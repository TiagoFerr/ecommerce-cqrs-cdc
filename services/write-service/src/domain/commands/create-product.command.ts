export interface CreateProductCommand {
  name: string;
  description?: string;
  price: number;
  stock: number;
}