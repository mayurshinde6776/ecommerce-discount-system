import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../errors';

/**
 * Validate request body against a plain object schema.
 *
 * Each entry in `rules` is a field name mapped to a validator function.
 * If any validator returns a string, it is treated as a validation error message.
 *
 * Usage:
 *   router.post('/', validate({ field: (v) => !v && 'required' }), handler)
 */
export type ValidatorFn = (value: unknown, body: Record<string, unknown>) => string | false | undefined | null;

export const validate =
  (rules: Record<string, ValidatorFn>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const body = req.body as Record<string, unknown>;
    const errors: string[] = [];

    for (const [field, rule] of Object.entries(rules)) {
      const result = rule(body[field], body);
      if (result) errors.push(result);
    }

    if (errors.length > 0) {
      return next(new BadRequestError(errors.join('; ')));
    }

    next();
  };
