import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyHttpProxy from '@fastify/http-proxy';
import { GatewayConfig, config as defaultConfig } from './config.js';

export async function buildApp(customConfig: Partial<GatewayConfig> = {}): Promise<FastifyInstance> {
  const cfg = { ...defaultConfig, ...customConfig };

  const app = Fastify({
    logger: false, // desativa logs redundantes em ambiente de testes para manter saída limpa
  });

  // Habilita CORS para permitir consumo seguro por aplicações Web/Mobile
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Healthcheck agregador: monitora a saúde consolidada do ecossistema distribuído
  app.get('/health', async (request, reply) => {
    const checkService = async (baseUrl: string) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          return { status: 'healthy', url: baseUrl };
        }
        return { status: 'unhealthy', url: baseUrl, statusCode: res.status };
      } catch (err: any) {
        return { status: 'unreachable', url: baseUrl, error: err.message };
      }
    };

    const [writeHealth, readHealth] = await Promise.all([
      checkService(cfg.writeServiceUrl),
      checkService(cfg.readServiceUrl),
    ]);

    const isAllHealthy = writeHealth.status === 'healthy' && readHealth.status === 'healthy';

    return reply.status(isAllHealthy ? 200 : 503).send({
      status: isAllHealthy ? 'ok' : 'degraded',
      service: 'api-gateway',
      downstream: {
        writeService: writeHealth,
        readService: readHealth,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // ========================================================
  // Roteamento CQRS (Proxy Reverso Declarativo)
  // ========================================================

  // 1. QUERIES (Consultas HTTP GET) -> Read Service (Porta 3002)
  await app.register(fastifyHttpProxy, {
    upstream: cfg.readServiceUrl,
    prefix: '/products',
    rewritePrefix: '/products',
    httpMethods: ['GET'],
  });

  await app.register(fastifyHttpProxy, {
    upstream: cfg.readServiceUrl,
    prefix: '/orders',
    rewritePrefix: '/orders',
    httpMethods: ['GET'],
  });

  // 2. COMMANDS (Mutações HTTP POST) -> Write Service (Porta 3001)
  await app.register(fastifyHttpProxy, {
    upstream: cfg.writeServiceUrl,
    prefix: '/products',
    rewritePrefix: '/products',
    httpMethods: ['POST'],
  });

  await app.register(fastifyHttpProxy, {
    upstream: cfg.writeServiceUrl,
    prefix: '/orders',
    rewritePrefix: '/orders',
    httpMethods: ['POST'],
  });

  return app;
}
