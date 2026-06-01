import { CartStore } from '../cart/cart.store';
import { cartItemSubtotal } from '../cart/cart.model';
import { OrderStore } from '../order/order.store';
import { OrderStatus } from '../order/order.model';
import { DiscountService } from '../discount/discount.service';
import { DiscountCode } from '../discount/discount.model';
import { CheckoutRequest, CheckoutResponse, toCheckoutResponse } from './checkout.dto';
import { NotFoundError, BadRequestError } from '../../errors';

/**
 * CheckoutService orchestrates the full checkout flow:
 *
 *  1. Validate cart exists and is not empty
 *  2. Calculate subtotal from cart items
 *  3. Validate optional discount code (without redeeming it yet)
 *  4. Calculate discount amount
 *  5. Create order as CONFIRMED
 *  6. Redeem discount code (mark as used)
 *  7. Clear the cart
 *  8. Check & issue loyalty coupon (every 5th confirmed order)
 *  9. Return order summary
 *
 * Steps 5-7 are kept close together to minimise the window of
 * inconsistency in a single-threaded in-memory store.
 */
export class CheckoutService {
  constructor(
    private readonly cartStore: CartStore,
    private readonly orderStore: OrderStore,
    private readonly discountService: DiscountService,
  ) {}

  checkout(request: CheckoutRequest): CheckoutResponse {
    const { userId, discountCode } = request;

    // ── 1. Validate input ──────────────────────────────────────────────────────
    if (!userId?.trim()) {
      throw new BadRequestError('userId is required');
    }

    // ── 2. Resolve cart ────────────────────────────────────────────────────────
    const userCarts = this.cartStore.findByUserId(userId.trim());

    if (userCarts.length === 0) {
      throw new NotFoundError(`Cart not found for user "${userId}"`);
    }

    // Pick most recently updated cart
    const cart = userCarts.sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    )[0];

    if (cart.items.length === 0) {
      throw new BadRequestError('Cannot checkout an empty cart');
    }

    // ── 3. Calculate subtotal ──────────────────────────────────────────────────
    const subtotal = parseFloat(
      cart.items.reduce((sum, item) => sum + cartItemSubtotal(item), 0).toFixed(2),
    );

    // ── 4. Validate discount code (read-only, no side effects yet) ─────────────
    let appliedCode: DiscountCode | undefined;
    let discountAmount = 0;

    if (discountCode?.trim()) {
      const validation = this.discountService.validateDiscountCode(discountCode.trim());

      if (!validation.valid) {
        throw new BadRequestError(validation.reason ?? 'Invalid discount code');
      }

      appliedCode = validation.discountCode!;
      discountAmount = parseFloat(
        ((subtotal * appliedCode.percentage) / 100).toFixed(2),
      );
    }

    const total = parseFloat((subtotal - discountAmount).toFixed(2));

    // ── 5. Create order (CONFIRMED immediately for this assignment) ────────────
    const order = this.orderStore.create({
      userId: userId.trim(),
      items: cart.items,
      subtotal,
      discount: discountAmount,
      total,
      ...(appliedCode && { discountCode: appliedCode.code }),
    });

    this.orderStore.updateStatus(order.id, OrderStatus.CONFIRMED);

    // ── 6. Mark discount code as used (only after order is persisted) ──────────
    if (appliedCode) {
      this.discountService.markDiscountAsUsed(appliedCode.code);
    }

    // ── 7. Clear the cart ──────────────────────────────────────────────────────
    this.cartStore.clearItems(cart.id);

    // ── 8. Check loyalty reward (every 5th confirmed order) ────────────────────
    const rewardResult = this.discountService.checkAndRewardUser(userId.trim());

    // ── 9. Return summary ──────────────────────────────────────────────────────
    // Re-fetch to get the CONFIRMED status reflected
    const confirmedOrder = this.orderStore.findById(order.id)!;

    return toCheckoutResponse(
      confirmedOrder,
      rewardResult.rewarded ? rewardResult.coupon : undefined,
    );
  }
}
