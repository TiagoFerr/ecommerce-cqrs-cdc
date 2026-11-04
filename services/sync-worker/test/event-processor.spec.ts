import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventProcessor } from '../src/domain/event-processor.js';

describe('EventProcessor (Debezium CDC to MongoDB Sync)', () => {
  it('deve ignorar com segurança payloads vazios ou inválidos', async () => {
    const processor = new EventProcessor({} as any);

    const emptyRes = await processor.processRawMessage(null);
    assert.strictEqual(emptyRes.status, 'skipped_empty');

    const invalidRes = await processor.processRawMessage('not-a-json');
    assert.strictEqual(invalidRes.status, 'error_invalid_json');
  });

  it('deve processar evento CDC do Debezium e projetar Produto no MongoDB', async () => {
    let capturedFilter: any = null;
    let capturedUpdate: any = null;
    let capturedOptions: any = null;

    const mockDb = {
      collection: (name: string) => {
        assert.strictEqual(name, 'products');
        return {
          updateOne: async (filter: any, update: any, options: any) => {
            capturedFilter = filter;
            capturedUpdate = update;
            capturedOptions = options;
            return { acknowledged: true };
          },
        };
      },
    };

    const processor = new EventProcessor(mockDb as any);

    // Simulação do envelope oficial emitido pelo conector Debezium PostgreSQL CDC
    const debeziumMessage = JSON.stringify({
      payload: {
        after: {
          id: 'outbox-uuid-1',
          aggregateType: 'Product',
          aggregateId: 'prod-100',
          eventType: 'ProductCreated',
          payload: {
            id: 'prod-100',
            name: 'Cadeira Gamer Ergonômica',
            price: 1200,
            stock: 8,
          },
        },
        op: 'c',
      },
    });

    const result = await processor.processRawMessage(debeziumMessage);

    assert.strictEqual(result.status, 'processed');
    assert.strictEqual(result.aggregateType, 'Product');
    assert.strictEqual(result.aggregateId, 'prod-100');

    // Validação de idempotência e projeção no MongoDB
    assert.deepStrictEqual(capturedFilter, { _id: 'prod-100' });
    assert.strictEqual(capturedUpdate.$set.name, 'Cadeira Gamer Ergonômica');
    assert.strictEqual(capturedUpdate.$set.price, 1200);
    assert.strictEqual(capturedOptions.upsert, true);
  });

  it('deve processar evento CDC do Debezium e projetar Pedido com itens no MongoDB', async () => {
    let capturedFilter: any = null;
    let capturedUpdate: any = null;

    const mockDb = {
      collection: (name: string) => {
        assert.strictEqual(name, 'orders');
        return {
          updateOne: async (filter: any, update: any, options: any) => {
            capturedFilter = filter;
            capturedUpdate = update;
            return { acknowledged: true };
          },
        };
      },
    };

    const processor = new EventProcessor(mockDb as any);

    const debeziumMessage = JSON.stringify({
      payload: {
        after: {
          id: 'outbox-uuid-2',
          aggregateType: 'Order',
          aggregateId: 'order-200',
          eventType: 'OrderCreated',
          payload: JSON.stringify({
            id: 'order-200',
            customerName: 'Tiago Ferreira',
            totalAmount: 2400,
            status: 'PENDING',
            items: [
              { productId: 'prod-100', quantity: 2, unitPrice: 1200 },
            ],
          }),
        },
        op: 'c',
      },
    });

    const result = await processor.processRawMessage(debeziumMessage);

    assert.strictEqual(result.status, 'processed');
    assert.strictEqual(result.aggregateType, 'Order');
    assert.strictEqual(result.aggregateId, 'order-200');

    assert.deepStrictEqual(capturedFilter, { _id: 'order-200' });
    assert.strictEqual(capturedUpdate.$set.customerName, 'Tiago Ferreira');
    assert.strictEqual(capturedUpdate.$set.totalAmount, 2400);
    assert.strictEqual(capturedUpdate.$set.items.length, 1);
  });
});
