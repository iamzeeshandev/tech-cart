import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { OrderService } from '../order/order.service.js';

type OrderWithRelations = NonNullable<Awaited<ReturnType<OrderService['findByIdempotencyKey']>>>;

@Injectable()
export class CheckoutService {
  constructor(private readonly orderService: OrderService) {}

  async checkout(userId: string, idempotencyKey: string) {
    const existing = await this.orderService.findByIdempotencyKey(userId, idempotencyKey);
    if (existing) {
      return { order: toResponse(existing), replayed: true };
    }

    try {
      const order = await this.orderService.createFromCart(userId, idempotencyKey);
      return { order: toResponse(order), replayed: false };
    } catch (error) {
      // Two requests with the same key at the same moment: the loser fails on the unique index
      // and returns the winner's order.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.orderService.findByIdempotencyKey(userId, idempotencyKey);
        if (winner) return { order: toResponse(winner), replayed: true };
      }
      throw error;
    }
  }
}

function toResponse(order: OrderWithRelations) {
  return {
    orderId: order.id,
    status: order.status,
    totalAmount: order.totalAmount,
    currency: order.currency,
    reservationExpiresAt: order.reservationExpiresAt,
    items: order.items.map(({ productName, unitAmount, quantity }) => ({
      productName,
      unitAmount,
      quantity,
    })),
  };
}
