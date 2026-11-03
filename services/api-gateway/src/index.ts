import 'dotenv/config';
import { buildApp } from './app.js';
import { config } from './config.js';

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🚀 API Gateway running on http://localhost:${config.port}`);
    console.log(`   👉 Commands -> Write Service: ${config.writeServiceUrl}`);
    console.log(`   👉 Queries  -> Read Service:  ${config.readServiceUrl}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
