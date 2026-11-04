import { FastifyInstance } from 'fastify';
import { GetOrderByIdHandler } from '../domain/handlers/get-order-by-id.handler.js';

export async function orderRoutes(app: FastifyInstance) {
  const getOrderHandler = new GetOrderByIdHandler();

  // GET /orders/:id
  app.get<{ Params: { id: string } }>('/orders/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const order = await getOrderHandler.execute({ id });

      if (!order) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Order with ID '${id}' not found`,
        });
      }

      return reply.send(order);
    } catch (error: any) {
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });
}

