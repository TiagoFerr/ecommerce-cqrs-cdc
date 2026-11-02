import Fastify from 'fastify';
import { productRoutes } from './routes/product.routes.js';
import { orderRoutes } from './routes/order.routes.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  // Healthcheck: monitoramento e orquestração do Docker/Kubernetes
  app.get('/health', async () => {
    return { status: 'ok', service: 'write-service' };
  });

  // Registro das rotas de escrita
  app.register(productRoutes);
  app.register(orderRoutes);

  return app;
}

