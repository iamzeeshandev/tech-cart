import Link from "next/link";
import { OrderSummary } from "@/components/order-summary";
import { getCurrentUserId, getOrder } from "@/lib/api";

export default async function CheckoutCancelPage({ searchParams }: PageProps<"/checkout/cancel">) {
  const { order_id } = await searchParams;
  const userId = await getCurrentUserId();
  const order = typeof order_id === "string" && userId ? await getOrder(userId, order_id) : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Payment not completed</h1>
      <p className="mt-2 text-sm text-zinc-500">You weren&apos;t charged.</p>
      {order && <OrderSummary order={order} />}
      {order?.status === "PENDING_PAYMENT" && order.checkoutUrl && (
        <p className="mt-4 text-sm">
          Your items stay reserved until{" "}
          {new Date(order.reservationExpiresAt).toLocaleTimeString("en-US", { timeStyle: "short" })}
          .{" "}
          <a href={order.checkoutUrl} className="font-medium underline">
            Resume payment
          </a>
        </p>
      )}
      <Link href="/cart" className="mt-8 inline-block text-sm underline">
        Back to cart
      </Link>
    </main>
  );
}
