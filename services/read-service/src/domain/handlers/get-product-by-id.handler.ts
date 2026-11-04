import { prisma } from '../../infrastructure/prisma.js';
import { GetProductByIdQuery } from '../queries/get-product-by-id.query.js';

export class GetProductByIdHandler {
  constructor(private readonly db = prisma) {}

  async execute(query: GetProductByIdQuery) {
    const product = await this.db.product.findUnique({
      where: { id: query.id },
    });

    if (!product) {
      return null;
    }

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      stock: product.stock,
      createdAt: product.createdAt,
    };
  }
}

