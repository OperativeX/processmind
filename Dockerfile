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

# Create supervisord configuration that uses environment variables
RUN mkdir -p /etc/supervisor/conf.d && \
    cat > /etc/supervisor/conf.d/supervisord.conf << 'EOF'
[supervisord]
nodaemon=true
logfile=/var/log/supervisord.log
loglevel=info

[program:redis]
command=redis-server /etc/redis/redis.conf
autostart=true
autorestart=true
stdout_logfile=/var/log/redis.log
stderr_logfile=/var/log/redis.error.log
priority=1

[program:backend]
command=/app/start-backend.sh
autostart=true
autorestart=true
startretries=10
startsecs=10
stdout_logfile=/var/log/backend.log
stderr_logfile=/var/log/backend.error.log
redirect_stderr=true
priority=2

[program:frontend]
command=bash -c "cd /app/frontend/build && python3 -m http.server 5001"
autostart=true
autorestart=true
stdout_logfile=/var/log/frontend.log
stderr_logfile=/var/log/frontend.error.log
priority=3
EOF

# Create backend startup script that properly passes environment variables
RUN cat > /app/start-backend.sh << 'EOF'
#!/bin/bash
set -e

echo "Starting backend with environment:"
echo "NODE_ENV=${NODE_ENV}"
echo "PORT=${PORT}"
echo "MONGODB_URI=${MONGODB_URI:0:30}..."
echo "REDIS_URL=redis://127.0.0.1:6379"
echo "JWT_SECRET is ${JWT_SECRET:+set}"
echo "OPENAI_API_KEY is ${OPENAI_API_KEY:+set}"

# Wait for Redis to be ready
echo "Waiting for Redis..."
for i in {1..30}; do
    if redis-cli ping > /dev/null 2>&1; then
        echo "Redis is ready!"
        break
    fi
    echo "Waiting for Redis... attempt $i/30"
    sleep 1
done

# Start backend with all environment variables
cd /app/backend
exec node src/server.js
EOF

RUN chmod +x /app/start-backend.sh

# Create health check script
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

# Set default environment variables that will be overridden by Coolify
ENV NODE_ENV=production
ENV PORT=5000
ENV REDIS_URL=redis://127.0.0.1:6379

# Health check - increased timeout for service startup
HEALTHCHECK --interval=30s --timeout=10s --start-period=300s --retries=5 \
    CMD /app/health.sh

# Start services with supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]