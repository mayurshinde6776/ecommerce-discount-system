import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../errors';
import { errorResponse } from '../types';
import { config } from '../config';

/**
 * Centralized error-handling middleware.
 * Must be registered LAST with four parameters so Express recognises it.
 *
 * Behaviour:
 *  - Operational errors (AppError subclasses) → structured JSON with their status code.
 *  - Unknown / programmer errors → 500 with a generic message.
 *  - Stack traces are only exposed in development.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  const isDev = config.env === 'development';

  if (err instanceof AppError && err.isOperational) {
    res.status(err.statusCode).json({
      ...errorResponse(err.message),
      ...(isDev && { stack: err.stack }),
    });
    return;
  }

  // Unexpected / programmer error
  console.error('[Unhandled Error]', err);

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    ...errorResponse('An unexpected error occurred. Please try again later.'),
    ...(isDev && { originalError: err.message, stack: err.stack }),
  });
};
