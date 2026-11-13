import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OrderStatus, PaymentStatus, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

// Stripe needs a session's expires_at to be >= 30 min after creation; the extra 5 min
// leaves room to retry session creation with the same persisted expires_at.
export const CHECKOUT_TTL_MS = 35 * 60 * 1000;
// Stripe's minimum charge for USD.
const MIN_ORDER_AMOUNT = 50;
const CURRENCY = 'usd';

// Fixed item order: a retried Stripe request must send identical line_items.
const orderInclude = { items: { orderBy: { productId: 'asc' } }, payments: true } as const;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function toOrderResponse(
  order: OrderWithRelations,
  checkoutUrl = order.payments.at(0)?.checkoutUrl ?? null,
) {
  const payment = order.payments.at(0);
  return {
    orderId: order.id,
    status: order.status,
    totalAmount: order.totalAmount,
    currency: order.currency,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    reservationExpiresAt: order.reservationExpiresAt,
    checkoutUrl,
    payment: payment
      ? {
          status: payment.status,
          stripePaymentIntentId: payment.stripePaymentIntentId,
          lastFailureCode: payment.lastFailureCode,
          lastFailureMessage: payment.lastFailureMessage,
        }
      : null,
    items: order.items.map(({ productName, unitAmount, quantity }) => ({
      productName,
      unitAmount,
      quantity,
    })),
  };
}

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  findByIdempotencyKey(userId: string, idempotencyKey: string) {
    return this.prisma.order.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: orderInclude,
    });
  }

  listForUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Webhook events whose object carried this order's id in its metadata: the session's,
  // and the PaymentIntent's and Charge's (copied there through payment_intent_data).
  findStripeEvents(orderId: string) {
    return this.prisma.stripeEvent.findMany({
      where: { payload: { path: ['data', 'object', 'metadata', 'orderId'], equals: orderId } },
      select: { id: true, type: true, status: true, stripeCreatedAt: true },
      orderBy: [{ stripeCreatedAt: 'asc' }, { receivedAt: 'asc' }],
    });
  }

  async getForUser(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId, userId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async getByCheckoutSession(sessionId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { userId, payments: { some: { stripeCheckoutSessionId: sessionId } } },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // One transaction: if any step throws, every stock reservation in it is rolled back.
  createFromCart(userId: string, idempotencyKey: string) {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cartItem.findMany({
        where: { userId },
        include: {
          product: { select: { name: true, priceAmount: true, currency: true, isActive: true } },
        },
        // Same lock order in every transaction, so two checkouts can't deadlock on Inventory rows.
        orderBy: { productId: 'asc' },
      });
      if (cart.length === 0) {
        throw new BadRequestException('Cart is empty');
      }
      for (const { product } of cart) {
        if (!product.isActive || product.currency !== CURRENCY) {
          throw new ConflictException(`${product.name} is no longer available`);
        }
      }

      const totalAmount = cart.reduce((sum, i) => sum + i.product.priceAmount * i.quantity, 0);
      if (totalAmount < MIN_ORDER_AMOUNT) {
        throw new BadRequestException('Order total must be at least $0.50 (Stripe minimum charge)');
      }

      // Insert before reserving: a concurrent request with the same key waits on the unique
      // index here and fails with P2002 without touching stock.
      const order = await tx.order.create({
        data: {
          userId,
          idempotencyKey,
          currency: CURRENCY,
          totalAmount,
          reservationExpiresAt: new Date(Date.now() + CHECKOUT_TTL_MS),
          items: {
            create: cart.map((item) => ({
              productId: item.productId,
              productName: item.product.name,
              unitAmount: item.product.priceAmount,
              quantity: item.quantity,
            })),
          },
          payments: { create: { amount: totalAmount, currency: CURRENCY } },
        },
        include: orderInclude,
      });

      for (const item of cart) {
        const { count } = await tx.inventory.updateMany({
          where: { productId: item.productId, quantityAvailable: { gte: item.quantity } },
          data: {
            quantityAvailable: { decrement: item.quantity },
            quantityReserved: { increment: item.quantity },
          },
        });
        if (count === 0) {
          throw new ConflictException(`Not enough stock for ${item.product.name}`);
        }
      }

      return order;
    });
  }

  attachCheckoutSession(paymentId: string, sessionId: string, checkoutUrl: string | null) {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { stripeCheckoutSessionId: sessionId, checkoutUrl },
    });
  }

  findPaymentBySession(sessionId: string) {
    return this.prisma.payment.findUnique({ where: { stripeCheckoutSessionId: sessionId } });
  }

  // Every transition below starts with a guarded UPDATE (WHERE status IN ...). When the same
  // event is handled twice at once, the second UPDATE waits for the first to commit, then
  // matches 0 rows and changes nothing.
  markPaid(paymentId: string, paymentIntentId: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.payment.updateMany({
        where: { id: paymentId, status: { in: ['PENDING', 'PROCESSING'] } },
        data: { status: 'SUCCEEDED', stripePaymentIntentId: paymentIntentId },
      });
      if (count === 0) return false;

      const { orderId } = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      const moved = await tx.order.updateMany({
        where: { id: orderId, status: { in: ['PENDING_PAYMENT', 'PAYMENT_PROCESSING'] } },
        data: { status: 'PAID', paidAt: new Date() },
      });
      if (moved.count === 0) {
        // Stripe took the money for an order we already closed: needs a human and a refund.
        throw new Error(`Order ${orderId} was paid but is no longer awaiting payment`);
      }

      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: { orderBy: { productId: 'asc' } } },
      });
      for (const item of order.items) {
        await tx.inventory.update({
          where: { productId: item.productId },
          data: { quantityReserved: { decrement: item.quantity } },
        });
        // Remove only what was bought: items added to the cart while paying stay.
        await tx.cartItem.deleteMany({
          where: { userId: order.userId, productId: item.productId, quantity: { lte: item.quantity } },
        });
        await tx.cartItem.updateMany({
          where: { userId: order.userId, productId: item.productId },
          data: { quantity: { decrement: item.quantity } },
        });
      }
      return true;
    });
  }

  // Delayed payment methods (e.g. bank debits): Checkout is done but the money isn't yet.
  markProcessing(paymentId: string, paymentIntentId: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.payment.updateMany({
        where: { id: paymentId, status: 'PENDING' },
        data: { status: 'PROCESSING', stripePaymentIntentId: paymentIntentId },
      });
      if (count === 0) return false;

      const { orderId } = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      await tx.order.updateMany({
        where: { id: orderId, status: 'PENDING_PAYMENT' },
        data: { status: 'PAYMENT_PROCESSING' },
      });
      return true;
    });
  }

  recordPaymentFailure(
    paymentId: string,
    paymentIntentId: string,
    code: string | null,
    message: string | null,
  ) {
    return this.prisma.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: { stripePaymentIntentId: paymentIntentId, lastFailureCode: code, lastFailureMessage: message },
    });
  }

  cancelPending(orderId: string) {
    return this.release(orderId, ['PENDING_PAYMENT'], 'CANCELLED', 'FAILED');
  }

  expire(orderId: string) {
    return this.release(orderId, ['PENDING_PAYMENT'], 'EXPIRED', 'EXPIRED');
  }

  failAsyncPayment(orderId: string) {
    return this.release(orderId, ['PENDING_PAYMENT', 'PAYMENT_PROCESSING'], 'PAYMENT_FAILED', 'FAILED');
  }

  private release(orderId: string, from: OrderStatus[], to: OrderStatus, paymentTo: PaymentStatus) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: { in: from } },
        data: { status: to },
      });
      if (count === 0) return false;

      const items = await tx.orderItem.findMany({ where: { orderId }, orderBy: { productId: 'asc' } });
      for (const item of items) {
        await tx.inventory.update({
          where: { productId: item.productId },
          data: {
            quantityAvailable: { increment: item.quantity },
            quantityReserved: { decrement: item.quantity },
          },
        });
      }
      await tx.payment.updateMany({
        where: { orderId, status: { in: ['PENDING', 'PROCESSING'] } },
        data: { status: paymentTo },
      });
      return true;
    });
  }
}
