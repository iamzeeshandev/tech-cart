import {
  Controller,
  Get,
  Inject,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import Stripe from 'stripe';
import { STRIPE_CLIENT } from './stripe.client.js';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(@Inject(STRIPE_CLIENT) private readonly stripe: Stripe) {}

  @ApiOperation({ summary: 'Stripe connectivity check (calls GET /v1/balance)' })
  @ApiOkResponse({
    schema: {
      example: {
        stripe: 'reachable',
        livemode: false,
        apiVersion: '2026-10-28.endive',
        requestId: 'req_123',
      },
    },
  })
  @ApiServiceUnavailableResponse({ description: 'Bad key or Stripe unreachable' })
  @Get('health')
  async health() {
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
