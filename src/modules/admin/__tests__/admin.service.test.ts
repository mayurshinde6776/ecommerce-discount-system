import { AdminService } from '../admin.service';
import { OrderStore } from '../../order/order.store';
import { OrderStatus } from '../../order/order.model';
import { DiscountStore } from '../../discount/discount.store';
import { DiscountService } from '../../discount/discount.service';

// ─── Factory ──────────────────────────────────────────────────────────────────

const makeService = () => {
  const orderStore = new OrderStore();
  const discountStore = new DiscountStore();
  const discountService = new DiscountService(discountStore, orderStore);
  const adminService = new AdminService(orderStore, discountStore, discountService);
  return { adminService, orderStore, discountStore };
};

const sampleItems = [{ productId: 'p1', name: 'Widget', price: 50, quantity: 2 }];

/** Helper: place and confirm N orders for a user */
const confirmOrders = (
  orderStore: OrderStore,
  userId: string,
  count: number,
  subtotal = 100,
  discount = 0,
) => {
  for (let i = 0; i < count; i++) {
    const o = orderStore.create({
      userId,
      items: sampleItems,
      subtotal,
      discount,
      total: subtotal - discount,
    });
    orderStore.updateStatus(o.id, OrderStatus.CONFIRMED);
  }
};

// ─── generateDiscount ─────────────────────────────────────────────────────────

describe('AdminService.generateDiscount', () => {
  it('should generate a code with the requested percentage', () => {
    const { adminService, discountStore } = makeService();
    const code = adminService.generateDiscount({ percentage: 15 });

    expect(code.percentage).toBe(15);
    expect(code.isActive).toBe(true);
    expect(code.isUsed).toBe(false);
    expect(discountStore.findByCode(code.code)).toBeDefined();
  });

  it('should use ADMIN prefix by default', () => {
    const { adminService } = makeService();
    const code = adminService.generateDiscount({ percentage: 10 });
    expect(code.code.startsWith('ADMIN-')).toBe(true);
  });

  it('should use a custom prefix when provided', () => {
    const { adminService } = makeService();
    const code = adminService.generateDiscount({ percentage: 20, prefix: 'FLASH' });
    expect(code.code.startsWith('FLASH-')).toBe(true);
  });

  it('should uppercase and trim the custom prefix', () => {
    const { adminService } = makeService();
    const code = adminService.generateDiscount({ percentage: 10, prefix: '  sale  ' });
    expect(code.code.startsWith('SALE-')).toBe(true);
  });

  it('should throw BadRequestError for percentage <= 0', () => {
    const { adminService } = makeService();
    expect(() => adminService.generateDiscount({ percentage: 0 })).toThrow(/percentage/i);
  });

  it('should throw BadRequestError for percentage > 100', () => {
    const { adminService } = makeService();
    expect(() => adminService.generateDiscount({ percentage: 101 })).toThrow(/percentage/i);
  });

  it('should throw BadRequestError when percentage is missing', () => {
    const { adminService } = makeService();
    expect(() =>
      adminService.generateDiscount({ percentage: undefined as unknown as number }),
    ).toThrow(/percentage/i);
  });
});

// ─── getStats — empty state ───────────────────────────────────────────────────

describe('AdminService.getStats — empty store', () => {
  it('should return zero values when no orders exist', () => {
    const { adminService } = makeService();
    const stats = adminService.getStats();

    expect(stats.orders.total).toBe(0);
    expect(stats.orders.confirmed).toBe(0);
    expect(stats.revenue.totalRevenue).toBe(0);
    expect(stats.revenue.totalDiscountGiven).toBe(0);
    expect(stats.items.totalItemsSold).toBe(0);
    expect(stats.coupons.totalGenerated).toBe(0);
  });
});

// ─── getStats — order counts ──────────────────────────────────────────────────

describe('AdminService.getStats — order counts', () => {
  it('should count CONFIRMED, PENDING, and CANCELLED orders separately', () => {
    const { adminService, orderStore } = makeService();

    const o1 = orderStore.create({ userId: 'u1', items: sampleItems, subtotal: 100, discount: 0, total: 100 });
    orderStore.updateStatus(o1.id, OrderStatus.CONFIRMED);

    const o2 = orderStore.create({ userId: 'u1', items: sampleItems, subtotal: 100, discount: 0, total: 100 });
    // leave o2 as PENDING (no status update needed)
    void o2; // satisfy noUnusedLocals

    const o3 = orderStore.create({ userId: 'u1', items: sampleItems, subtotal: 100, discount: 0, total: 100 });
    orderStore.updateStatus(o3.id, OrderStatus.CANCELLED);

    const stats = adminService.getStats();
    expect(stats.orders.total).toBe(3);
    expect(stats.orders.confirmed).toBe(1);
    expect(stats.orders.pending).toBe(1);
    expect(stats.orders.cancelled).toBe(1);
  });
});

