# API Design Implementation - Advanced JSON Chat System

## Overview

This document details the implementation of the API design for the advanced JSON-based chat system. The implementation provides a comprehensive RESTful API with streaming support, detailed error handling, and extensive validation.

## Implementation Components

### 1. Route Definitions
**File**: `supabase/functions/chat/api/v2/routes.ts`

#### Features:
- **Comprehensive Endpoint Mapping**: All routes for chat, conversations, memories, state, and context
- **Method & Path Definition**: RESTful conventions with clear resource hierarchy
- **Authentication & Scopes**: Permission-based access control per endpoint
- **Query Parameter Support**: Documented query params for list endpoints
- **Rate Limit Configuration**: Different limits for different operation types

#### Route Categories:
1. **Chat Routes**: Message creation, streaming, retrieval, and batch operations
2. **Conversation Routes**: Session management and message history
3. **Memory Routes**: CRUD operations for agent memories with search
4. **State Routes**: Agent state management with checkpoints
5. **Context Routes**: Context optimization and templating
6. **System Routes**: Health checks, migration, and status

### 2. Request Schemas
**File**: `supabase/functions/chat/api/v2/schemas/requests.ts`

#### Key Request Types:
- **CreateMessageRequest**: Comprehensive message creation with options
- **BatchMessageRequest**: Multiple message processing
- **CreateConversationRequest**: Conversation initialization
- **SearchMemoriesRequest**: Vector-based memory search
- **UpdateStateRequest**: State modifications with merge options
- **CreateCheckpointRequest**: State preservation
- **OptimizeContextRequest**: Context compression

#### Request Features:
- **Version Control**: All requests include API version
- **Request IDs**: Optional client-provided correlation IDs
- **Flexible Options**: Extensive configuration per request
- **Type Safety**: Full TypeScript typing

### 3. Response Schemas
**File**: `supabase/functions/chat/api/v2/schemas/responses.ts`

#### Response Structure:
- **Base Response**: Consistent structure across all endpoints
- **Success Response**: Generic typed wrapper with metadata
- **Error Response**: RFC 7807 compliant error details
- **Streaming Events**: Server-sent events for real-time updates

#### Key Response Types:
- **MessageResponse**: Complete message with metrics
- **BatchMessageResponse**: Aggregated batch results
- **ConversationResponse**: Full conversation details
- **MemorySearchResponse**: Search results with relevance
- **StateResponse**: Current state with metadata
- **HealthResponse**: System health indicators

#### Streaming Event Types:
```typescript
- MessageStartEvent: Indicates message processing began
- ContentDeltaEvent: Incremental content chunks
- ToolCallEvent: Tool execution notifications
- ToolResultEvent: Tool execution results
- MessageCompleteEvent: Final message with metrics
- ErrorEvent: Recoverable error during streaming
```

### 4. Error Handling
**File**: `supabase/functions/chat/api/v2/errors.ts`

#### Error Classes:
- **APIError**: Base class for all API errors
- **ValidationError**: Field-specific validation failures
- **RateLimitError**: Rate limit exceeded with retry info
- **AuthenticationError**: Auth failures with suggestions
- **PermissionError**: Insufficient permissions
- **NotFoundError**: Resource not found
- **ConflictError**: Resource conflicts
- **TimeoutError**: Operation timeouts
- **ServiceUnavailableError**: Service degradation
- **BusinessError**: Business logic violations

#### Error Features:
- **Consistent Structure**: RFC 7807 compliance
- **Helpful Extensions**: Suggestions, documentation links
- **Retry Information**: When and how to retry
- **Field-Level Details**: For validation errors
- **Request Correlation**: Request ID tracking

### 5. Validation System
**File**: `supabase/functions/chat/api/v2/validation.ts`

#### Validation Components:
- **ValidationContext**: Tracks nested validation paths
- **Base Validators**: Reusable validation functions
- **Request Validators**: Specific validators per request type
- **Type Guards**: Runtime type checking

#### Validation Features:
- **Comprehensive Checks**: Type, format, range, pattern
- **Nested Validation**: Deep object and array validation
- **Custom Rules**: Business logic validation
- **Clear Error Messages**: User-friendly descriptions
- **Performance**: Efficient validation execution

