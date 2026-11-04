import { Producer } from 'kafkajs';
import { config } from '../config.js';
import { DlqPublisher, DlqPayload } from '../domain/event-processor.js';

export class KafkaDlqPublisher implements DlqPublisher {
  constructor(
    private readonly producer: Producer,
    private readonly dlqTopic = config.kafka.dlqTopic
  ) {}

  async sendToDlq(payload: DlqPayload): Promise<void> {
    const value = typeof payload.rawPayload === 'string'
      ? payload.rawPayload
      : JSON.stringify(payload.rawPayload);

    await this.producer.send({
      topic: this.dlqTopic,
      messages: [
        {
          key: payload.aggregateId || 'unknown',
          value: Buffer.from(value),
          headers: {
            'x-dlq-reason': payload.reason,
            'x-dlq-error': payload.error || '',
            'x-dlq-timestamp': new Date().toISOString(),
            ...(payload.traceparent ? { traceparent: payload.traceparent } : {}),
          },
        },
      ],
    });
  }
}
