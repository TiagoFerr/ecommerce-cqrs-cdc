import { randomUUID } from 'node:crypto';
import { prisma } from '../../infrastructure/prisma.js';
import { CreateOrderCommand } from '../commands/create-order.command.js';

export class CreateOrderHandler {
  constructor(private readonly db = prisma) {}

  async execute(command: CreateOrderCommand, metadata?: { traceparent?: string }) {
    if (!command.customerName || command.customerName.trim() === '') {
      throw new Error('Customer name is required');
    }

    if (!command.items || command.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    // Transação ACID atômica com IDs gerados explicitamente (padrão CQRS / Event-Driven)
    return await this.db.$transaction(async (tx) => {
      let totalAmount = 0;
      const orderItemsData = [];

      for (const item of command.items) {
        if (item.quantity <= 0) {
          throw new Error(`Quantity for product ${item.productId} must be greater than zero`);
        }

        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        if (product.stock < item.quantity) {
          throw new Error(
            `Insufficient stock for product "${product.name}". Available: ${product.stock}, requested: ${item.quantity}`
          );
        }

        // Baixa de estoque no banco de escrita
        await tx.product.update({
          where: { id: product.id },
          data: { stock: product.stock - item.quantity },
        });

        const unitPrice = Number(product.price);
        totalAmount += unitPrice * item.quantity;

        orderItemsData.push({
          id: randomUUID(),
          productId: product.id,
          quantity: item.quantity,
          unitPrice: product.price,
        });
      }

      const order = await tx.order.create({
        data: {
          id: randomUUID(),
          customerName: command.customerName,
          totalAmount,
          status: 'PENDING',
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: true,
        },
      });

      const orderDto = {
        id: order.id,
        customerName: order.customerName,
        totalAmount: Number(order.totalAmount),
        status: order.status,
        items: order.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
        })),
        createdAt: order.createdAt,
      };

      // Transactional Outbox Pattern: Pedido e Evento gravados na mesma transação ACID (Zero Dual-Write)
      await tx.outbox.create({
        data: {
          id: randomUUID(),
          aggregateType: 'Order',
          aggregateId: order.id,
          eventType: 'OrderCreated',
          payload: {
            ...orderDto,
            ...(metadata?.traceparent ? { traceparent: metadata.traceparent } : {}),
          },
        },
      });

      return orderDto;
    });
  }
}
