import request from 'supertest';
import { createApp } from '../../../app';

const app = createApp();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const addItem = (body: object) =>
  request(app).post('/api/v1/cart/items').send(body);

const checkout = (body: object) =>
  request(app).post('/api/v1/checkout').send(body);

/** Seed a cart with one product for a given userId */
const seedCart = async (userId: string) => {
  await addItem({ userId, productId: 'p1', name: 'Widget', price: 100, quantity: 2 });
};

// ─── Happy path — no discount ─────────────────────────────────────────────────

describe('POST /api/v1/checkout — no discount', () => {
  const userId = 'checkout-user-1';

  beforeAll(async () => {
    await seedCart(userId);
  });

  it('should return 201 with correct order summary', async () => {
    const res = await checkout({ userId });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const { order } = res.body.data;
    expect(order.userId).toBe(userId);
    expect(order.status).toBe('CONFIRMED');
    expect(order.subtotal).toBe(200);
    expect(order.discount).toBe(0);
    expect(order.total).toBe(200);
    expect(order.discountCode).toBeUndefined();
    expect(order.items).toHaveLength(1);
    expect(order.items[0].lineTotal).toBe(200);
    expect(order.itemCount).toBe(2);
    expect(order.id).toBeDefined();
  });

  it('should clear the cart after checkout', async () => {
    // Seed a fresh cart for a different user
    const u = 'checkout-clear-test';
    await seedCart(u);
    await checkout({ userId: u });

    const cartRes = await request(app).get(`/api/v1/cart/${u}`);
    // Cart still exists but is now empty
    expect(cartRes.body.data.items).toHaveLength(0);
    expect(cartRes.body.data.subtotal).toBe(0);
  });
});

// ─── Happy path — with valid discount code ────────────────────────────────────

describe('POST /api/v1/checkout — with discount code', () => {
  it('should apply SAVE10 (10%) and compute correct totals', async () => {
    const userId = 'checkout-discount-user';
    await seedCart(userId); // subtotal = 200

    const res = await checkout({ userId, discountCode: 'SAVE10' });

    expect(res.status).toBe(201);
    const { order } = res.body.data;
    expect(order.subtotal).toBe(200);
    expect(order.discount).toBe(20);       // 10% of 200
    expect(order.total).toBe(180);
    expect(order.discountCode).toBe('SAVE10');
  });

  it('should apply WELCOME20 (20%) correctly', async () => {
    const userId = 'checkout-welcome-user';
    await seedCart(userId); // subtotal = 200

    const res = await checkout({ userId, discountCode: 'WELCOME20' });

    expect(res.status).toBe(201);
    const { order } = res.body.data;
    expect(order.discount).toBe(40);       // 20% of 200
    expect(order.total).toBe(160);
    expect(order.discountCode).toBe('WELCOME20');
  });

  it('should return 400 if same discount code is reused', async () => {
    // SAVE10 was already consumed above — try to use it again
    const userId = 'checkout-reuse-user';
    await seedCart(userId);

    const res = await checkout({ userId, discountCode: 'SAVE10' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/already been used/i);
  });
});

// ─── Loyalty coupon — every 5th order ─────────────────────────────────────────

describe('POST /api/v1/checkout — loyalty reward', () => {
  const userId = 'loyalty-user';

  const doCheckout = async () => {
    await seedCart(userId);
    return checkout({ userId });
  };

  it('should NOT include loyaltyCoupon on orders 1–4', async () => {
    for (let i = 0; i < 4; i++) {
      const res = await doCheckout();
      expect(res.status).toBe(201);
      expect(res.body.data.loyaltyCoupon).toBeUndefined();
    }
  });

  it('should include loyaltyCoupon on the 5th order', async () => {
    const res = await doCheckout();

    expect(res.status).toBe(201);
    const { loyaltyCoupon } = res.body.data;
    expect(loyaltyCoupon).toBeDefined();
    expect(loyaltyCoupon.percentage).toBe(10);
    expect(loyaltyCoupon.code).toMatch(/^LOYALTY5-/);
    expect(loyaltyCoupon.message).toMatch(/loyalty/i);
  });

  it('should NOT include loyaltyCoupon on the 6th order', async () => {
    const res = await doCheckout();
    expect(res.body.data.loyaltyCoupon).toBeUndefined();
  });
});

// ─── Error cases ──────────────────────────────────────────────────────────────

describe('POST /api/v1/checkout — errors', () => {
  it('should return 400 when userId is missing', async () => {
    const res = await checkout({});
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/userId/i);
  });

  it('should return 404 when user has no cart', async () => {
    const res = await checkout({ userId: 'no-cart-user-xyz' });
    expect(res.status).toBe(404);
    expect(res.body.error.message).toMatch(/not found/i);
  });

  it('should return 400 when cart is empty', async () => {
    // Create a user, add item, checkout (clears cart), then try again
    const userId = 'empty-cart-user';
    await seedCart(userId);
    await checkout({ userId }); // first checkout clears cart

    const res = await checkout({ userId }); // second checkout — empty cart
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/empty cart/i);
  });

  it('should return 400 for an invalid discount code', async () => {
    const userId = 'bad-code-user';
    await seedCart(userId);

    const res = await checkout({ userId, discountCode: 'BOGUS-CODE-000' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/does not exist/i);
  });
});
