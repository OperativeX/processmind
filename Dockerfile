# Multi-stage Dockerfile for ProcessLink

# Backend build stage
FROM node:18-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install --production

# Frontend build stage
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Final stage
FROM node:18-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    nginx \
    supervisor \
    curl

# Create app directories
WORKDIR /app

# Copy backend
COPY --from=backend-build /app/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/

# Copy frontend build and nginx config
COPY --from=frontend-build /app/frontend/build ./frontend/build
COPY nginx-docker.conf /etc/nginx/nginx.conf

# Create necessary directories
RUN mkdir -p /app/backend/logs \
    && mkdir -p /app/backend/uploads/temp \
    && mkdir -p /app/backend/uploads/processed \
    && mkdir -p /var/log/supervisor

# Create supervisord config
RUN cat > /etc/supervisor/conf.d/supervisord.conf <<EOF
[supervisord]
nodaemon=true
logfile=/var/log/supervisor/supervisord.log

[program:backend]
command=node /app/backend/src/server.js
directory=/app/backend
autostart=true
autorestart=true
stderr_logfile=/var/log/supervisor/backend.err.log
stdout_logfile=/var/log/supervisor/backend.out.log
environment=NODE_ENV="production"

[program:nginx]
command=/usr/sbin/nginx -g "daemon off;"
autostart=true
autorestart=true
stderr_logfile=/var/log/supervisor/nginx.err.log
stdout_logfile=/var/log/supervisor/nginx.out.log
EOF

# Expose ports
EXPOSE 5000 5001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Start supervisord
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]