import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

// Stripe needs a session's expires_at to be >= 30 min after creation; the extra 5 min
// leaves room to retry session creation with the same persisted expires_at.
export const CHECKOUT_TTL_MS = 35 * 60 * 1000;
// Stripe's minimum charge for USD.
const MIN_ORDER_AMOUNT = 50;
const CURRENCY = 'usd';

const orderInclude = { items: true, payments: true } as const;

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  findByIdempotencyKey(userId: string, idempotencyKey: string) {
    return this.prisma.order.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: orderInclude,
    });
  }

  // One transaction: if any step throws, every stock reservation in it is rolled back.
  createFromCart(userId: string, idempotencyKey: string) {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cartItem.findMany({
        where: { userId },
        include: {
          product: { select: { name: true, priceAmount: true, currency: true, isActive: true } },
        },
        // Same lock order in every transaction, so two checkouts can't deadlock on Inventory rows.
        orderBy: { productId: 'asc' },
      });
      if (cart.length === 0) {
        throw new BadRequestException('Cart is empty');
      }
      for (const { product } of cart) {
        if (!product.isActive || product.currency !== CURRENCY) {
          throw new ConflictException(`${product.name} is no longer available`);
        }
      }

      const totalAmount = cart.reduce((sum, i) => sum + i.product.priceAmount * i.quantity, 0);
      if (totalAmount < MIN_ORDER_AMOUNT) {
        throw new BadRequestException('Order total must be at least $0.50 (Stripe minimum charge)');
      }

      // Insert before reserving: a concurrent request with the same key waits on the unique
      // index here and fails with P2002 without touching stock.
      const order = await tx.order.create({
        data: {
          userId,
          idempotencyKey,
          currency: CURRENCY,
          totalAmount,
          reservationExpiresAt: new Date(Date.now() + CHECKOUT_TTL_MS),
          items: {
            create: cart.map((item) => ({
              productId: item.productId,
              productName: item.product.name,
              unitAmount: item.product.priceAmount,
              quantity: item.quantity,
            })),
          },
          payments: { create: { amount: totalAmount, currency: CURRENCY } },
        },
        include: orderInclude,
      });

      for (const item of cart) {
        // Check and decrement in one statement: concurrent checkouts can't both take the last unit.
        const { count } = await tx.inventory.updateMany({
          where: { productId: item.productId, quantityAvailable: { gte: item.quantity } },
          data: {
            quantityAvailable: { decrement: item.quantity },
            quantityReserved: { increment: item.quantity },
          },
        });
        if (count === 0) {
          throw new ConflictException(`Not enough stock for ${item.product.name}`);
        }
      }

      return order;
    });
  }
}
