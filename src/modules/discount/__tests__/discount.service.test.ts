import { DiscountService } from '../discount.service';
import { DiscountStore } from '../discount.store';
import { OrderStore } from '../../order/order.store';
import { OrderStatus } from '../../order/order.model';

// ─── Factory ──────────────────────────────────────────────────────────────────

const makeService = () => {
  const discountStore = new DiscountStore();
  const orderStore = new OrderStore();
  const service = new DiscountService(discountStore, orderStore);
  return { service, discountStore, orderStore };
};

/** Helper: confirm N orders for a user in the orderStore */
const confirmOrders = (orderStore: OrderStore, userId: string, count: number) => {
  const items = [{ productId: 'p1', name: 'Item', price: 100, quantity: 1 }];
  for (let i = 0; i < count; i++) {
    const order = orderStore.create({ userId, items, subtotal: 100, discount: 0, total: 100 });
    orderStore.updateStatus(order.id, OrderStatus.CONFIRMED);
  }
};

// ─── generateDiscountCode ─────────────────────────────────────────────────────

describe('DiscountService.generateDiscountCode', () => {
  it('should create and persist a discount code in the store', () => {
    const { service, discountStore } = makeService();
    const code = service.generateDiscountCode(10);

    expect(code.percentage).toBe(10);
    expect(code.isActive).toBe(true);
    expect(code.isUsed).toBe(false);
    expect(discountStore.findByCode(code.code)).toBeDefined();
  });

  it('should default to 10% if no percentage given', () => {
    const { service } = makeService();
    const code = service.generateDiscountCode();
    expect(code.percentage).toBe(10);
  });

  it('should throw BadRequestError for percentage > 100', () => {
    const { service } = makeService();
    expect(() => service.generateDiscountCode(101)).toThrow(/percentage/i);
  });

  it('should throw BadRequestError for percentage <= 0', () => {
    const { service } = makeService();
    expect(() => service.generateDiscountCode(0)).toThrow(/percentage/i);
  });

  it('should produce codes with the requested prefix', () => {
    const { service } = makeService();
    const code = service.generateDiscountCode(10, 'LOYALTY5');
    expect(code.code.startsWith('LOYALTY5-')).toBe(true);
  });
});

// ─── validateDiscountCode ─────────────────────────────────────────────────────

describe('DiscountService.validateDiscountCode', () => {
  it('should return valid=true for a fresh active code', () => {
    const { service } = makeService();
    const created = service.generateDiscountCode(15);
    const result = service.validateDiscountCode(created.code);

    expect(result.valid).toBe(true);
    expect(result.discountCode?.code).toBe(created.code);
    expect(result.reason).toBeUndefined();
  });

  it('should return valid=false for an unknown code', () => {
    const { service } = makeService();
    const result = service.validateDiscountCode('GHOST-FAKE-000');

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/does not exist/i);
  });

  it('should return valid=false for a used code', () => {
    const { service, discountStore } = makeService();
    const created = service.generateDiscountCode(10);
    discountStore.markAsUsed(created.code);

    const result = service.validateDiscountCode(created.code);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/already been used/i);
  });

  it('should return valid=false for an inactive code', () => {
    const { service, discountStore } = makeService();
    const created = service.generateDiscountCode(10);
    discountStore.setActive(created.code, false);

    const result = service.validateDiscountCode(created.code);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/no longer active/i);
  });

  it('should return valid=false for empty input', () => {
    const { service } = makeService();
    const result = service.validateDiscountCode('');
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/required/i);
  });

  it('should be case-insensitive', () => {
    const { service } = makeService();
    const created = service.generateDiscountCode(10);
    const result = service.validateDiscountCode(created.code.toLowerCase());
    expect(result.valid).toBe(true);
  });
});

// ─── markDiscountAsUsed ───────────────────────────────────────────────────────

