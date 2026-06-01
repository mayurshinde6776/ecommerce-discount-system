import { Router } from 'express';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { cartStore } from '../cart/cart.store';
import { orderStore } from '../order/order.store';
import { discountStore } from '../discount/discount.store';
import { DiscountService } from '../discount/discount.service';
import { validate } from '../../middlewares';

const router = Router();

// ─── Dependency wiring ────────────────────────────────────────────────────────
const discountService = new DiscountService(discountStore, orderStore);
const checkoutService = new CheckoutService(cartStore, orderStore, discountService);
const checkoutController = new CheckoutController(checkoutService);

// ─── Route-level validation ───────────────────────────────────────────────────
const checkoutValidation = validate({
  userId: (v) =>
    (!v || typeof v !== 'string' || !(v as string).trim()) && 'userId is required',
});

/**
 * @route   POST /api/v1/checkout
 * @desc    Checkout the user's active cart
 * @access  Public
 * @body    { userId: string, discountCode?: string }
 */
router.post('/', checkoutValidation, checkoutController.checkout);

export default router;
