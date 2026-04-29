export class KovaTTSError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class KovaTTSAuthError extends KovaTTSError {}
export class KovaTTSRateLimitError extends KovaTTSError {}
export class KovaTTSServerError extends KovaTTSError {}
export class KovaTTSValidationError extends KovaTTSError {}
export class KovaTTSConnectionError extends KovaTTSError {}
export class KovaTTSProtocolError extends KovaTTSError {}

export function errorForStatus(status: number, message: string, body: unknown): KovaTTSError {
  if (status === 401 || status === 403) {
    return new KovaTTSAuthError(message, status, body);
  }
  if (status === 429) {
    return new KovaTTSRateLimitError(message, status, body);
  }
  if (status === 400 || status === 422) {
    return new KovaTTSValidationError(message, status, body);
  }
  if (status >= 500) {
    return new KovaTTSServerError(message, status, body);
  }
  return new KovaTTSError(message, status, body);
}
