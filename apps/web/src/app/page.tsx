import Link from "next/link";
import { CategoryNav } from "@/components/category-nav";
import { Page } from "@/components/page";
import { ProductImage } from "@/components/product-image";
import { StockLabel } from "@/components/stock-label";
import { getProducts, type Product } from "@/lib/api";
import { formatMoney } from "@/lib/money";

function groupByCategory(products: Product[]) {
  const groups = new Map<string, { name: string; products: Product[] }>();
  for (const product of products) {
    const group = groups.get(product.category.slug) ?? { name: product.category.name, products: [] };
    group.products.push(product);
    groups.set(product.category.slug, group);
  }
  return [...groups.entries()];
}

export default async function Home() {
  const groups = groupByCategory(await getProducts());

  return (
    <Page>
      <h1 className="max-w-[16ch] text-[2.5rem] leading-[1.05] sm:text-6xl">Everyday electronics</h1>
      <p className="mt-4 max-w-[48ch] text-muted">
        Laptops, phones, audio and accessories. Prices are in US dollars and stock levels are live.
      </p>

      <CategoryNav
        categories={groups.map(([slug, group]) => ({
          slug,
          name: group.name,
          count: group.products.length,
          imageUrl: group.products[0].imageUrl,
        }))}
      />

      <div className="mt-14 divide-y divide-rule border-t border-rule">
        {groups.map(([slug, group]) => (
          <section
            key={slug}
            id={`category-${slug}`}
            aria-labelledby={`heading-${slug}`}
            className="scroll-mt-16 py-10 lg:grid lg:grid-cols-[11rem_1fr] lg:gap-10"
          >
            <div className="mb-6 flex items-baseline justify-between lg:mb-0 lg:block">
              <h2 id={`heading-${slug}`} className="text-h2 lg:sticky lg:top-24">
                {group.name}
              </h2>
              <p className="text-caption text-muted lg:hidden">{group.products.length} products</p>
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3">
              {group.products.map((product) => {
                const quantity = product.inventory?.quantityAvailable ?? 0;
                return (
                  <li key={product.id}>
                    <Link href={`/products/${product.slug}`} className="group block">
                      <ProductImage
                        src={product.imageUrl}
                        alt={product.name}
                        sizes="(min-width: 1024px) 270px, (min-width: 768px) 30vw, 47vw"
                        unavailable={quantity === 0}
                      />
                      <h3 className="mt-3 leading-snug font-medium group-hover:underline">{product.name}</h3>
                      <p className={`font-medium ${quantity === 0 ? "text-muted" : ""}`}>
                        {formatMoney(product.priceAmount, product.currency)}
                      </p>
                      <StockLabel quantity={quantity} className="text-caption" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Page>
  );
}
