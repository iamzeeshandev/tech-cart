import Link from "next/link";
import { OrderStatus } from "@/components/order-status";
import { getCurrentUserId, getOrders } from "@/lib/api";
import { formatDateTime } from "@/lib/date";
import { formatMoney } from "@/lib/money";

export default async function OrdersPage() {
  const userId = await getCurrentUserId();
  const orders = userId ? await getOrders(userId) : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Orders</h1>

      {!orders && <p className="mt-4 text-zinc-500">Choose a demo user (top right) to see their orders.</p>}
      {orders?.length === 0 && <p className="mt-4 text-zinc-500">No orders yet.</p>}

      {orders && orders.length > 0 && (
        <ul className="mt-6 divide-y divide-zinc-500/30 border-y border-zinc-500/30">
          {orders.map((order) => (
            <li key={order.orderId}>
              <Link
                href={`/orders/${order.orderId}`}
                className="flex items-center gap-4 py-3 hover:bg-zinc-500/5"
              >
                <span className="w-44 text-sm text-zinc-500">{formatDateTime(order.createdAt)}</span>
                <span className="flex-1 truncate text-sm">
                  {order.items.map((item) => `${item.quantity} × ${item.productName}`).join(", ")}
                </span>
                <OrderStatus status={order.status} />
                <span className="w-24 text-right tabular-nums">
                  {formatMoney(order.totalAmount, order.currency)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
