"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cartRequest } from "@/lib/cart-client";

export function AddToCartButton({ productId, disabled }: { productId: string; disabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function add() {
    startTransition(async () => {
      try {
        await cartRequest("POST", "/items", { productId, quantity: 1 });
        setResult({ ok: true, message: "Added to cart." });
        router.refresh();
      } catch (error) {
        setResult({ ok: false, message: (error as Error).message });
      }
    });
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={add}
        disabled={disabled || pending}
        className="min-h-11 w-full rounded-control bg-pine px-6 text-ui font-medium text-paper hover:bg-pine-deep disabled:bg-well disabled:text-muted sm:w-auto"
      >
        {pending ? "Adding…" : "Add to cart"}
      </button>
      <p role="status" className={`mt-3 min-h-6 text-ui ${result?.ok === false ? "text-danger" : ""}`}>
        {result?.message}{" "}
        {result?.ok && (
          <Link href="/cart" className="font-medium text-pine underline underline-offset-2">
            View cart
          </Link>
        )}
      </p>
    </div>
  );
}
