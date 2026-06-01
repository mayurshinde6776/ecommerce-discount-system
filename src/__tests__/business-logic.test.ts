/**
 * Business Logic Tests
 * ====================
 * These tests document and protect the core business rules of the system.
 * They are organised by DOMAIN RULE, not by class or method.
 *
 * Four rule groups:
 *  1. Discount Validation Rules
 *  2. Nth-Order Coupon Generation
 *  3. Checkout Calculation Correctness
 *  4. Invalid Coupon Handling
 *
 * Each test is designed to read like a product specification.
 * No HTTP layer — pure service-level assertions.
 */

import { DiscountService } from '../modules/discount/discount.service';
import { DiscountStore } from '../modules/discount/discount.store';
import { OrderStore } from '../modules/order/order.store';
import { OrderStatus } from '../modules/order/order.model';
import { CheckoutService } from '../modules/checkout/checkout.service';
import { CartStore } from '../modules/cart/cart.store';

// ─── Shared factory ────────────────────────────────────────────────────────────

/**
 * Creates a fully isolated set of services per test.
 * No shared singletons — every test starts from a blank slate.
 */
const makeStack = () => {
  const cartStore = new CartStore();
  const orderStore = new OrderStore();
  const discountStore = new DiscountStore();
  const discountService = new DiscountService(discountStore, orderStore);
  const checkoutService = new CheckoutService(cartStore, orderStore, discountService);
  return { cartStore, orderStore, discountStore, discountService, checkoutService };
};

/** Seed a cart with a single product and return the cartId */
const seedCart = (
  cartStore: CartStore,
  userId: string,
  price = 100,
  quantity = 2,
): string => {
  const cart = cartStore.create(userId);
  cartStore.addItem(cart.id, { productId: 'prod-1', name: 'Widget', price, quantity });
  return cart.id;
};

