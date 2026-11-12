import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from './stripe.client.js';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(@Inject(STRIPE_CLIENT) private readonly stripe: Stripe) {}

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
      if (err instanceof Stripe.errors.StripeError) {
        this.logger.error(`${err.type} ${err.requestId ?? ''}: ${err.message}`);
      }
      throw new ServiceUnavailableException({ stripe: 'unreachable' });
    }
  }
}
