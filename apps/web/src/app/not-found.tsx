import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/page";
import { primaryAction } from "@/components/ui";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <Page narrow>
      <h1 className="text-h1">We can&apos;t find that page</h1>
      <p className="mt-2 max-w-[60ch] text-muted">
        The link may be out of date. If you were looking for an order or product, check that the right demo
        user is selected at the top of the page.
      </p>
      <Link href="/" className={`${primaryAction} mt-8`}>
        Back to products
      </Link>
    </Page>
  );
}
