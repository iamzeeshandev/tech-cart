"use client";

import { useRef, useState } from "react";
import { ApiError, startCheckout } from "@/lib/cart-client";

const labels = {
  idle: "Go to checkout",
  starting: "Starting checkout…",
  redirecting: "Opening payment page…",
};

export function CheckoutButton({ className = "" }: { className?: string }) {
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
    <div className={className}>
      {error && (
        <p role="alert" className="mb-2 text-ui text-danger">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={checkout}
        disabled={state !== "idle"}
        className="min-h-11 w-full rounded-control bg-pine px-6 text-ui font-medium text-paper hover:bg-pine-deep disabled:bg-well disabled:text-muted"
      >
        {labels[state]}
      </button>
    </div>
  );
}