### 6. API Configuration
**File**: `supabase/functions/chat/api/v2/index.ts`

#### Configuration Areas:
- **Version Management**: API version detection and routing
- **Rate Limits**: Configurable limits per operation type
- **Default Values**: System-wide defaults
- **Timeouts**: Operation-specific timeouts
- **Content Types**: Standard and custom media types

#### Utility Functions:
- **Response Headers**: Standard header creation
- **Content Negotiation**: Accept header parsing
- **Pagination Links**: HATEOAS link generation
- **Stream Response**: SSE helper class
- **CORS Handling**: Cross-origin support

## API Design Patterns

### RESTful Conventions
```
GET    /v2/resource          - List resources
POST   /v2/resource          - Create resource
GET    /v2/resource/{id}     - Get specific resource
PATCH  /v2/resource/{id}     - Update resource
DELETE /v2/resource/{id}     - Delete resource
POST   /v2/resource/{id}/action - Resource actions
```

### Versioning Strategy
1. **URL Path**: `/v2/` prefix for all v2 endpoints
2. **Header**: `X-API-Version: 2.0` support
3. **Content Type**: `application/vnd.agentopia.v2+json`
4. **Backward Compatibility**: v1 endpoints remain available

### Authentication & Authorization
```typescript
// Bearer token
Authorization: Bearer eyJhbGciOiJ...

// API key
X-API-Key: sk_live_abc123...

// Required scopes per endpoint
scopes: ['messages:write', 'memories:read']
```

### Rate Limiting
```typescript
// Response headers
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200

// Different limits
default: 100/min
streaming: 30/min
batch: 10/min
migration: 5/hour
```

### Error Response Format
```json
{
  "version": "2.0.0",
  "status": "error",
  "error": {
    "type": "https://api.agentopia.com/errors/validation_error",
    "title": "Validation Error",
    "status": 400,
    "detail": "Validation failed for one or more fields",
    "instance": "/v2/chat/messages",
    "error_code": "invalid_request",
    "extensions": {
      "validation_errors": [
        {
          "field": "message.content.text",
          "message": "text is required",
          "code": "required_field"
        }
      ]
    }
  }
}
```

## Streaming Implementation

### Server-Sent Events Format
```
event: message_start
data: {"event":"message_start","message_id":"msg_123","timestamp":"2024-01-20T10:00:00Z"}

event: content_delta
data: {"event":"content_delta","delta":"Hello ","index":0}

event: content_delta
data: {"event":"content_delta","delta":"world!","index":1}

event: message_complete
data: {"event":"message_complete","message":{...},"metrics":{...}}
```

### Stream Response Helper
```typescript
const stream = new StreamResponse();

// Send events
stream.send({ event: 'message_start', message_id });
stream.send({ event: 'content_delta', delta: chunk });

// Complete stream
stream.send({ event: 'message_complete', message, metrics });
stream.close();

// Return response
return stream.getResponse();
```

## Usage Examples

### Creating a Message
```typescript
// Request
POST /v2/chat/messages
{
  "version": "2.0.0",
  "message": {
    "role": "user",
    "content": {
      "type": "text",
      "text": "Hello, how can you help me?"
    }
  },
  "context": {
    "agent_id": "agent_123",
    "conversation_id": "conv_456"
  },
  "options": {
    "memory": {
      "enabled": true,
      "types": ["semantic", "episodic"],
      "max_results": 10
    },
    "response": {
      "stream": false,
      "include_metrics": true
    }
  }
}

// Response
{
  "version": "2.0.0",
  "status": "success",
  "data": {
    "message": {
      "id": "msg_789",
      "role": "assistant",
      "content": {
        "type": "text",
        "text": "I'm here to help! I can assist with..."
      },
      "metadata": {
        "tokens": 50,
        "confidence_score": 0.95
      }
    },
    "conversation": {
      "id": "conv_456",
      "message_count": 5
    },
    "session": {
      "id": "sess_101",
      "active": true
    }
  },
  "metrics": {
    "processing_time_ms": 250,
    "tokens": {
      "prompt": 100,
      "completion": 50,
      "total": 150
    }
  }
}
```

