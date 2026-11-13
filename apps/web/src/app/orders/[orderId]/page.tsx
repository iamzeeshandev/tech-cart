import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderSummary } from "@/components/order-summary";
import { getCurrentUserId, getOrder } from "@/lib/api";
import { formatDateTime, formatTime } from "@/lib/date";

export default async function OrderPage({ params }: PageProps<"/orders/[orderId]">) {
  const { orderId } = await params;
  const userId = await getCurrentUserId();
  const order = userId ? await getOrder(userId, orderId) : null;
  if (!order) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link href="/orders" className="text-sm text-zinc-500 hover:underline">
        ← All orders
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Order</h1>
      <p className="text-sm text-zinc-500">
        Placed {formatDateTime(order.createdAt)}
        {order.paidAt && ` · paid ${formatDateTime(order.paidAt)}`}
      </p>

      <OrderSummary order={order} />

      {order.status === "PENDING_PAYMENT" && order.checkoutUrl && (
        <a href={order.checkoutUrl} className="mt-4 inline-block text-sm font-medium underline">
          Resume payment
        </a>
      )}

      {order.payment && (
        <section className="mt-8 max-w-md text-sm">
          <h2 className="font-semibold">Payment</h2>
          <dl className="mt-2 grid grid-cols-[10rem_1fr] gap-y-1">
            <dt className="text-zinc-500">Status</dt>
            <dd className="font-mono">{order.payment.status}</dd>
            <dt className="text-zinc-500">PaymentIntent</dt>
            <dd className="font-mono">{order.payment.stripePaymentIntentId ?? "—"}</dd>
            {order.payment.lastFailureCode && (
              <>
                <dt className="text-zinc-500">Last decline</dt>
                <dd>
                  <span className="font-mono">{order.payment.lastFailureCode}</span>:{" "}
                  {order.payment.lastFailureMessage}
                </dd>
              </>
            )}
          </dl>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-semibold">Stripe events</h2>
        <p className="text-xs text-zinc-500">
          Webhooks Stripe sent for this order and what we did with each (shown for learning).
        </p>
        {order.events.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">None received yet.</p>
        ) : (
          <ul className="mt-2 text-sm">
            {order.events.map((event) => (
              <li key={event.id} className="flex gap-4 py-0.5">
                <span className="w-24 tabular-nums text-zinc-500">{formatTime(event.stripeCreatedAt)}</span>
                <span className="w-72 font-mono">{event.type}</span>
                <span className={event.status === "PROCESSED" ? "text-green-600" : "text-zinc-500"}>
                  {event.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
