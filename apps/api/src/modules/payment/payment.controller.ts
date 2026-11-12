import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service.js';

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

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
  health() {
    return this.paymentService.checkStripe();
  }
}
