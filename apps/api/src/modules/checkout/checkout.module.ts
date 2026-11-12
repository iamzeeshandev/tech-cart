import { Module } from '@nestjs/common';
import { OrderModule } from '../order/order.module.js';
import { UserModule } from '../user/user.module.js';
import { CheckoutController } from './checkout.controller.js';
import { CheckoutService } from './checkout.service.js';

@Module({
  imports: [UserModule, OrderModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
