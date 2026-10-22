# Deployment Guide

This guide covers deploying Agentopia to production environments with proper security, scalability, and monitoring considerations.

## 🚀 Deployment Overview

### Deployment Architecture
- **Frontend**: Static site deployment (Netlify, Vercel, or similar)
- **Backend**: Supabase managed infrastructure with Edge Functions
- **Services**: DigitalOcean droplets for specialized backend services
- **Database**: Supabase managed PostgreSQL with RLS
- **Storage**: Supabase Storage for file uploads and media

### Production Requirements
- **Node.js**: v18 or higher
- **Supabase Project**: Production-grade project with appropriate tier
- **Domain**: Custom domain with SSL certificate
- **Monitoring**: Application performance monitoring setup
- **Backup Strategy**: Database and file backup procedures

## 🔧 Environment Configuration

### Production Environment Variables

#### Frontend (.env.production)
```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_production_anon_key

# Application Configuration
VITE_APP_ENV=production
VITE_APP_VERSION=2.0.0
VITE_APP_NAME=Agentopia

# Optional: Analytics and Monitoring
VITE_ANALYTICS_ID=your_analytics_id
```

#### Supabase Edge Functions
Configure in Supabase Dashboard (Settings → Edge Functions):

```bash
# Core Services
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
OPENAI_API_KEY=your_openai_api_key

# Email Integrations
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret

# Web Research APIs
SERPER_API_KEY=your_serper_api_key
SERPAPI_API_KEY=your_serpapi_api_key
BRAVE_SEARCH_API_KEY=your_brave_api_key

# Infrastructure Services
DO_API_TOKEN=your_digitalocean_api_token
AGENTOPIA_API_URL=https://your-project-ref.supabase.co/functions/v1

# Security
INTERNAL_API_SECRET=your_internal_api_secret
MANAGER_SECRET_KEY=your_manager_secret_key

# Optional: Discord Integration
DISCORD_PUBLIC_KEY=your_discord_public_key
DISCORD_APP_ID=your_discord_app_id

# Optional: Knowledge Systems
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=your_pinecone_index
PINECONE_ENVIRONMENT=your_pinecone_environment
GETZEP_API_KEY=your_getzep_api_key
```

## 🏗️ Infrastructure Setup

### 1. Supabase Project Configuration

#### Project Settings
1. **Create Production Project**: Use appropriate Supabase tier for expected load
2. **Configure Custom Domain**: Set up custom domain with SSL
3. **Enable Required Extensions**: Ensure pg_cron and other extensions are enabled
4. **Configure Auth Settings**: Set up proper auth redirects and security settings

#### Database Setup
```bash
# Deploy migrations
supabase db push --include-all --project-ref your-project-ref

# Verify schema
supabase db diff --schema public --project-ref your-project-ref

# Set up pg_cron for task execution
supabase sql --project-ref your-project-ref --file scripts/setup-pg-cron.sql
```

#### Edge Functions Deployment
```bash
# Deploy all functions
supabase functions deploy --project-ref your-project-ref

# Verify deployment
supabase functions list --project-ref your-project-ref
```

### 2. Frontend Deployment

#### Static Site Deployment (Netlify)
```bash
# Build for production
npm run build

# Deploy to Netlify
netlify deploy --prod --dir=dist

# Or configure automatic deployments from Git
```

#### Static Site Deployment (Vercel)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Or configure automatic deployments from Git
```

#### Custom Server Deployment
```bash
# Build static files
npm run build

# Serve with nginx, Apache, or CDN
# Configure proper caching headers and gzip compression
```

### 3. Backend Services Setup (Optional)

#### DigitalOcean Droplet Configuration
For specialized backend services (discord-worker, worker-manager):

```bash
# Create droplet
doctl compute droplet create agentopia-services \
  --region nyc3 \
  --size s-2vcpu-2gb \
  --image ubuntu-22-04-x64 \
  --ssh-keys your-ssh-key-id

# Configure droplet with PM2
ssh root@your-droplet-ip
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs
npm install pm2@latest -g

