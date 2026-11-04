import 'dotenv/config';
import { getMongoDb } from './infrastructure/mongo.js';
import { createConsumer } from './infrastructure/kafka.js';
import { EventProcessor } from './domain/event-processor.js';
import { config } from './config.js';

async function start() {
  console.log('🚀 Initializing Sync Worker (CDC Consumer)...');

  try {
    const db = await getMongoDb();
    const processor = new EventProcessor(db);
    const consumer = createConsumer();

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
        }
      },
    });

    const shutdown = async () => {
      console.log('Gracefully stopping Sync Worker...');
      await consumer.disconnect();
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
