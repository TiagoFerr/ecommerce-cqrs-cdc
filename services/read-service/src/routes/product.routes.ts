import { FastifyInstance } from 'fastify';
import { ListProductsHandler } from '../domain/handlers/list-products.handler.js';
import { GetProductByIdHandler } from '../domain/handlers/get-product-by-id.handler.js';

export async function productRoutes(app: FastifyInstance) {
  const listHandler = new ListProductsHandler();
  const getByIdHandler = new GetProductByIdHandler();

  // GET /products?search=teclado&minPrice=100&maxPrice=500
  app.get<{
    Querystring: { search?: string; minPrice?: string; maxPrice?: string };
  }>('/products', async (request, reply) => {
    try {
      const { search, minPrice, maxPrice } = request.query;

      const result = await listHandler.execute({
        search,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
      });

      return reply.send(result);
    } catch (error: any) {
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });

  // GET /products/:id
  app.get<{ Params: { id: string } }>('/products/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const product = await getByIdHandler.execute({ id });

      if (!product) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Product with ID '${id}' not found`,
        });
      }

      return reply.send(product);
    } catch (error: any) {
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });
}

