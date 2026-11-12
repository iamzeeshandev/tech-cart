import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export const MAX_QUANTITY_PER_ITEM = 10;

const cartItemSelect = {
  id: true,
  quantity: true,
  product: {
    select: {
      id: true,
      slug: true,
      name: true,
      imageUrl: true,
      priceAmount: true,
      currency: true,
      inventory: { select: { quantityAvailable: true } },
    },
  },
} satisfies Prisma.CartItemSelect;

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    const rows = await this.prisma.cartItem.findMany({
      where: { userId },
      select: cartItemSelect,
      orderBy: { createdAt: 'asc' },
    });
    const items = rows.map((row) => ({
      ...row,
      lineTotal: row.product.priceAmount * row.quantity,
    }));
    return {
      items,
      // Display estimate from current DB prices. Checkout recomputes it and never reads this.
      subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
      currency: 'usd',
    };
  }

  async addItem(userId: string, productId: string, quantity: number) {
    const key = { userId_productId: { userId, productId } };
    const existing = await this.prisma.cartItem.findUnique({ where: key });
    const newQuantity = (existing?.quantity ?? 0) + quantity;
    await this.assertCanHold(productId, newQuantity);

    await this.prisma.cartItem.upsert({
      where: key,
      create: { userId, productId, quantity: newQuantity },
      update: { quantity: newQuantity },
    });
    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, quantity: number) {
    const item = await this.findOwnItem(userId, itemId);
    await this.assertCanHold(item.productId, quantity);

    await this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const item = await this.findOwnItem(userId, itemId);
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.getCart(userId);
  }

  // Matching on userId too means another user's item id is simply "not found".
  private async findOwnItem(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({ where: { id: itemId, userId } });
    if (!item) {
      throw new NotFoundException('Cart item not found');
    }
    return item;
  }

  // Early feedback only. Stock can change after this, so checkout re-checks and reserves it.
  private async assertCanHold(productId: string, quantity: number) {
    if (quantity > MAX_QUANTITY_PER_ITEM) {
      throw new ConflictException(`At most ${MAX_QUANTITY_PER_ITEM} of one product per cart`);
    }
    const product = await this.prisma.product.findUnique({
      where: { id: productId, isActive: true },
      select: { inventory: { select: { quantityAvailable: true } } },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const available = product.inventory?.quantityAvailable ?? 0;
    if (quantity > available) {
      throw new ConflictException(
        available === 0 ? 'Out of stock' : `Only ${available} in stock`,
      );
    }
  }
}
