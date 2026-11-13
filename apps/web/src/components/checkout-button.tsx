"use client";

import { useRef, useState } from "react";
import { ApiError, startCheckout } from "@/lib/cart-client";

const labels = {
  idle: "Checkout",
  starting: "Starting checkout…",
  redirecting: "Redirecting to Stripe…",
};

export function CheckoutButton() {
  const [state, setState] = useState<keyof typeof labels>("idle");
  const [error, setError] = useState<string | null>(null);
  const attemptKey = useRef<string | null>(null);

  async function checkout() {
    setError(null);
    setState("starting");
    attemptKey.current ??= crypto.randomUUID();
    try {
      const { checkoutUrl } = await startCheckout(attemptKey.current);
      attemptKey.current = null;
      if (!checkoutUrl) throw new Error("Payment could not be started. Please try again.");
      setState("redirecting");
      window.location.assign(checkoutUrl);
    } catch (e) {
      if (e instanceof ApiError && e.status !== 503) attemptKey.current = null;
      setError((e as Error).message);
      setState("idle");
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={checkout}
        disabled={state !== "idle"}
        className="rounded bg-zinc-900 px-6 py-2 text-sm text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {labels[state]}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
