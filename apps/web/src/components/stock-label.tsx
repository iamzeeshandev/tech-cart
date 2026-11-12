export function StockLabel({ quantity }: { quantity: number }) {
  if (quantity === 0) {
    return <p className="text-sm text-red-600">Out of stock</p>;
  }
  if (quantity <= 3) {
    return <p className="text-sm text-amber-600">Only {quantity} left</p>;
  }
  return <p className="text-sm text-green-600">In stock</p>;
}
