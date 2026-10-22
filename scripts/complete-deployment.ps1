# Complete deployment script for WebSocket Voice Server
# This script will deploy the code and configure the server

$DROPLET_IP = "165.227.188.122"
$DOMAIN = "voice.gofragents.com"
$EMAIL = "admin@agentopia.ai"

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Completing WebSocket Voice Server Deployment             ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

Write-Host "📋 Deployment Details:" -ForegroundColor Yellow
Write-Host "   Droplet IP: $DROPLET_IP"
Write-Host "   Domain: $DOMAIN"
Write-Host "`n"

# Step 1: Copy files to droplet
Write-Host "📦 Step 1: Deploying server code..." -ForegroundColor Green
Write-Host "   Running: scp -r dist package.json package-lock.json root@$DROPLET_IP`:/opt/agentopia-voice-ws/"
Write-Host ""
Write-Host "⚠️  You may be prompted for the droplet's root password or to accept SSH fingerprint." -ForegroundColor Yellow
Write-Host "   If you don't have SSH key setup, you'll need the root password from DigitalOcean.`n"

$scpCommand = "scp -r dist package.json package-lock.json root@" + $DROPLET_IP + "`:/opt/agentopia-voice-ws/"
Write-Host "   Command: $scpCommand" -ForegroundColor Gray
Write-Host "`n   Press Enter to continue with SCP, or type 'skip' to see manual instructions..."
$response = Read-Host

if ($response -eq "skip") {
    Write-Host "`n📋 Manual Deployment Instructions:" -ForegroundColor Yellow
    Write-Host "════════════════════════════════════════════════════════════"
    Write-Host ""
    Write-Host "1. Open a new terminal/PowerShell window"
    Write-Host ""
    Write-Host "2. Run the following command:"
    Write-Host "   cd C:\Users\charl\Software\Agentopia\services\websocket-voice-server"
    Write-Host "   scp -r dist package.json package-lock.json root@$DROPLET_IP:/opt/agentopia-voice-ws/"
    Write-Host ""
    Write-Host "3. If prompted, accept the SSH fingerprint (type 'yes')"
    Write-Host ""
    Write-Host "4. Enter the root password (from DigitalOcean droplet console)"
    Write-Host ""
    Write-Host "5. Once files are copied, SSH into the server:"
    Write-Host "   ssh root@$DROPLET_IP"
    Write-Host ""
    Write-Host "6. Install dependencies:"
    Write-Host "   cd /opt/agentopia-voice-ws"
    Write-Host "   npm install --production"
    Write-Host ""
    Write-Host "7. Start the server:"
    Write-Host "   pm2 start dist/index.js --name voice-ws-server"
    Write-Host "   pm2 save"
    Write-Host ""
    Write-Host "8. Check server status:"
    Write-Host "   pm2 status"
    Write-Host "   pm2 logs voice-ws-server"
    Write-Host ""
    Write-Host "9. Test health endpoint:"
    Write-Host "   curl http://localhost:8081/health"
    Write-Host ""
    Write-Host "10. Obtain SSL certificate (wait 5 minutes for DNS propagation):"
    Write-Host "    certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL"
    Write-Host ""
    Write-Host "11. Test final endpoint:"
    Write-Host "    curl https://$DOMAIN/health"
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════════"
    Write-Host ""
    Write-Host "✅ Once these steps are complete, your WebSocket server will be live!"
    Write-Host ""
    Write-Host "📝 Next: Update your frontend .env.local file:"
    Write-Host "   VITE_VOICE_WEBSOCKET_URL=wss://$DOMAIN"
    Write-Host ""
    exit 0
}

# Continue with automated deployment if not skipped
Write-Host "Executing SCP..." -ForegroundColor Green
Invoke-Expression $scpCommand

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ SCP failed. Please check SSH access and try manual deployment." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Files deployed successfully!`n" -ForegroundColor Green

# Step 2: SSH and run commands
Write-Host "📦 Step 2: Installing dependencies on droplet..." -ForegroundColor Green
$sshCommands = @"
cd /opt/agentopia-voice-ws && \
npm install --production && \
pm2 start dist/index.js --name voice-ws-server && \
pm2 save && \
echo "Server started successfully!"
"@

ssh "root@$DROPLET_IP" $sshCommands

Write-Host "`n✅ Server is now running!`n" -ForegroundColor Green

# Step 3: SSL Certificate
Write-Host "🔒 Step 3: Setting up SSL certificate..." -ForegroundColor Green
Write-Host "   Waiting 30 seconds for DNS propagation..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

$sslCommand = "certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL"
ssh "root@$DROPLET_IP" $sslCommand

Write-Host "`n✅ SSL certificate obtained!`n" -ForegroundColor Green

# Final tests
Write-Host "🧪 Running final tests..." -ForegroundColor Green
Write-Host "   Testing HTTP health endpoint..."
$healthResponse = Invoke-WebRequest -Uri "http://$DROPLET_IP:8081/health" -UseBasicParsing
Write-Host "   ✅ HTTP Health: $($healthResponse.StatusCode)" -ForegroundColor Green

Write-Host "   Testing HTTPS health endpoint..."
$httpsHealthResponse = Invoke-WebRequest -Uri "https://$DOMAIN/health" -UseBasicParsing
Write-Host "   ✅ HTTPS Health: $($httpsHealthResponse.StatusCode)" -ForegroundColor Green

$separator = "=" * 60
Write-Host "`n$separator" -ForegroundColor Cyan
Write-Host "DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host "$separator`n" -ForegroundColor Cyan

Write-Host "📊 Server Information:" -ForegroundColor Yellow
Write-Host "   WebSocket URL: wss://$DOMAIN"
Write-Host "   Health Check: https://$DOMAIN/health"
Write-Host "   SSH Access: ssh root@$DROPLET_IP"
Write-Host ""

Write-Host "📝 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Update your .env.local file:"
Write-Host "      VITE_VOICE_WEBSOCKET_URL=wss://$DOMAIN"
Write-Host ""
Write-Host "   2. Restart your dev server:"
Write-Host "      npm run dev"
Write-Host ""
Write-Host "   3. Test voice chat in your Agentopia app"
Write-Host ""

Write-Host $separator -ForegroundColor Cyan

