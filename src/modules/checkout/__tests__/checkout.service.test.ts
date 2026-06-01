import { CheckoutService } from '../checkout.service';
import { CartStore } from '../../cart/cart.store';
import { OrderStore } from '../../order/order.store';
import { DiscountStore } from '../../discount/discount.store';
import { DiscountService } from '../../discount/discount.service';
import { OrderStatus } from '../../order/order.model';

// ─── Factory ──────────────────────────────────────────────────────────────────

const makeService = () => {
  const cartStore = new CartStore();
  const orderStore = new OrderStore();
  const discountStore = new DiscountStore();
  const discountService = new DiscountService(discountStore, orderStore);
  const service = new CheckoutService(cartStore, orderStore, discountService);
  return { service, cartStore, orderStore, discountStore, discountService };
};

/** Seed cart with one item and return the cart */
const seedCart = (cartStore: CartStore, userId: string) => {
  const cart = cartStore.create(userId);
  cartStore.addItem(cart.id, { productId: 'p1', name: 'Widget', price: 100, quantity: 3 });
  return cart;
};

// ─── Basic checkout ───────────────────────────────────────────────────────────

describe('CheckoutService.checkout — basic', () => {
  it('should create a CONFIRMED order with correct totals', () => {
    const { service, cartStore } = makeService();
    seedCart(cartStore, 'u1');

    const result = service.checkout({ userId: 'u1' });

    expect(result.order.status).toBe(OrderStatus.CONFIRMED);
    expect(result.order.subtotal).toBe(300); // 100 × 3
    expect(result.order.discount).toBe(0);
    expect(result.order.total).toBe(300);
    expect(result.order.discountCode).toBeUndefined();
    expect(result.order.itemCount).toBe(3);
  });

  it('should clear cart items after checkout', () => {
    const { service, cartStore } = makeService();
    const cart = seedCart(cartStore, 'u1');
    service.checkout({ userId: 'u1' });

    expect(cartStore.findById(cart.id)?.items).toHaveLength(0);
  });

  it('should snapshot cart items into the order', () => {
    const { service, cartStore, orderStore } = makeService();
    seedCart(cartStore, 'u1');
    const result = service.checkout({ userId: 'u1' });

    const order = orderStore.findById(result.order.id)!;
    expect(order.items).toHaveLength(1);
    expect(order.items[0].productId).toBe('p1');
    expect(order.items[0].quantity).toBe(3);
  });
});

// ─── Discount code application ────────────────────────────────────────────────

describe('CheckoutService.checkout — with discount', () => {
  it('should apply a percentage discount correctly', () => {
    const { service, cartStore, discountStore } = makeService();
    discountStore.create({ code: 'TEST20', percentage: 20 });
    seedCart(cartStore, 'u1'); // subtotal = 300

    const result = service.checkout({ userId: 'u1', discountCode: 'TEST20' });

    expect(result.order.discount).toBe(60);   // 20% of 300
    expect(result.order.total).toBe(240);
    expect(result.order.discountCode).toBe('TEST20');
  });

  it('should mark the discount code as used after checkout', () => {
    const { service, cartStore, discountStore } = makeService();
    discountStore.create({ code: 'ONETIME', percentage: 10 });
    seedCart(cartStore, 'u1');
    service.checkout({ userId: 'u1', discountCode: 'ONETIME' });

    expect(discountStore.findByCode('ONETIME')?.isUsed).toBe(true);
  });

  it('should throw BadRequestError for an unknown discount code', () => {
    const { service, cartStore } = makeService();
    seedCart(cartStore, 'u1');

    expect(() =>
      service.checkout({ userId: 'u1', discountCode: 'GHOST-CODE-000' }),
    ).toThrow(/does not exist/i);
  });

  it('should throw BadRequestError for an already-used code', () => {
    const { service, cartStore, discountStore } = makeService();
    discountStore.create({ code: 'USED10', percentage: 10 });
    discountStore.markAsUsed('USED10');
    seedCart(cartStore, 'u1');

    expect(() =>
      service.checkout({ userId: 'u1', discountCode: 'USED10' }),
    ).toThrow(/already been used/i);
  });

  it('should proceed without discount when no code is provided', () => {
    const { service, cartStore } = makeService();
    seedCart(cartStore, 'u1');
    const result = service.checkout({ userId: 'u1' });

    expect(result.order.discount).toBe(0);
    expect(result.order.discountCode).toBeUndefined();
  });
});

// ─── Loyalty reward ───────────────────────────────────────────────────────────

describe('CheckoutService.checkout — loyalty reward', () => {
  /**
   * After each checkout the cart is cleared (items removed) but the cart
   * record still exists. Re-seeding must add to that same cart rather than
   * creating a new one, otherwise CartStore returns the stale empty cart
   * (most-recently-updated wins) and the next checkout fails with "empty cart".
   */
  const doCheckout = (service: CheckoutService, cartStore: CartStore, userId: string) => {
    const existing = cartStore.findByUserId(userId);
    if (existing.length > 0) {
      // Re-use the existing cart — just add the item back
      cartStore.addItem(existing[0].id, { productId: 'p1', name: 'Widget', price: 100, quantity: 3 });
    } else {
      seedCart(cartStore, userId);
    }
    return service.checkout({ userId });
  };

  it('should not include loyaltyCoupon on orders 1-4', () => {
    const { service, cartStore } = makeService();
    for (let i = 0; i < 4; i++) {
      const result = doCheckout(service, cartStore, 'u1');
      expect(result.loyaltyCoupon).toBeUndefined();
    }
  });

  it('should include loyaltyCoupon on the 5th order', () => {
    const { service, cartStore } = makeService();
    let last;
    for (let i = 0; i < 5; i++) {
      last = doCheckout(service, cartStore, 'u1');
    }

    expect(last?.loyaltyCoupon).toBeDefined();
    expect(last?.loyaltyCoupon?.percentage).toBe(10);
    expect(last?.loyaltyCoupon?.code).toMatch(/^LOYALTY5-/);
    expect(last?.loyaltyCoupon?.message).toContain('loyalty');
  });

  it('should not include loyaltyCoupon on orders 6-9', () => {
    const { service, cartStore } = makeService();
    for (let i = 0; i < 6; i++) {
      doCheckout(service, cartStore, 'u1');
    }
    const result = doCheckout(service, cartStore, 'u1');
    expect(result.loyaltyCoupon).toBeUndefined();
  });

  it('should reward again on the 10th order', () => {
    const { service, cartStore } = makeService();
    let last;
    for (let i = 0; i < 10; i++) {
      last = doCheckout(service, cartStore, 'u1');
    }
    expect(last?.loyaltyCoupon?.code).toMatch(/^LOYALTY10-/);
  });
});

// ─── Error cases ──────────────────────────────────────────────────────────────

describe('CheckoutService.checkout — errors', () => {
  it('should throw BadRequestError for missing userId', () => {
    const { service } = makeService();
    expect(() => service.checkout({ userId: '' })).toThrow(/userId is required/i);
  });

  it('should throw NotFoundError when user has no cart', () => {
    const { service } = makeService();
    expect(() => service.checkout({ userId: 'no-cart-user' })).toThrow(/Cart not found/i);
  });

  it('should throw BadRequestError for empty cart', () => {
    const { service, cartStore } = makeService();
    cartStore.create('u1'); // cart with no items
    expect(() => service.checkout({ userId: 'u1' })).toThrow(/empty cart/i);
  });
});
