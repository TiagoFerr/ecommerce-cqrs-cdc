import { Db } from 'mongodb';
import { getMongoDb } from '../../infrastructure/mongo.js';
import { ListProductsQuery } from '../queries/list-products.query.js';

export class ListProductsHandler {
  constructor(private readonly getDb: () => Promise<Db> = getMongoDb) {}

  async execute(query: ListProductsQuery) {
    const db = await this.getDb();
    const filter: any = {};

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ];
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter.price = {};
      if (query.minPrice !== undefined) filter.price.$gte = query.minPrice;
      if (query.maxPrice !== undefined) filter.price.$lte = query.maxPrice;
    }

    const products = await db.collection('products')
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    return products.map((product) => ({
      id: product._id ? product._id.toString() : product.id,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      stock: product.stock,
      createdAt: product.createdAt,
    }));
  }
}
