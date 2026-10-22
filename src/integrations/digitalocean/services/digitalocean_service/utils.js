"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callWithRetry = callWithRetry;
var exponential_backoff_1 = require("exponential-backoff");
var errors_1 = require("./errors");
// Define default options for retry attempts
var DEFAULT_RETRY_OPTIONS = {
    numOfAttempts: 3, // Default number of attempts
    startingDelay: 500, // Default starting delay in ms
    timeMultiple: 2, // Multiplier for the delay
    maxDelay: 5000, // Maximum delay in ms
    jitter: 'full', // Adding jitter for better distribution of retries
    // A jitter function could be added here, e.g., jitter: 'full' or a custom function
};
/**
 * Checks if an error is likely an Axios-style error with a response object.
 * `dots-wrapper` uses axios, so errors from API calls should conform to this.
 */
function isAxiosErrorWithResponse(error) {
    return error && typeof error.response === 'object' && typeof error.response.status === 'number' && error.isAxiosError !== undefined;
}
/**
 * Checks if an error is a non-response Axios error (e.g. network issue, timeout before response).
 */
function isAxiosNetworkError(error) {
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
function callWithRetry(apiCall, options) {
    return __awaiter(this, void 0, void 0, function () {
        var backoffOptions, error_1, originalErrorMessage, status_1, responseData, message, apiErrorCode, retryAfterHeader, retryAfterSeconds;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    backoffOptions = __assign(__assign({}, DEFAULT_RETRY_OPTIONS), options);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, exponential_backoff_1.backOff)(apiCall, __assign(__assign({}, backoffOptions), { retry: function (e, attemptNumber) {
                                var _a;
                                console.warn("DigitalOcean API call attempt ".concat(attemptNumber, " failed. Error: ").concat((e === null || e === void 0 ? void 0 : e.message) || 'Unknown error', ". Analyzing for retry..."));
                                if (isAxiosErrorWithResponse(e)) {
                                    var status_2 = e.response.status;
                                    var doErrorCode = (_a = e.response.data) === null || _a === void 0 ? void 0 : _a.id; // DigitalOcean often uses 'id' field for error type
                                    console.log("API Error Response: Status ".concat(status_2, ", DO Error ID: ").concat(doErrorCode || 'N/A'));
                                    if (status_2 === 401 || status_2 === 403) {
                                        console.log("Authentication/Authorization error (status ".concat(status_2, "). Not retrying."));
                                        return false;
                                    }
                                    if (status_2 === 404) {
                                        console.log("Resource not found (status ".concat(status_2, "). Not retrying."));
                                        return false;
                                    }
                                    if (status_2 >= 400 && status_2 < 500 && status_2 !== 429) {
                                        console.log("Other client error (status ".concat(status_2, "). Not retrying."));
                                        return false;
                                    }
                                    if (status_2 === 429 || (status_2 >= 500 && status_2 <= 599)) {
                                        console.log("Retryable server/rate limit error (status ".concat(status_2, "). Retrying."));
                                        return true;
                                    }
                                }
                                else if (isAxiosNetworkError(e)) {
                                    // Axios specific error codes for network issues like timeout, DNS, connection refused etc.
                                    // Common codes: ECONNABORTED (timeout), ENOTFOUND (DNS), ECONNREFUSED, ERR_NETWORK
                                    console.log("Axios network error (code: ".concat(e.code || 'N/A', "). Retrying: ").concat(e.message));
                                    return true;
                                }
                                else {
                                    // For truly unknown non-Axios errors, or Axios errors without response not caught above.
                                    // Retrying these might be risky without more info, but for now, we'll allow it for a few attempts.
                                    console.log('Unknown error type or non-response Axios error. Retrying as a general transient issue.');
                                    return true;
                                }
                                // Default to not retrying if none of the above explicit conditions for retry were met.
                                console.log('Error not classified for retry by above rules. Not retrying.');
                                return false;
                            } }))];
                case 2: return [2 /*return*/, _b.sent()];
                case 3:
                    error_1 = _b.sent();
                    originalErrorMessage = (error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || 'Unknown error after retries';
                    console.error("DigitalOcean API call failed definitively: ".concat(originalErrorMessage), { errorDetails: isAxiosErrorWithResponse(error_1) ? error_1.response.data : error_1 });
                    if (error_1 instanceof errors_1.DigitalOceanServiceError) {
                        throw error_1;
                    }
                    if (isAxiosErrorWithResponse(error_1)) {
                        status_1 = error_1.response.status;
                        responseData = error_1.response.data;
                        message = (responseData === null || responseData === void 0 ? void 0 : responseData.message) || originalErrorMessage;
                        apiErrorCode = (responseData === null || responseData === void 0 ? void 0 : responseData.id) || (responseData === null || responseData === void 0 ? void 0 : responseData.code);
                        if (status_1 === 401 || status_1 === 403) {
                            throw new errors_1.DigitalOceanAuthenticationError(message, error_1);
                        }
                        if (status_1 === 404) {
                            throw new errors_1.DigitalOceanResourceNotFoundError(message, error_1);
                        }
                        if (status_1 === 429) {
                            retryAfterHeader = (_a = error_1.response.headers) === null || _a === void 0 ? void 0 : _a['retry-after'];
                            retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
                            throw new errors_1.DigitalOceanRateLimitError(message, retryAfterSeconds, error_1);
                        }
                        if (status_1 >= 400 && status_1 < 500) {
                            throw new errors_1.DigitalOceanApiError(message, status_1, apiErrorCode, error_1);
                        }
                        if (status_1 >= 500) {
                            throw new errors_1.DigitalOceanApiError("Server error: ".concat(message), status_1, apiErrorCode, error_1);
                        }
                    }
                    else if (isAxiosNetworkError(error_1)) {
                        // Handle specific Axios network error codes if needed, or a general service error
                        throw new errors_1.DigitalOceanServiceError("Network error during DigitalOcean API call: ".concat(originalErrorMessage), error_1);
                    }
                    throw new errors_1.DigitalOceanServiceError("Failed DigitalOcean API operation: ".concat(originalErrorMessage), error_1);
                case 4: return [2 /*return*/];
            }
        });
    });
}
