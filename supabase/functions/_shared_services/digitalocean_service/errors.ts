/**
 * Base error class for errors originating from the DigitalOceanService.
 */
export class DigitalOceanServiceError extends Error {
  public readonly originalError?: any;

  constructor(message: string, originalError?: any) {
    super(message);
    this.name = this.constructor.name;
    this.originalError = originalError;
    // Ensuring the prototype chain is correct for custom errors
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Represents an error reported by the DigitalOcean API.
 */
export class DigitalOceanApiError extends DigitalOceanServiceError {
  public readonly statusCode?: number;
  public readonly apiErrorCode?: string | number; // DigitalOcean specific error code, if available

  constructor(
    message: string,
    statusCode?: number,
    apiErrorCode?: string | number,
    originalError?: any
  ) {
    super(message, originalError);
    this.statusCode = statusCode;
    this.apiErrorCode = apiErrorCode;
  }
}

/**
 * Error for authentication failures with the DigitalOcean API (e.g., invalid token).
 */
export class DigitalOceanAuthenticationError extends DigitalOceanApiError {
  constructor(message: string = "DigitalOcean API authentication failed.", originalError?: any) {
    // Typically a 401 status code
    super(message, 401, undefined, originalError);
  }
}

/**
 * Error when a requested DigitalOcean resource is not found.
 */
export class DigitalOceanResourceNotFoundError extends DigitalOceanApiError {
  constructor(message: string = "DigitalOcean resource not found.", originalError?: any) {
    // Typically a 404 status code
    super(message, 404, undefined, originalError);
  }
}

/**
 * Error for API rate limiting by DigitalOcean.
 */
export class DigitalOceanRateLimitError extends DigitalOceanApiError {
  public readonly retryAfter?: number; // Seconds after which to retry, if provided by API

  constructor(message: string = "DigitalOcean API rate limit exceeded.", retryAfter?: number, originalError?: any) {
    // Typically a 429 status code
    super(message, 429, undefined, originalError);
    this.retryAfter = retryAfter;
  }
}

/**
 * Error for unexpected issues or invalid responses from the DigitalOcean API.
 */
export class DigitalOceanUnexpectedResponseError extends DigitalOceanServiceError {
  constructor(message: string = "Unexpected response from DigitalOcean API.", originalError?: any) {
    super(message, originalError);
  }
} 