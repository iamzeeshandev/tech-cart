import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { Env } from '../../config/env.js';
import { STRIPE_CLIENT } from './stripe.client.js';

type CheckoutOrder = {
  id: string;
  currency: string;
  reservationExpiresAt: Date;
  items: { productName: string; unitAmount: number; quantity: number }[];
};

export function isPermanentStripeError(error: unknown): boolean {
  if (!(error instanceof Stripe.errors.StripeError) || error.statusCode === undefined) {
    return false;
  }
  const status = error.statusCode;
  return status >= 400 && status < 500 && status !== 409 && status !== 429;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly webUrl: string;

  constructor(
    @Inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    config: ConfigService<Env, true>,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true });
  }

  async checkStripe() {
    try {
      const balance = await this.stripe.balance.retrieve();
      return {
        stripe: 'reachable',
        livemode: balance.livemode,
        apiVersion: balance.lastResponse.apiVersion,
        requestId: balance.lastResponse.requestId,
      };
    } catch (err) {
      this.logStripeError(err);
      throw new ServiceUnavailableException({ stripe: 'unreachable' });
    }
  }

  async createCustomer(user: { id: string; email: string; name: string }) {
    try {
      const customer = await this.stripe.customers.create(
        { email: user.email, name: user.name, metadata: { userId: user.id } },
        { idempotencyKey: `customer:${user.id}` },
      );
      return customer.id;
    } catch (err) {
      this.logStripeError(err);
      throw err;
    }
  }

  async createCheckoutSession(order: CheckoutOrder, paymentId: string, customerId: string) {
    const metadata = { orderId: order.id, paymentId };
    try {
      return await this.stripe.checkout.sessions.create(
        {
          mode: 'payment',
          customer: customerId,
          client_reference_id: order.id,
          line_items: order.items.map((item) => ({
            quantity: item.quantity,
            price_data: {
              currency: order.currency,
              unit_amount: item.unitAmount,
              product_data: { name: item.productName },
            },
          })),
          metadata,
          payment_intent_data: { metadata },
          expires_at: Math.floor(order.reservationExpiresAt.getTime() / 1000),
          success_url: `${this.webUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${this.webUrl}/checkout/cancel?order_id=${order.id}`,
        },
        // Every param comes from saved rows, so a retry sends an identical request and
        // Stripe returns the session it already created.
        { idempotencyKey: `checkout-session:${paymentId}` },
      );
    } catch (err) {
      this.logStripeError(err);
      throw err;
    }
  }

  private logStripeError(err: unknown) {
    if (err instanceof Stripe.errors.StripeError) {
      this.logger.error(`${err.type} ${err.requestId ?? ''}: ${err.message}`);
    }
  }
}
