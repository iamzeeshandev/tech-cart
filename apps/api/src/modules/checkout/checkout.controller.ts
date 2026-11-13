import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiSecurity,
  ApiServiceUnavailableResponse,
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

  @ApiOperation({
    summary: 'Create an order from the cart, reserve its stock and start a Stripe Checkout Session',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'A new UUID per checkout attempt. Retrying with the same key returns the same order.',
  })
  @ApiBadRequestResponse({ description: 'Bad Idempotency-Key, empty cart, or total below $0.50' })
  @ApiConflictResponse({ description: 'Not enough stock, or a product is no longer available' })
  @ApiBadGatewayResponse({ description: 'Stripe rejected the session; the order is cancelled' })
  @ApiServiceUnavailableResponse({
    description: 'Stripe unreachable; the order is kept, retry with the same Idempotency-Key',
  })
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

    const { order, replayed } = await this.checkoutService.checkout(user, key.data);
    if (replayed) {
      res.status(200).setHeader('Idempotent-Replayed', 'true');
    }
    return order;
  }

  @ApiOperation({ summary: 'Order behind a Checkout Session (for the success page)' })
  @ApiNotFoundResponse({ description: 'No order with this session for this user' })
  @Get('sessions/:sessionId')
  getBySession(@CurrentUser() user: User, @Param('sessionId') sessionId: string) {
    return this.checkoutService.getBySession(user.id, sessionId);
  }
}
