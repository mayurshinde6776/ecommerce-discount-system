import { CartItem } from '../cart/cart.model';

// ─── Order Status ────────────────────────────────────────────────────────────

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

// ─── Order Interface ─────────────────────────────────────────────────────────

/**
 * A placed order — snapshot of the cart at checkout time.
 *
 * Pricing breakdown:
 *   subtotal  = sum of (item.price × item.quantity)
 *   discount  = amount deducted (always ≥ 0)
 *   total     = subtotal - discount
 */
export interface Order {
  id: string;
  userId: string;
  /** Snapshot of the cart items at the time of checkout */
  items: CartItem[];
  /** Original cart total before any discount */
  subtotal: number;
  /** Absolute amount discounted (derived from discountCode.percentage) */
  discount: number;
  /** Final amount charged to the customer */
  total: number;
  /** The discount code applied, if any */
  discountCode?: string;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

// ─── DTO used to create an order ─────────────────────────────────────────────

export interface CreateOrderInput {
  userId: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  discountCode?: string;
}
