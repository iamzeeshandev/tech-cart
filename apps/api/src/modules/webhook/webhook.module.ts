import { Module } from '@nestjs/common';
import { CheckoutModule } from '../checkout/checkout.module.js';
import { OrderModule } from '../order/order.module.js';
import { PaymentModule } from '../payment/payment.module.js';
import { WebhookController } from './webhook.controller.js';
import { WebhookService } from './webhook.service.js';

@Module({
  imports: [PaymentModule, CheckoutModule, OrderModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
