import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller.js';
import { PaymentService } from './payment.service.js';
import { stripeClientProvider } from './stripe.client.js';

@Module({
  controllers: [PaymentController],
  providers: [stripeClientProvider, PaymentService],
})
export class PaymentModule {}
