import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../errors';

/**
 * Catch-all handler for routes that do not exist.
 * Converts unmatched requests into a NotFoundError so the
 * centralized error middleware can format the response uniformly.
 */
export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction): void => {
  next(new NotFoundError(`Route ${_req.method} ${_req.originalUrl} not found`));
};
