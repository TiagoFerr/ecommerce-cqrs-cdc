import { Kafka, Consumer } from 'kafkajs';
import { config } from '../config.js';

const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
});

export function createConsumer(): Consumer {
  return kafka.consumer({ groupId: config.kafka.groupId });
}