/** Perform N full checkouts for a user, re-adding items each time */
const doCheckouts = (
  checkoutService: CheckoutService,
  cartStore: CartStore,
  userId: string,
  count: number,
  price = 100,
  quantity = 1,
) => {
  const results = [];
  for (let i = 0; i < count; i++) {
    const existing = cartStore.findByUserId(userId);
    if (existing.length > 0) {
      cartStore.addItem(existing[0].id, { productId: 'p1', name: 'X', price, quantity });
    } else {
      seedCart(cartStore, userId, price, quantity);
    }
    results.push(checkoutService.checkout({ userId }));
  }
  return results;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. DISCOUNT VALIDATION RULES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Business Rule: Discount Validation', () => {
  /**
   * RULE: A discount code is only redeemable when ALL three conditions hold:
   *   (a) the code exists in the store
   *   (b) isActive === true
   *   (c) isUsed === false
   */

  it('RULE-DV-01 — a fresh, active, unused code is valid', () => {
    const { discountStore, discountService } = makeStack();
    discountStore.create({ code: 'FRESH10', percentage: 10 });

    const result = discountService.validateDiscountCode('FRESH10');

    expect(result.valid).toBe(true);
    expect(result.discountCode?.code).toBe('FRESH10');
    expect(result.reason).toBeUndefined();
  });

  it('RULE-DV-02 — validation is case-insensitive (lowercase input must match)', () => {
    const { discountStore, discountService } = makeStack();
    discountStore.create({ code: 'UPPER', percentage: 15 });

    expect(discountService.validateDiscountCode('upper').valid).toBe(true);
    expect(discountService.validateDiscountCode('Upper').valid).toBe(true);
    expect(discountService.validateDiscountCode('UPPER').valid).toBe(true);
  });

  it('RULE-DV-03 — validation has no side effects (calling it 3× leaves code still valid)', () => {
    const { discountStore, discountService } = makeStack();
    discountStore.create({ code: 'NOEFFECT', percentage: 10 });

    discountService.validateDiscountCode('NOEFFECT');
    discountService.validateDiscountCode('NOEFFECT');
    const third = discountService.validateDiscountCode('NOEFFECT');

    expect(third.valid).toBe(true);
    expect(discountStore.findByCode('NOEFFECT')?.isUsed).toBe(false);
  });

  it('RULE-DV-04 — an empty string is invalid, not a server error', () => {
    const { discountService } = makeStack();

    const result = discountService.validateDiscountCode('');

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/required/i);
  });

  it('RULE-DV-05 — whitespace-only input is treated as empty', () => {
    const { discountService } = makeStack();

    const result = discountService.validateDiscountCode('   ');

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/required/i);
  });

  it('RULE-DV-06 — percentage must be in range (1–100) when creating codes', () => {
    const { discountService } = makeStack();

    expect(() => discountService.generateDiscountCode(0)).toThrow(/percentage/i);
    expect(() => discountService.generateDiscountCode(101)).toThrow(/percentage/i);
    expect(() => discountService.generateDiscountCode(-5)).toThrow(/percentage/i);

    // Boundary values that ARE valid
    expect(() => discountService.generateDiscountCode(1)).not.toThrow();
    expect(() => discountService.generateDiscountCode(100)).not.toThrow();
  });

  it('RULE-DV-07 — calculateDiscount produces correct amount for standard percentages', () => {
    const { discountStore, discountService } = makeStack();
    discountStore.create({ code: 'PCT10', percentage: 10 });
    discountStore.create({ code: 'PCT20', percentage: 20 });
    discountStore.create({ code: 'PCT50', percentage: 50 });

    expect(discountService.calculateDiscount(200, 'PCT10')).toBe(20);
    expect(discountService.calculateDiscount(200, 'PCT20')).toBe(40);
    expect(discountService.calculateDiscount(200, 'PCT50')).toBe(100);
  });

  it('RULE-DV-08 — discount amount is rounded to 2 decimal places', () => {
    const { discountStore, discountService } = makeStack();
    discountStore.create({ code: 'ODD', percentage: 10 });

    // 10% of 99.99 = 9.999 → rounds to 10.00
    expect(discountService.calculateDiscount(99.99, 'ODD')).toBe(10);

    // 10% of 33.33 = 3.333 → rounds to 3.33
    expect(discountService.calculateDiscount(33.33, 'ODD')).toBe(3.33);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Nth-ORDER COUPON GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Business Rule: Nth-Order Coupon Generation', () => {
  /**
   * RULE: After every 5th CONFIRMED order, the user receives a 10% loyalty coupon.
   * Rewards happen at: 5, 10, 15, 20 … confirmed orders.
   * Only CONFIRMED orders count. PENDING/CANCELLED orders are ignored.
   */

  it('RULE-NO-01 — no coupon after the 1st order', () => {
    const { checkoutService, cartStore } = makeStack();
    const [result] = doCheckouts(checkoutService, cartStore, 'u1', 1);
    expect(result.loyaltyCoupon).toBeUndefined();
  });

  it('RULE-NO-02 — no coupon on orders 2, 3, 4 (not yet at threshold)', () => {
    const { checkoutService, cartStore } = makeStack();
    const results = doCheckouts(checkoutService, cartStore, 'u1', 4);

    results.forEach((r) => expect(r.loyaltyCoupon).toBeUndefined());
  });

  it('RULE-NO-03 — coupon IS generated on exactly the 5th order', () => {
    const { checkoutService, cartStore } = makeStack();
    const results = doCheckouts(checkoutService, cartStore, 'u1', 5);
    const fifth = results[4];

    expect(fifth.loyaltyCoupon).toBeDefined();
    expect(fifth.loyaltyCoupon?.percentage).toBe(10);
    expect(fifth.loyaltyCoupon?.code).toMatch(/^LOYALTY5-/);
    expect(fifth.loyaltyCoupon?.message).toContain('loyalty');
  });

  it('RULE-NO-04 — no coupon on the 6th order (not a threshold)', () => {
    const { checkoutService, cartStore } = makeStack();
    const results = doCheckouts(checkoutService, cartStore, 'u1', 6);
    expect(results[5].loyaltyCoupon).toBeUndefined();
  });

  it('RULE-NO-05 — coupon IS generated again on the 10th order', () => {
    const { checkoutService, cartStore } = makeStack();
    const results = doCheckouts(checkoutService, cartStore, 'u1', 10);
    const tenth = results[9];

    expect(tenth.loyaltyCoupon).toBeDefined();
    expect(tenth.loyaltyCoupon?.code).toMatch(/^LOYALTY10-/);
  });

  it('RULE-NO-06 — rewards fire at every multiple of 5 (5, 10, 15)', () => {
    const { checkoutService, cartStore } = makeStack();
    const results = doCheckouts(checkoutService, cartStore, 'u1', 15);

    const rewarded = results
      .map((r, i) => ({ n: i + 1, rewarded: !!r.loyaltyCoupon }))
      .filter((r) => r.rewarded)
      .map((r) => r.n);

    expect(rewarded).toEqual([5, 10, 15]);
  });

  it('RULE-NO-07 — loyalty coupons are actually usable (saved to discount store)', () => {
    const { checkoutService, cartStore, discountService } = makeStack();
    const results = doCheckouts(checkoutService, cartStore, 'u1', 5);
    const couponCode = results[4].loyaltyCoupon!.code;

    const validation = discountService.validateDiscountCode(couponCode);
    expect(validation.valid).toBe(true);
    expect(validation.discountCode?.percentage).toBe(10);
  });

  it('RULE-NO-08 — PENDING orders do NOT count toward the threshold', () => {
    const { discountService, orderStore } = makeStack();
    const items = [{ productId: 'p1', name: 'Item', price: 100, quantity: 1 }];

    // 4 confirmed + 10 pending — still not at 5 confirmed
    for (let i = 0; i < 4; i++) {
      const o = orderStore.create({ userId: 'u1', items, subtotal: 100, discount: 0, total: 100 });
      orderStore.updateStatus(o.id, OrderStatus.CONFIRMED);
    }
    for (let i = 0; i < 10; i++) {
      orderStore.create({ userId: 'u1', items, subtotal: 100, discount: 0, total: 100 });
      // left as PENDING
    }

    const result = discountService.checkAndRewardUser('u1');
    expect(result.rewarded).toBe(false);
  });

  it('RULE-NO-09 — coupons for different users are independent', () => {
    const { checkoutService, cartStore } = makeStack();

    // userA gets to 5 orders, userB only has 4
    doCheckouts(checkoutService, cartStore, 'userA', 5);
    const userBResults = doCheckouts(checkoutService, cartStore, 'userB', 4);

    userBResults.forEach((r) => expect(r.loyaltyCoupon).toBeUndefined());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CHECKOUT CALCULATION CORRECTNESS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Business Rule: Checkout Calculations', () => {
  /**
   * RULE: At checkout —
   *   subtotal = Σ (item.price × item.quantity)
   *   discount = subtotal × (code.percentage / 100)  [or 0 if no code]
   *   total    = subtotal − discount
   *   All monetary values are rounded to 2 decimal places.
   */

  it('RULE-CC-01 — subtotal is the sum of all line totals', () => {
    const { cartStore, checkoutService } = makeStack();
    const cart = cartStore.create('u1');
    cartStore.addItem(cart.id, { productId: 'p1', name: 'A', price: 10, quantity: 3 });  // 30
    cartStore.addItem(cart.id, { productId: 'p2', name: 'B', price: 25, quantity: 2 });  // 50
    cartStore.addItem(cart.id, { productId: 'p3', name: 'C', price: 5,  quantity: 10 }); // 50

    const result = checkoutService.checkout({ userId: 'u1' });

    expect(result.order.subtotal).toBe(130); // 30 + 50 + 50
    expect(result.order.discount).toBe(0);
    expect(result.order.total).toBe(130);
  });

  it('RULE-CC-02 — discount is applied as a percentage of the subtotal', () => {
    const { cartStore, discountStore, checkoutService } = makeStack();
    discountStore.create({ code: 'OFF25', percentage: 25 });
    seedCart(cartStore, 'u1', 80, 5); // subtotal = 400

    const result = checkoutService.checkout({ userId: 'u1', discountCode: 'OFF25' });

    expect(result.order.subtotal).toBe(400);
    expect(result.order.discount).toBe(100); // 25% of 400
    expect(result.order.total).toBe(300);    // 400 − 100
  });

  it('RULE-CC-03 — discount = 0 and total = subtotal when no code is provided', () => {
    const { cartStore, checkoutService } = makeStack();
    seedCart(cartStore, 'u1', 50, 4); // subtotal = 200

    const result = checkoutService.checkout({ userId: 'u1' });

    expect(result.order.discount).toBe(0);
    expect(result.order.total).toBe(result.order.subtotal);
    expect(result.order.discountCode).toBeUndefined();
  });

  it('RULE-CC-04 — monetary values are rounded to 2 decimal places', () => {
    const { cartStore, discountStore, checkoutService } = makeStack();
    discountStore.create({ code: 'ODD', percentage: 10 });
    // price=33.33, qty=3 → subtotal=99.99, 10% off = 9.999 → rounds to 10.00
    seedCart(cartStore, 'u1', 33.33, 3);

    const result = checkoutService.checkout({ userId: 'u1', discountCode: 'ODD' });

    expect(result.order.subtotal).toBe(99.99);
    expect(result.order.discount).toBe(10);       // 9.999 → 10.00
    expect(result.order.total).toBe(89.99);        // 99.99 - 10.00
  });

  it('RULE-CC-05 — a 100% discount makes total exactly 0', () => {
    const { cartStore, discountStore, checkoutService } = makeStack();
    discountStore.create({ code: 'FREE100', percentage: 100 });
    seedCart(cartStore, 'u1', 99, 2); // subtotal = 198

    const result = checkoutService.checkout({ userId: 'u1', discountCode: 'FREE100' });

    expect(result.order.discount).toBe(198);
    expect(result.order.total).toBe(0);
  });

  it('RULE-CC-06 — itemCount is the sum of all quantities, not number of product lines', () => {
    const { cartStore, checkoutService } = makeStack();
    const cart = cartStore.create('u1');
    cartStore.addItem(cart.id, { productId: 'p1', name: 'A', price: 10, quantity: 5 });
    cartStore.addItem(cart.id, { productId: 'p2', name: 'B', price: 10, quantity: 3 });

    const result = checkoutService.checkout({ userId: 'u1' });

    expect(result.order.itemCount).toBe(8);       // 5 + 3 units
    expect(result.order.items).toHaveLength(2);   // 2 product lines
  });

  it('RULE-CC-07 — order status is CONFIRMED immediately after checkout', () => {
    const { cartStore, checkoutService } = makeStack();
    seedCart(cartStore, 'u1');

    const result = checkoutService.checkout({ userId: 'u1' });

    expect(result.order.status).toBe(OrderStatus.CONFIRMED);
  });

  it('RULE-CC-08 — cart is empty after successful checkout', () => {
    const { cartStore, checkoutService } = makeStack();
    const cartId = seedCart(cartStore, 'u1');

    checkoutService.checkout({ userId: 'u1' });

    expect(cartStore.findById(cartId)?.items).toHaveLength(0);
  });

  it('RULE-CC-09 — order items are a snapshot (mutating cart after checkout has no effect)', () => {
    const { cartStore, orderStore, checkoutService } = makeStack();
    const cartId = seedCart(cartStore, 'u1', 50, 2);

    const result = checkoutService.checkout({ userId: 'u1' });

    // Mutate cart (add another item post-checkout)
    cartStore.addItem(cartId, { productId: 'p99', name: 'Late', price: 999, quantity: 1 });

    const order = orderStore.findById(result.order.id)!;
    expect(order.items).toHaveLength(1);           // snapshot intact
    expect(order.subtotal).toBe(100);              // not affected by post-checkout mutation
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. INVALID COUPON HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Business Rule: Invalid Coupon Handling', () => {
  /**
   * RULE: A coupon that fails validation MUST:
   *   - Be rejected before any order is created
   *   - Return a descriptive, human-readable reason
   *   - Leave the store state unchanged (no partial mutations)
   */

  it('RULE-IC-01 — non-existent code returns invalid with reason', () => {
    const { discountService } = makeStack();

    const result = discountService.validateDiscountCode('DOES-NOT-EXIST');

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/does not exist/i);
    expect(result.discountCode).toBeUndefined();
  });

  it('RULE-IC-02 — a used code returns invalid with reason "already been used"', () => {
    const { discountStore, discountService } = makeStack();
    discountStore.create({ code: 'SPENT', percentage: 10 });
    discountStore.markAsUsed('SPENT');

    const result = discountService.validateDiscountCode('SPENT');

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/already been used/i);
  });

  it('RULE-IC-03 — an inactive (disabled) code returns invalid with reason "no longer active"', () => {
    const { discountStore, discountService } = makeStack();
    discountStore.create({ code: 'DISABLED', percentage: 10 });
    discountStore.setActive('DISABLED', false);

    const result = discountService.validateDiscountCode('DISABLED');

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/no longer active/i);
  });

  it('RULE-IC-04 — checkout with invalid code is rejected BEFORE order is created', () => {
    const { cartStore, orderStore, checkoutService } = makeStack();
    seedCart(cartStore, 'u1');

    const orderCountBefore = orderStore.size;

    expect(() =>
      checkoutService.checkout({ userId: 'u1', discountCode: 'FAKE-000' }),
    ).toThrow();

    // No order should have been persisted
    expect(orderStore.size).toBe(orderCountBefore);
  });

  it('RULE-IC-05 — checkout with invalid code leaves cart intact', () => {
    const { cartStore, checkoutService } = makeStack();
    const cartId = seedCart(cartStore, 'u1');

    try {
      checkoutService.checkout({ userId: 'u1', discountCode: 'FAKE-000' });
    } catch {
      // expected
    }

    // Cart must still have its items — nothing was cleared
    expect(cartStore.findById(cartId)?.items).toHaveLength(1);
  });

  it('RULE-IC-06 — a code cannot be reused: second checkout with same code throws', () => {
    const { cartStore, discountStore, checkoutService } = makeStack();
    discountStore.create({ code: 'ONETIME', percentage: 15 });
    const cart = cartStore.create('u1');

    // First checkout — succeeds and consumes the code
    cartStore.addItem(cart.id, { productId: 'p1', name: 'X', price: 100, quantity: 1 });
    checkoutService.checkout({ userId: 'u1', discountCode: 'ONETIME' });

    // Second checkout — code is now used
    cartStore.addItem(cart.id, { productId: 'p1', name: 'X', price: 100, quantity: 1 });

    expect(() =>
      checkoutService.checkout({ userId: 'u1', discountCode: 'ONETIME' }),
    ).toThrow(/already been used/i);
  });

  it('RULE-IC-07 — markDiscountAsUsed is atomic: validating then marking is one guard', () => {
    const { discountStore, discountService } = makeStack();
    discountStore.create({ code: 'ATOMIC', percentage: 10 });

    // First redemption must succeed
    expect(() => discountService.markDiscountAsUsed('ATOMIC')).not.toThrow();

    // Immediate second attempt must fail — no window where code appears unused
    expect(() => discountService.markDiscountAsUsed('ATOMIC')).toThrow(/already been used/i);
  });

  it('RULE-IC-08 — validateOrThrow throws BadRequestError (not 500) for invalid codes', () => {
    const { discountService } = makeStack();

    // Should be a BadRequestError (operational error → 400), not an unhandled crash
    let caughtErr: (Error & { statusCode?: number }) | undefined;
    try {
      discountService.validateOrThrow('NO-SUCH-CODE');
    } catch (e) {
      caughtErr = e as Error & { statusCode?: number };
    }

    expect(caughtErr).toBeDefined();
    expect(caughtErr?.statusCode).toBe(400);
    expect(caughtErr?.message).toMatch(/does not exist/i);
  });
});
