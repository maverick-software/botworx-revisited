import { backOff, type IBackOffOptions } from 'https://esm.sh/exponential-backoff@3.1.2';
import {
  DigitalOceanServiceError,
  DigitalOceanApiError,
  DigitalOceanAuthenticationError,
  DigitalOceanResourceNotFoundError,
  DigitalOceanRateLimitError,
  DigitalOceanUnexpectedResponseError
} from './errors.ts';

// Define default options for retry attempts
const DEFAULT_RETRY_OPTIONS: Partial<IBackOffOptions> = {
  numOfAttempts: 3, // Default number of attempts
  startingDelay: 500, // Default starting delay in ms
  timeMultiple: 2, // Multiplier for the delay
  maxDelay: 5000, // Maximum delay in ms
  jitter: 'full', // Adding jitter for better distribution of retries
  // A jitter function could be added here, e.g., jitter: 'full' or a custom function
};

/**
 * Configuration for the callWithRetry utility.
 */
export interface CallWithRetryOptions extends Partial<IBackOffOptions> {
  // No additional options for now, but can be extended
}

/**
 * Checks if an error is likely an Axios-style error with a response object.
 * `dots-wrapper` uses axios, so errors from API calls should conform to this.
 */
function isAxiosErrorWithResponse(error: any): error is { response: { status: number; data?: {id?: string; message?: string; code?: string; [key: string]: any}; headers?: any }; message: string; code?: string; isAxiosError?: boolean } {
  return error && typeof error.response === 'object' && typeof error.response.status === 'number' && error.isAxiosError !== undefined;
}

/**
 * Checks if an error is a non-response Axios error (e.g. network issue, timeout before response).
 */
function isAxiosNetworkError(error: any): error is { message: string; code?: string; isAxiosError?: boolean } {
    return error && error.isAxiosError && !error.response;
}

/**
 * Wraps a DigitalOcean API call with retry logic using exponential backoff.
 * 
 * IMPORTANT: The retry predicate currently retries most errors. This MUST be refined
 * once the structure of errors from `dots-wrapper` is known, to only retry
 * appropriate transient errors (e.g., 429, 5xx) and not client errors (4xx, except 429).
 * 
 * @param apiCall A function that returns a Promise for the DigitalOcean API call.
 * @param options Optional configuration for retry behavior, extending IBackOffOptions.
 * @returns The result of the API call.
 * @throws {DigitalOceanServiceError} or its subtypes if the API call ultimately fails.
 */
export async function callWithRetry<T>(
  apiCall: () => Promise<T>,
  options?: CallWithRetryOptions
): Promise<T> {
  const backoffOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };

  try {
    return await backOff(apiCall, {
      ...backoffOptions,
      retry: (e: any, attemptNumber: number) => {
        console.warn(
          `DigitalOcean API call attempt ${attemptNumber} failed. Error: ${e?.message || 'Unknown error'}. Analyzing for retry...`
        );

        if (isAxiosErrorWithResponse(e)) {
          const status = e.response.status;
          const doErrorCode = e.response.data?.id; // DigitalOcean often uses 'id' field for error type
          console.log(`API Error Response: Status ${status}, DO Error ID: ${doErrorCode || 'N/A'}`);

          if (status === 401 || status === 403) {
            console.log(`Authentication/Authorization error (status ${status}). Not retrying.`);
            return false;
          }
          if (status === 404) {
            console.log(`Resource not found (status ${status}). Not retrying.`);
            return false;
          }
          if (status >= 400 && status < 500 && status !== 429) {
            console.log(`Other client error (status ${status}). Not retrying.`);
            return false;
          }
          if (status === 429 || (status >= 500 && status <= 599)) {
            console.log(`Retryable server/rate limit error (status ${status}). Retrying.`);
            return true;
          }
        } else if (isAxiosNetworkError(e)) {
          // Axios specific error codes for network issues like timeout, DNS, connection refused etc.
          // Common codes: ECONNABORTED (timeout), ENOTFOUND (DNS), ECONNREFUSED, ERR_NETWORK
          console.log(`Axios network error (code: ${e.code || 'N/A'}). Retrying: ${e.message}`);
          return true; 
        } else {
          // For truly unknown non-Axios errors, or Axios errors without response not caught above.
          // Retrying these might be risky without more info, but for now, we'll allow it for a few attempts.
          console.log('Unknown error type or non-response Axios error. Retrying as a general transient issue.');
          return true;
        }
        // Default to not retrying if none of the above explicit conditions for retry were met.
        console.log('Error not classified for retry by above rules. Not retrying.');
        return false;
      },
    });
  } catch (error: any) {
    // This block handles errors after retries are exhausted or if the retry predicate returned false.
    const originalErrorMessage = error?.message || 'Unknown error after retries';
    console.error(
      `DigitalOcean API call failed definitively: ${originalErrorMessage}`,
      { errorDetails: isAxiosErrorWithResponse(error) ? error.response.data : error }
    );

    if (error instanceof DigitalOceanServiceError) {
      throw error; 
    }

    if (isAxiosErrorWithResponse(error)) {
      const status = error.response.status;
      const responseData = error.response.data;
      // Prefer DigitalOcean's message and ID if available in the response data
      const message = responseData?.message || originalErrorMessage;
      const apiErrorCode = responseData?.id || responseData?.code; 

      if (status === 401 || status === 403) {
        throw new DigitalOceanAuthenticationError(message, error);
      }
      if (status === 404) {
        throw new DigitalOceanResourceNotFoundError(message, error);
      }
      if (status === 429) {
        const retryAfterHeader = error.response.headers?.['retry-after']; // Axios makes headers available
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
        throw new DigitalOceanRateLimitError(message, retryAfterSeconds, error);
      }
      if (status >= 400 && status < 500) {
        throw new DigitalOceanApiError(message, status, apiErrorCode, error);
      }
      if (status >= 500) {
        throw new DigitalOceanApiError(`Server error: ${message}`, status, apiErrorCode, error);
      }
    } else if (isAxiosNetworkError(error)) {
        // Handle specific Axios network error codes if needed, or a general service error
        throw new DigitalOceanServiceError(`Network error during DigitalOcean API call: ${originalErrorMessage}`, error);
    }
    
    throw new DigitalOceanServiceError(
      `Failed DigitalOcean API operation: ${originalErrorMessage}`,
      error
    );
  }
} 