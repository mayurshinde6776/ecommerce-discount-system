import { DiscountStore } from './discount.store';
import { DiscountCode } from './discount.model';
import { OrderStore } from '../order/order.store';
import { generateDiscountCode } from './discount.codegen';
import { BadRequestError, NotFoundError } from '../../errors';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Every N-th confirmed order earns a discount coupon */
const REWARD_EVERY_N_ORDERS = 5;

/** Percentage awarded by the loyalty coupon */
const REWARD_PERCENTAGE = 10;

// ─── Result types ─────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  discountCode?: DiscountCode;
  reason?: string;
}

export interface RewardCheckResult {
  rewarded: boolean;
  /** Populated when rewarded === true */
  coupon?: DiscountCode;
}

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * DiscountService owns all discount business logic:
 *
 *  1. generateDiscountCode  — create a new coupon in the store
 *  2. validateDiscountCode  — check eligibility without side effects
 *  3. markDiscountAsUsed    — redeem a code (single-use)
 *  4. checkAndRewardUser    — every-5th-order loyalty reward (called post-order)
 */
export class DiscountService {
  constructor(
    private readonly discountStore: DiscountStore,
    private readonly orderStore: OrderStore,
  ) {}

  // ─── 1. Generate ────────────────────────────────────────────────────────────

  /**
   * Creates a new discount coupon with a readable code.
   * Retries up to `maxRetries` times to avoid the rare collision.
   */
  generateDiscountCode(
    percentage: number = REWARD_PERCENTAGE,
    prefix = 'REWARD',
    maxRetries = 5,
  ): DiscountCode {
    if (percentage <= 0 || percentage > 100) {
      throw new BadRequestError('Discount percentage must be between 1 and 100');
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const code = generateDiscountCode(prefix);
      try {
        return this.discountStore.create({ code, percentage });
      } catch (err) {
        // Collision — try a different code
        lastError = err as Error;
      }
    }

    throw new Error(
      `Failed to generate a unique discount code after ${maxRetries} attempts: ${lastError?.message ?? ''}`,
    );
  }

  // ─── 2. Validate ────────────────────────────────────────────────────────────

  /**
   * Validates a discount code without redeeming it.
   * Returns a typed result so callers can branch on `valid` without try/catch.
   *
   * Reasons a code may be invalid:
   *  - does not exist
   *  - inactive (manually disabled)
   *  - already used
   */
  validateDiscountCode(code: string): ValidationResult {
    if (!code?.trim()) {
      return { valid: false, reason: 'Discount code is required' };
    }

    const record = this.discountStore.findByCode(code);

    if (!record) {
      return { valid: false, reason: `Discount code "${code.toUpperCase()}" does not exist` };
    }

    if (!record.isActive) {
      return { valid: false, reason: `Discount code "${record.code}" is no longer active` };
    }

    if (record.isUsed) {
      return { valid: false, reason: `Discount code "${record.code}" has already been used` };
    }

    return { valid: true, discountCode: record };
  }

  /**
   * Throws a BadRequestError if the code is invalid.
   * Convenience wrapper for contexts where validation failure is exceptional.
   */
  validateOrThrow(code: string): DiscountCode {
    const result = this.validateDiscountCode(code);
    if (!result.valid || !result.discountCode) {
      throw new BadRequestError(result.reason ?? 'Invalid discount code');
    }
    return result.discountCode;
  }

  // ─── 3. Mark as used ────────────────────────────────────────────────────────

  /**
   * Redeems a discount code — marks it as used in the store.
   * Validates before marking so partial redemption cannot occur.
   *
   * @throws BadRequestError  if the code is invalid / already used
   * @throws NotFoundError    if the code doesn't exist
   */
  markDiscountAsUsed(code: string): DiscountCode {
    // Validate first — atomic guard
    this.validateOrThrow(code);

    const updated = this.discountStore.markAsUsed(code);

    if (!updated) {
      throw new NotFoundError(`Discount code "${code.toUpperCase()}" not found`);
    }

    return updated;
  }

  // ─── 4. Loyalty reward ──────────────────────────────────────────────────────

  /**
   * Checks whether a user has just crossed a reward threshold and, if so,
   * generates a 10% coupon for them.
   *
   * Call this AFTER persisting a newly confirmed order.
   *
   * Logic:
   *   confirmedCount % REWARD_EVERY_N_ORDERS === 0  →  reward
   *
   * e.g. 5th, 10th, 15th … confirmed order each earns one coupon.
   */
  checkAndRewardUser(userId: string): RewardCheckResult {
    const confirmedCount = this.orderStore.countConfirmedByUserId(userId);

    const shouldReward =
      confirmedCount > 0 && confirmedCount % REWARD_EVERY_N_ORDERS === 0;

    if (!shouldReward) {
      return { rewarded: false };
    }

    const coupon = this.generateDiscountCode(
      REWARD_PERCENTAGE,
      `LOYALTY${confirmedCount}`, // e.g. LOYALTY5, LOYALTY10
    );

    return { rewarded: true, coupon };
  }

  // ─── Queries ─────────────────────────────────────────────────────────────────

  /** Calculate the discount amount for a given subtotal and code */
  calculateDiscount(subtotal: number, code: string): number {
    const record = this.validateOrThrow(code);
    return parseFloat(((subtotal * record.percentage) / 100).toFixed(2));
  }

  getAll(): DiscountCode[] {
    return this.discountStore.getAll();
  }

  getActive(): DiscountCode[] {
    return this.discountStore.getActive();
  }
}
