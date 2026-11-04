import { FastifyInstance } from 'fastify';
import { CreateOrderHandler } from '../domain/handlers/create-order.handler.js';
import { CreateOrderCommand } from '../domain/commands/create-order.command.js';

export async function orderRoutes(app: FastifyInstance) {
  const handler = new CreateOrderHandler();

  // Endpoint de Comando: POST /orders
  app.post<{ Body: CreateOrderCommand }>('/orders', async (request, reply) => {
    try {
      const command: CreateOrderCommand = request.body;
      const traceparent = request.headers['traceparent'] as string | undefined;
      const result = await handler.execute(command, { traceparent });
      return reply.status(201).send(result);
    } catch (error: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: error.message,
      });
    }
  });
}
