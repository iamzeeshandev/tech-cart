export function StockLabel({ quantity, className = "" }: { quantity: number; className?: string }) {
  if (quantity === 0) {
    return <p className={`font-medium text-danger ${className}`}>Out of stock</p>;
  }
  if (quantity <= 3) {
    return (
      <p className={`font-medium text-warn ${className}`}>
        {quantity === 1 ? "Only 1 left" : `Only ${quantity} left`}
      </p>
    );
  }
  return <p className={`text-muted ${className}`}>In stock</p>;
}
