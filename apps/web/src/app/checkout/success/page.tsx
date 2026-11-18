import type { Metadata } from "next";
import Link from "next/link";
import { OrderSummary } from "@/components/order-summary";
import { Page } from "@/components/page";
import { primaryAction, textLink } from "@/components/ui";
import { getCurrentUserId, getOrderByCheckoutSession } from "@/lib/api";

export const metadata: Metadata = { title: "Order confirmation" };

const outcomes: Record<string, { heading: string; message: string }> = {
  PAID: {
    heading: "Thank you for your order",
    message: "Your payment is confirmed. You can follow this order from your orders page.",
  },
  PAYMENT_PROCESSING: {
    heading: "We're confirming your payment",
    message:
      "Your payment is processing. Bank payments can take a few days, and this order updates as soon as it's confirmed.",
  },
  PENDING_PAYMENT: {
    heading: "We're confirming your payment",
    message: "We haven't received confirmation of your payment yet. Refresh this page in a moment.",
  },
};

export default async function CheckoutSuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  const { session_id } = await searchParams;
  const userId = await getCurrentUserId();
  const order =
    typeof session_id === "string" && userId
      ? await getOrderByCheckoutSession(userId, session_id)
      : null;
  const outcome = order && (outcomes[order.status] ?? { heading: "Your order", message: "" });

  return (
    <Page narrow>
      {order && outcome ? (
        <>
          <h1 className="text-h1">{outcome.heading}</h1>
          {outcome.message && <p className="mt-2 max-w-[60ch] text-muted">{outcome.message}</p>}
          <OrderSummary order={order} />
          <div className="mt-8 flex flex-wrap items-center gap-x-6">
            <Link href={`/orders/${order.orderId}`} className={primaryAction}>
              View order
            </Link>
            <Link href="/" className={textLink}>
              Continue shopping
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-h1">We couldn&apos;t find this checkout</h1>
          <p className="mt-2 max-w-[60ch] text-muted">
            Make sure the right demo user is selected at the top of the page, then check your orders.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6">
            <Link href="/orders" className={primaryAction}>
              View orders
            </Link>
            <Link href="/" className={textLink}>
              Continue shopping
            </Link>
          </div>
        </>
      )}
    </Page>
  );
}
