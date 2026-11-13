import { OrderStatus } from "@/components/order-status";
import type { Order } from "@/lib/api";
import { formatMoney } from "@/lib/money";

export function OrderSummary({ order }: { order: Order }) {
  return (
    <div className="mt-6 max-w-md">
      <p className="text-sm">
        Status: <OrderStatus status={order.status} />
      </p>
      <p className="text-xs text-zinc-500">Order {order.orderId}</p>
      <ul className="mt-3 divide-y divide-zinc-500/30 border-y border-zinc-500/30 text-sm">
        {order.items.map((item) => (
          <li key={item.productName} className="flex justify-between py-2">
            <span>
              {item.quantity} × {item.productName}
            </span>
            <span className="tabular-nums">
              {formatMoney(item.unitAmount * item.quantity, order.currency)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-right font-semibold">{formatMoney(order.totalAmount, order.currency)}</p>
    </div>
  );
}
