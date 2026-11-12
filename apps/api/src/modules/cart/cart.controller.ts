import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { z } from 'zod';
import type { User } from '../../generated/prisma/client.js';
import { CurrentUser } from '../user/current-user.decorator.js';
import { DemoUserGuard } from '../user/demo-user.guard.js';
import { CartService, MAX_QUANTITY_PER_ITEM } from './cart.service.js';

// No price field: unknown keys (e.g. a tampered "priceAmount") are stripped by zod.
const addItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.int().min(1).max(MAX_QUANTITY_PER_ITEM).default(1),
});
const updateItemSchema = z.object({
  quantity: z.int().min(1).max(MAX_QUANTITY_PER_ITEM),
});

@ApiTags('cart')
@ApiSecurity('demo-user')
@ApiUnauthorizedResponse({ description: 'Missing or unknown x-demo-user-id header' })
@UseGuards(DemoUserGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @ApiOperation({ summary: "Current user's cart (subtotal is a display estimate)" })
  @Get()
  getCart(@CurrentUser() user: User) {
    return this.cartService.getCart(user.id);
  }

  @ApiOperation({ summary: 'Add a product (adds to the existing quantity)' })
  @ApiNotFoundResponse({ description: 'Product not found or inactive' })
  @ApiConflictResponse({ description: 'Not enough stock, or over the per-product limit' })
  @Post('items')
  addItem(
    @CurrentUser() user: User,
    @Body({ schema: addItemSchema }) body: z.output<typeof addItemSchema>,
  ) {
    return this.cartService.addItem(user.id, body.productId, body.quantity);
  }

  @ApiOperation({ summary: 'Set the quantity of a cart item' })
  @ApiNotFoundResponse({ description: "Cart item not found (or not this user's)" })
  @ApiConflictResponse({ description: 'Not enough stock, or over the per-product limit' })
  @Patch('items/:itemId')
  updateItem(
    @CurrentUser() user: User,
    @Param('itemId') itemId: string,
    @Body({ schema: updateItemSchema }) body: z.output<typeof updateItemSchema>,
  ) {
    return this.cartService.updateItem(user.id, itemId, body.quantity);
  }

  @ApiOperation({ summary: 'Remove a cart item' })
  @ApiNotFoundResponse({ description: "Cart item not found (or not this user's)" })
  @Delete('items/:itemId')
  removeItem(@CurrentUser() user: User, @Param('itemId') itemId: string) {
    return this.cartService.removeItem(user.id, itemId);
  }
}
