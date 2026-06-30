import { getApiErrorMessage, isRecord } from './error-message';

/**
 * Actionable recovery hint returned by the backend alongside an error.
 * Example: { label: 'Đăng nhập', href: '/auth/login' } for an email collision.
 */
export interface ApiErrorAction {
  label: string;
  href: string;
}

/**
 * Error that preserves the structured detail of a failed API response
 * (HTTP status, machine-readable `code`, and an optional recovery `action`),
 * so the UI can render a clear message plus a recovery CTA.
 */
export class ApiError extends Error {
  readonly statusCode?: number;
  readonly code?: string;
  readonly action?: ApiErrorAction;

  constructor(
    message: string,
    options: { statusCode?: number; code?: string; action?: ApiErrorAction } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.action = options.action;
    // Restore prototype chain for `instanceof` after transpilation to ES5.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/** Type guard: narrow an unknown caught value to {@link ApiError}. */
export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

function parseAction(value: unknown): ApiErrorAction | undefined {
  if (isRecord(value) && typeof value.label === 'string' && typeof value.href === 'string') {
    return { label: value.label, href: value.href };
  }
  return undefined;
}

/**
 * Build an {@link ApiError} from a raw response `error` payload.
 *
 * Handles the backend's structured detail shape
 * `{ code, message, action: { label, href } }` while gracefully falling back
 * to a plain message for string/array/legacy error payloads.
 */
export function toApiError(
  responseError: unknown,
  statusCode: number | undefined,
  fallbackMessage: string,
): ApiError {
  const message = getApiErrorMessage(responseError, fallbackMessage);
  const code = isRecord(responseError) && typeof responseError.code === 'string' ? responseError.code : undefined;
  const action = isRecord(responseError) ? parseAction(responseError.action) : undefined;
  return new ApiError(message, { statusCode, code, action });
}
