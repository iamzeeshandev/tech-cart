"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cartRequest } from "@/lib/cart-client";

const stepper =
  "inline-flex size-11 items-center justify-center rounded-control border border-rule text-body hover:border-ink disabled:text-muted disabled:hover:border-rule";

export function CartItemControls({ itemId, quantity }: { itemId: string; quantity: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [initialQuantity] = useState(quantity);

  function run(method: "PATCH" | "DELETE", body?: { quantity: number }) {
    setError(null);
    startTransition(async () => {
      try {
        await cartRequest(method, `/items/${itemId}`, body);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Decrease quantity"
          className={stepper}
          disabled={pending || quantity <= 1}
          onClick={() => run("PATCH", { quantity: quantity - 1 })}
        >
          −
        </button>
        <span className="min-w-8 text-center font-medium" aria-live="polite">
          <span key={quantity} className={quantity !== initialQuantity ? "tick" : ""}>
            {quantity}
          </span>
        </span>
        <button
          type="button"
          aria-label="Increase quantity"
          className={stepper}
          disabled={pending}
          onClick={() => run("PATCH", { quantity: quantity + 1 })}
        >
          +
        </button>
        <button
          type="button"
          className="ml-2 inline-flex min-h-11 items-center rounded-control px-2 text-ui text-muted underline underline-offset-2 hover:text-danger disabled:opacity-50"
          disabled={pending}
          onClick={() => run("DELETE")}
        >
          Remove
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-ui text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
