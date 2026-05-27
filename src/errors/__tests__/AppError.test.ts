import { AppError, NotFoundError, BadRequestError } from '../../errors/AppError';
import { StatusCodes } from 'http-status-codes';

describe('AppError', () => {
  it('should set statusCode and isOperational', () => {
    const err = new AppError('something went wrong', StatusCodes.BAD_GATEWAY);

    expect(err.message).toBe('something went wrong');
    expect(err.statusCode).toBe(StatusCodes.BAD_GATEWAY);
    expect(err.isOperational).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it('should default to 500 when no statusCode provided', () => {
    const err = new AppError('oops');
    expect(err.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
  });
});

describe('NotFoundError', () => {
  it('should have 404 statusCode', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(StatusCodes.NOT_FOUND);
    expect(err.isOperational).toBe(true);
  });

  it('should accept custom messages', () => {
    const err = new NotFoundError('User not found');
    expect(err.message).toBe('User not found');
  });
});

describe('BadRequestError', () => {
  it('should have 400 statusCode', () => {
    const err = new BadRequestError();
    expect(err.statusCode).toBe(StatusCodes.BAD_REQUEST);
  });
});
