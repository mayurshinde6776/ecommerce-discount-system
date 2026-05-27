import { OrderStore } from '../order.store';
import { OrderStatus } from '../order.model';
import { CartItem } from '../../cart/cart.model';

const sampleItems: CartItem[] = [
  { productId: 'p1', name: 'Widget', price: 50, quantity: 2 },
];

describe('OrderStore', () => {
  let store: OrderStore;

  beforeEach(() => {
    store = new OrderStore();
  });

  it('should create an order with correct pricing fields', () => {
    const order = store.create({
      userId: 'user-1',
      items: sampleItems,
      subtotal: 100,
      discount: 10,
      total: 90,
      discountCode: 'SAVE10',
    });

    expect(order.id).toBeDefined();
    expect(order.subtotal).toBe(100);
    expect(order.discount).toBe(10);
    expect(order.total).toBe(90);
    expect(order.discountCode).toBe('SAVE10');
    expect(order.status).toBe(OrderStatus.PENDING);
  });

  it('should create order without discountCode when not provided', () => {
    const order = store.create({
      userId: 'user-1',
      items: sampleItems,
      subtotal: 100,
      discount: 0,
      total: 100,
    });

    expect(order.discountCode).toBeUndefined();
  });

  it('should snapshot items — mutations to original do not affect order', () => {
    const items = [{ productId: 'p1', name: 'Widget', price: 50, quantity: 2 }];
    const order = store.create({ userId: 'u1', items, subtotal: 100, discount: 0, total: 100 });

    items[0].quantity = 999; // mutate original
    expect(order.items[0].quantity).toBe(2); // snapshot is unchanged
  });

  it('should update order status', () => {
    const order = store.create({ userId: 'u1', items: sampleItems, subtotal: 100, discount: 0, total: 100 });
    const updated = store.updateStatus(order.id, OrderStatus.CONFIRMED);

    expect(updated?.status).toBe(OrderStatus.CONFIRMED);
  });

  it('should find orders by userId using secondary index', () => {
    store.create({ userId: 'user-1', items: sampleItems, subtotal: 100, discount: 0, total: 100 });
    store.create({ userId: 'user-1', items: sampleItems, subtotal: 200, discount: 0, total: 200 });
    store.create({ userId: 'user-2', items: sampleItems, subtotal: 50, discount: 0, total: 50 });

    expect(store.findByUserId('user-1')).toHaveLength(2);
    expect(store.findByUserId('user-2')).toHaveLength(1);
    expect(store.findByUserId('unknown')).toHaveLength(0);
  });

  it('should find orders by status', () => {
    const o1 = store.create({ userId: 'u1', items: sampleItems, subtotal: 100, discount: 0, total: 100 });
    store.create({ userId: 'u2', items: sampleItems, subtotal: 100, discount: 0, total: 100 });
    store.updateStatus(o1.id, OrderStatus.CONFIRMED);

    expect(store.findByStatus(OrderStatus.CONFIRMED)).toHaveLength(1);
    expect(store.findByStatus(OrderStatus.PENDING)).toHaveLength(1);
  });
});
