import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ListProductsHandler } from '../src/domain/handlers/list-products.handler.js';

describe('ListProductsHandler (MongoDB Read Store Query)', () => {
  it('deve listar produtos do MongoDB sem filtros adicionais', async () => {
    let capturedFilter: any = null;

    const mockDb = {
      collection: () => ({
        find: (filter: any) => {
          capturedFilter = filter;
          return {
            sort: () => ({
              toArray: async () => [
                {
                  _id: 'p-1',
                  name: 'Mouse',
                  description: 'Óptico',
                  price: 50,
                  stock: 10,
                  createdAt: new Date('2026-01-01T00:00:00Z'),
                },
              ],
            }),
          };
        },
      }),
    };

    const handler = new ListProductsHandler(async () => mockDb as any);
    const result = await handler.execute({});

    assert.deepStrictEqual(capturedFilter, {});
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'p-1');
    assert.strictEqual(result[0].name, 'Mouse');
    assert.strictEqual(result[0].price, 50);
  });

  it('deve construir query com busca textual regex e range de preços no MongoDB', async () => {
    let capturedFilter: any = null;

    const mockDb = {
      collection: () => ({
        find: (filter: any) => {
          capturedFilter = filter;
          return {
            sort: () => ({
              toArray: async () => [],
            }),
          };
        },
      }),
    };

    const handler = new ListProductsHandler(async () => mockDb as any);
    await handler.execute({
      search: 'Gamer',
      minPrice: 100,
      maxPrice: 500,
    });

    assert.ok(capturedFilter.$or, 'Deve conter filtro de busca $or');
    assert.strictEqual(capturedFilter.price.$gte, 100);
    assert.strictEqual(capturedFilter.price.$lte, 500);
  });
});
