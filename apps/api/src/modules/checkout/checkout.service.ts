import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, type User } from '../../generated/prisma/client.js';
import {
  OrderService,
  type OrderWithRelations,
  toOrderResponse,
} from '../order/order.service.js';
import { isPermanentStripeError, PaymentService } from '../payment/payment.service.js';
import { UserService } from '../user/user.service.js';

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
    return { order: toOrderResponse(order, checkoutUrl), replayed };
  }

  // Success page: the same fulfillment as the webhook, so a customer who lands here sees PAID
  // even if the webhook is late. The webhook stays the guarantee for customers who never land.
  async getBySession(userId: string, sessionId: string) {
    const order = await this.orderService.getByCheckoutSession(sessionId, userId);
    if (order.status === 'PENDING_PAYMENT' || order.status === 'PAYMENT_PROCESSING') {
      try {
        await this.fulfillCheckoutSession(sessionId);
      } catch (error) {
        this.logger.warn(`Fulfillment from the success page failed: ${String(error)}`);
      }
    }
    return toOrderResponse(await this.orderService.getByCheckoutSession(sessionId, userId));
  }

  // Safe to call any number of times, even concurrently, for one session. Returns false when
  // the session isn't ours (e.g. created by `stripe trigger`).
  async fulfillCheckoutSession(sessionId: string) {
    const payment = await this.orderService.findPaymentBySession(sessionId);
    if (!payment) return false;
    if (payment.status === 'SUCCEEDED') return true;

    // Fetch the current state instead of trusting the event's snapshot, which may be stale.
    const session = await this.paymentService.retrieveCheckoutSession(sessionId);
    if (session.amount_total !== payment.amount || session.currency !== payment.currency) {
      throw new Error(
        `Session ${sessionId} totals ${session.amount_total} ${session.currency}, payment ${payment.id} expects ${payment.amount} ${payment.currency}`,
      );
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null);
    if (session.payment_status === 'paid') {
      await this.orderService.markPaid(payment.id, paymentIntentId);
    } else if (session.status === 'complete') {
      await this.orderService.markProcessing(payment.id, paymentIntentId);
    }
    return true;
  }

  async expireCheckoutSession(sessionId: string) {
    const payment = await this.orderService.findPaymentBySession(sessionId);
    if (!payment) return false;
    await this.orderService.expire(payment.orderId);
    return true;
  }

  async failCheckoutSession(sessionId: string) {
    const payment = await this.orderService.findPaymentBySession(sessionId);
    if (!payment) return false;
    await this.orderService.failAsyncPayment(payment.orderId);
    return true;
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
