import { CartStore } from '../cart.store';

describe('CartStore', () => {
  let store: CartStore;

  beforeEach(() => {
    store = new CartStore(); // fresh instance per test — no shared state
  });

  it('should create a cart for a user', () => {
    const cart = store.create('user-1');

    expect(cart.id).toBeDefined();
    expect(cart.userId).toBe('user-1');
    expect(cart.items).toHaveLength(0);
    expect(store.size).toBe(1);
  });

  it('should add an item to a cart', () => {
    const cart = store.create('user-1');
    const updated = store.addItem(cart.id, {
      productId: 'p1',
      name: 'Widget',
      price: 100,
      quantity: 2,
    });

    expect(updated?.items).toHaveLength(1);
    expect(updated?.items[0].quantity).toBe(2);
  });

  it('should merge duplicate products instead of duplicating', () => {
    const cart = store.create('user-1');
    store.addItem(cart.id, { productId: 'p1', name: 'Widget', price: 100, quantity: 2 });
    store.addItem(cart.id, { productId: 'p1', name: 'Widget', price: 100, quantity: 3 });

    const fetched = store.findById(cart.id)!;
    expect(fetched.items).toHaveLength(1);
    expect(fetched.items[0].quantity).toBe(5);
  });

  it('should update item quantity', () => {
    const cart = store.create('user-1');
    store.addItem(cart.id, { productId: 'p1', name: 'Widget', price: 100, quantity: 3 });
    store.updateItemQuantity(cart.id, 'p1', 1);

    expect(store.findById(cart.id)?.items[0].quantity).toBe(1);
  });

  it('should remove an item when quantity is set to 0', () => {
    const cart = store.create('user-1');
    store.addItem(cart.id, { productId: 'p1', name: 'Widget', price: 100, quantity: 2 });
    store.updateItemQuantity(cart.id, 'p1', 0);

    expect(store.findById(cart.id)?.items).toHaveLength(0);
  });

  it('should return undefined for unknown cartId', () => {
    expect(store.findById('nonexistent')).toBeUndefined();
    expect(store.addItem('nonexistent', { productId: 'p1', name: 'x', price: 1, quantity: 1 })).toBeUndefined();
  });

  it('should find all carts by userId', () => {
    store.create('user-1');
    store.create('user-1');
    store.create('user-2');

    expect(store.findByUserId('user-1')).toHaveLength(2);
    expect(store.findByUserId('user-2')).toHaveLength(1);
  });

  it('should delete a cart', () => {
    const cart = store.create('user-1');
    expect(store.delete(cart.id)).toBe(true);
    expect(store.findById(cart.id)).toBeUndefined();
    expect(store.size).toBe(0);
  });
});
