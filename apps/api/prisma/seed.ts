import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const categories = [
  { slug: 'laptops', name: 'Laptops' },
  { slug: 'phones', name: 'Phones' },
  { slug: 'audio', name: 'Audio' },
  { slug: 'accessories', name: 'Accessories' },
];

// priceAmount in cents. Some rows exist only to exercise payment edge cases later.
const products = [
  { slug: 'aero-14-laptop', name: 'Aero 14 Laptop', category: 'laptops', priceAmount: 129900, stock: 10,
    description: '14-inch ultralight laptop, 16 GB RAM, 512 GB SSD.' },
  { slug: 'nimbus-16-pro', name: 'Nimbus 16 Pro', category: 'laptops', priceAmount: 249900, stock: 5,
    description: '16-inch performance laptop, 32 GB RAM, 1 TB SSD.' },
  { slug: 'pixelon-9', name: 'Pixelon 9', category: 'phones', priceAmount: 79900, stock: 15,
    description: '6.3-inch phone, 256 GB, triple camera.' },
  // Only one in stock: two buyers racing for it tests stock reservation (Phase 4).
  { slug: 'orbit-mini', name: 'Orbit Mini', category: 'phones', priceAmount: 59900, stock: 1,
    description: 'Compact 5.8-inch phone, 128 GB.' },
  { slug: 'pulse-anc-headphones', name: 'Pulse ANC Headphones', category: 'audio', priceAmount: 34900, stock: 20,
    description: 'Over-ear noise-cancelling headphones, 40 h battery.' },
  // Out of stock: checkout must refuse it.
  { slug: 'echo-buds', name: 'Echo Buds', category: 'audio', priceAmount: 12900, stock: 0,
    description: 'True wireless earbuds with charging case.' },
  { slug: 'usb-c-charger-65w', name: '65W USB-C Charger', category: 'accessories', priceAmount: 3999, stock: 50,
    description: 'GaN charger, 2 USB-C ports.' },
  { slug: 'usb-c-cable-2m', name: 'USB-C Cable 2m', category: 'accessories', priceAmount: 1299, stock: 100,
    description: 'Braided 100 W USB-C to USB-C cable.' },
  // $0.35 is below Stripe's $0.50 USD minimum charge: an order of just this fails at Checkout.
  { slug: 'cable-ties', name: 'Cable Ties (10 pack)', category: 'accessories', priceAmount: 35, stock: 100,
    description: 'Reusable hook-and-loop cable ties.' },
  // Inactive: must not appear in the catalog API.
  { slug: 'retro-dock', name: 'Retro Dock', category: 'accessories', priceAmount: 8999, stock: 3, isActive: false,
    description: 'Discontinued USB-A docking station.' },
];

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name },
      create: category,
    });
  }

  for (const { category, stock, ...product } of products) {
    const data = {
      ...product,
      isActive: product.isActive ?? true,
      imageUrl: `https://placehold.co/600x400/png?text=${encodeURIComponent(product.name)}`,
      category: { connect: { slug: category } },
    };
    // Re-running the seed refreshes product details but never resets stock,
    // because stock may be held by real orders by then.
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: data,
      create: { ...data, inventory: { create: { quantityAvailable: stock } } },
    });
  }

  console.log(`Seeded ${categories.length} categories and ${products.length} products.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
