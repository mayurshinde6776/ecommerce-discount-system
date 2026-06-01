import { OrderStore } from '../order/order.store';
import { OrderStatus } from '../order/order.model';
import { DiscountService } from '../discount/discount.service';
import { DiscountStore } from '../discount/discount.store';
import { DiscountCode } from '../discount/discount.model';
import { BadRequestError } from '../../errors';
import { StatsResponse, GenerateDiscountRequest } from './admin.dto';

/**
 * AdminService owns all admin-level business logic.
 *
 * Deliberately separate from domain services so admin concerns
 * (reporting, manual code generation) do not bleed into checkout logic.
 */
export class AdminService {
  constructor(
    private readonly orderStore: OrderStore,
    private readonly discountStore: DiscountStore,
    private readonly discountService: DiscountService,
  ) {}

  // ─── Generate discount code ───────────────────────────────────────────────

  /**
   * Manually generate a discount code with a specified percentage.
   * Delegates collision handling and validation to DiscountService.
   */
  generateDiscount(input: GenerateDiscountRequest): DiscountCode {
    if (
      input.percentage === undefined ||
      input.percentage === null ||
      typeof input.percentage !== 'number'
    ) {
      throw new BadRequestError('percentage is required and must be a number');
    }

    return this.discountService.generateDiscountCode(
      input.percentage,
      (input.prefix?.trim().toUpperCase() || 'ADMIN'),
    );
  }

  // ─── Platform statistics ───────────────────────────────────────────────────

  /**
   * Compute all platform-level statistics from the in-memory stores.
   * Only CONFIRMED orders contribute to revenue and sales figures.
   */
  getStats(): StatsResponse {
    const allOrders = this.orderStore.getAll();
    const confirmedOrders = allOrders.filter((o) => o.status === OrderStatus.CONFIRMED);
    const allCoupons = this.discountStore.getAll();

    // ── Order counts ────────────────────────────────────────────────────────
    const orderStats = {
      total: allOrders.length,
      confirmed: confirmedOrders.length,
      pending: allOrders.filter((o) => o.status === OrderStatus.PENDING).length,
      cancelled: allOrders.filter((o) => o.status === OrderStatus.CANCELLED).length,
    };

    // ── Revenue (CONFIRMED orders only) ─────────────────────────────────────
    const totalRevenue = parseFloat(
      confirmedOrders.reduce((sum, o) => sum + o.total, 0).toFixed(2),
    );
    const grossRevenue = parseFloat(
      confirmedOrders.reduce((sum, o) => sum + o.subtotal, 0).toFixed(2),
    );
    const totalDiscountGiven = parseFloat(
      confirmedOrders.reduce((sum, o) => sum + o.discount, 0).toFixed(2),
    );

    // ── Items sold (CONFIRMED orders only) ───────────────────────────────────
    const totalItemsSold = confirmedOrders.reduce(
      (sum, o) => sum + o.items.reduce((s, item) => s + item.quantity, 0),
      0,
    );
    const totalLineItems = confirmedOrders.reduce((sum, o) => sum + o.items.length, 0);

    // ── Coupon breakdown ────────────────────────────────────────────────────
    const couponStats = {
      totalGenerated: allCoupons.length,
      available: allCoupons.filter((c) => c.isActive && !c.isUsed).length,
      used: allCoupons.filter((c) => c.isUsed).length,
      inactive: allCoupons.filter((c) => !c.isActive && !c.isUsed).length,
    };

    return {
      orders: orderStats,
      revenue: {
        totalRevenue,
        grossRevenue,
        totalDiscountGiven,
      },
      items: {
        totalItemsSold,
        totalLineItems,
      },
      coupons: couponStats,
    };
  }
}