// ─── getStats — revenue ───────────────────────────────────────────────────────

describe('AdminService.getStats — revenue', () => {
  it('should sum totalRevenue from CONFIRMED orders only', () => {
    const { adminService, orderStore } = makeService();
    confirmOrders(orderStore, 'u1', 3, 100, 0); // 3 × 100 = 300 revenue

    // PENDING order — should NOT be counted
    orderStore.create({ userId: 'u1', items: sampleItems, subtotal: 500, discount: 0, total: 500 });

    const stats = adminService.getStats();
    expect(stats.revenue.totalRevenue).toBe(300);
    expect(stats.revenue.grossRevenue).toBe(300);
  });

  it('should compute totalDiscountGiven correctly', () => {
    const { adminService, orderStore } = makeService();
    // 2 confirmed orders each with a $20 discount
    confirmOrders(orderStore, 'u1', 2, 100, 20); // total = 80, discount = 20 each

    const stats = adminService.getStats();
    expect(stats.revenue.totalDiscountGiven).toBe(40);    // 2 × 20
    expect(stats.revenue.grossRevenue).toBe(200);          // 2 × 100
    expect(stats.revenue.totalRevenue).toBe(160);          // 2 × 80
  });

  it('should return 0 revenue when all orders are PENDING', () => {
    const { adminService, orderStore } = makeService();
    orderStore.create({ userId: 'u1', items: sampleItems, subtotal: 999, discount: 0, total: 999 });

    const stats = adminService.getStats();
    expect(stats.revenue.totalRevenue).toBe(0);
  });
});

// ─── getStats — items sold ────────────────────────────────────────────────────

describe('AdminService.getStats — items sold', () => {
  it('should count total units and line items across CONFIRMED orders', () => {
    const { adminService, orderStore } = makeService();

    // Order 1: 2 line items, 3 + 1 = 4 units
    const o1 = orderStore.create({
      userId: 'u1',
      items: [
        { productId: 'p1', name: 'Widget', price: 10, quantity: 3 },
        { productId: 'p2', name: 'Gadget', price: 20, quantity: 1 },
      ],
      subtotal: 50, discount: 0, total: 50,
    });
    orderStore.updateStatus(o1.id, OrderStatus.CONFIRMED);

    // Order 2: 1 line item, 2 units
    const o2 = orderStore.create({
      userId: 'u2',
      items: [{ productId: 'p3', name: 'Donut', price: 5, quantity: 2 }],
      subtotal: 10, discount: 0, total: 10,
    });
    orderStore.updateStatus(o2.id, OrderStatus.CONFIRMED);

    // PENDING — should not count
    orderStore.create({
      userId: 'u3',
      items: [{ productId: 'p4', name: 'Thing', price: 1, quantity: 100 }],
      subtotal: 100, discount: 0, total: 100,
    });

    const stats = adminService.getStats();
    expect(stats.items.totalItemsSold).toBe(6);   // 3 + 1 + 2
    expect(stats.items.totalLineItems).toBe(3);    // 2 + 1 (not the PENDING order)
  });
});

// ─── getStats — coupons ───────────────────────────────────────────────────────

describe('AdminService.getStats — coupons', () => {
  it('should count coupon lifecycle states correctly', () => {
    const { adminService, discountStore } = makeService();

    discountStore.create({ code: 'A10', percentage: 10 });            // available
    discountStore.create({ code: 'B20', percentage: 20 });            // will be used
    discountStore.create({ code: 'C30', percentage: 30 });            // will be inactive
    discountStore.markAsUsed('B20');
    discountStore.setActive('C30', false);

    const stats = adminService.getStats();
    expect(stats.coupons.totalGenerated).toBe(3);
    expect(stats.coupons.available).toBe(1);  // A10
    expect(stats.coupons.used).toBe(1);       // B20
    expect(stats.coupons.inactive).toBe(1);   // C30
  });
});
