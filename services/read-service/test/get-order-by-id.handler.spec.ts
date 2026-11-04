import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GetOrderByIdHandler } from '../src/domain/handlers/get-order-by-id.handler.js';

describe('GetOrderByIdHandler (MongoDB Read Store Query)', () => {
  it('deve retornar null se o pedido não existir no MongoDB', async () => {
    const mockDb = {
      collection: () => ({
        findOne: async () => null,
      }),
    };

    const handler = new GetOrderByIdHandler(async () => mockDb as any);
    const result = await handler.execute({ id: 'order-inexistente' });

    assert.strictEqual(result, null);
  });

  it('deve consultar pedido e calcular subtotais dos itens a partir do documento desnormalizado', async () => {
    const mockDb = {
      collection: () => ({
        findOne: async () => ({
          _id: 'order-1',
          customerName: 'Tiago',
          totalAmount: 700,
          status: 'PENDING',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          items: [
            {
              id: 'item-1',
              productId: 'prod-1',
              quantity: 2,
              unitPrice: 350,
            },
          ],
        }),
      }),
    };

    const handler = new GetOrderByIdHandler(async () => mockDb as any);
    const result = await handler.execute({ id: 'order-1' });

    assert.ok(result);
    assert.strictEqual(result.id, 'order-1');
    assert.strictEqual(result.customerName, 'Tiago');
    assert.strictEqual(result.totalAmount, 700);
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].quantity, 2);
    assert.strictEqual(result.items[0].unitPrice, 350);
    assert.strictEqual(result.items[0].subtotal, 700);
  });
});
