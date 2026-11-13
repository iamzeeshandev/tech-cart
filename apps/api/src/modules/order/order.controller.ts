import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { User } from '../../generated/prisma/client.js';
import { CurrentUser } from '../user/current-user.decorator.js';
import { DemoUserGuard } from '../user/demo-user.guard.js';
import { OrderService, toOrderResponse } from './order.service.js';

@ApiTags('orders')
@ApiSecurity('demo-user')
@ApiUnauthorizedResponse({ description: 'Missing or unknown x-demo-user-id header' })
@UseGuards(DemoUserGuard)
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @ApiOperation({ summary: "Get one of the current user's orders" })
  @ApiNotFoundResponse({ description: 'No such order for this user' })
  @Get(':orderId')
  async findOne(@CurrentUser() user: User, @Param('orderId') orderId: string) {
    return toOrderResponse(await this.orderService.getForUser(orderId, user.id));
  }
}
