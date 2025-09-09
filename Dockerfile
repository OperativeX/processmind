# ProcessLink Dockerfile
FROM node:18-alpine

# Install runtime dependencies including Redis
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    curl \
    bash \
    redis \
    supervisor

WORKDIR /app

# Copy everything
COPY . .

# Install and build backend
WORKDIR /app/backend
RUN npm install --production

# Install and build frontend
WORKDIR /app/frontend
RUN npm install && npm run build

# Setup for production
WORKDIR /app

# Create Redis configuration
RUN mkdir -p /etc/redis && \
    echo "bind 127.0.0.1" > /etc/redis/redis.conf && \
    echo "protected-mode no" >> /etc/redis/redis.conf && \
    echo "port 6379" >> /etc/redis/redis.conf

# Create supervisord configuration
RUN mkdir -p /etc/supervisor/conf.d && \
    cat > /etc/supervisor/conf.d/supervisord.conf << 'EOF'
[supervisord]
nodaemon=true
logfile=/var/log/supervisord.log

[program:redis]
command=redis-server /etc/redis/redis.conf
autostart=true
autorestart=true
stdout_logfile=/var/log/redis.log
stderr_logfile=/var/log/redis.error.log
priority=1

[program:backend]
command=bash -c "cd /app/backend && NODE_ENV=production PORT=5000 REDIS_URL=redis://127.0.0.1:6379 node src/server.js"
autostart=true
autorestart=true
startretries=10
startsecs=10
stdout_logfile=/var/log/backend.log
stderr_logfile=/var/log/backend.error.log
environment=NODE_ENV="production",PORT="5000",REDIS_URL="redis://127.0.0.1:6379"
priority=2

[program:frontend]
command=bash -c "cd /app/frontend/build && python3 -m http.server 5001"
autostart=true
autorestart=true
stdout_logfile=/var/log/frontend.log
stderr_logfile=/var/log/frontend.error.log
priority=3
EOF

# Create startup script for health check
RUN cat > /app/health.sh << 'EOF'
#!/bin/sh
# Check if Redis is running
redis-cli ping > /dev/null 2>&1 || exit 1
# Check if backend is healthy
curl -f http://localhost:5000/health || exit 1
EOF

RUN chmod +x /app/health.sh

# Create log directory
RUN mkdir -p /var/log

# Expose ports
EXPOSE 5000 5001

# Health check - increased timeout for service startup
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=5 \
    CMD /app/health.sh

# Start services with supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]