import { DiscountStore } from '../discount.store';

describe('DiscountStore', () => {
  let store: DiscountStore;

  beforeEach(() => {
    store = new DiscountStore(); // fresh — no seeded data
  });

  it('should create a discount code and normalise to uppercase', () => {
    const code = store.create({ code: 'save10', percentage: 10 });

    expect(code.code).toBe('SAVE10');
    expect(code.percentage).toBe(10);
    expect(code.isActive).toBe(true);
    expect(code.isUsed).toBe(false);
  });

  it('should find a code case-insensitively', () => {
    store.create({ code: 'WELCOME20', percentage: 20 });

    expect(store.findByCode('welcome20')).toBeDefined();
    expect(store.findByCode('WELCOME20')).toBeDefined();
    expect(store.findByCode('WeLcOmE20')).toBeDefined();
  });

  it('should throw when creating a duplicate code', () => {
    store.create({ code: 'DUPE', percentage: 5 });
    expect(() => store.create({ code: 'dupe', percentage: 5 })).toThrow();
  });

  it('isRedeemable should return true for a fresh active code', () => {
    store.create({ code: 'FRESH', percentage: 15 });
    expect(store.isRedeemable('FRESH')).toBe(true);
  });

  it('isRedeemable should return false for a used code', () => {
    store.create({ code: 'USED', percentage: 15 });
    store.markAsUsed('USED');
    expect(store.isRedeemable('USED')).toBe(false);
  });

  it('isRedeemable should return false for an inactive code', () => {
    store.create({ code: 'INACTIVE', percentage: 15 });
    store.setActive('INACTIVE', false);
    expect(store.isRedeemable('INACTIVE')).toBe(false);
  });

  it('isRedeemable should return false for unknown code', () => {
    expect(store.isRedeemable('GHOST')).toBe(false);
  });

  it('should return only active unused codes from getActive()', () => {
    store.create({ code: 'A', percentage: 5 });
    store.create({ code: 'B', percentage: 10 });
    store.create({ code: 'C', percentage: 15 });

    store.markAsUsed('B');
    store.setActive('C', false);

    const active = store.getActive();
    expect(active).toHaveLength(1);
    expect(active[0].code).toBe('A');
  });

  it('should toggle isActive correctly', () => {
    store.create({ code: 'TOGGLE', percentage: 10 });
    store.setActive('TOGGLE', false);
    expect(store.findByCode('TOGGLE')?.isActive).toBe(false);

    store.setActive('TOGGLE', true);
    expect(store.findByCode('TOGGLE')?.isActive).toBe(true);
  });
});
