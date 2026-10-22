/**
 * Base class for all MCP Client related errors.
 */
export class MCPError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

/**
 * Error during connection establishment (WebSocket level).
 */
export class MCPConnectionError extends MCPError {
    constructor(message: string, public originalError?: any) {
        super(message);
    }
}

/**
 * Error during MCP handshake (e.g., 'initialize' method failure).
 */
export class MCPHandshakeError extends MCPError {
    constructor(message: string, public details?: any) {
        super(message);
    }
}

/**
 * Error related to server capabilities (e.g., missing required capability).
 */
export class MCPCapabilityError extends MCPError {
    constructor(message: string) {
        super(message);
    }
}

/**
 * Error during sending a request or receiving a response (after connection).
 */
export class MCPRequestError extends MCPError {
    constructor(message: string, public rpcErrorCode?: number, public rpcErrorData?: any) {
        super(message);
    }
}

/**
 * Error indicating a timeout occurred.
 */
export class MCPTimeoutError extends MCPError {
    constructor(message: string = 'MCP operation timed out') {
        super(message);
    }
} 