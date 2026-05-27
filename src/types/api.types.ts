/**
 * Standardized API response envelope.
 * All responses follow: { success, data?, error?, meta? }
 */

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/** Helper to build a success payload */
export const successResponse = <T>(
  data: T,
  meta?: Record<string, unknown>,
): ApiSuccessResponse<T> => ({
  success: true,
  data,
  ...(meta && { meta }),
});

/** Helper to build an error payload */
export const errorResponse = (
  message: string,
  code?: string,
  details?: unknown,
): ApiErrorResponse => ({
  success: false,
  error: {
    message,
    ...(code && { code }),
    ...(details !== undefined && { details }),
  },
});
