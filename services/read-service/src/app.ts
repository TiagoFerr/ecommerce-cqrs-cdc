import Fastify from 'fastify';
import { productRoutes } from './routes/product.routes.js';
import { orderRoutes } from './routes/order.routes.js';
import { initTelemetry, SpanStatusCode } from './infrastructure/telemetry.js';

export function buildApp() {
  const tracer = initTelemetry('read-service');

  const app = Fastify({
    logger: false, // saída limpa em logs e testes
  });

  // OpenTelemetry Tracing Hook: rastreamento de queries de leitura
  app.addHook('onRequest', async (request, reply) => {
    const span = tracer.startSpan(`read-service ${request.method} ${request.url}`);
    (request as any).otelSpan = span;
  });

  app.addHook('onResponse', async (request, reply) => {
    const span = (request as any).otelSpan;
    if (span) {
      span.setAttribute('http.status_code', reply.statusCode);
      span.setAttribute('http.method', request.method);
      span.setAttribute('http.url', request.url);
      span.setStatus({
        code: reply.statusCode < 400 ? SpanStatusCode.OK : SpanStatusCode.ERROR,
      });
      span.end();
    }
  });

  app.get('/health', async () => {
    return { status: 'ok', service: 'read-service' };
  });

  app.register(productRoutes);
  app.register(orderRoutes);

  return app;
}
