import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatus } from "@/components/order-status";
import { Page } from "@/components/page";
import { primaryAction } from "@/components/ui";
import { getCurrentUserId, getOrders } from "@/lib/api";
import { formatDateTime } from "@/lib/date";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const userId = await getCurrentUserId();
  const orders = userId ? await getOrders(userId) : null;

  return (
    <Page>
      <h1 className="text-h1">Your orders</h1>

      {!orders && (
        <p className="mt-4 max-w-[60ch] text-muted">
          Choose a demo user at the top of the page to see their orders.
        </p>
      )}

      {orders?.length === 0 && (
        <>
          <p className="mt-4 text-muted">You haven&apos;t placed an order yet.</p>
          <Link href="/" className={`${primaryAction} mt-6`}>
            Browse products
          </Link>
        </>
      )}

      {orders && orders.length > 0 && (
        <ul className="mt-8 divide-y divide-rule border-y border-rule">
          {orders.map((order) => (
            <li key={order.orderId}>
              <Link
                href={`/orders/${order.orderId}`}
                className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-4 hover:bg-well/60 sm:grid-cols-[11rem_1fr_10rem_6rem] sm:items-baseline"
              >
                <span className="order-1 line-clamp-2 sm:order-2">
                  {order.items.map((item) => `${item.quantity} × ${item.productName}`).join(", ")}
                </span>
                <span className="order-2 text-right font-medium sm:order-4">
                  {formatMoney(order.totalAmount, order.currency)}
                </span>
                <span className="order-3 text-caption text-muted sm:order-1 sm:text-ui">
                  {formatDateTime(order.createdAt)}
                </span>
                <span className="order-4 text-right text-ui sm:order-3 sm:text-left">
                  <OrderStatus status={order.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
