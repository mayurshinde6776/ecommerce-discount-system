import { Router } from 'express';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { orderStore } from '../order/order.store';
import { discountStore } from '../discount/discount.store';
import { DiscountService } from '../discount/discount.service';
import { validate } from '../../middlewares';

const router = Router();

// ─── Dependency wiring ────────────────────────────────────────────────────────
const discountService = new DiscountService(discountStore, orderStore);
const adminService = new AdminService(orderStore, discountStore, discountService);
const adminController = new AdminController(adminService);

// ─── Validation ───────────────────────────────────────────────────────────────
const generateDiscountValidation = validate({
  percentage: (v) => {
    if (v === undefined || v === null) return 'percentage is required';
    if (typeof v !== 'number' || !isFinite(v as number))
      return 'percentage must be a number';
    if ((v as number) <= 0 || (v as number) > 100)
      return 'percentage must be between 1 and 100';
    return false;
  },
});

/**
 * @route   POST /admin/discount/generate
 * @desc    Manually generate a discount code with a given percentage
 * @body    { percentage: number, prefix?: string }
 */
router.post('/discount/generate', generateDiscountValidation, adminController.generateDiscount);

/**
 * @route   GET /admin/stats
 * @desc    Platform-wide statistics (revenue, items sold, discounts, coupons)
 */
router.get('/stats', adminController.getStats);

export default router;
