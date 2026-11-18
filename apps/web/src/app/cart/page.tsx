import type { Metadata } from "next";
import Link from "next/link";
import { CartItemControls } from "@/components/cart-item-controls";
import { CheckoutButton } from "@/components/checkout-button";
import { Ledger, LedgerRow } from "@/components/ledger";
import { Page } from "@/components/page";
import { ProductImage } from "@/components/product-image";
import { primaryAction } from "@/components/ui";
import { getCart, getCurrentUserId } from "@/lib/api";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const userId = await getCurrentUserId();
  const cart = userId ? await getCart(userId) : null;
  const hasItems = !!cart && cart.items.length > 0;

  return (
    <Page>
      <h1 className="text-h1">Your cart</h1>

      {!cart && (
        <p className="mt-4 max-w-[60ch] text-muted">
          Choose a demo user at the top of the page to see their cart.
        </p>
      )}

      {cart && !hasItems && (
        <>
          <p className="mt-4 text-muted">Your cart is empty.</p>
          <Link href="/" className={`${primaryAction} mt-6`}>
            Browse products
          </Link>
        </>
      )}

      {cart && hasItems && (
        <div className="mt-8 pb-28 lg:grid lg:grid-cols-12 lg:gap-12 lg:pb-0">
          <div className="lg:col-span-8">
            <ul className="divide-y divide-rule border-y border-rule">
              {cart.items.map((item) => (
                <li key={item.id} className="grid grid-cols-[6rem_1fr_auto] gap-x-4 gap-y-2 py-5">
                  <ProductImage
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    sizes="96px"
                  />
                  <div className="min-w-0">
                    <Link
                      href={`/products/${item.product.slug}`}
                      className="font-medium hover:underline"
                    >
                      {item.product.name}
                    </Link>
                    <p className="text-caption text-muted">
                      {formatMoney(item.product.priceAmount, item.product.currency)} each
                    </p>
                  </div>
                  <p className="font-medium">{formatMoney(item.lineTotal, item.product.currency)}</p>
                  <div className="col-span-3 col-start-1 sm:col-span-2 sm:col-start-2">
                    <CartItemControls itemId={item.id} quantity={item.quantity} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-caption text-muted">
              The subtotal is an estimate. The final total is calculated when you check out.
            </p>
          </div>

          <aside
            aria-label="Order summary"
            className="fixed inset-x-0 bottom-0 z-10 border-t border-rule bg-paper px-4 py-3 lg:static lg:col-span-4 lg:border-0 lg:bg-transparent lg:p-0"
          >
            <div className="mx-auto max-w-[70rem] lg:sticky lg:top-6 lg:max-w-none">
              <div className="hidden lg:block">
                <Ledger>
                  <LedgerRow label="Estimated subtotal" amount={formatMoney(cart.subtotal, cart.currency)} total />
                </Ledger>
              </div>
              <p className="mb-2 flex items-baseline justify-between text-ui lg:hidden">
                <span>Estimated subtotal</span>
                <span className="text-body font-bold">{formatMoney(cart.subtotal, cart.currency)}</span>
              </p>
              <CheckoutButton className="lg:mt-6" />
            </div>
          </aside>
        </div>
      )}
    </Page>
  );
}
