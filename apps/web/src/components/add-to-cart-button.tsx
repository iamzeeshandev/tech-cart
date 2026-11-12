"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cartRequest } from "@/lib/cart-client";

export function AddToCartButton({ productId, disabled }: { productId: string; disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function add() {
    startTransition(async () => {
      try {
        await cartRequest("POST", "/items", { productId, quantity: 1 });
        setResult({ ok: true, message: "Added to cart." });
      } catch (error) {
        setResult({ ok: false, message: (error as Error).message });
      }
    });
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={add}
        disabled={disabled || pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Adding…" : "Add to cart"}
      </button>
      {result && (
        <p className={`mt-2 text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}>
          {result.message}{" "}
          {result.ok && (
            <Link href="/cart" className="underline">
              View cart
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
