import Link from "next/link";
import { OrderSummary } from "@/components/order-summary";
import { getCurrentUserId, getOrderByCheckoutSession } from "@/lib/api";

const messages: Record<string, string> = {
  PAID: "Payment confirmed. Our server checked it with Stripe; the redirect alone proves nothing.",
  PAYMENT_PROCESSING:
    "Your payment is processing (bank payments can take a few days). This order updates when Stripe confirms it.",
  PENDING_PAYMENT: "Stripe hasn't confirmed the payment yet. Refresh in a moment.",
};

export default async function CheckoutSuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  const { session_id } = await searchParams;
  const userId = await getCurrentUserId();
  const order =
    typeof session_id === "string" && userId
      ? await getOrderByCheckoutSession(userId, session_id)
      : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Thanks for your order</h1>
      {order ? (
        <>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">{messages[order.status]}</p>
          <OrderSummary order={order} />
          <Link href={`/orders/${order.orderId}`} className="mt-4 inline-block text-sm underline">
            View order
          </Link>
        </>
      ) : (
        <p className="mt-4 text-zinc-500">We couldn&apos;t find this checkout.</p>
      )}
      <Link href="/" className="mt-8 inline-block text-sm underline">
        Continue shopping
      </Link>
    </main>
  );
}
