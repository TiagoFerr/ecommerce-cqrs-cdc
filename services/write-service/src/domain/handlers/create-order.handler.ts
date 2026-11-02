import { prisma } from '../../infrastructure/prisma.js';
import { CreateOrderCommand } from '../commands/create-order.command.js';

export class CreateOrderHandler {
  async execute(command: CreateOrderCommand) {
    // 1. Validações básicas de entrada
    if (!command.customerName || command.customerName.trim() === '') {
      throw new Error('Customer name is required');
    }

    if (!command.items || command.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    // 2. Transação ACID atômica:
    // Se o estoque de QUALQUER produto for insuficiente, toda a operação sofre Rollback.
    return await prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      const orderItemsData = [];

      for (const item of command.items) {
        if (item.quantity <= 0) {
          throw new Error(`Quantity for product ${item.productId} must be greater than zero`);
        }

        // Busca o produto com o preço real no banco de escrita
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        // Regra de invariante de domínio: Estoque não pode ficar negativo
        if (product.stock < item.quantity) {
          throw new Error(
            `Insufficient stock for product "${product.name}". Available: ${product.stock}, requested: ${item.quantity}`
          );
        }

        // Baixa imediata de estoque no banco de escrita
        await tx.product.update({
          where: { id: product.id },
          data: { stock: product.stock - item.quantity },
        });

        const unitPrice = Number(product.price);
        totalAmount += unitPrice * item.quantity;

        orderItemsData.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice: product.price,
        });
      }

      // Criação do pedido com os itens agregados
      const order = await tx.order.create({
        data: {
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

      return {
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
    });
  }
}

