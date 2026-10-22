# =====================================================
# SERVICE PROVIDERS MIGRATION HELPER SCRIPT
# =====================================================
# PowerShell script to help migrate files from oauth_providers to service_providers
# This script provides utilities for the migration process

param(
    [Parameter(Mandatory=$false)]
    [string]$Phase = "check",
    [Parameter(Mandatory=$false)]
    [string]$FilePath = "",
    [Parameter(Mandatory=$false)]
    [switch]$DryRun = $false
)

# Color output functions
function Write-Success { param($Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Info { param($Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }

# Check if we're in the correct directory
if (-not (Test-Path "supabase" -PathType Container)) {
    Write-Error "Please run this script from the agentopia project root directory"
    exit 1
}

function Get-FallbackStats {
    Write-Info "Checking fallback usage statistics..."
    
    try {
        $result = supabase db sql --query "SELECT * FROM get_migration_fallback_stats(24);" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Fallback statistics retrieved successfully"
            Write-Host $result
        } else {
            Write-Warning "Could not retrieve fallback stats. Migration may not be initialized yet."
        }
    } catch {
        Write-Warning "Error checking fallback stats: $_"
    }
}

function Test-DataConsistency {
    Write-Info "Checking data consistency between oauth_providers and service_providers..."
    
    try {
        $result = supabase db sql --query "SELECT * FROM check_service_providers_consistency();" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Data consistency check completed"
            Write-Host $result
        } else {
            Write-Warning "Could not check data consistency. Migration may not be initialized yet."
        }
    } catch {
        Write-Warning "Error checking data consistency: $_"
    }
}

function Find-FilesWithOAuthProviders {
    Write-Info "Scanning codebase for files containing 'oauth_providers'..."
    
    $files = Get-ChildItem -Recurse -Include "*.ts", "*.tsx", "*.js", "*.jsx", "*.sql" | 
             Where-Object { $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*\.git*" } |
             Select-String -Pattern "oauth_providers" -List |
             Select-Object -ExpandProperty Path
    
    if ($files.Count -gt 0) {
        Write-Warning "Found $($files.Count) files containing 'oauth_providers':"
        $files | ForEach-Object { 
            $relativePath = Resolve-Path $_ -Relative
            Write-Host "  - $relativePath" -ForegroundColor Yellow
        }
    } else {
        Write-Success "No files found containing 'oauth_providers' - migration may be complete!"
    }
    
    return $files
}

function Update-FileToServiceProviders {
    param(
        [string]$FilePath,
        [bool]$DryRun = $true
    )
    
    if (-not (Test-Path $FilePath)) {
        Write-Error "File not found: $FilePath"
        return $false
    }
    
    $content = Get-Content $FilePath -Raw
    $originalContent = $content
    
    # Replace oauth_providers with service_providers in various contexts
    $replacements = @{
        "from\('oauth_providers'\)" = "from('service_providers')"
        "\.oauth_providers" = ".service_providers"
        "oauth_providers\." = "service_providers."
        '"oauth_providers"' = '"service_providers"'
        "'oauth_providers'" = "'service_providers'"
        "oauth_providers_" = "service_providers_"
        "OAuthProviders" = "ServiceProviders"
        "oauthProviders" = "serviceProviders"
        "oauth-providers" = "service-providers"
    }
    
    $changesMade = $false
    foreach ($pattern in $replacements.Keys) {
        $replacement = $replacements[$pattern]
        if ($content -match $pattern) {
            $content = $content -replace $pattern, $replacement
            $changesMade = $true
            Write-Info "  Replaced: $pattern → $replacement"
        }
    }
    
    if ($changesMade) {
        if ($DryRun) {
            Write-Warning "DRY RUN: Would update $FilePath"
            # Show a diff-like output
            $lines = $content -split "`n"
            $originalLines = $originalContent -split "`n"
            for ($i = 0; $i -lt [Math]::Min($lines.Length, $originalLines.Length); $i++) {
                if ($lines[$i] -ne $originalLines[$i]) {
                    Write-Host "  Line $($i+1):" -ForegroundColor Cyan
                    Write-Host "    - $($originalLines[$i])" -ForegroundColor Red
                    Write-Host "    + $($lines[$i])" -ForegroundColor Green
                }
            }
        } else {
            # Create backup
            $backupPath = "$FilePath.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
            Copy-Item $FilePath $backupPath
            Write-Info "  Created backup: $backupPath"
            
            # Write updated content
            Set-Content $FilePath $content -NoNewline
            Write-Success "  Updated: $FilePath"
        }
        return $true
    } else {
        Write-Info "  No changes needed: $FilePath"
        return $false
    }
}

function Get-CriticalFiles {
    return @(
        "supabase/functions/get-agent-tools/index.ts",
        "supabase/functions/gmail-api/index.ts",
        "supabase/functions/gmail-oauth/index.ts",
        "supabase/functions/smtp-api/index.ts",
        "supabase/functions/web-search-api/index.ts",
        "supabase/functions/media-library-api/index.ts",
        "supabase/functions/get-agent-permissions/index.ts",
        "supabase/functions/oauth-refresh/index.ts",
        "supabase/functions/mailgun-service/index.ts",
        "supabase/functions/create-agent/index.ts"
    )
}

function Update-CriticalFiles {
    param([bool]$DryRun = $true)
    
    Write-Info "Updating critical edge functions..."
    $criticalFiles = Get-CriticalFiles
    $updatedCount = 0
    
    foreach ($file in $criticalFiles) {
        if (Test-Path $file) {
            Write-Info "Processing: $file"
            if (Update-FileToServiceProviders -FilePath $file -DryRun $DryRun) {
                $updatedCount++
            }
        } else {
            Write-Warning "File not found: $file"
        }
    }
    
    if ($DryRun) {
        Write-Warning "DRY RUN: Would update $updatedCount critical files"
    } else {
        Write-Success "Updated $updatedCount critical files"
    }
}

function Deploy-EdgeFunctions {
    Write-Info "Deploying updated edge functions..."
    $criticalFiles = Get-CriticalFiles
    
    foreach ($file in $criticalFiles) {
        if (Test-Path $file) {
            $functionName = Split-Path (Split-Path $file -Parent) -Leaf
            Write-Info "Deploying function: $functionName"
            
            try {
                supabase functions deploy $functionName
                if ($LASTEXITCODE -eq 0) {
                    Write-Success "  Deployed: $functionName"
                } else {
                    Write-Error "  Failed to deploy: $functionName"
                }
            } catch {
                Write-Error "  Error deploying $functionName: $_"
            }
        }
    }
}

# Main execution logic
switch ($Phase.ToLower()) {
    "check" {
        Write-Info "=== SERVICE PROVIDERS MIGRATION STATUS CHECK ==="
        Get-FallbackStats
        Test-DataConsistency
        Find-FilesWithOAuthProviders
    }
    
    "scan" {
        Write-Info "=== SCANNING FOR FILES TO MIGRATE ==="
        Find-FilesWithOAuthProviders
    }
    
    "critical" {
        Write-Info "=== UPDATING CRITICAL FILES ==="
        Update-CriticalFiles -DryRun $DryRun
    }
    
    "deploy" {
        Write-Info "=== DEPLOYING EDGE FUNCTIONS ==="
        Deploy-EdgeFunctions
    }
    
    "file" {
        if ($FilePath -eq "") {
            Write-Error "Please specify -FilePath when using -Phase file"
            exit 1
        }
        Write-Info "=== UPDATING SINGLE FILE ==="
        Update-FileToServiceProviders -FilePath $FilePath -DryRun $DryRun
    }
    
    "stats" {
        Write-Info "=== MIGRATION STATISTICS ==="
        Get-FallbackStats
    }
    
    "consistency" {
        Write-Info "=== DATA CONSISTENCY CHECK ==="
        Test-DataConsistency
    }
    
    default {
        Write-Info "=== SERVICE PROVIDERS MIGRATION HELPER ==="
        Write-Host ""
        Write-Host "Usage: .\migrate_to_service_providers.ps1 -Phase <phase> [options]"
        Write-Host ""
        Write-Host "Phases:"
        Write-Host "  check      - Full status check (fallback stats, consistency, file scan)"
        Write-Host "  scan       - Scan for files containing oauth_providers"
        Write-Host "  critical   - Update critical edge function files"
        Write-Host "  deploy     - Deploy updated edge functions"
        Write-Host "  file       - Update a specific file (requires -FilePath)"
        Write-Host "  stats      - Show fallback usage statistics"
        Write-Host "  consistency - Check data consistency"
        Write-Host ""
        Write-Host "Options:"
        Write-Host "  -DryRun    - Preview changes without making them"
        Write-Host "  -FilePath  - Specific file to update (for -Phase file)"
        Write-Host ""
        Write-Host "Examples:"
        Write-Host "  .\migrate_to_service_providers.ps1 -Phase check"
        Write-Host "  .\migrate_to_service_providers.ps1 -Phase critical -DryRun"
        Write-Host "  .\migrate_to_service_providers.ps1 -Phase file -FilePath 'src/components/modal.tsx'"
    }
}
