# Comprehensive Investigation - LLM Integration & MCP Protocol

## Investigation Scope

Before implementing any fixes, we need to thoroughly investigate:
1. OpenAI API message format requirements (Chat Completions vs Responses API)
2. Model Context Protocol (MCP) specifications
3. Our current implementation vs best practices
4. Root causes of message sequencing errors
5. Proper message flow architecture

## Research Areas

### 1. OpenAI API Message Format Requirements
- [ ] Chat Completions API message sequence rules
- [ ] Responses API message sequence rules
- [ ] tool_calls and tool response pairing requirements
- [ ] Differences between APIs for tool handling

### 2. Model Context Protocol (MCP)
- [ ] Official MCP specification for message handling
- [ ] MCP client/server interaction patterns
- [ ] Error handling and retry patterns in MCP
- [ ] Best practices for tool execution in MCP context

### 3. Current Codebase Analysis
- [ ] Message flow from user request → LLM → tools → LLM → response
- [ ] Where messages are constructed, modified, filtered
- [ ] How tool_calls are added to messages
- [ ] How tool responses are added to messages
- [ ] Message cleaning logic in retry loop vs final synthesis

### 4. Error Pattern Analysis
- [ ] Exact error messages and when they occur
- [ ] Message state at each stage of processing
- [ ] Comparison of successful vs failing message sequences

## Investigation Process

Starting with file analysis, web research, and protocol documentation review...

