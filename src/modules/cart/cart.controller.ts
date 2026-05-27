import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { CartService } from './cart.service';
import { AddCartItemRequest } from './cart.dto';
import { successResponse } from '../../types';

export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * POST /api/v1/cart/items
   * Body: { userId, productId, name, price, quantity }
   */
  addItem = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const input = req.body as AddCartItemRequest;
      const cart = this.cartService.addItem(input);
      res.status(StatusCodes.OK).json(successResponse(cart));
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/cart/:userId
   */
  getCart = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { userId } = req.params;
      const cart = this.cartService.getCartByUserId(userId);
      res.status(StatusCodes.OK).json(successResponse(cart));
    } catch (err) {
      next(err);
    }
  };
}
