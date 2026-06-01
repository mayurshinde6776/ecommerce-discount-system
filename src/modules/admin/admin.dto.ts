import { DiscountCode } from '../discount/discount.model';

// ─── POST /admin/discount/generate ───────────────────────────────────────────

export interface GenerateDiscountRequest {
  percentage: number;
  /** Optional prefix for the generated code, defaults to 'ADMIN' */
  prefix?: string;
}

export interface GenerateDiscountResponse {
  discountCode: DiscountCode;
}

// ─── GET /admin/stats ─────────────────────────────────────────────────────────

export interface StatsResponse {
  orders: {
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
  };
  revenue: {
    /** Sum of final totals across all CONFIRMED orders */
    totalRevenue: number;
    /** Sum of subtotals before discount across all CONFIRMED orders */
    grossRevenue: number;
    /** Total discount amount saved across all CONFIRMED orders */
    totalDiscountGiven: number;
  };
  items: {
    /** Total individual units sold across all CONFIRMED orders */
    totalItemsSold: number;
    /** Total distinct product lines (not units) across all CONFIRMED orders */
    totalLineItems: number;
  };
  coupons: {
    /** Total coupon codes ever created (including seed data) */
    totalGenerated: number;
    /** Codes that are active and not yet used */
    available: number;
    /** Codes that have been redeemed */
    used: number;
    /** Codes that have been manually deactivated */
    inactive: number;
  };
}
