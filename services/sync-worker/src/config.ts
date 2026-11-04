import 'dotenv/config';

export const config = {
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'sync-worker',
    groupId: process.env.KAFKA_GROUP_ID || 'ecommerce-sync-group',
    topic: process.env.KAFKA_TOPIC || 'ecommerce_cdc.public.outbox',
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://root:root@localhost:27017/ecommerce_read?authSource=admin',
    dbName: 'ecommerce_read',
  },
};
