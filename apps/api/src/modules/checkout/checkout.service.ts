import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, type User } from '../../generated/prisma/client.js';
import { OrderService } from '../order/order.service.js';
import { isPermanentStripeError, PaymentService } from '../payment/payment.service.js';
import { UserService } from '../user/user.service.js';

type OrderWithRelations = NonNullable<Awaited<ReturnType<OrderService['findByIdempotencyKey']>>>;

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
    private readonly userService: UserService,
  ) {}

  async checkout(user: User, idempotencyKey: string) {
    const { order, replayed } = await this.findOrCreateOrder(user.id, idempotencyKey);
    const [payment] = order.payments;

    let checkoutUrl = payment.checkoutUrl;
    if (order.status === 'PENDING_PAYMENT' && !payment.stripeCheckoutSessionId) {
      checkoutUrl = await this.startCheckoutSession(user, order, payment.id);
    }
    return { order: toResponse(order, checkoutUrl), replayed };
  }

  private async findOrCreateOrder(userId: string, idempotencyKey: string) {
    const existing = await this.orderService.findByIdempotencyKey(userId, idempotencyKey);
    if (existing) {
      return { order: existing, replayed: true };
    }

    try {
      const order = await this.orderService.createFromCart(userId, idempotencyKey);
      return { order, replayed: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.orderService.findByIdempotencyKey(userId, idempotencyKey);
        if (winner) return { order: winner, replayed: true };
      }
      throw error;
    }
  }

  private async startCheckoutSession(user: User, order: OrderWithRelations, paymentId: string) {
    try {
      const customerId = await this.ensureStripeCustomer(user);
      const session = await this.paymentService.createCheckoutSession(order, paymentId, customerId);
      await this.orderService.attachCheckoutSession(paymentId, session.id, session.url);
      return session.url;
    } catch (error) {
      if (isPermanentStripeError(error)) {
        await this.orderService.cancelPending(order.id);
        throw new BadGatewayException('Payment could not be started. Please try again.');
      }
      // Unknown outcome (timeout, Stripe 5xx, DB error): keep the order and its stock.
      this.logger.error(`Checkout Session for order ${order.id} failed: ${String(error)}`);
      throw new ServiceUnavailableException(
        'Payment provider unavailable. Retry with the same Idempotency-Key.',
      );
    }
  }

  private async ensureStripeCustomer(user: User) {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }
    const customerId = await this.paymentService.createCustomer(user);
    await this.userService.saveStripeCustomerId(user.id, customerId);
    return customerId;
  }
}

function toResponse(order: OrderWithRelations, checkoutUrl: string | null) {
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
