import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventProcessor, DlqPublisher, DlqPayload } from '../src/domain/event-processor.js';

describe('EventProcessor (Debezium CDC to MongoDB Sync & DLQ Resilience)', () => {
  it('deve ignorar com segurança payloads vazios', async () => {
    const processor = new EventProcessor({} as any);
    const emptyRes = await processor.processRawMessage(null);
    assert.strictEqual(emptyRes.status, 'skipped_empty');
  });

  it('deve rotear payload com JSON corrompido para a DLQ', async () => {
    let capturedDlqPayload: DlqPayload | null = null;
    const mockDlq: DlqPublisher = {
      sendToDlq: async (payload) => {
        capturedDlqPayload = payload;
      },
    };

    const processor = new EventProcessor({} as any, mockDlq);
    const result = await processor.processRawMessage('invalid-json-{corrupt');

    assert.strictEqual(result.status, 'routed_to_dlq');
    assert.strictEqual(result.reason, 'invalid_json');
    assert.strictEqual(capturedDlqPayload?.reason, 'invalid_json');
    assert.strictEqual(capturedDlqPayload?.rawPayload, 'invalid-json-{corrupt');
  });

  it('deve rotear mensagem malformada (sem aggregateType ou aggregateId) para a DLQ', async () => {
    let capturedDlqPayload: DlqPayload | null = null;
    const mockDlq: DlqPublisher = {
      sendToDlq: async (payload) => {
        capturedDlqPayload = payload;
      },
    };

    const processor = new EventProcessor({} as any, mockDlq);
    const poisonPillMessage = JSON.stringify({ someRandomField: 'unexpected_value' });
    const result = await processor.processRawMessage(poisonPillMessage);

    assert.strictEqual(result.status, 'routed_to_dlq');
    assert.strictEqual(result.reason, 'invalid_outbox_format');
    assert.strictEqual(capturedDlqPayload?.reason, 'invalid_outbox_format');
  });

  it('deve rotear para a DLQ quando a escrita no MongoDB falha', async () => {
    let capturedDlqPayload: DlqPayload | null = null;
    const mockDlq: DlqPublisher = {
      sendToDlq: async (payload) => {
        capturedDlqPayload = payload;
      },
    };

    const failingDb = {
      collection: () => ({
        updateOne: async () => {
          throw new Error('Mongo write conflict or connection timeout');
        },
      }),
    };

    const processor = new EventProcessor(failingDb as any, mockDlq);
    const debeziumMessage = JSON.stringify({
      payload: {
        after: {
          id: 'outbox-uuid-fail',
          aggregateType: 'Product',
          aggregateId: 'prod-fail',
          eventType: 'ProductCreated',
          payload: { id: 'prod-fail', name: 'Falha' },
        },
      },
    });

    const result = await processor.processRawMessage(debeziumMessage);

    assert.strictEqual(result.status, 'routed_to_dlq');
    assert.strictEqual(result.reason, 'mongo_write_error');
    assert.strictEqual(capturedDlqPayload?.reason, 'mongo_write_error');
    assert.strictEqual(capturedDlqPayload?.error, 'Mongo write conflict or connection timeout');
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
            traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
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
