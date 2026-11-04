import { Db } from 'mongodb';
import { getMongoDb } from '../../infrastructure/mongo.js';
import { GetOrderByIdQuery } from '../queries/get-order-by-id.query.js';

export class GetOrderByIdHandler {
  constructor(private readonly getDb: () => Promise<Db> = getMongoDb) {}

  async execute(query: GetOrderByIdQuery) {
    const db = await this.getDb();
    const order = await db.collection('orders').findOne({
      $or: [{ _id: query.id as any }, { id: query.id }],
    });

    if (!order) {
      return null;
    }

    return {
      id: order._id ? order._id.toString() : order.id,
      customerName: order.customerName,
      totalAmount: Number(order.totalAmount),
      status: order.status,
      createdAt: order.createdAt,
      items: (order.items || []).map((item: any) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.unitPrice) * item.quantity,
      })),
    };
  }
}
