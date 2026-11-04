import 'dotenv/config';
import { buildApp } from './app.js';

const app = buildApp();
const PORT = Number(process.env.PORT) || 3002;

async function start() {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 Read Service running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

