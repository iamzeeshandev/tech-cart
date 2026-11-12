import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module.js';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';

@Module({
  imports: [UserModule],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
