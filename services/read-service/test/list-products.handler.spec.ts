import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ListProductsHandler } from '../src/domain/handlers/list-products.handler.js';

describe('ListProductsHandler (CQRS Query Handler)', () => {
  it('deve listar produtos sem filtros adicionais', async () => {
    let capturedWhere: any = null;

    const mockDb = {
      product: {
        findMany: async ({ where }: any) => {
          capturedWhere = where;
          return [
            {
              id: 'p-1',
              name: 'Mouse',
              description: 'Óptico',
              price: 50,
              stock: 10,
              createdAt: new Date('2026-01-01T00:00:00Z'),
            },
          ];
        },
      },
    };

    const handler = new ListProductsHandler(mockDb as any);
    const result = await handler.execute({});

    assert.deepStrictEqual(capturedWhere, {});
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'Mouse');
    assert.strictEqual(result[0].price, 50);
  });

  it('deve construir query com busca textual e range de preços', async () => {
    let capturedWhere: any = null;

    const mockDb = {
      product: {
        findMany: async ({ where }: any) => {
          capturedWhere = where;
          return [];
        },
      },
    };

    const handler = new ListProductsHandler(mockDb as any);
    await handler.execute({
      search: 'Gamer',
      minPrice: 100,
      maxPrice: 500,
    });

    assert.ok(capturedWhere.OR, 'Deve conter filtro de busca OR');
    assert.strictEqual(capturedWhere.price.gte, 100);
    assert.strictEqual(capturedWhere.price.lte, 500);
  });
});
