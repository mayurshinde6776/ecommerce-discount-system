import { CartService } from '../cart.service';
import { CartStore } from '../cart.store';

const makeService = () => new CartService(new CartStore());

const validInput = {
  userId: 'u1',
  productId: 'p1',
  name: 'Widget',
  price: 100,
  quantity: 2,
};

describe('CartService.addItem', () => {
  it('should auto-create a cart and return computed totals', () => {
    const service = makeService();
    const result = service.addItem(validInput);

    expect(result.userId).toBe('u1');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].lineTotal).toBe(200);
    expect(result.subtotal).toBe(200);
    expect(result.itemCount).toBe(2);
  });

  it('should reuse existing cart on second call for same user', () => {
    const service = makeService();
    service.addItem(validInput);
    const result = service.addItem({ ...validInput, productId: 'p2', name: 'Gadget', price: 50, quantity: 1 });

    expect(result.items).toHaveLength(2);
  });

  it('should merge quantities for duplicate productId', () => {
    const service = makeService();
    service.addItem(validInput);
    const result = service.addItem(validInput); // same product

    expect(result.items).toHaveLength(1);
    expect(result.items[0].quantity).toBe(4);
    expect(result.subtotal).toBe(400);
  });

  it('should throw BadRequestError for missing userId', () => {
    const service = makeService();
    expect(() => service.addItem({ ...validInput, userId: '' })).toThrow('userId is required');
  });

  it('should throw BadRequestError for negative price', () => {
    const service = makeService();
    expect(() => service.addItem({ ...validInput, price: -1 })).toThrow(/price/i);
  });

  it('should throw BadRequestError for zero quantity', () => {
    const service = makeService();
    expect(() => service.addItem({ ...validInput, quantity: 0 })).toThrow(/quantity/i);
  });

  it('should throw BadRequestError for non-integer quantity', () => {
    const service = makeService();
    expect(() => service.addItem({ ...validInput, quantity: 2.5 })).toThrow(/quantity/i);
  });
});

describe('CartService.getCartByUserId', () => {
  it('should return cart with totals after items are added', () => {
    const service = makeService();
    service.addItem(validInput);
    const result = service.getCartByUserId('u1');

    expect(result.userId).toBe('u1');
    expect(result.subtotal).toBe(200);
  });

  it('should throw NotFoundError for user with no cart', () => {
    const service = makeService();
    expect(() => service.getCartByUserId('nobody')).toThrow('Cart not found');
  });

  it('should throw BadRequestError for empty userId', () => {
    const service = makeService();
    expect(() => service.getCartByUserId('')).toThrow('userId is required');
  });
});