# Deploy services
git clone your-repo
cd agentopia/services
npm install

# Configure PM2 ecosystem
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🔒 Security Configuration

### 1. Supabase Security

#### Row Level Security (RLS)
Ensure all tables have proper RLS policies:
```sql
-- Verify RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = false;

-- Enable RLS if needed
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

#### API Keys and Secrets
- **Service Role Key**: Restrict to server-side functions only
- **Anon Key**: Configure appropriate JWT settings
- **Vault Secrets**: Ensure all sensitive data uses Supabase Vault
- **CORS Settings**: Configure proper CORS for production domains

### 2. Application Security

#### Content Security Policy (CSP)
Configure CSP headers for enhanced security:
```nginx
# Nginx configuration example
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://your-supabase-project.supabase.co; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://your-supabase-project.supabase.co wss://your-supabase-project.supabase.co;";
```

#### HTTPS Configuration
- **SSL Certificates**: Use Let's Encrypt or commercial certificates
- **HSTS Headers**: Enable HTTP Strict Transport Security
- **Secure Cookies**: Configure secure cookie settings in Supabase

### 3. Infrastructure Security

#### Firewall Configuration
```bash
# DigitalOcean Cloud Firewall rules
# Inbound: SSH (22), HTTP (80), HTTPS (443), Custom app ports
# Outbound: All traffic allowed for API calls

# UFW configuration on droplets
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80
ufw allow 443
ufw allow 3000  # Application port
ufw enable
```

#### SSH Security
```bash
# Disable root login and password authentication
vim /etc/ssh/sshd_config
# Set: PermitRootLogin no, PasswordAuthentication no
systemctl restart ssh
```

## 📊 Monitoring & Observability

### 1. Application Monitoring

#### Supabase Dashboard
- **Function Logs**: Monitor Edge Function execution and errors
- **Database Performance**: Track query performance and connection usage
- **Auth Analytics**: Monitor user authentication and session patterns
- **Storage Usage**: Track file uploads and storage consumption

#### Custom Monitoring
```typescript
// Application performance monitoring
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, key)

// Log application events
const logEvent = async (event: string, metadata: any) => {
  await supabase.from('application_logs').insert({
    event_type: event,
    metadata,
    timestamp: new Date().toISOString()
  })
}
```

### 2. Infrastructure Monitoring

#### DigitalOcean Monitoring
- **Droplet Metrics**: CPU, memory, disk, and network monitoring
- **Uptime Monitoring**: Set up alerts for service downtime
- **Load Balancing**: Configure load balancers for high availability

#### Custom Health Checks
```bash
# Health check endpoint
curl -f https://your-domain.com/api/health || exit 1

# Database connectivity check
curl -f https://your-project-ref.supabase.co/rest/v1/profiles?select=count || exit 1
```

### 3. Alerting Configuration

#### Critical Alerts
- **Service Downtime**: Application or database unavailability
- **High Error Rates**: Increased error rates in Edge Functions
- **Security Events**: Failed authentication attempts or suspicious activity
- **Resource Exhaustion**: High CPU, memory, or storage usage

#### Notification Channels
- **Email**: Critical alerts to operations team
- **Slack**: Real-time notifications for development team
- **PagerDuty**: Escalation for critical production issues

## 🔄 Backup & Recovery

### 1. Database Backup

#### Automated Supabase Backups
Supabase provides automated daily backups for paid plans:
- **Point-in-Time Recovery**: Available for Pro tier and above
- **Manual Backups**: Create manual backups before major deployments
- **Backup Verification**: Regularly test backup restoration procedures

#### Custom Backup Scripts
```bash
# Database backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump "postgresql://user:pass@host:port/db" > backup_$DATE.sql
aws s3 cp backup_$DATE.sql s3://your-backup-bucket/
```

### 2. File Storage Backup

#### Supabase Storage Backup
```typescript
// Backup storage bucket contents
const { data: files } = await supabase.storage
  .from('media-library')
  .list()

