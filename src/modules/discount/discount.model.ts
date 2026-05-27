// ─── DiscountCode Interface ───────────────────────────────────────────────────

/**
 * A discount code that can be applied at checkout.
 *
 * Rules:
 *   - `percentage` must be in the range (0, 100].
 *   - A code can only be applied when `isActive` is true AND `isUsed` is false.
 *   - Once redeemed, `isUsed` is set to true (single-use semantics).
 *     Extend to `maxUses / currentUses` for multi-use codes.
 */
export interface DiscountCode {
  /** Unique, case-insensitive code string (stored uppercased) */
  code: string;
  /** Discount as a percentage of the order subtotal — e.g. 10 = 10% off */
  percentage: number;
  /** False means the code is disabled and cannot be redeemed */
  isActive: boolean;
  /** True once the code has been successfully applied to an order */
  isUsed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── DTO used to create a discount code ──────────────────────────────────────

export interface CreateDiscountCodeInput {
  code: string;
  percentage: number;
}
