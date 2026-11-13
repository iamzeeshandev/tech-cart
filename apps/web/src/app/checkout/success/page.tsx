import Link from "next/link";
import { OrderSummary } from "@/components/order-summary";
import { getCurrentUserId, getOrderByCheckoutSession } from "@/lib/api";

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
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            Stripe sent you back to this page, but a redirect proves nothing: anyone can open this
            URL. The order is marked paid only when Stripe confirms the payment to our server.
          </p>
          <OrderSummary order={order} />
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
