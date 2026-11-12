// Display only: amounts stay integer minor units everywhere else.
// The currency's own decimals decide the divisor: USD 129900 → $1,299.00, JPY 500 → ¥500.
export function formatMoney(amount: number, currency: string) {
  const format = new Intl.NumberFormat("en-US", { style: "currency", currency });
  const decimals = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(amount / 10 ** decimals);
}
