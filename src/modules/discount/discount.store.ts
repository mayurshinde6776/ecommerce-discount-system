import { DiscountCode, CreateDiscountCodeInput } from './discount.model';

/**
 * In-memory Discount Code store backed by a Map<code, DiscountCode>.
 *
 * Codes are always stored and looked up uppercased for case-insensitive matching.
 */
export class DiscountStore {
  private readonly codes = new Map<string, DiscountCode>();

  // ─── Write Operations ─────────────────────────────────────────────────────

  create(input: CreateDiscountCodeInput): DiscountCode {
    const normalised = input.code.toUpperCase().trim();

    if (this.codes.has(normalised)) {
      throw new Error(`Discount code "${normalised}" already exists`);
    }

    const now = new Date();
    const discountCode: DiscountCode = {
      code: normalised,
      percentage: input.percentage,
      isActive: true,
      isUsed: false,
      createdAt: now,
      updatedAt: now,
    };

    this.codes.set(normalised, discountCode);
    return discountCode;
  }

  /**
   * Mark a code as used (single-use redemption).
   * Returns the updated code, or undefined if not found.
   */
  markAsUsed(code: string): DiscountCode | undefined {
    const record = this.codes.get(code.toUpperCase().trim());
    if (!record) return undefined;
    record.isUsed = true;
    record.updatedAt = new Date();
    return record;
  }

  /**
   * Toggle the active state of a code (admin operation).
   */
  setActive(code: string, isActive: boolean): DiscountCode | undefined {
    const record = this.codes.get(code.toUpperCase().trim());
    if (!record) return undefined;
    record.isActive = isActive;
    record.updatedAt = new Date();
    return record;
  }

  // ─── Read Operations ──────────────────────────────────────────────────────

  findByCode(code: string): DiscountCode | undefined {
    return this.codes.get(code.toUpperCase().trim());
  }

  /**
   * Validate a code is eligible for redemption:
   *  - exists, is active, and has not been used.
   */
  isRedeemable(code: string): boolean {
    const record = this.findByCode(code);
    return !!record && record.isActive && !record.isUsed;
  }

  getAll(): DiscountCode[] {
    return [...this.codes.values()];
  }

  getActive(): DiscountCode[] {
    return this.getAll().filter((c) => c.isActive && !c.isUsed);
  }

  get size(): number {
    return this.codes.size;
  }
}

/** Singleton store instance — seeded with some demo codes */
export const discountStore = new DiscountStore();

// ─── Seed Data ────────────────────────────────────────────────────────────────
// Remove or move to a dedicated seed script before production use.
discountStore.create({ code: 'SAVE10', percentage: 10 });
discountStore.create({ code: 'WELCOME20', percentage: 20 });
