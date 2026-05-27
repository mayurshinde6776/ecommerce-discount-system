import request from 'supertest';
import { createApp } from '../../../app';

const app = createApp();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const addItem = (body: object) => request(app).post('/api/v1/cart/items').send(body);

const validItem = {
  userId: 'user-test-1',
  productId: 'prod-001',
  name: 'Blue T-Shirt',
  price: 29.99,
  quantity: 2,
};

// ─── POST /api/v1/cart/items ──────────────────────────────────────────────────

describe('POST /api/v1/cart/items', () => {
  it('should create a cart and return 200 with correct totals', async () => {
    const res = await addItem(validItem);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(data.userId).toBe('user-test-1');
    expect(data.items).toHaveLength(1);
    expect(data.items[0].lineTotal).toBeCloseTo(59.98);
    expect(data.subtotal).toBeCloseTo(59.98);
    expect(data.itemCount).toBe(2);
  });

  it('should merge quantity when the same productId is added twice', async () => {
    const userId = 'user-merge-test';
    await addItem({ ...validItem, userId });
    const res = await addItem({ ...validItem, userId }); // same product again

    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(data.items).toHaveLength(1);             // still 1 line item
    expect(data.items[0].quantity).toBe(4);          // 2 + 2
    expect(data.subtotal).toBeCloseTo(119.96);
    expect(data.itemCount).toBe(4);
  });

  it('should add multiple distinct products to the same cart', async () => {
    const userId = 'user-multi-product';
    await addItem({ ...validItem, userId });
    const res = await addItem({
      userId,
      productId: 'prod-002',
      name: 'Black Jeans',
      price: 49.99,
      quantity: 1,
    });

    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(data.items).toHaveLength(2);
    expect(data.subtotal).toBeCloseTo(109.97); // 59.98 + 49.99
  });

  // ─── Validation failures ────────────────────────────────────────────────────

  it('should return 400 when userId is missing', async () => {
    const { userId: _omit, ...body } = validItem;
    const res = await addItem(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/userId/i);
  });

  it('should return 400 when productId is missing', async () => {
    const res = await addItem({ ...validItem, productId: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/productId/i);
  });

  it('should return 400 when price is zero or negative', async () => {
    const res = await addItem({ ...validItem, price: -5 });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/price/i);
  });

  it('should return 400 when price is not a number', async () => {
    const res = await addItem({ ...validItem, price: 'free' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/price/i);
  });

  it('should return 400 when quantity is a float', async () => {
    const res = await addItem({ ...validItem, quantity: 1.5 });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/quantity/i);
  });

  it('should return 400 when quantity is zero', async () => {
    const res = await addItem({ ...validItem, quantity: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/quantity/i);
  });
});

// ─── GET /api/v1/cart/:userId ─────────────────────────────────────────────────

describe('GET /api/v1/cart/:userId', () => {
  const userId = 'user-get-test';

  beforeAll(async () => {
    // seed cart for this describe block
    await addItem({ ...validItem, userId });
    await addItem({ userId, productId: 'prod-002', name: 'Cap', price: 10.00, quantity: 3 });
  });

  it('should return the cart with correct totals', async () => {
    const res = await request(app).get(`/api/v1/cart/${userId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(data.userId).toBe(userId);
    expect(data.items).toHaveLength(2);
    // 29.99×2 + 10×3 = 59.98 + 30 = 89.98
    expect(data.subtotal).toBeCloseTo(89.98);
    expect(data.itemCount).toBe(5);
  });

  it('should return 404 for a user with no cart', async () => {
    const res = await request(app).get('/api/v1/cart/no-such-user-xyz');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/not found/i);
  });
});
