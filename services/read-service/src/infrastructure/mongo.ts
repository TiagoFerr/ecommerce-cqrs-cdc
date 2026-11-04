import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://root:root@localhost:27017/ecommerce_read?authSource=admin';
const DB_NAME = 'ecommerce_read';

export async function getMongoDb(): Promise<Db> {
  if (db) {
    return db;
  }

  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);

  return db;
}
