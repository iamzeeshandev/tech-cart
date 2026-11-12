import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

// Whitelist of public fields: new DB columns never leak into the API by accident.
const productSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  imageUrl: true,
  priceAmount: true,
  currency: true,
  category: { select: { slug: true, name: true } },
  inventory: { select: { quantityAvailable: true } },
} satisfies Prisma.ProductSelect;

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.product.findMany({
      where: { isActive: true },
      select: productSelect,
      orderBy: [{ category: { name: 'asc' } }, { priceAmount: 'asc' }],
    });
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug, isActive: true },
      select: productSelect,
    });
    if (!product) {
      throw new NotFoundException(`Product "${slug}" not found`);
    }
    return product;
  }
}