describe('DiscountService.markDiscountAsUsed', () => {
  it('should mark a valid code as used and return it', () => {
    const { service } = makeService();
    const created = service.generateDiscountCode(10);
    const redeemed = service.markDiscountAsUsed(created.code);

    expect(redeemed.isUsed).toBe(true);
    expect(redeemed.code).toBe(created.code);
  });

  it('should throw BadRequestError when trying to reuse an already-used code', () => {
    const { service } = makeService();
    const created = service.generateDiscountCode(10);
    service.markDiscountAsUsed(created.code);

    expect(() => service.markDiscountAsUsed(created.code)).toThrow(/already been used/i);
  });

  it('should throw BadRequestError for an unknown code', () => {
    const { service } = makeService();
    expect(() => service.markDiscountAsUsed('FAKE-CODE-000')).toThrow(/does not exist/i);
  });

  it('should prevent second redemption even after concurrent-like calls', () => {
    const { service } = makeService();
    const created = service.generateDiscountCode(20);
    service.markDiscountAsUsed(created.code); // first use

    // Second attempt must fail
    expect(() => service.markDiscountAsUsed(created.code)).toThrow();
  });
});

// ─── checkAndRewardUser (every-5th-order rule) ────────────────────────────────

describe('DiscountService.checkAndRewardUser — loyalty rule', () => {
  it('should NOT reward after 1 confirmed order', () => {
    const { service, orderStore } = makeService();
    confirmOrders(orderStore, 'u1', 1);
    const result = service.checkAndRewardUser('u1');

    expect(result.rewarded).toBe(false);
    expect(result.coupon).toBeUndefined();
  });

  it('should NOT reward after 4 confirmed orders', () => {
    const { service, orderStore } = makeService();
    confirmOrders(orderStore, 'u1', 4);
    const result = service.checkAndRewardUser('u1');
    expect(result.rewarded).toBe(false);
  });

  it('should reward after exactly 5 confirmed orders', () => {
    const { service, orderStore } = makeService();
    confirmOrders(orderStore, 'u1', 5);
    const result = service.checkAndRewardUser('u1');

    expect(result.rewarded).toBe(true);
    expect(result.coupon).toBeDefined();
    expect(result.coupon?.percentage).toBe(10);
    expect(result.coupon?.isActive).toBe(true);
    expect(result.coupon?.isUsed).toBe(false);
    expect(result.coupon?.code.startsWith('LOYALTY5-')).toBe(true);
  });

  it('should NOT reward on the 6th order (not a multiple of 5)', () => {
    const { service, orderStore } = makeService();
    confirmOrders(orderStore, 'u1', 6);
    const result = service.checkAndRewardUser('u1');
    expect(result.rewarded).toBe(false);
  });

  it('should reward again on the 10th confirmed order', () => {
    const { service, orderStore } = makeService();
    confirmOrders(orderStore, 'u1', 10);
    const result = service.checkAndRewardUser('u1');

    expect(result.rewarded).toBe(true);
    expect(result.coupon?.code.startsWith('LOYALTY10-')).toBe(true);
  });

  it('should NOT count PENDING orders towards the reward', () => {
    const { service, orderStore } = makeService();
    const items = [{ productId: 'p1', name: 'Item', price: 100, quantity: 1 }];

    // 4 confirmed + 5 pending = still no reward
    confirmOrders(orderStore, 'u1', 4);
    for (let i = 0; i < 5; i++) {
      orderStore.create({ userId: 'u1', items, subtotal: 100, discount: 0, total: 100 });
      // left as PENDING
    }

    const result = service.checkAndRewardUser('u1');
    expect(result.rewarded).toBe(false);
  });

  it('should not reward a user with zero orders', () => {
    const { service } = makeService();
    const result = service.checkAndRewardUser('new-user');
    expect(result.rewarded).toBe(false);
  });
});

// ─── calculateDiscount ────────────────────────────────────────────────────────

describe('DiscountService.calculateDiscount', () => {
  it('should calculate 10% of subtotal correctly', () => {
    const { service } = makeService();
    const created = service.generateDiscountCode(10);
    expect(service.calculateDiscount(200, created.code)).toBe(20);
  });

  it('should round to 2 decimal places', () => {
    const { service } = makeService();
    const created = service.generateDiscountCode(10);
    // 10% of 99.99 = 9.999 → rounds to 10.00
    expect(service.calculateDiscount(99.99, created.code)).toBe(10);
  });

  it('should throw for an invalid code', () => {
    const { service } = makeService();
    expect(() => service.calculateDiscount(100, 'BAD-CODE-000')).toThrow();
  });
});
