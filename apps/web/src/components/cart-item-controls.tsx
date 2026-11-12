"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cartRequest } from "@/lib/cart-client";

export function CartItemControls({ itemId, quantity }: { itemId: string; quantity: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  const button = "rounded border border-zinc-500/30 px-2 py-0.5 text-sm disabled:opacity-40";

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={button}
          disabled={pending || quantity <= 1}
          onClick={() => run("PATCH", { quantity: quantity - 1 })}
        >
          −
        </button>
        <span className="w-6 text-center tabular-nums">{quantity}</span>
        <button
          type="button"
          className={button}
          disabled={pending}
          onClick={() => run("PATCH", { quantity: quantity + 1 })}
        >
          +
        </button>
        <button
          type="button"
          className="ml-2 text-sm text-red-600 hover:underline disabled:opacity-40"
          disabled={pending}
          onClick={() => run("DELETE")}
        >
          Remove
        </button>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
