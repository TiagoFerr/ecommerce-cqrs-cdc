import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CreateOrderHandler } from '../src/domain/handlers/create-order.handler.js';

describe('CreateOrderHandler (CQRS Command Handler with ACID Transaction & Outbox)', () => {
  it('deve rejeitar pedido sem nome do cliente', async () => {
    const handler = new CreateOrderHandler({} as any);

    await assert.rejects(
      async () => {
        await handler.execute({
          customerName: '',
          items: [{ productId: 'prod-1', quantity: 1 }],
        });
      },
      {
        name: 'Error',
        message: 'Customer name is required',
      }
    );
  });

  it('deve rejeitar pedido sem itens', async () => {
    const handler = new CreateOrderHandler({} as any);

    await assert.rejects(
      async () => {
        await handler.execute({
          customerName: 'Tiago',
          items: [],
        });
      },
      {
        name: 'Error',
        message: 'Order must contain at least one item',
      }
    );
  });

  it('deve falhar se produto não existir durante a transação', async () => {
    const mockDb = {
      $transaction: async (callback: any) => {
        const tx = {
          product: {
            findUnique: async () => null,
          },
        };
        return await callback(tx);
      },
    };

    const handler = new CreateOrderHandler(mockDb as any);

    await assert.rejects(
      async () => {
        await handler.execute({
          customerName: 'Tiago',
          items: [{ productId: 'prod-inexistente', quantity: 1 }],
        });
      },
      {
        name: 'Error',
        message: 'Product not found: prod-inexistente',
      }
    );
  });

  it('deve falhar e disparar rollback se estoque for insuficiente', async () => {
    const mockDb = {
      $transaction: async (callback: any) => {
        const tx = {
          product: {
            findUnique: async () => ({
              id: 'prod-1',
              name: 'RTX 4090',
              price: 12000,
              stock: 1, // apenas 1 em estoque
            }),
          },
        };
        return await callback(tx);
      },
    };

    const handler = new CreateOrderHandler(mockDb as any);

    await assert.rejects(
      async () => {
        await handler.execute({
          customerName: 'Tiago',
          items: [{ productId: 'prod-1', quantity: 2 }], // solicitando 2
        });
      },
      {
        name: 'Error',
        message: 'Insufficient stock for product "RTX 4090". Available: 1, requested: 2',
      }
    );
  });

  it('deve processar transação ACID, abater estoque e registrar evento Outbox com sucesso', async () => {
    let stockUpdatedWith: any = null;
    let orderCreatedWith: any = null;
    let outboxCreatedWith: any = null;

    const mockDb = {
      $transaction: async (callback: any) => {
        const tx = {
          product: {
            findUnique: async ({ where }: any) => {
              if (where.id === 'prod-1') {
                return {
                  id: 'prod-1',
                  name: 'Headset Wireless',
                  price: 500,
                  stock: 10,
                };
              }
              return null;
            },
            update: async ({ where, data }: any) => {
              stockUpdatedWith = { where, data };
              return { id: where.id, stock: data.stock };
            },
          },
          order: {
            create: async ({ data }: any) => {
              orderCreatedWith = data;
              return {
                id: data.id,
                customerName: data.customerName,
                totalAmount: data.totalAmount,
                status: data.status,
                items: data.items.create,
                createdAt: new Date('2026-01-01T00:00:00Z'),
              };
            },
          },
          outbox: {
            create: async ({ data }: any) => {
              outboxCreatedWith = data;
              return data;
            },
          },
        };
        return await callback(tx);
      },
    };

    const handler = new CreateOrderHandler(mockDb as any);

    const result = await handler.execute({
      customerName: 'Tiago',
      items: [{ productId: 'prod-1', quantity: 3 }],
    });

    // 1. Verificação de baixa de estoque (10 - 3 = 7)
    assert.deepStrictEqual(stockUpdatedWith, {
      where: { id: 'prod-1' },
      data: { stock: 7 },
    });

    // 2. Verificação de cálculo do valor total (500 * 3 = 1500)
    assert.strictEqual(result.totalAmount, 1500);
    assert.strictEqual(result.status, 'PENDING');
    assert.strictEqual(result.customerName, 'Tiago');
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].quantity, 3);
    assert.strictEqual(result.items[0].unitPrice, 500);

    // 3. Verificação do Transactional Outbox Pattern
    assert.ok(outboxCreatedWith, 'Evento outbox deve ter sido gravado');
    assert.strictEqual(outboxCreatedWith.aggregateType, 'Order');
    assert.strictEqual(outboxCreatedWith.aggregateId, result.id);
    assert.strictEqual(outboxCreatedWith.eventType, 'OrderCreated');
    assert.strictEqual(outboxCreatedWith.payload.totalAmount, 1500);
  });
});
