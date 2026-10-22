"use strict";
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
exports.getDOClient = getDOClient;
exports.getDOClientSync = getDOClientSync;
// Forcing linter re-evaluation after tsconfig.node.json change.
var dots_wrapper_1 = require("dots-wrapper");
// Removed: import { IAPIClient } from 'dots-wrapper/dist/client';
var supabase_js_1 = require("@supabase/supabase-js");
// Initialize Supabase Admin Client
// Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in the environment for this service
var supabaseUrl = process.env.SUPABASE_URL;
var supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
var supabaseAdmin = null;
if (supabaseUrl && supabaseServiceRoleKey) {
    supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }, // Backend service, no session needed
    });
    console.info('Supabase admin client initialized for DigitalOcean service.');
}
else {
    console.error('Supabase URL or Service Role Key not found in environment. Vault operations will fail for DigitalOcean service.');
}
function getSecretFromVault(secretId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, data, error, vaultResponse, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!supabaseAdmin) {
                        console.error('Supabase admin client not initialized. Cannot fetch secret from vault.');
                        return [2 /*return*/, null];
                    }
                    if (!secretId) {
                        console.warn('getSecretFromVault: No secret ID provided.');
                        return [2 /*return*/, null];
                    }
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    console.log("getSecretFromVault: Attempting to retrieve secret for vault ID: ".concat(secretId));
                    return [4 /*yield*/, supabaseAdmin
                            .rpc('get_secret', { secret_id: secretId })
                            .single()];
                case 2:
                    _a = _b.sent(), data = _a.data, error = _a.error;
                    if (error) {
                        console.error("getSecretFromVault: Error retrieving secret from vault (ID: ".concat(secretId, "):"), error);
                        return [2 /*return*/, null];
                    }
                    vaultResponse = data;
                    if (vaultResponse === null || vaultResponse === void 0 ? void 0 : vaultResponse.key) {
                        console.log("getSecretFromVault: Successfully retrieved secret for vault ID: ".concat(secretId));
                        return [2 /*return*/, vaultResponse.key];
                    }
                    else {
                        console.warn("getSecretFromVault: Secret retrieved but key was null or empty for vault ID: ".concat(secretId));
                        return [2 /*return*/, null];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _b.sent();
                    console.error("getSecretFromVault: Exception during secret retrieval for vault ID: ".concat(secretId, ":"), error_1);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
var apiClientInstance = null;
/**
 * Initializes and returns the DigitalOcean API client.
 * Fetches the API token from a secure vault.
 * @returns {Promise<DotsApiClient>} The initialized API client.
 * @throws {Error} If the API token cannot be retrieved or client initialization fails.
 */
function getDOClient() {
    return __awaiter(this, void 0, void 0, function () {
        var apiTokenSecretId, apiToken, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (apiClientInstance) {
                        return [2 /*return*/, apiClientInstance];
                    }
                    apiTokenSecretId = process.env.DO_API_TOKEN_VAULT_ID;
                    if (!apiTokenSecretId) {
                        console.error('DigitalOcean API token Vault ID (DO_API_TOKEN_VAULT_ID) is not configured in environment.');
                        throw new Error('DigitalOcean API token Vault ID is not configured.');
                    }
                    return [4 /*yield*/, getSecretFromVault(apiTokenSecretId)];
                case 1:
                    apiToken = _a.sent();
                    if (!apiToken) {
                        console.error('Failed to retrieve DigitalOcean API token from Vault.');
                        throw new Error('Failed to retrieve DigitalOcean API token from Vault.');
                    }
                    try {
                        apiClientInstance = (0, dots_wrapper_1.createApiClient)({ token: apiToken });
                        console.info('DigitalOcean API client initialized successfully.');
                        return [2 /*return*/, apiClientInstance];
                    }
                    catch (error) {
                        console.error('Failed to initialize DigitalOcean API client:', error);
                        errorMessage = error instanceof Error ? error.message : String(error);
                        throw new Error("Failed to initialize DigitalOcean API client: ".concat(errorMessage));
                    }
                    return [2 /*return*/];
            }
        });
    });
}
// Optional: A way to get the client synchronously if it's guaranteed to be initialized
// Use with caution, prefer getDOClient for async safety.
function getDOClientSync() {
    if (!apiClientInstance) {
        throw new Error('DigitalOcean API client has not been initialized. Call getDOClient() first.');
    }
    return apiClientInstance;
}
