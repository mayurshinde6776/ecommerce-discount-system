import { CartStore } from './cart.store';
import { CartResponse, AddCartItemRequest, toCartResponse } from './cart.dto';
import { NotFoundError, BadRequestError } from '../../errors';

/**
 * CartService owns all cart business logic.
 *
 * Rules enforced here:
 *  - A user has at most ONE active cart (first cart found).
 *    A cart is auto-created on first item add.
 *  - price must be a positive number.
 *  - quantity must be a positive integer.
 *  - Adding the same productId again adds to the existing quantity.
 */
export class CartService {
  constructor(private readonly store: CartStore) {}

  // ─── Add Item ─────────────────────────────────────────────────────────────

  /**
   * Adds (or merges) an item into the user's cart.
   * Auto-creates the cart if none exists for that user.
   */
  addItem(input: AddCartItemRequest): CartResponse {
    this.validateItem(input);

    // Resolve or create the user's single active cart
    const existingCarts = this.store.findByUserId(input.userId);
    const cart = existingCarts.length > 0 ? existingCarts[0] : this.store.create(input.userId);

    const updated = this.store.addItem(cart.id, {
      productId: input.productId,
      name: input.name.trim(),
      price: input.price,
      quantity: input.quantity,
    });

    // updated is always defined here — we just resolved/created the cart
    return toCartResponse(updated!);
  }

  // ─── Get Cart ─────────────────────────────────────────────────────────────

  /**
   * Retrieves the active cart for a user.
   * Throws NotFoundError if no cart exists.
   */
  getCartByUserId(userId: string): CartResponse {
    if (!userId?.trim()) {
      throw new BadRequestError('userId is required');
    }

    const carts = this.store.findByUserId(userId.trim());

    if (carts.length === 0) {
      throw new NotFoundError(`Cart not found for user "${userId}"`);
    }

    // Return the most recently updated cart first
    const active = carts.sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    )[0];

    return toCartResponse(active);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private validateItem(input: AddCartItemRequest): void {
    const errors: string[] = [];

    if (!input.userId?.trim()) errors.push('userId is required');
    if (!input.productId?.trim()) errors.push('productId is required');
    if (!input.name?.trim()) errors.push('name is required');

    if (input.price === undefined || input.price === null) {
      errors.push('price is required');
    } else if (typeof input.price !== 'number' || !isFinite(input.price) || input.price <= 0) {
      errors.push('price must be a positive number');
    }

    if (input.quantity === undefined || input.quantity === null) {
      errors.push('quantity is required');
    } else if (
      !Number.isInteger(input.quantity) ||
      input.quantity <= 0
    ) {
      errors.push('quantity must be a positive integer');
    }

    if (errors.length > 0) {
      throw new BadRequestError(errors.join('; '));
    }
  }
}
