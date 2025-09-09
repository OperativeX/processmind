# ProcessLink Frontend - Deployment Guide

This is the React-based frontend for ProcessLink, a SaaS application for automated video processing with AI-powered transcription and analysis.

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm start
```

The app will run on http://localhost:5001

### Docker Build (Local Testing)

```bash
# Build the Docker image
docker build -t processlink-frontend .

# Run the container
docker run -p 5001:80 \
  -e REACT_APP_API_URL=https://api.processlink.meine-apps.de \
  -e REACT_APP_MAX_FILE_SIZE=2147483648 \
  processlink-frontend
```

## 📦 Deployment with Coolify

### Prerequisites

1. A GitHub repository with this frontend code
2. Coolify instance running on your server
3. Domain configured (e.g., processlink.meine-apps.de)

### Step-by-Step Coolify Deployment

1. **Create New Resource in Coolify**
   - Choose "Docker Compose" as deployment type
   - Connect your GitHub repository
   - Set branch (usually `main` or `master`)

2. **Environment Variables**
   
   In Coolify, set these environment variables:
   ```
   REACT_APP_API_URL=https://api.processlink.meine-apps.de
   REACT_APP_MAX_FILE_SIZE=2147483648
   ```

3. **Build Configuration**
   - Build Pack: Docker Compose
   - Exposed Port: 5001
   - Health Check Path: /health

4. **Domain Configuration**
   - Set your domain: processlink.meine-apps.de
   - Enable "Force HTTPS"
   - Coolify will automatically handle SSL certificates

5. **Deploy**
   - Click "Deploy" in Coolify
   - Monitor the deployment logs
   - Once successful, your app will be available at your domain

### Advanced Coolify Settings

**Resource Limits** (Optional):
```yaml
# In Coolify's Advanced Settings
CPU: 0.5
Memory: 512MB
```

**Custom Labels** (if needed):
```yaml
# For Traefik routing customization
traefik.http.routers.frontend.middlewares: "compress@docker"
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_API_URL` | Backend API URL | https://api.processlink.meine-apps.de |
| `REACT_APP_MAX_FILE_SIZE` | Maximum file size in bytes (2GB) | 2147483648 |
| `REACT_APP_WS_URL` | WebSocket URL (optional) | Derived from API_URL |
| `REACT_APP_PUBLIC_URL` | Public URL of the app | Auto-detected |

### Nginx Configuration

The included `nginx.conf` provides:
- 2GB file upload limit for video processing
- Proxy pass to backend API
- WebSocket support for real-time updates
- Gzip compression for assets
- Security headers
- SPA routing for React Router

## 🛠 Build Scripts

```bash
# Development
npm start          # Start dev server on port 5001

# Testing
npm test           # Run tests
npm run lint       # Run ESLint
npm run typecheck  # TypeScript validation

# Production
npm run build      # Create production build
```

## 📁 Project Structure

```
frontend/
├── public/            # Static assets
├── src/
│   ├── components/    # Reusable components
│   ├── contexts/      # React contexts (Auth, Upload, etc.)
│   ├── pages/         # Route pages
│   ├── services/      # API services
│   └── styles/        # Global styles and theme
├── Dockerfile         # Multi-stage Docker build
├── nginx.conf         # Nginx configuration
├── docker-compose.yml # Docker Compose for Coolify
└── .env.example       # Environment variables template
```

## 🔍 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure `REACT_APP_API_URL` matches your backend URL
   - Check that backend allows your frontend domain

2. **File Upload Fails**
   - Verify nginx `client_max_body_size` is set to 2G
   - Check backend file size limits match

3. **WebSocket Connection Issues**
   - Ensure `/ws/` location in nginx.conf points to correct backend
   - Check that Coolify/proxy supports WebSocket upgrade

4. **Build Failures in Coolify**
   - Check build logs in Coolify dashboard
   - Ensure all environment variables are set
   - Verify GitHub permissions

### Debug Mode

For debugging in production:
```bash
# Add to environment variables
REACT_APP_DEBUG=true
```

This enables additional console logging (remove in production).

## 🚀 Performance Optimization

The deployment is optimized for:
- Fast initial load with code splitting
- Gzip compression for all assets
- 1-year cache for static assets
- Efficient Docker image with multi-stage build
- Health checks for container monitoring

## 📝 Notes for Coolify Users

- Coolify automatically handles SSL certificates via Let's Encrypt
- No need to modify ports in docker-compose.yml - Coolify manages this
- Environment variables in Coolify override those in docker-compose.yml
- Use Coolify's built-in monitoring for logs and metrics
- Enable auto-deploy for automatic updates on git push

## 🆘 Support

For deployment issues:
1. Check Coolify deployment logs
2. Verify all environment variables are set correctly
3. Ensure your domain DNS points to your Coolify server
4. Check backend API is accessible at configured URL

---

Built with React, TypeScript, Material-UI, and deployed with Docker + Coolify