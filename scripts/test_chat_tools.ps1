# Test script to check MCP tools discovery via Supabase CLI
Write-Host "Testing MCP Tools Discovery via Chat Function..." -ForegroundColor Cyan
Write-Host ""

# Test the tools diagnostics endpoint
Write-Host "1. Testing tools diagnostics endpoint..." -ForegroundColor Yellow
$diagnosticsPayload = @{
    path = "/tools/diagnostics"
    agent_id = "87e6e948-694d-4f8c-8e94-2b4f6281ffc3"
    user_id = "3f966af2-72a1-41bc-8fac-400b8002664b"
} | ConvertTo-Json

Write-Host "Payload: $diagnosticsPayload" -ForegroundColor Gray

try {
    $result = supabase functions invoke chat --data $diagnosticsPayload 2>&1
    Write-Host "Diagnostics result:" -ForegroundColor Green
    Write-Host $result -ForegroundColor White
} catch {
    Write-Host "Error in diagnostics:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "2. Testing chat with tool awareness question..." -ForegroundColor Yellow

# Test actual chat message asking about tools
$chatPayload = @{
    message = @{
        content = "What tools do you have access to? List all available tools and their capabilities."
        role = "user"
    }
    agent_id = "87e6e948-694d-4f8c-8e94-2b4f6281ffc3"
    user_id = "3f966af2-72a1-41bc-8fac-400b8002664b"
    conversation_id = "test-mcp-discovery-$(Get-Date -Format 'yyyyMMddHHmmss')"
} | ConvertTo-Json -Depth 10

Write-Host "Payload: $chatPayload" -ForegroundColor Gray

try {
    $chatResult = supabase functions invoke chat --data $chatPayload 2>&1
    Write-Host "Chat result:" -ForegroundColor Green
    Write-Host $chatResult -ForegroundColor White
} catch {
    Write-Host "Error in chat:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "3. Testing specific Google Docs question..." -ForegroundColor Yellow

# Test specific Google Docs question
$docsPayload = @{
    message = @{
        content = "Can you create a Google Document for me? I want to create a document titled 'Test Document' with some sample content."
        role = "user"
    }
    agent_id = "87e6e948-694d-4f8c-8e94-2b4f6281ffc3"
    user_id = "3f966af2-72a1-41bc-8fac-400b8002664b"
    conversation_id = "test-google-docs-$(Get-Date -Format 'yyyyMMddHHmmss')"
} | ConvertTo-Json -Depth 10

Write-Host "Payload: $docsPayload" -ForegroundColor Gray

try {
    $docsResult = supabase functions invoke chat --data $docsPayload 2>&1
    Write-Host "Google Docs test result:" -ForegroundColor Green
    Write-Host $docsResult -ForegroundColor White
} catch {
    Write-Host "Error in Google Docs test:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "Test completed!" -ForegroundColor Cyan
