import { Db } from 'mongodb';
import { getMongoDb } from '../../infrastructure/mongo.js';
import { GetProductByIdQuery } from '../queries/get-product-by-id.query.js';

export class GetProductByIdHandler {
  constructor(private readonly getDb: () => Promise<Db> = getMongoDb) {}

  async execute(query: GetProductByIdQuery) {
    const db = await this.getDb();
    const product = await db.collection('products').findOne({
      $or: [{ _id: query.id as any }, { id: query.id }],
    });

    if (!product) {
      return null;
    }

    return {
      id: product._id ? product._id.toString() : product.id,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      stock: product.stock,
      createdAt: product.createdAt,
    };
  }
}
