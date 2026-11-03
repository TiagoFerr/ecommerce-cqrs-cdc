import { prisma } from '../../infrastructure/prisma.js';
import { ListProductsQuery } from '../queries/list-products.query.js';

export class ListProductsHandler {
  constructor(private readonly db = prisma) {}

  async execute(query: ListProductsQuery) {
    const where: any = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {};
      if (query.minPrice !== undefined) where.price.gte = query.minPrice;
      if (query.maxPrice !== undefined) where.price.lte = query.maxPrice;
    }

    const products = await this.db.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      stock: product.stock,
      createdAt: product.createdAt,
    }));
  }
}

