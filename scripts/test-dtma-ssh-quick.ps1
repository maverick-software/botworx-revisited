# DTMA SSH Integration Quick Test - PowerShell Version
# Tests the new SSH integration endpoints

param(
    [string]$DropletIP = "147.182.160.136",
    [string]$DtmaPort = "30000",
    [string]$BearerToken = $env:DTMA_BEARER_TOKEN
)

$BaseUrl = "http://${DropletIP}:${DtmaPort}"

Write-Host "🚀 DTMA SSH Integration Quick Test" -ForegroundColor Blue
Write-Host "Target: $BaseUrl"
Write-Host "Token: $(if($BearerToken) {'✓ Set'} else {'✗ Missing'})`n"

if (-not $BearerToken) {
    Write-Host "❌ DTMA_BEARER_TOKEN environment variable is required" -ForegroundColor Red
    Write-Host "   Set with: `$env:DTMA_BEARER_TOKEN='your-token'" -ForegroundColor Gray
    exit 1
}

$Headers = @{
    'Authorization' = "Bearer $BearerToken"
    'Content-Type' = 'application/json'
}

$PassedTests = 0
$TotalTests = 0

function Test-HealthEndpoint {
    Write-Host "🔍 Testing health endpoint..." -ForegroundColor Cyan
    $script:TotalTests++
    
    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/health" -Method GET -TimeoutSec 10
        Write-Host "  ✅ Health endpoint: OK" -ForegroundColor Green
        $script:PassedTests++
        return $true
    }
    catch {
        Write-Host "  ❌ Health endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Test-StatusEndpoint {
    Write-Host "🔍 Testing status endpoint..." -ForegroundColor Cyan
    $script:TotalTests++
    
    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/status" -Method GET -Headers $Headers -TimeoutSec 10
        Write-Host "  ✅ Status endpoint: OK" -ForegroundColor Green
        Write-Host "  📊 Service: $($response.service)" -ForegroundColor Gray
        Write-Host "  📊 Version: $($response.version)" -ForegroundColor Gray
        $script:PassedTests++
        return $true
    }
    catch {
        Write-Host "  ❌ Status endpoint failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-Host "     Check your DTMA_BEARER_TOKEN" -ForegroundColor Yellow
        }
        return $false
    }
}

function Test-SSHCommand {
    param(
        [string]$Command,
        [string]$Description
    )
    
    Write-Host "🖥️  Testing SSH: $Description..." -ForegroundColor Cyan
    $script:TotalTests++
    
    try {
        $body = @{ command = $Command } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$BaseUrl/ssh/execute" -Method POST -Headers $Headers -Body $body -TimeoutSec 30
        
        if ($response.success) {
            Write-Host "  ✅ ${Description}: OK" -ForegroundColor Green
            if ($response.stdout -and $response.stdout.Trim()) {
                $output = $response.stdout.Trim()
                if ($output.Length -gt 100) {
                    $output = $output.Substring(0, 100) + "..."
                }
                Write-Host "     Output: $output" -ForegroundColor Gray
            }
            $script:PassedTests++
            return $true
        }
        else {
            Write-Host "  ❌ ${Description}: Command failed" -ForegroundColor Red
            Write-Host "     Error: $($response.stderr)" -ForegroundColor Gray
            return $false
        }
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 403) {
            Write-Host "  ✅ ${Description}: Correctly blocked (403)" -ForegroundColor Green
            $script:PassedTests++
            return $true
        }
        Write-Host "  ❌ ${Description}: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Test-DiagnosticEndpoint {
    param(
        [string]$Path,
        [string]$Description
    )
    
    Write-Host "🩺 Testing $Description..." -ForegroundColor Cyan
    $script:TotalTests++
    
    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl$Path" -Method GET -Headers $Headers -TimeoutSec 15
        Write-Host "  ✅ ${Description}: OK" -ForegroundColor Green
        $script:PassedTests++
        return $true
    }
    catch {
        Write-Host "  ❌ ${Description}: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Run the test suite
Write-Host "Starting test suite...`n"

# Basic connectivity tests
Test-HealthEndpoint | Out-Null
Test-StatusEndpoint | Out-Null

# SSH command tests
Test-SSHCommand -Command "whoami" -Description "whoami command" | Out-Null
Test-SSHCommand -Command "docker --version" -Description "Docker version" | Out-Null
Test-SSHCommand -Command "docker ps" -Description "Docker containers" | Out-Null

# Security test (dangerous command should be blocked)
Test-SSHCommand -Command "rm -rf /" -Description "Dangerous command blocking" | Out-Null

# Diagnostic endpoints
Test-DiagnosticEndpoint -Path "/diagnostics/docker" -Description "Docker diagnostics" | Out-Null
Test-DiagnosticEndpoint -Path "/diagnostics/system" -Description "System diagnostics" | Out-Null
Test-DiagnosticEndpoint -Path "/diagnostics/logs?lines=5" -Description "Logs diagnostics" | Out-Null

# Results
Write-Host "`n$('=' * 50)"
Write-Host "🎯 Test Results: $PassedTests/$TotalTests passed" -ForegroundColor $(if($PassedTests -eq $TotalTests) {'Green'} else {'Yellow'})

if ($PassedTests -eq $TotalTests) {
    Write-Host "🎉 All tests passed! DTMA SSH integration is working correctly." -ForegroundColor Green
}
else {
    Write-Host "⚠️  Some tests failed. Check the output above for details." -ForegroundColor Yellow
    Write-Host "`nTroubleshooting tips:" -ForegroundColor Gray
    Write-Host "- Ensure DTMA service is running: systemctl status dtma" -ForegroundColor Gray
    Write-Host "- Check service logs: journalctl -u dtma -f" -ForegroundColor Gray
    Write-Host "- Verify port 30000 is accessible" -ForegroundColor Gray
    Write-Host "- Confirm DTMA_BEARER_TOKEN is correct" -ForegroundColor Gray
}

exit $(if($PassedTests -eq $TotalTests) {0} else {1}) 