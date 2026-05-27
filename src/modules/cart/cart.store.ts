import { randomUUID } from 'crypto';
import { Cart, CartItem } from './cart.model';

/**
 * In-memory Cart store backed by a Map<cartId, Cart>.
 *
 * Intended to be consumed by CartService — never call this directly
 * from controllers. Swap out for a DB-backed implementation without
 * changing the service layer.
 */
export class CartStore {
  /** Primary storage: cartId → Cart */
  private readonly carts = new Map<string, Cart>();

  // ─── Write Operations ─────────────────────────────────────────────────────

  create(userId: string): Cart {
    const now = new Date();
    const cart: Cart = {
      id: randomUUID(),
      userId,
      items: [],
      createdAt: now,
      updatedAt: now,
    };
    this.carts.set(cart.id, cart);
    return cart;
  }

  /**
   * Add or merge a CartItem into an existing cart.
   * If the productId already exists, increments quantity instead of duplicating.
   */
  addItem(cartId: string, item: CartItem): Cart | undefined {
    const cart = this.carts.get(cartId);
    if (!cart) return undefined;

    const existing = cart.items.find((i) => i.productId === item.productId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      cart.items.push({ ...item });
    }

    cart.updatedAt = new Date();
    return cart;
  }

  /**
   * Update the quantity of an existing item.
   * Setting quantity to 0 removes the item from the cart.
   */
  updateItemQuantity(cartId: string, productId: string, quantity: number): Cart | undefined {
    const cart = this.carts.get(cartId);
    if (!cart) return undefined;

    if (quantity <= 0) {
      cart.items = cart.items.filter((i) => i.productId !== productId);
    } else {
      const item = cart.items.find((i) => i.productId === productId);
      if (item) item.quantity = quantity;
    }

    cart.updatedAt = new Date();
    return cart;
  }

  removeItem(cartId: string, productId: string): Cart | undefined {
    return this.updateItemQuantity(cartId, productId, 0);
  }

  clearItems(cartId: string): Cart | undefined {
    const cart = this.carts.get(cartId);
    if (!cart) return undefined;
    cart.items = [];
    cart.updatedAt = new Date();
    return cart;
  }

  // ─── Read Operations ──────────────────────────────────────────────────────

  findById(cartId: string): Cart | undefined {
    return this.carts.get(cartId);
  }

  findByUserId(userId: string): Cart[] {
    return [...this.carts.values()].filter((c) => c.userId === userId);
  }

  getAll(): Cart[] {
    return [...this.carts.values()];
  }

  // ─── Delete Operations ────────────────────────────────────────────────────

  delete(cartId: string): boolean {
    return this.carts.delete(cartId);
  }

  get size(): number {
    return this.carts.size;
  }
}

/** Singleton store instance — shared across the application lifecycle */
export const cartStore = new CartStore();
