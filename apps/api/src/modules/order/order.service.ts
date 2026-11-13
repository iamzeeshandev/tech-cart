import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
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
  return {
    orderId: order.id,
    status: order.status,
    totalAmount: order.totalAmount,
    currency: order.currency,
    reservationExpiresAt: order.reservationExpiresAt,
    checkoutUrl,
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

  cancelPending(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Guarded transition: stock is released once, and never for an order that moved on.
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: 'PENDING_PAYMENT' },
        data: { status: 'CANCELLED' },
      });
      if (count === 0) return;

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
        where: { orderId, status: 'PENDING' },
        data: { status: 'FAILED' },
      });
    });
  }
}
