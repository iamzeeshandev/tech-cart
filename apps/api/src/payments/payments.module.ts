import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { stripeClientProvider } from './stripe.client.js';

@Module({
  controllers: [PaymentsController],
  providers: [stripeClientProvider],
})
export class PaymentsModule {}