### Searching Memories
```typescript
// Request
POST /v2/agents/agent_123/memories/search
{
  "version": "2.0.0",
  "query": "user preferences for email notifications",
  "filters": {
    "memory_types": ["semantic", "procedural"],
    "importance_min": 0.7
  },
  "options": {
    "max_results": 5,
    "min_relevance": 0.8
  }
}

// Response
{
  "version": "2.0.0",
  "status": "success",
  "data": {
    "results": [
      {
        "memory": {
          "id": "mem_001",
          "memory_type": "semantic",
          "content": {
            "concept": "email_preferences",
            "definition": "User prefers daily digest at 9 AM"
          },
          "importance": 0.9
        },
        "relevance_score": 0.95
      }
    ],
    "search_metrics": {
      "total_searched": 150,
      "processing_time_ms": 45
    }
  }
}
```

## Testing Strategy

### Unit Tests
```typescript
describe('API v2', () => {
  describe('Request Validation', () => {
    test('validates message creation request', () => {
      const result = RequestValidators.validateCreateMessage({
        version: '2.0.0',
        message: { role: 'user', content: { type: 'text', text: 'Hello' } }
      });
      expect(result.valid).toBe(true);
    });
    
    test('rejects invalid content type', () => {
      const result = RequestValidators.validateCreateMessage({
        version: '2.0.0',
        message: { role: 'user', content: { type: 'invalid' } }
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('invalid_content_type');
    });
  });
  
  describe('Error Handling', () => {
    test('creates proper error response', () => {
      const error = new ValidationError([
        { field: 'message.content', message: 'Required', code: 'required' }
      ]);
      const response = error.toResponse();
      expect(response.error.status).toBe(400);
      expect(response.error.extensions?.validation_errors).toHaveLength(1);
    });
  });
});
```

### Integration Tests
```typescript
describe('Chat Endpoints', () => {
  test('creates message successfully', async () => {
    const response = await fetch('/v2/chat/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token'
      },
      body: JSON.stringify({
        version: '2.0.0',
        message: { role: 'user', content: { type: 'text', text: 'Test' } }
      })
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('success');
  });
  
  test('handles streaming response', async () => {
    const response = await fetch('/v2/chat/messages/stream', {
      method: 'POST',
      headers: { 'Accept': 'text/event-stream' },
      body: JSON.stringify({...})
    });
    
    const reader = response.body?.getReader();
    // Process stream...
  });
});
```

## Monitoring & Analytics

### Key Metrics
- Request volume by endpoint
- Response time percentiles (p50, p95, p99)
- Error rates by error code
- Token usage by endpoint
- Streaming connection duration

### Logging
```typescript
// Structured logging for each request
{
  timestamp: '2024-01-20T10:00:00Z',
  request_id: 'req_123',
  method: 'POST',
  path: '/v2/chat/messages',
  status: 200,
  duration_ms: 250,
  tokens_used: 150,
  error_code: null,
  user_id: 'user_456',
  agent_id: 'agent_789'
}
```

## Security Considerations

### Input Validation
- All inputs validated before processing
- SQL injection prevention
- XSS protection for stored content
- File upload restrictions

### Authentication
- JWT token validation
- API key rate limiting
- OAuth 2.0 support
- Scope-based permissions

### Data Protection
- PII handling in compliance with GDPR
- Encrypted storage for sensitive data
- Audit trails for all operations
- Data retention policies

## Performance Optimization

### Caching Strategy
- Response caching for read endpoints
- ETag support for conditional requests
- Memory caching for frequently accessed data
- Redis for distributed caching

### Database Optimization
- Indexed queries for fast retrieval
- Connection pooling
- Read replicas for scaling
- Query optimization

### API Gateway
- Load balancing across instances
- Request routing based on version
- Circuit breakers for resilience
- Response compression

## Conclusion

The API v2 implementation provides a robust, scalable, and developer-friendly interface for the advanced JSON chat system. With comprehensive validation, detailed error handling, streaming support, and extensive documentation, the API is ready for production use while maintaining backward compatibility and enabling future enhancements.