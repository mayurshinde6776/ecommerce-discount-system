import { Cart, CartItem, cartItemSubtotal } from './cart.model';

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface CartItemResponse extends CartItem {
  lineTotal: number;
}

export interface CartResponse {
  id: string;
  userId: string;
  items: CartItemResponse[];
  itemCount: number;
  subtotal: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export interface AddCartItemRequest {
  userId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

/**
 * Convert a Cart domain object into the response shape:
 *  - annotates each item with its lineTotal
 *  - computes itemCount (total units) and subtotal
 */
export const toCartResponse = (cart: Cart): CartResponse => {
  const items: CartItemResponse[] = cart.items.map((item) => ({
    ...item,
    lineTotal: cartItemSubtotal(item),
  }));

  const subtotal = parseFloat(items.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2));
  const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

  return {
    id: cart.id,
    userId: cart.userId,
    items,
    itemCount,
    subtotal,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  };
};
