interface FastApiValidationError {
  loc?: Array<string | number>;
  msg?: string;
  type?: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function formatValidationError(item: FastApiValidationError): string {
  const location = item.loc?.filter((part) => part !== 'body').join('.');
  return location ? `${location}: ${item.msg || 'Invalid value'}` : item.msg || 'Invalid value';
}

export function getApiErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error || fallback;

  if (Array.isArray(error)) {
    const messages = error
      .map((item) => (isRecord(item) ? formatValidationError(item as FastApiValidationError) : String(item)))
      .filter(Boolean);
    return messages.length > 0 ? messages.join('\n') : fallback;
  }

  if (isRecord(error)) {
    const detail = error.detail;
    if (Array.isArray(detail)) return getApiErrorMessage(detail, fallback);
    if (typeof detail === 'string') return detail;

    const responseError = error.error;
    if (Array.isArray(responseError)) return getApiErrorMessage(responseError, fallback);
    if (typeof responseError === 'string' && responseError) return responseError;

    const message = error.message;
    if (typeof message === 'string' && message) return message;
  }

  return fallback;
}
