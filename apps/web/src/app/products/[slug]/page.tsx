import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { StockLabel } from "@/components/stock-label";
import { getProduct } from "@/lib/api";
import { formatMoney } from "@/lib/money";

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← All products
      </Link>
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        {product.imageUrl && (
          <Image
            src={product.imageUrl}
            alt={product.name}
            width={600}
            height={400}
            className="rounded-lg"
          />
        )}
        <div>
          <p className="text-xs uppercase text-zinc-500">{product.category.name}</p>
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className="mt-2 text-xl">{formatMoney(product.priceAmount, product.currency)}</p>
          <p className="text-xs text-zinc-500">
            Stripe amount: {product.priceAmount} {product.currency} (minor units)
          </p>
          <div className="mt-2">
            <StockLabel quantity={product.inventory?.quantityAvailable ?? 0} />
          </div>
          <p className="mt-4">{product.description}</p>
          <AddToCartButton
            productId={product.id}
            disabled={(product.inventory?.quantityAvailable ?? 0) === 0}
          />
        </div>
      </div>
    </main>
  );
}
