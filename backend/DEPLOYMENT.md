# ProcessMind Backend - Coolify Deployment Guide

## Important: External Services Required

Since Coolify will deploy only the backend container, you need to have Redis and MongoDB running separately.

## Option 1: Use External Services

### Redis
- Use a managed Redis service (e.g., Redis Cloud, AWS ElastiCache)
- Or deploy Redis separately in Coolify as another service

### MongoDB  
- Use MongoDB Atlas (free tier available)
- Or deploy MongoDB separately in Coolify

## Option 2: Deploy All Services in Coolify

1. **Deploy Redis:**
   - Add new service in Coolify
   - Choose Redis image
   - Note the internal URL (e.g., `redis://redis-xyz.internal:6379`)

2. **Deploy MongoDB:**
   - Add new service in Coolify
   - Choose MongoDB image
   - Note the internal URL (e.g., `mongodb://mongodb-xyz.internal:27017`)

3. **Deploy Backend:**
   - Use this repository
   - Set environment variables with the URLs from steps 1 & 2

## Required Environment Variables in Coolify

```env
# Database Connections (use your actual URLs)
REDIS_URL=redis://your-redis-server:6379
MONGODB_URI=mongodb://your-mongodb-server:27017/process-mind

# Essential Keys
JWT_SECRET=your-secure-jwt-secret
OPENAI_API_KEY=sk-your-openai-api-key

# Optional but recommended
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM="ProcessMind <noreply@yourdomain.com>"

# Frontend URL
FRONTEND_URL=https://your-frontend-url.com
CORS_ORIGIN=https://your-frontend-url.com
```

## Deployment Steps

1. **Prepare External Services:**
   - Set up Redis and MongoDB (see options above)
   - Get connection URLs

2. **Configure in Coolify:**
   - Add your GitHub repository
   - Set all required environment variables
   - Deploy

3. **Verify:**
   - Check logs for successful connections
   - Test the health endpoint: `https://your-backend-url/health`

## Troubleshooting

### Container won't start
- Check if all required environment variables are set
- Verify Redis and MongoDB are accessible from Coolify's network

### Health check fails
- Ensure the app can connect to Redis and MongoDB
- Check logs for specific error messages

### Redis connection refused
- Make sure REDIS_URL is set correctly
- If using internal Coolify service, use the internal domain

## Using Docker Compose Locally

For local development with all services:
```bash
mv docker-compose.yml.backup docker-compose.yml
docker-compose up -d
```

This will start Redis, MongoDB, and the backend together.