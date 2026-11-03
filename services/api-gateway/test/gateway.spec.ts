import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify, { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('API Gateway (CQRS Single Entry Point)', () => {
  let mockWriteService: FastifyInstance;
  let mockReadService: FastifyInstance;
  let writePort: number;
  let readPort: number;
  let gatewayApp: FastifyInstance;

  before(async () => {
    // 1. Mock do Write Service (recebe Commands)
    mockWriteService = Fastify();
    mockWriteService.get('/health', async () => ({ status: 'ok', service: 'mock-write' }));
    mockWriteService.post('/products', async (req, reply) => {
      return reply.status(201).send({ id: 'prod-write-1', ...(req.body as object) });
    });
    mockWriteService.post('/orders', async (req, reply) => {
      return reply.status(201).send({ id: 'order-write-1', ...(req.body as object) });
    });
    await mockWriteService.listen({ port: 0, host: '127.0.0.1' });
    writePort = (mockWriteService.server.address() as any).port;

    // 2. Mock do Read Service (recebe Queries)
    mockReadService = Fastify();
    mockReadService.get('/health', async () => ({ status: 'ok', service: 'mock-read' }));
    mockReadService.get('/products', async () => {
      return [{ id: 'prod-read-1', name: 'Teclado' }];
    });
    mockReadService.get('/orders/:id', async (req) => {
      return { id: (req.params as any).id, status: 'CONFIRMED' };
    });
    await mockReadService.listen({ port: 0, host: '127.0.0.1' });
    readPort = (mockReadService.server.address() as any).port;

    // 3. Inicialização do Gateway apontando para as portas mockadas
    gatewayApp = await buildApp({
      writeServiceUrl: `http://127.0.0.1:${writePort}`,
      readServiceUrl: `http://127.0.0.1:${readPort}`,
    });
    await gatewayApp.ready();
  });

  after(async () => {
    await gatewayApp.close();
    await mockWriteService.close();
    await mockReadService.close();
  });

  it('deve retornar status saudável no /health agregando os serviços downstream', async () => {
    const res = await gatewayApp.inject({
      method: 'GET',
      url: '/health',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.status, 'ok');
    assert.strictEqual(body.service, 'api-gateway');
    assert.strictEqual(body.downstream.writeService.status, 'healthy');
    assert.strictEqual(body.downstream.readService.status, 'healthy');
  });

  it('deve rotear POST /products (Command) transparentemente para o Write Service', async () => {
    const res = await gatewayApp.inject({
      method: 'POST',
      url: '/products',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({ name: 'Mouse Sem Fio', price: 120 }),
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.id, 'prod-write-1');
    assert.strictEqual(body.name, 'Mouse Sem Fio');
  });

  it('deve rotear GET /products (Query) transparentemente para o Read Service', async () => {
    const res = await gatewayApp.inject({
      method: 'GET',
      url: '/products',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(Array.isArray(body), true);
    assert.strictEqual(body[0].id, 'prod-read-1');
  });

  it('deve rotear POST /orders (Command) para o Write Service', async () => {
    const res = await gatewayApp.inject({
      method: 'POST',
      url: '/orders',
      headers: { 'Content-Type': 'application/json' },
      payload: JSON.stringify({ customerName: 'Tiago Ferreira' }),
    });

    assert.strictEqual(res.statusCode, 201);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.id, 'order-write-1');
  });

  it('deve rotear GET /orders/:id (Query) para o Read Service', async () => {
    const res = await gatewayApp.inject({
      method: 'GET',
      url: '/orders/order-xyz-789',
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.id, 'order-xyz-789');
    assert.strictEqual(body.status, 'CONFIRMED');
  });
});
