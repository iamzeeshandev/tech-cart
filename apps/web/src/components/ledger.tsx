export function Ledger({ children }: { children: React.ReactNode }) {
  return <dl className="space-y-2">{children}</dl>;
}

export function LedgerRow({
  label,
  amount,
  total = false,
}: {
  label: React.ReactNode;
  amount: string;
  total?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline gap-2 ${total ? "border-t border-ink pt-3 text-h2 font-bold" : ""}`}
    >
      <dt className="flex min-w-0 flex-1 items-baseline gap-2">
        {label}
        <span aria-hidden="true" className="min-w-4 flex-1 -translate-y-1 border-b-2 border-dotted border-rule" />
      </dt>
      <dd className={total ? "" : "font-medium"}>{amount}</dd>
    </div>
  );
}
