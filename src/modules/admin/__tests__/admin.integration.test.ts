import request from 'supertest';
import { createApp } from '../../../app';

const app = createApp();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generate = (body: object) =>
  request(app).post('/admin/discount/generate').send(body);

const getStats = () =>
  request(app).get('/admin/stats');

const addItem = (body: object) =>
  request(app).post('/api/v1/cart/items').send(body);

const checkout = (body: object) =>
  request(app).post('/api/v1/checkout').send(body);

// ─── POST /admin/discount/generate ───────────────────────────────────────────

describe('POST /admin/discount/generate', () => {
  it('should return 201 with a generated discount code', async () => {
    const res = await generate({ percentage: 25 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const { discountCode } = res.body.data;
    expect(discountCode.percentage).toBe(25);
    expect(discountCode.isActive).toBe(true);
    expect(discountCode.isUsed).toBe(false);
    expect(discountCode.code.startsWith('ADMIN-')).toBe(true);
  });

  it('should use the provided prefix', async () => {
    const res = await generate({ percentage: 10, prefix: 'FLASH' });

    expect(res.status).toBe(201);
    expect(res.body.data.discountCode.code.startsWith('FLASH-')).toBe(true);
  });

  it('should return 400 when percentage is missing', async () => {
    const res = await generate({});
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/percentage/i);
  });

  it('should return 400 when percentage is 0', async () => {
    const res = await generate({ percentage: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/percentage/i);
  });

  it('should return 400 when percentage is > 100', async () => {
    const res = await generate({ percentage: 110 });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/percentage/i);
  });

  it('should return 400 when percentage is a string', async () => {
    const res = await generate({ percentage: 'half' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/percentage/i);
  });
});

// ─── GET /admin/stats ─────────────────────────────────────────────────────────

describe('GET /admin/stats — structure', () => {
  it('should return 200 with all required stat sections', async () => {
    const res = await getStats();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const stats = res.body.data;
    expect(stats).toHaveProperty('orders');
    expect(stats).toHaveProperty('revenue');
    expect(stats).toHaveProperty('items');
    expect(stats).toHaveProperty('coupons');

    expect(stats.orders).toHaveProperty('total');
    expect(stats.orders).toHaveProperty('confirmed');
    expect(stats.orders).toHaveProperty('pending');
    expect(stats.revenue).toHaveProperty('totalRevenue');
    expect(stats.revenue).toHaveProperty('grossRevenue');
    expect(stats.revenue).toHaveProperty('totalDiscountGiven');
    expect(stats.items).toHaveProperty('totalItemsSold');
    expect(stats.coupons).toHaveProperty('totalGenerated');
    expect(stats.coupons).toHaveProperty('available');
    expect(stats.coupons).toHaveProperty('used');
  });
});

describe('GET /admin/stats — after checkout activity', () => {
  const userId = 'stats-test-user';

  beforeAll(async () => {
    // Complete 2 checkouts: one plain, one with WELCOME20 discount
    await addItem({ userId, productId: 'p1', name: 'Widget', price: 100, quantity: 2 });
    await checkout({ userId }); // subtotal=200, discount=0, total=200

    await addItem({ userId, productId: 'p1', name: 'Widget', price: 100, quantity: 2 });
    await checkout({ userId, discountCode: 'WELCOME20' }); // subtotal=200, discount=40, total=160
  });

  it('should reflect confirmed order count in stats', async () => {
    const res = await getStats();
    const stats = res.body.data;

    // At least the 2 orders we placed (other tests may have added more)
    expect(stats.orders.confirmed).toBeGreaterThanOrEqual(2);
  });

  it('should accumulate totalRevenue from confirmed orders', async () => {
    const res = await getStats();
    // At minimum our 200 + 160 = 360
    expect(res.body.data.revenue.totalRevenue).toBeGreaterThanOrEqual(360);
  });

  it('should accumulate totalDiscountGiven', async () => {
    const res = await getStats();
    // At minimum the $40 discount from WELCOME20
    expect(res.body.data.revenue.totalDiscountGiven).toBeGreaterThanOrEqual(40);
  });

  it('should count items sold', async () => {
    const res = await getStats();
    // 2 units × 2 checkouts = at least 4 units sold
    expect(res.body.data.items.totalItemsSold).toBeGreaterThanOrEqual(4);
  });

  it('should count generated coupons (including seed data)', async () => {
    const res = await getStats();
    // SAVE10 + WELCOME20 seed + any generated in other tests
    expect(res.body.data.coupons.totalGenerated).toBeGreaterThanOrEqual(2);
  });

  it('WELCOME20 should appear as used in coupon stats', async () => {
    const res = await getStats();
    expect(res.body.data.coupons.used).toBeGreaterThanOrEqual(1);
  });
});
