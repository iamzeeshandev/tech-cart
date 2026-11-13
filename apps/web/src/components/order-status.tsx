const colors: Record<string, string> = {
  PAID: "text-green-600",
  PENDING_PAYMENT: "text-amber-600",
  PAYMENT_PROCESSING: "text-amber-600",
  PAYMENT_FAILED: "text-red-600",
};

export function OrderStatus({ status }: { status: string }) {
  return (
    <span className={`font-mono text-sm font-semibold ${colors[status] ?? "text-zinc-500"}`}>
      {status}
    </span>
  );
}
