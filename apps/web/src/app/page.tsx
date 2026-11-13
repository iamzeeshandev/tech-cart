import Image from "next/image";
import Link from "next/link";
import { StockLabel } from "@/components/stock-label";
import { getProducts } from "@/lib/api";
import { formatMoney } from "@/lib/money";

export default async function Home() {
  const products = await getProducts();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Products</h1>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <li key={product.id} className="rounded-lg border border-zinc-500/30">
            <Link href={`/products/${product.slug}`} className="block p-4">
              {product.imageUrl && (
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  width={1200}
                  height={800}
                  sizes="(min-width: 1024px) 288px, (min-width: 640px) 45vw, 90vw"
                  className="aspect-[3/2] rounded object-cover"
                />
              )}
              <p className="mt-3 text-xs uppercase text-zinc-500">{product.category.name}</p>
              <h2 className="font-medium">{product.name}</h2>
              <p className="mt-1">{formatMoney(product.priceAmount, product.currency)}</p>
              <StockLabel quantity={product.inventory?.quantityAvailable ?? 0} />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
