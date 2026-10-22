"use strict";
// Re-exporting core types from dots-wrapper for convenience if needed elsewhere,
// or define specific request/response types for our service methods.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Droplet = void 0;
// Example: Re-exporting the Droplet type from dots-wrapper
// The actual path might vary based on dots-wrapper structure, e.g., dots-wrapper/dist/modules/droplet
// For now, let's assume it's directly accessible or we define our own simplified versions.
var dots_wrapper_1 = require("dots-wrapper"); // Re-exporting for use by other services
Object.defineProperty(exports, "Droplet", { enumerable: true, get: function () { return dots_wrapper_1.Droplet; } });
// Add other service-specific types as the module grows (e.g., for firewalls, volumes) 
