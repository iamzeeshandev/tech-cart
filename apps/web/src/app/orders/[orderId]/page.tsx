import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderSummary } from "@/components/order-summary";
import { Page } from "@/components/page";
import { primaryAction } from "@/components/ui";
import { getCurrentUserId, getOrder } from "@/lib/api";
import { formatDateTime, formatTime } from "@/lib/date";

export const metadata: Metadata = { title: "Order details" };

export default async function OrderPage({ params }: PageProps<"/orders/[orderId]">) {
  const { orderId } = await params;
  const userId = await getCurrentUserId();
  const order = userId ? await getOrder(userId, orderId) : null;
  if (!order) notFound();

  return (
    <Page narrow>
      <Link href="/orders" className="-mx-2 inline-flex min-h-11 items-center px-2 text-ui text-muted hover:text-pine">
        ← All orders
      </Link>
      <h1 className="mt-2 text-h1">Order details</h1>
      <p className="mt-1 text-muted">
        Placed {formatDateTime(order.createdAt)}
        {order.paidAt && `. Paid ${formatDateTime(order.paidAt)}.`}
      </p>

      <OrderSummary order={order} />

      {order.status === "PENDING_PAYMENT" && order.checkoutUrl && (
        <a href={order.checkoutUrl} className={`${primaryAction} mt-6`}>
          Resume payment
        </a>
      )}

      {order.status !== "PAID" && order.payment?.lastFailureMessage && (
        <p className="mt-6 max-w-[60ch] text-danger">
          The last payment attempt was declined: {order.payment.lastFailureMessage}
        </p>
      )}

      <details className="mt-12 border-t border-rule pt-2 text-ui">
        <summary className="flex min-h-11 cursor-pointer items-center text-muted hover:text-ink">
          For developers: Stripe payment and events
        </summary>
        <div className="space-y-6 pb-4 pt-2">
          {order.payment && (
            <dl className="grid grid-cols-[9rem_1fr] gap-y-1">
              <dt className="text-muted">Payment status</dt>
              <dd className="font-mono">{order.payment.status}</dd>
              <dt className="text-muted">PaymentIntent</dt>
              <dd className="break-all font-mono">{order.payment.stripePaymentIntentId ?? "—"}</dd>
              {order.payment.lastFailureCode && (
                <>
                  <dt className="text-muted">Last decline</dt>
                  <dd>
                    <span className="font-mono">{order.payment.lastFailureCode}</span>:{" "}
                    {order.payment.lastFailureMessage}
                  </dd>
                </>
              )}
            </dl>
          )}
          <div>
            <h2 className="text-body">Stripe events</h2>
            <p className="text-caption text-muted">
              Webhooks Stripe sent for this order, and what the server did with each.
            </p>
            {order.events.length === 0 ? (
              <p className="mt-2 text-muted">None received yet.</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {order.events.map((event) => (
                  <li key={event.id} className="flex flex-wrap gap-x-4">
                    <span className="w-24 text-muted">{formatTime(event.stripeCreatedAt)}</span>
                    <span className="font-mono">{event.type}</span>
                    <span className={event.status === "PROCESSED" ? "text-pine" : "text-muted"}>
                      {event.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </details>
    </Page>
  );
}
