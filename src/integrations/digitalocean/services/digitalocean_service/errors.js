"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DigitalOceanUnexpectedResponseError = exports.DigitalOceanRateLimitError = exports.DigitalOceanResourceNotFoundError = exports.DigitalOceanAuthenticationError = exports.DigitalOceanApiError = exports.DigitalOceanServiceError = void 0;
/**
 * Base error class for errors originating from the DigitalOceanService.
 */
var DigitalOceanServiceError = /** @class */ (function (_super) {
    __extends(DigitalOceanServiceError, _super);
    function DigitalOceanServiceError(message, originalError) {
        var _newTarget = this.constructor;
        var _this = _super.call(this, message) || this;
        _this.name = _this.constructor.name;
        _this.originalError = originalError;
        // Ensuring the prototype chain is correct for custom errors
        Object.setPrototypeOf(_this, _newTarget.prototype);
        return _this;
    }
    return DigitalOceanServiceError;
}(Error));
exports.DigitalOceanServiceError = DigitalOceanServiceError;
/**
 * Represents an error reported by the DigitalOcean API.
 */
var DigitalOceanApiError = /** @class */ (function (_super) {
    __extends(DigitalOceanApiError, _super);
    function DigitalOceanApiError(message, statusCode, apiErrorCode, originalError) {
        var _this = _super.call(this, message, originalError) || this;
        _this.statusCode = statusCode;
        _this.apiErrorCode = apiErrorCode;
        return _this;
    }
    return DigitalOceanApiError;
}(DigitalOceanServiceError));
exports.DigitalOceanApiError = DigitalOceanApiError;
/**
 * Error for authentication failures with the DigitalOcean API (e.g., invalid token).
 */
var DigitalOceanAuthenticationError = /** @class */ (function (_super) {
    __extends(DigitalOceanAuthenticationError, _super);
    function DigitalOceanAuthenticationError(message, originalError) {
        if (message === void 0) { message = "DigitalOcean API authentication failed."; }
        // Typically a 401 status code
        return _super.call(this, message, 401, undefined, originalError) || this;
    }
    return DigitalOceanAuthenticationError;
}(DigitalOceanApiError));
exports.DigitalOceanAuthenticationError = DigitalOceanAuthenticationError;
/**
 * Error when a requested DigitalOcean resource is not found.
 */
var DigitalOceanResourceNotFoundError = /** @class */ (function (_super) {
    __extends(DigitalOceanResourceNotFoundError, _super);
    function DigitalOceanResourceNotFoundError(message, originalError) {
        if (message === void 0) { message = "DigitalOcean resource not found."; }
        // Typically a 404 status code
        return _super.call(this, message, 404, undefined, originalError) || this;
    }
    return DigitalOceanResourceNotFoundError;
}(DigitalOceanApiError));
exports.DigitalOceanResourceNotFoundError = DigitalOceanResourceNotFoundError;
/**
 * Error for API rate limiting by DigitalOcean.
 */
var DigitalOceanRateLimitError = /** @class */ (function (_super) {
    __extends(DigitalOceanRateLimitError, _super);
    function DigitalOceanRateLimitError(message, retryAfter, originalError) {
        if (message === void 0) { message = "DigitalOcean API rate limit exceeded."; }
        // Typically a 429 status code
        var _this = _super.call(this, message, 429, undefined, originalError) || this;
        _this.retryAfter = retryAfter;
        return _this;
    }
    return DigitalOceanRateLimitError;
}(DigitalOceanApiError));
exports.DigitalOceanRateLimitError = DigitalOceanRateLimitError;
/**
 * Error for unexpected issues or invalid responses from the DigitalOcean API.
 */
var DigitalOceanUnexpectedResponseError = /** @class */ (function (_super) {
    __extends(DigitalOceanUnexpectedResponseError, _super);
    function DigitalOceanUnexpectedResponseError(message, originalError) {
        if (message === void 0) { message = "Unexpected response from DigitalOcean API."; }
        return _super.call(this, message, originalError) || this;
    }
    return DigitalOceanUnexpectedResponseError;
}(DigitalOceanServiceError));
exports.DigitalOceanUnexpectedResponseError = DigitalOceanUnexpectedResponseError;
