import type { Metadata } from "next";
import Link from "next/link";
import { OrderSummary } from "@/components/order-summary";
import { Page } from "@/components/page";
import { primaryAction, textLink } from "@/components/ui";
import { getCurrentUserId, getOrder } from "@/lib/api";

export const metadata: Metadata = { title: "Payment not completed" };

export default async function CheckoutCancelPage({ searchParams }: PageProps<"/checkout/cancel">) {
  const { order_id } = await searchParams;
  const userId = await getCurrentUserId();
  const order = typeof order_id === "string" && userId ? await getOrder(userId, order_id) : null;
  const canResume = order?.status === "PENDING_PAYMENT" && !!order.checkoutUrl;
  const alreadyPaid = order?.status === "PAID";

  return (
    <Page narrow>
      <h1 className="text-h1">{alreadyPaid ? "This order is already paid" : "Payment not completed"}</h1>
      <p className="mt-2 text-muted">
        {alreadyPaid ? "There's nothing more to pay." : "You haven't been charged."}
      </p>
      {order && <OrderSummary order={order} />}
      {order && canResume && (
        <p className="mt-6 max-w-[60ch]">
          Your items stay reserved until{" "}
          {new Date(order.reservationExpiresAt).toLocaleTimeString("en-US", { timeStyle: "short" })}.
        </p>
      )}
      <div className="mt-8 flex flex-wrap items-center gap-x-6">
        {order && canResume && (
          <a href={order.checkoutUrl!} className={primaryAction}>
            Resume payment
          </a>
        )}
        {alreadyPaid && (
          <Link href={`/orders/${order.orderId}`} className={primaryAction}>
            View order
          </Link>
        )}
        <Link href="/cart" className={canResume || alreadyPaid ? textLink : primaryAction}>
          Back to cart
        </Link>
      </div>
    </Page>
  );
}
