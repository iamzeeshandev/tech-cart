import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { Env } from '../config/env.js';

export const STRIPE_CLIENT = Symbol('STRIPE_CLIENT');

export const stripeClientProvider: Provider = {
  provide: STRIPE_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) =>
    new Stripe(config.get('STRIPE_SECRET_KEY', { infer: true }), {
      apiVersion: '2026-10-28.endive',
      maxNetworkRetries: 2,
      timeout: 20_000,
      appInfo: { name: 'TechCart' },
    }),
};
