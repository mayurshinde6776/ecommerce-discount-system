import { generateDiscountCode } from '../discount.codegen';

describe('generateDiscountCode', () => {
  it('should return an uppercase string', () => {
    const code = generateDiscountCode();
    expect(code).toBe(code.toUpperCase());
  });

  it('should match the format PREFIX-ADJECTIVENOUN-NNN', () => {
    const code = generateDiscountCode('REWARD');
    // REWARD-<WORD><WORD>-<3 digits>
    expect(code).toMatch(/^REWARD-[A-Z]+-\d{3}$/);
  });

  it('should use a custom prefix', () => {
    const code = generateDiscountCode('LOYALTY5');
    expect(code.startsWith('LOYALTY5-')).toBe(true);
  });

  it('should generate unique codes across multiple calls', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateDiscountCode()));
    // With 25×25×1000 = 625,000 combinations, 100 draws should yield at most ~0.008% collision rate
    expect(codes.size).toBeGreaterThan(90);
  });

  it('should always include a 3-digit numeric suffix', () => {
    for (let i = 0; i < 20; i++) {
      const suffix = generateDiscountCode().split('-').pop()!;
      expect(suffix).toMatch(/^\d{3}$/);
    }
  });
});
