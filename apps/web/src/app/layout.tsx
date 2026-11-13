import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { DemoUserMenu } from "@/components/demo-user-menu";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TechCart",
  description: "Electronics store for learning Stripe payments",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <header className="border-b border-zinc-500/30">
          <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
            <Link href="/" className="font-semibold">
              TechCart
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/orders" className="text-sm hover:underline">
                Orders
              </Link>
              <Link href="/cart" className="text-sm hover:underline">
                Cart
              </Link>
              <Suspense fallback={null}>
                <DemoUserMenu />
              </Suspense>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
