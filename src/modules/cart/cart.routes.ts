import { Router } from 'express';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { cartStore } from './cart.store';
import { validate } from '../../middlewares';

const router = Router();

// ─── Dependency wiring ────────────────────────────────────────────────────────
const cartService = new CartService(cartStore);
const cartController = new CartController(cartService);

// ─── Route-level validation ───────────────────────────────────────────────────
const addItemValidation = validate({
  userId: (v) => (!v || typeof v !== 'string' || !(v as string).trim()) && 'userId is required',
  productId: (v) => (!v || typeof v !== 'string' || !(v as string).trim()) && 'productId is required',
  name: (v) => (!v || typeof v !== 'string' || !(v as string).trim()) && 'name is required',
  price: (v) => {
    if (v === undefined || v === null) return 'price is required';
    if (typeof v !== 'number' || !isFinite(v as number) || (v as number) <= 0)
      return 'price must be a positive number';
    return false;
  },
  quantity: (v) => {
    if (v === undefined || v === null) return 'quantity is required';
    if (!Number.isInteger(v) || (v as number) <= 0) return 'quantity must be a positive integer';
    return false;
  },
});

/**
 * @route   POST /api/v1/cart/items
 * @desc    Add an item to the user's cart (creates cart if none exists)
 * @access  Public
 * @body    { userId, productId, name, price, quantity }
 */
router.post('/items', addItemValidation, cartController.addItem);

/**
 * @route   GET /api/v1/cart/:userId
 * @desc    Get the active cart for a user with computed totals
 * @access  Public
 */
router.get('/:userId', cartController.getCart);

export default router;
