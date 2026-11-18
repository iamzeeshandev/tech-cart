import Link from "next/link";
import { getCart, getCurrentUserId } from "@/lib/api";
import { CartCount } from "./cart-count";

async function countItems() {
  try {
    const userId = await getCurrentUserId();
    const cart = userId ? await getCart(userId) : null;
    return cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;
  } catch {
    // The header must never take the page down; the cart page shows the real error.
    return 0;
  }
}

export async function CartLink({ className }: { className: string }) {
  const count = await countItems();

  return (
    <Link href="/cart" className={className} aria-label={count > 0 ? `Cart, ${count} items` : "Cart"}>
      Cart
      <CartCount count={count} />
    </Link>
  );
}
