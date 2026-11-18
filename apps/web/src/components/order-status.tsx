const labels: Record<string, { text: string; color: string }> = {
  PAID: { text: "Paid", color: "text-pine" },
  PENDING_PAYMENT: { text: "Awaiting payment", color: "text-warn" },
  PAYMENT_PROCESSING: { text: "Payment processing", color: "text-warn" },
  PAYMENT_FAILED: { text: "Payment failed", color: "text-danger" },
};

function humanize(status: string) {
  const text = status.toLowerCase().replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function OrderStatus({ status }: { status: string }) {
  const label = labels[status] ?? { text: humanize(status), color: "text-muted" };
  return <span className={`font-medium ${label.color}`}>{label.text}</span>;
}
