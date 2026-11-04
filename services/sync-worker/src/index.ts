import 'dotenv/config';
import { getMongoDb } from './infrastructure/mongo.js';
import { createConsumer, createProducer } from './infrastructure/kafka.js';
import { KafkaDlqPublisher } from './infrastructure/kafka-dlq.publisher.js';
import { EventProcessor } from './domain/event-processor.js';
import { config } from './config.js';

async function start() {
  console.log('🚀 Initializing Sync Worker (CDC Consumer & DLQ Resilience)...');

  try {
    const db = await getMongoDb();
    const consumer = createConsumer();
    const producer = createProducer();

    await producer.connect();
    console.log('⚡ Connected Kafka Producer (DLQ Routing):', config.kafka.dlqTopic);

    const dlqPublisher = new KafkaDlqPublisher(producer);
    const processor = new EventProcessor(db, dlqPublisher);

    await consumer.connect();
    console.log('⚡ Connected to Apache Kafka broker(s):', config.kafka.brokers);

    await consumer.subscribe({
      topic: config.kafka.topic,
      fromBeginning: true,
    });
    console.log(`📡 Subscribed to topic: "${config.kafka.topic}"`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const value = message.value?.toString();
        const result = await processor.processRawMessage(value);

        if (result.status === 'processed') {
          console.log(`✅ [${result.aggregateType}] ID '${result.aggregateId}' synced to MongoDB.`);
        } else if (result.status === 'routed_to_dlq') {
          console.warn(`⚠️ [DLQ] Message routed to DLQ topic "${config.kafka.dlqTopic}". Reason: ${result.reason}`);
        }
      },
    });

    const shutdown = async () => {
      console.log('Gracefully stopping Sync Worker...');
      await consumer.disconnect();
      await producer.disconnect();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Fatal error starting Sync Worker:', error);
    process.exit(1);
  }
}

start();
