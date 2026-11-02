import { FastifyInstance } from 'fastify';
import { CreateProductHandler } from '../domain/handlers/create-product.handler.js';
import { CreateProductCommand } from '../domain/commands/create-product.command.js';

export async function productRoutes(app: FastifyInstance) {
  const handler = new CreateProductHandler();

  // Endpoint de Comando: POST /products
  // Responsabilidade única: receber o HTTP, instanciar o Command e delegar para o Handler.
  app.post<{ Body: CreateProductCommand }>('/products', async (request, reply) => {
    try {
      const command: CreateProductCommand = request.body;
      const result = await handler.execute(command);
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

