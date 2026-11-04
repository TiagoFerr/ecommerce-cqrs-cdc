import { Db } from 'mongodb';
import { initTelemetry, SpanStatusCode } from '../infrastructure/telemetry.js';

export interface DlqPayload {
  rawPayload: string;
  reason: string;
  aggregateType?: string;
  aggregateId?: string;
  error?: string;
  traceparent?: string;
}

export interface DlqPublisher {
  sendToDlq(payload: DlqPayload): Promise<void>;
}

export interface ProcessResult {
  status: 'processed' | 'routed_to_dlq' | 'skipped_empty' | 'skipped_unknown_aggregate';
  aggregateType?: string;
  aggregateId?: string;
  reason?: string;
}

export class EventProcessor {
  private readonly tracer = initTelemetry('sync-worker');

  constructor(
    private readonly db: Db,
    private readonly dlqPublisher?: DlqPublisher
  ) {}

  async processRawMessage(rawMessage: string | Buffer | null | undefined): Promise<ProcessResult> {
    if (!rawMessage) {
      return { status: 'skipped_empty' };
    }

    const rawString = rawMessage.toString();
    let parsed: any;

    try {
      parsed = JSON.parse(rawString);
    } catch (parseError: any) {
      if (this.dlqPublisher) {
        await this.dlqPublisher.sendToDlq({
          rawPayload: rawString,
          reason: 'invalid_json',
          error: parseError.message,
        });
      }
      return { status: 'routed_to_dlq', reason: 'invalid_json' };
    }

    // Normalização do envelope Debezium CDC:
    // Debezium pode enviar em { payload: { after: { ... } } } ou diretamente { after: { ... } }
    const outboxRecord = parsed.payload?.after || parsed.after || parsed;

    if (!outboxRecord || !outboxRecord.aggregateType || !outboxRecord.aggregateId) {
      if (this.dlqPublisher) {
        await this.dlqPublisher.sendToDlq({
          rawPayload: rawString,
          reason: 'invalid_outbox_format',
          error: 'Missing aggregateType or aggregateId in payload',
        });
      }
      return { status: 'routed_to_dlq', reason: 'invalid_outbox_format' };
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
    const traceparent = data?.traceparent || outboxRecord?.traceparent;

    // Span OpenTelemetry para o ciclo assíncrono do Worker
    const span = this.tracer.startSpan(`sync-worker:sync-${aggregateType.toLowerCase()}`);
    span.setAttribute('cdc.aggregate_type', aggregateType);
    span.setAttribute('cdc.aggregate_id', aggregateId);
    if (eventType) span.setAttribute('cdc.event_type', eventType);
    if (traceparent) span.setAttribute('w3c.traceparent', traceparent);

    try {
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
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
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
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        return { status: 'processed', aggregateType, aggregateId };
      }

      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return { status: 'skipped_unknown_aggregate', aggregateType, aggregateId };
    } catch (dbError: any) {
      span.recordException(dbError);
      span.setStatus({ code: SpanStatusCode.ERROR, message: dbError.message });
      span.end();

      if (this.dlqPublisher) {
        await this.dlqPublisher.sendToDlq({
          rawPayload: rawString,
          reason: 'mongo_write_error',
          aggregateType,
          aggregateId,
          error: dbError.message,
          traceparent,
        });
      }
      return { status: 'routed_to_dlq', aggregateType, aggregateId, reason: 'mongo_write_error' };
    }
  }
}
