import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AdminService } from './admin.service';
import { GenerateDiscountRequest } from './admin.dto';
import { successResponse } from '../../types';

export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * POST /admin/discount/generate
   * Body: { percentage: number, prefix?: string }
   */
  generateDiscount = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const input = req.body as GenerateDiscountRequest;
      const discountCode = this.adminService.generateDiscount(input);
      res.status(StatusCodes.CREATED).json(successResponse({ discountCode }));
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /admin/stats
   */
  getStats = (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const stats = this.adminService.getStats();
      res.status(StatusCodes.OK).json(successResponse(stats));
    } catch (err) {
      next(err);
    }
  };
}
