import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { HealthService } from './health.service';
import { successResponse } from '../../types';

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * GET /health
   * Returns current system health status.
   */
  getHealth = (_req: Request, res: Response): void => {
    const status = this.healthService.getStatus();

    const httpStatus = status.status === 'ok' ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;

    res.status(httpStatus).json(successResponse(status));
  };
}
