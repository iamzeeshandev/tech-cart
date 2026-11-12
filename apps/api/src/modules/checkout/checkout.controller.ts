import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiHeader,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import type { User } from '../../generated/prisma/client.js';
import { CurrentUser } from '../user/current-user.decorator.js';
import { DemoUserGuard } from '../user/demo-user.guard.js';
import { CheckoutService } from './checkout.service.js';

const idempotencyKeySchema = z.uuid();

@ApiTags('checkout')
@ApiSecurity('demo-user')
@ApiUnauthorizedResponse({ description: 'Missing or unknown x-demo-user-id header' })
@UseGuards(DemoUserGuard)
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @ApiOperation({ summary: 'Create an order from the cart and reserve its stock' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'A new UUID per checkout attempt. Retrying with the same key returns the same order.',
  })
  @ApiBadRequestResponse({ description: 'Bad Idempotency-Key, empty cart, or total below $0.50' })
  @ApiConflictResponse({ description: 'Not enough stock, or a product is no longer available' })
  @Post()
  async checkout(
    @CurrentUser() user: User,
    @Headers('idempotency-key') rawKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = idempotencyKeySchema.safeParse(rawKey);
    if (!key.success) {
      throw new BadRequestException('Idempotency-Key header must be a UUID');
    }

    const { order, replayed } = await this.checkoutService.checkout(user.id, key.data);
    if (replayed) {
      // Same signal Stripe gives on its own idempotent replays.
      res.status(200).setHeader('Idempotent-Replayed', 'true');
    }
    return order;
  }
}
