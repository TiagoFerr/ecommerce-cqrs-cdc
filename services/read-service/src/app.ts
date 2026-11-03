import Fastify from 'fastify';
import { productRoutes } from './routes/product.routes.js';
import { orderRoutes } from './routes/order.routes.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.get('/health', async () => {
    return { status: 'ok', service: 'read-service' };
  });

  app.register(productRoutes);
  app.register(orderRoutes);

  return app;
}

