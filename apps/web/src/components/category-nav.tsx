import { ProductImage } from "@/components/product-image";

export type CategoryLink = { slug: string; name: string; count: number; imageUrl: string | null };

export function CategoryNav({ categories }: { categories: CategoryLink[] }) {
  return (
    <nav aria-label="Categories" className="mt-8">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {categories.map((category) => (
          <li key={category.slug}>
            <a
              href={`#category-${category.slug}`}
              className="flex min-h-11 items-center gap-3 rounded-control border border-rule px-3 py-2 hover:border-ink sm:p-2"
            >
              <ProductImage src={category.imageUrl} alt="" sizes="64px" className="hidden w-16 shrink-0 sm:block" />
              <span className="min-w-0">
                <span className="block font-medium leading-tight">{category.name}</span>
                <span className="block text-caption text-muted">
                  {category.count === 1 ? "1 product" : `${category.count} products`}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
