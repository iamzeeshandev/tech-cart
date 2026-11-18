import type { Metadata } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { CartLink } from "@/components/cart-link";
import { DemoUserMenu } from "@/components/demo-user-menu";
import "./globals.css";

const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "TechCart", template: "%s · TechCart" },
  description: "A small online shop for laptops, phones, audio and accessories.",
};

const navLink =
  "inline-flex min-h-11 items-center rounded-control px-2 text-ui hover:text-pine";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${schibsted.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only z-30 rounded-control bg-pine px-4 py-2 text-ui font-medium text-paper focus:not-sr-only focus:absolute focus:left-4 focus:top-2"
        >
          Skip to content
        </a>
        <div className="bg-well">
          <div className="mx-auto flex w-full max-w-[70rem] justify-end px-4 sm:px-6">
            <Suspense fallback={<div className="min-h-11 sm:min-h-9" />}>
              <DemoUserMenu />
            </Suspense>
          </div>
        </div>
        <header className="sticky top-0 z-20 border-b border-rule bg-paper">
          <nav
            aria-label="Main"
            className="mx-auto flex w-full max-w-[70rem] items-center justify-between gap-4 px-4 py-2 sm:px-6"
          >
            <Link href="/" className="-mx-2 inline-flex min-h-11 items-center px-2 text-h2 font-bold tracking-tight">
              TechCart
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/orders" className={navLink}>
                Orders
              </Link>
              <Suspense
                fallback={
                  <Link href="/cart" className={navLink}>
                    Cart
                  </Link>
                }
              >
                <CartLink className={navLink} />
              </Suspense>
            </div>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-rule">
          <p className="mx-auto w-full max-w-[70rem] px-4 py-6 text-caption text-muted sm:px-6">
            TechCart is a demo shop and nothing ships. Payments run in Stripe test mode: pay with card{" "}
            <span className="font-medium text-ink">4242 4242 4242 4242</span>, any future expiry date and any CVC.
          </p>
        </footer>
      </body>
    </html>
  );
}
