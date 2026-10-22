export const CHAT_CONSTANTS = {
  MAX_FETCH_ATTEMPTS: 5,
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_TEXTAREA_HEIGHT: 200, // pixels
  MIN_TEXTAREA_HEIGHT: 22, // pixels
  SCROLL_THRESHOLD: 100, // pixels from bottom to trigger auto-scroll
  DEFAULT_CONTEXT_SIZE: 25,
  AI_PROCESSING_DELAYS: {
    THINKING: 800,
    ANALYZING_TOOLS: 600,
    TOOL_EXECUTION: 1500,
    PROCESSING_RESULTS: 800,
    GENERATING_RESPONSE: 1000,
  },
  CLEANUP_TIMEOUT: 500,
  SCROLL_DELAY: 100,
  UPLOAD_PROGRESS_CLEANUP_DELAY: 2000,
} as const;

export const ALLOWED_FILE_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  DOCUMENT: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ],
} as const;

export const AI_STATE_LABELS = {
  'thinking': 'Analyzing your message',
  'analyzing_tools': 'Checking available tools',
  'executing_tool': 'Executing tool',
  'processing_results': 'Processing tool results',
  'generating_response': 'Generating response',
  'completed': 'Response ready',
  'failed': 'Processing failed'
} as const;

export const WEB_SEARCH_PROVIDERS = ['serper_api', 'serpapi', 'brave_search'] as const;
