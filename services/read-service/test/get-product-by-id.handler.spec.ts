import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GetProductByIdHandler } from '../src/domain/handlers/get-product-by-id.handler.js';

describe('GetProductByIdHandler (CQRS Query Handler)', () => {
  it('deve retornar null se o produto não for encontrado', async () => {
    const mockDb = {
      product: {
        findUnique: async () => null,
      },
    };

    const handler = new GetProductByIdHandler(mockDb as any);
    const result = await handler.execute({ id: 'p-inexistente' });

    assert.strictEqual(result, null);
  });

  it('deve retornar DTO do produto quando encontrado', async () => {
    const mockDb = {
      product: {
        findUnique: async () => ({
          id: 'p-1',
          name: 'Teclado Mecânico',
          description: 'Switch Blue',
          price: 250,
          stock: 8,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        }),
      },
    };

    const handler = new GetProductByIdHandler(mockDb as any);
    const result = await handler.execute({ id: 'p-1' });

    assert.ok(result);
    assert.strictEqual(result.id, 'p-1');
    assert.strictEqual(result.name, 'Teclado Mecânico');
    assert.strictEqual(result.price, 250);
  });
});
