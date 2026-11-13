import Image from "next/image";
import Link from "next/link";
import { CartItemControls } from "@/components/cart-item-controls";
import { CheckoutButton } from "@/components/checkout-button";
import { getCart, getCurrentUserId } from "@/lib/api";
import { formatMoney } from "@/lib/money";

export default async function CartPage() {
  const userId = await getCurrentUserId();
  const cart = userId ? await getCart(userId) : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Cart</h1>

      {!cart && <p className="mt-4 text-zinc-500">Choose a demo user (top right) to see their cart.</p>}

      {cart?.items.length === 0 && (
        <p className="mt-4 text-zinc-500">
          Your cart is empty.{" "}
          <Link href="/" className="underline">
            Browse products
          </Link>
        </p>
      )}

      {cart && cart.items.length > 0 && (
        <>
          <ul className="mt-6 divide-y divide-zinc-500/30 border-y border-zinc-500/30">
            {cart.items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 py-4">
                {item.product.imageUrl && (
                  <Image
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    width={96}
                    height={64}
                    className="rounded"
                  />
                )}
                <div className="flex-1">
                  <Link href={`/products/${item.product.slug}`} className="font-medium hover:underline">
                    {item.product.name}
                  </Link>
                  <p className="text-sm text-zinc-500">
                    {formatMoney(item.product.priceAmount, item.product.currency)} each
                  </p>
                  <div className="mt-2">
                    <CartItemControls itemId={item.id} quantity={item.quantity} />
                  </div>
                </div>
                <p className="tabular-nums">{formatMoney(item.lineTotal, item.product.currency)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 text-right">
            <p className="text-lg">
              Subtotal: <span className="font-semibold">{formatMoney(cart.subtotal, cart.currency)}</span>
            </p>
            <p className="text-xs text-zinc-500">Estimate. The server recalculates the total at checkout.</p>
            <CheckoutButton />
          </div>
        </>
      )}
    </main>
  );
}
