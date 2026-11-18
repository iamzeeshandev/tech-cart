import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { Page } from "@/components/page";
import { ProductImage } from "@/components/product-image";
import { StockLabel } from "@/components/stock-label";
import { getProduct } from "@/lib/api";
import { formatMoney } from "@/lib/money";

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  return { title: product?.name ?? "Product not found" };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const quantity = product.inventory?.quantityAvailable ?? 0;

  return (
    <Page>
      <Link href="/" className="-mx-2 inline-flex min-h-11 items-center px-2 text-ui text-muted hover:text-pine">
        ← All products
      </Link>
      <div className="mt-4 grid gap-8 md:grid-cols-12 md:gap-12">
        <div className="md:col-span-7">
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            sizes="(min-width: 1024px) 640px, (min-width: 768px) 55vw, 100vw"
            preload
            unavailable={quantity === 0}
          />
        </div>
        <div className="md:col-span-5">
          <h1 className="text-h1">{product.name}</h1>
          <p className="mt-3 text-h2 font-medium md:text-price md:leading-none">
            {formatMoney(product.priceAmount, product.currency)}
          </p>
          <StockLabel quantity={quantity} className="mt-3" />
          <p className="mt-6 max-w-[60ch]">{product.description}</p>
          <AddToCartButton productId={product.id} disabled={quantity === 0} />
        </div>
      </div>
    </Page>
  );
}
