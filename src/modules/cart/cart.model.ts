/**
 * Represents a single line-item in a cart.
 */
export interface CartItem {
  productId: string;
  name: string;
  /** Unit price in minor currency units (e.g. paise / cents) or decimal */
  price: number;
  quantity: number;
}

/**
 * Computed subtotal for a single CartItem.
 * Pure helper — no mutation.
 */
export const cartItemSubtotal = (item: CartItem): number =>
  parseFloat((item.price * item.quantity).toFixed(2));

/**
 * A shopping cart belonging to a user session.
 * Multiple carts per user are allowed (e.g. saved / active).
 */
export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  createdAt: Date;
  updatedAt: Date;
}
