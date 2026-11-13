import { Injectable, Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PaymentService } from '../payment/payment.service.js';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
  ) {}

  async receive(rawBody: Buffer, signature: string) {
    const event = this.paymentService.constructWebhookEvent(rawBody, signature);

    const existing = await this.prisma.stripeEvent.findUnique({
      where: { id: event.id },
      select: { status: true },
    });
    if (existing?.status === 'PROCESSED' || existing?.status === 'IGNORED') {
      return { received: true, status: 'DUPLICATE' };
    }

    await this.prisma.stripeEvent.upsert({
      where: { id: event.id },
      create: {
        id: event.id,
        type: event.type,
        apiVersion: event.api_version,
        livemode: event.livemode,
        payload: event as unknown as Prisma.InputJsonValue,
        stripeCreatedAt: new Date(event.created * 1000),
      },
      update: { status: 'PROCESSING', attempts: { increment: 1 }, lastError: null },
    });

    let handled: boolean;
    try {
      handled = await this.dispatch(event);
    } catch (error) {
      await this.prisma.stripeEvent.update({
        where: { id: event.id },
        data: { status: 'FAILED', lastError: String(error) },
      });
      this.logger.error(`${event.type} ${event.id} failed: ${String(error)}`);
      // A 500 makes Stripe deliver the event again later.
      throw error;
    }

    const status = handled ? 'PROCESSED' : 'IGNORED';
    await this.prisma.stripeEvent.update({
      where: { id: event.id },
      data: { status, processedAt: new Date() },
    });
    return { received: true, status };
  }

  private async dispatch(event: Stripe.Event): Promise<boolean> {
    switch (event.type) {
      default:
        return false;
    }
  }
}
