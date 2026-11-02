import { prisma } from "../../infrastructure/prisma.js";
import { CreateProductCommand } from "../commands/create-product.command.js";

export class CreateProductHandler {
  async execute(command: CreateProductCommand) {
    if (!command.name || command.name.trim() === "") {
      throw new Error("Product name is required");
    }

    if (command.price <= 0) {
      throw new Error("Product price must be greater than zero");
    }

    if (command.stock < 0) {
      throw new Error("Product stock cannot be negative");
    }

    const product = await prisma.product.create({
      data: {
        name: command.name,
        description: command.description,
        price: command.price,
        stock: command.stock,
      },
    });

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: Number(product.price),
      stock: product.stock,
      createdAt: product.createdAt,
    };
  }
}
