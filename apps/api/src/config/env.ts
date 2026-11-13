import { z } from 'zod';

// Every setting the API needs. If one is missing or malformed, the API
// refuses to start, instead of failing later in the middle of a payment.
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // Sandbox keys only: a live key pasted by mistake must never charge real cards here.
  STRIPE_SECRET_KEY: z
    .string()
    .regex(/^(sk|rk)_test_\w+$/, 'must be a sandbox key (sk_test_... or rk_test_...)'),
  // Where Stripe Checkout sends the customer back (success_url / cancel_url).
  WEB_URL: z.url().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

// Called by ConfigModule at startup with the merged process.env + .env values.
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
