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

# Create supervisord configuration with logging to stdout
RUN mkdir -p /etc/supervisor/conf.d && \
    cat > /etc/supervisor/conf.d/supervisord.conf << 'EOF'
[supervisord]
nodaemon=true
logfile=/dev/stdout
logfile_maxbytes=0
loglevel=info

[program:redis]
command=redis-server /etc/redis/redis.conf
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
priority=1

[program:backend]
command=/app/start-backend.sh
autostart=true
autorestart=true
startretries=3
startsecs=10
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
priority=2

[program:frontend]
command=bash -c "cd /app/frontend/build && python3 -m http.server 5001"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
priority=3
EOF

# Create backend startup script with better error handling
RUN cat > /app/start-backend.sh << 'EOF'
#!/bin/bash
set -e

echo "[BACKEND] Starting backend service..."
echo "[BACKEND] Environment check:"
echo "[BACKEND] NODE_ENV=${NODE_ENV}"
echo "[BACKEND] PORT=${PORT}"
echo "[BACKEND] MONGODB_URI=${MONGODB_URI:0:30}..."
echo "[BACKEND] REDIS_URL=redis://127.0.0.1:6379"
echo "[BACKEND] JWT_SECRET is ${JWT_SECRET:+set}"
echo "[BACKEND] OPENAI_API_KEY is ${OPENAI_API_KEY:+set}"

# Check required environment variables
if [ -z "$MONGODB_URI" ]; then
    echo "[BACKEND] ERROR: MONGODB_URI is not set!"
    echo "[BACKEND] Please set MONGODB_URI environment variable in Coolify"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    echo "[BACKEND] ERROR: JWT_SECRET is not set!"
    echo "[BACKEND] Please set JWT_SECRET environment variable in Coolify"
    exit 1
fi

# Wait for Redis to be ready
echo "[BACKEND] Waiting for Redis..."
for i in {1..30}; do
    if redis-cli ping > /dev/null 2>&1; then
        echo "[BACKEND] Redis is ready!"
        break
    fi
    echo "[BACKEND] Waiting for Redis... attempt $i/30"
    sleep 1
done

# Override Redis URL to use local Redis
export REDIS_URL=redis://127.0.0.1:6379

# Start backend with all environment variables
echo "[BACKEND] Starting Node.js application..."
cd /app/backend
exec node src/server.js
EOF

RUN chmod +x /app/start-backend.sh

# Create health check script
RUN cat > /app/health.sh << 'EOF'
#!/bin/sh
# Only check backend health after 60 seconds
if [ -f /tmp/startup_complete ]; then
    curl -f http://localhost:5000/health || exit 1
else
    # Check if 60 seconds have passed since container start
    if [ $(( $(date +%s) - $(stat -c %Y /proc/1) )) -gt 60 ]; then
        touch /tmp/startup_complete
        curl -f http://localhost:5000/health || exit 1
    else
        # During startup, just check Redis
        redis-cli ping > /dev/null 2>&1 || exit 1
    fi
fi
EOF

RUN chmod +x /app/health.sh

# Create log directory
RUN mkdir -p /var/log /tmp

# Expose ports
EXPOSE 5000 5001

# Set default environment variables that will be overridden by Coolify
ENV NODE_ENV=production
ENV PORT=5000
ENV REDIS_URL=redis://127.0.0.1:6379

# Health check - increased timeout for service startup
HEALTHCHECK --interval=30s --timeout=15s --start-period=300s --retries=10 \
    CMD /app/health.sh

# Start services with supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]