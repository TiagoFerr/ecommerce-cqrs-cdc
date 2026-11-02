export interface OrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderCommand {
  customerName: string;
  items: OrderItemInput[];
}