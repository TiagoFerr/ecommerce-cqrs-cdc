import { randomUUID } from 'node:crypto';
import { prisma } from '../../infrastructure/prisma.js';
import { CreateProductCommand } from '../commands/create-product.command.js';

export class CreateProductHandler {
  constructor(private readonly db = prisma) {}

  async execute(command: CreateProductCommand) {
    if (!command.name || command.name.trim() === '') {
      throw new Error('Product name is required');
    }

    if (command.price <= 0) {
      throw new Error('Product price must be greater than zero');
    }

    if (command.stock < 0) {
      throw new Error('Product stock cannot be negative');
    }

    const productId = randomUUID();

    // Transactional Outbox Pattern: Produto e Evento são gravados sob a mesma transação ACID
    return await this.db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          id: productId,
          name: command.name,
          description: command.description,
          price: command.price,
          stock: command.stock,
        },
      });

      await tx.outbox.create({
        data: {
          id: randomUUID(),
          aggregateType: 'Product',
          aggregateId: product.id,
          eventType: 'ProductCreated',
          payload: {
            id: product.id,
            name: product.name,
            description: product.description,
            price: Number(product.price),
            stock: product.stock,
            createdAt: product.createdAt,
          },
        },
      });

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price),
        stock: product.stock,
        createdAt: product.createdAt,
      };
    });
  }
}