// Implement backup logic for critical files
```

### 3. Disaster Recovery Plan

#### Recovery Procedures
1. **Database Recovery**: Restore from Supabase backup or custom backup
2. **File Recovery**: Restore files from backup storage
3. **Configuration Recovery**: Restore environment variables and settings
4. **Service Recovery**: Redeploy Edge Functions and restart services

#### Recovery Testing
- **Quarterly Tests**: Test full disaster recovery procedures
- **Documentation**: Maintain updated recovery documentation
- **Runbooks**: Create step-by-step recovery runbooks

## 🚀 Performance Optimization

### 1. Frontend Optimization

#### Build Optimization
```bash
# Optimize build for production
npm run build

# Analyze bundle size
npm run build:analyze

# Enable compression
gzip_static on;  # Nginx
```

#### CDN Configuration
- **Static Assets**: Serve static assets via CDN
- **Cache Headers**: Configure appropriate cache headers
- **Image Optimization**: Optimize images and use modern formats

### 2. Backend Optimization

#### Database Optimization
```sql
-- Create necessary indexes
CREATE INDEX CONCURRENTLY idx_chat_messages_channel_created 
ON chat_messages(channel_id, created_at DESC);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM agents WHERE user_id = $1;

-- Update table statistics
ANALYZE;
```

#### Edge Function Optimization
- **Connection Pooling**: Use connection pooling for database connections
- **Caching**: Implement appropriate caching strategies
- **Timeout Configuration**: Set reasonable timeout values

### 3. Scaling Considerations

#### Horizontal Scaling
- **Load Balancing**: Configure load balancers for high traffic
- **Database Scaling**: Consider read replicas for read-heavy workloads
- **Function Scaling**: Monitor and optimize Edge Function concurrency

#### Vertical Scaling
- **Supabase Tier**: Upgrade Supabase tier based on usage patterns
- **Droplet Sizing**: Scale DigitalOcean droplets based on resource usage
- **Resource Monitoring**: Monitor resource usage and scale proactively

## 🔍 Troubleshooting

### Common Deployment Issues

#### Environment Variable Issues
```bash
# Check environment variables are set
echo $VITE_SUPABASE_URL
supabase secrets list --project-ref your-project-ref

# Update environment variables
supabase secrets set --project-ref your-project-ref KEY=value
```

#### Database Connection Issues
```bash
# Test database connectivity
psql "postgresql://user:pass@host:port/db" -c "SELECT 1;"

# Check RLS policies
SELECT * FROM pg_policies WHERE schemaname = 'public';
```

#### Edge Function Issues
```bash
# Check function logs
supabase functions logs --project-ref your-project-ref

# Test function locally
supabase functions serve
curl http://localhost:54321/functions/v1/your-function
```

### Performance Issues

#### Slow Queries
```sql
-- Identify slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Check for missing indexes
SELECT * FROM pg_stat_user_tables WHERE idx_scan = 0;
```

#### High Memory Usage
```bash
# Monitor memory usage
free -h
top -o %MEM

# Check for memory leaks in Node.js services
node --inspect your-app.js
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] All environment variables configured
- [ ] Database migrations tested and ready
- [ ] Security configurations reviewed
- [ ] Backup procedures tested
- [ ] Performance benchmarks established

### Deployment Process
- [ ] Deploy database migrations
- [ ] Deploy Edge Functions
- [ ] Deploy frontend application
- [ ] Configure DNS and SSL
- [ ] Set up monitoring and alerts

### Post-Deployment
- [ ] Verify all services are running
- [ ] Test critical user workflows
- [ ] Monitor application performance
- [ ] Verify backup procedures
- [ ] Update documentation

### Rollback Plan
- [ ] Database rollback procedures documented
- [ ] Previous application version tagged
- [ ] Rollback scripts tested
- [ ] Communication plan for rollback events

---

This deployment guide provides comprehensive coverage of production deployment considerations. For specific integration deployments or troubleshooting, refer to the relevant topic-specific documentation in this README folder.
