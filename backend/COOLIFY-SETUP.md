# ProcessMind Backend - Coolify Setup Guide

## Quick Start (Test Deployment)

1. **Use Simple Dockerfile First**
   - Rename `Dockerfile.simple` to `Dockerfile`
   - This will start a minimal server without database requirements
   - Access `/health` and `/info` endpoints to verify deployment

2. **Check Deployment**
   - Visit: `https://your-app-url/health`
   - Visit: `https://your-app-url/info` (shows which env vars are missing)

## Full Deployment Steps

### Step 1: Deploy External Services

#### Option A: Use Managed Services (Recommended)
- **MongoDB Atlas**: https://cloud.mongodb.com
  - Create free M0 cluster
  - Get connection string: `mongodb+srv://...`
- **Redis Cloud**: https://app.redislabs.com
  - Create free database
  - Get connection string: `redis://...`

#### Option B: Deploy in Coolify
1. **Redis Service**:
   - New Service → Docker Image
   - Image: `redis:7-alpine`
   - Internal Port: 6379
   - Note the internal URL

2. **MongoDB Service**:
   - New Service → Docker Image  
   - Image: `mongo:7`
   - Internal Port: 27017
   - Note the internal URL

### Step 2: Configure Environment Variables in Coolify

Required variables:
```
NODE_ENV=production
PORT=5000
REDIS_URL=redis://your-redis:6379
MONGODB_URI=mongodb://your-mongodb:27017/process-mind
JWT_SECRET=generate-a-secure-random-string
OPENAI_API_KEY=sk-your-openai-key
```

Optional but recommended:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com
FRONTEND_URL=https://your-frontend.com
CORS_ORIGIN=https://your-frontend.com
```

### Step 3: Deploy Backend

1. **Initial Test**:
   - Deploy with minimal configuration
   - Check `/health` endpoint
   - Check `/info` to see missing configurations

2. **Full Deployment**:
   - Add all environment variables
   - Use the main `Dockerfile` (not simple)
   - Deploy again

## Troubleshooting

### Container Won't Start
1. Check Coolify logs
2. Try `Dockerfile.simple` first
3. Verify environment variables in `/info`

### Database Connection Issues
- Ensure services are in same network
- Use internal Coolify URLs (not localhost)
- Check firewall/security groups for managed services

### Health Check Fails
- Start with `Dockerfile.simple`
- Check `/health` endpoint manually
- Verify PORT is set to 5000

## Testing Endpoints

Once deployed, test these:
- `GET /health` - Basic health check
- `GET /info` - Environment variable status
- `GET /` - Basic API info

## Migration to Full App

Once minimal deployment works:
1. Set all required environment variables
2. Switch back to main `Dockerfile`
3. Redeploy
4. Full API will be available at `/api/v1/*`