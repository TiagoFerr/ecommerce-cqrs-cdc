import { prisma } from '../../infrastructure/prisma.js';
import { GetOrderByIdQuery } from '../queries/get-order-by-id.query.js';

export class GetOrderByIdHandler {
  constructor(private readonly db = prisma) {}

  async execute(query: GetOrderByIdQuery) {
    const order = await this.db.order.findUnique({
      where: { id: query.id },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return null;
    }

    return {
      id: order.id,
      customerName: order.customerName,
      totalAmount: Number(order.totalAmount),
      status: order.status,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.unitPrice) * item.quantity,
      })),
    };
  }
}

