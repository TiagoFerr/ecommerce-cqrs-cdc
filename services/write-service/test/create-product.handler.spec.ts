import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CreateProductHandler } from '../src/domain/handlers/create-product.handler.js';

describe('CreateProductHandler (CQRS Command Handler)', () => {
  it('deve rejeitar produto sem nome', async () => {
    const handler = new CreateProductHandler({} as any);

    await assert.rejects(
      async () => {
        await handler.execute({
          name: '',
          price: 100,
          stock: 10,
        });
      },
      {
        name: 'Error',
        message: 'Product name is required',
      }
    );
  });

  it('deve rejeitar produto com preço menor ou igual a zero', async () => {
    const handler = new CreateProductHandler({} as any);

    await assert.rejects(
      async () => {
        await handler.execute({
          name: 'Mouse Gamer',
          price: 0,
          stock: 10,
        });
      },
      {
        name: 'Error',
        message: 'Product price must be greater than zero',
      }
    );
  });

  it('deve rejeitar produto com estoque negativo', async () => {
    const handler = new CreateProductHandler({} as any);

    await assert.rejects(
      async () => {
        await handler.execute({
          name: 'Mouse Gamer',
          price: 150,
          stock: -1,
        });
      },
      {
        name: 'Error',
        message: 'Product stock cannot be negative',
      }
    );
  });

  it('deve persistir e retornar DTO do produto com sucesso', async () => {
    const mockDb = {
      product: {
        create: async ({ data }: any) => ({
          ...data,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        }),
      },
    };

    const handler = new CreateProductHandler(mockDb as any);

    const result = await handler.execute({
      name: 'Monitor UltraWide 34"',
      description: 'Painel IPS 144Hz',
      price: 2500,
      stock: 5,
    });

    assert.ok(result.id, 'ID deve ser gerado');
    assert.strictEqual(result.name, 'Monitor UltraWide 34"');
    assert.strictEqual(result.price, 2500);
    assert.strictEqual(result.stock, 5);
  });
});
