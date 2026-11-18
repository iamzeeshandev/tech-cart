import { Ledger, LedgerRow } from "@/components/ledger";
import { OrderStatus } from "@/components/order-status";
import type { Order } from "@/lib/api";
import { formatMoney } from "@/lib/money";

export function OrderSummary({ order }: { order: Order }) {
  return (
    <section aria-label="Order summary" className="mt-8 max-w-md">
      <p>
        <OrderStatus status={order.status} />
      </p>
      <p className="text-caption text-muted">Order {order.orderId}</p>
      <div className="mt-6">
        <Ledger>
          {order.items.map((item) => (
            <LedgerRow
              key={item.productName}
              label={`${item.quantity} × ${item.productName}`}
              amount={formatMoney(item.unitAmount * item.quantity, order.currency)}
            />
          ))}
          <LedgerRow label="Total" amount={formatMoney(order.totalAmount, order.currency)} total />
        </Ledger>
      </div>
    </section>
  );
}
