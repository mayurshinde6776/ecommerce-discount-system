import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { CheckoutService } from './checkout.service';
import { CheckoutRequest } from './checkout.dto';
import { successResponse } from '../../types';

export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  /**
   * POST /api/v1/checkout
   * Body: { userId, discountCode? }
   */
  checkout = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const input = req.body as CheckoutRequest;
      const result = this.checkoutService.checkout(input);
      res.status(StatusCodes.CREATED).json(successResponse(result));
    } catch (err) {
      next(err);
    }
  };
}
