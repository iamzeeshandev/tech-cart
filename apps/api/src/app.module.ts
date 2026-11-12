import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.js';
import { HealthModule } from './modules/health/health.module.js';
import { PaymentModule } from './modules/payment/payment.module.js';
import { ProductModule } from './modules/product/product.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    HealthModule,
    ProductModule,
    PaymentModule,
  ],
})
export class AppModule {}
