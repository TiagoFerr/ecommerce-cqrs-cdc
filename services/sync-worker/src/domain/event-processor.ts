import { Db } from 'mongodb';

export interface OutboxPayload {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: any;
}

export class EventProcessor {
  constructor(private readonly db: Db) {}

  async processRawMessage(rawMessage: string | Buffer | null | undefined): Promise<{ status: string; aggregateType?: string; aggregateId?: string }> {
    if (!rawMessage) {
      return { status: 'skipped_empty' };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawMessage.toString());
    } catch {
      return { status: 'error_invalid_json' };
    }

    // Normalização do envelope Debezium CDC:
    // Debezium pode enviar em { payload: { after: { ... } } } ou diretamente { after: { ... } }
    const outboxRecord = parsed.payload?.after || parsed.after || parsed;

    if (!outboxRecord || !outboxRecord.aggregateType || !outboxRecord.aggregateId) {
      return { status: 'skipped_not_outbox_format' };
    }

    let data = outboxRecord.payload;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        // mantém como string se não for JSON
      }
    }

    const { aggregateType, aggregateId, eventType } = outboxRecord;

    // Idempotência garantida via upsert no MongoDB pelo _id único da entidade
    if (aggregateType === 'Product') {
      await this.db.collection('products').updateOne(
        { _id: aggregateId as any },
        {
          $set: {
            ...data,
            _id: aggregateId,
            syncedAt: new Date(),
          },
        },
        { upsert: true }
      );
      return { status: 'processed', aggregateType, aggregateId };
    }

    if (aggregateType === 'Order') {
      await this.db.collection('orders').updateOne(
        { _id: aggregateId as any },
        {
          $set: {
            ...data,
            _id: aggregateId,
            syncedAt: new Date(),
          },
        },
        { upsert: true }
      );
      return { status: 'processed', aggregateType, aggregateId };
    }

    return { status: 'skipped_unknown_aggregate', aggregateType, aggregateId };
  }
}
