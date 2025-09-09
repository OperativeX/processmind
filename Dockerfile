# ProcessLink Dockerfile
FROM node:18-alpine

# Install runtime dependencies including Redis and Nginx
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    curl \
    bash \
    redis \
    supervisor \
    nginx

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

# Setup Nginx
RUN rm -f /etc/nginx/nginx.conf /etc/nginx/conf.d/default.conf && \
    mkdir -p /var/cache/nginx /var/log/nginx /run/nginx

# Create Nginx configuration
RUN cat > /etc/nginx/nginx.conf << 'EOF'
user root;
worker_processes auto;
error_log /dev/stderr warn;
pid /run/nginx/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    access_log /dev/stdout;
    
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml application/atom+xml image/svg+xml;
    
    client_max_body_size 2G;
    client_body_buffer_size 128k;
    client_body_timeout 300s;
    
    proxy_connect_timeout 600s;
    proxy_send_timeout 600s;
    proxy_read_timeout 600s;
    send_timeout 600s;
    
    server {
        listen 5001;
        server_name localhost;
        
        root /app/frontend/build;
        index index.html;
        
        location /api/ {
            proxy_pass http://127.0.0.1:5000/api/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_connect_timeout 600s;
            proxy_send_timeout 600s;
            proxy_read_timeout 600s;
        }
        
        location /ws/ {
            proxy_pass http://127.0.0.1:5000/ws/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 3600s;
            proxy_send_timeout 3600s;
        }
        
        location / {
            try_files $uri $uri/ /index.html;
        }
        
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
EOF

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

[program:nginx]
command=nginx -g 'daemon off;'
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
priority=2

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
priority=3
environment=NODE_ENV="production",PORT="5000",REDIS_URL="redis://127.0.0.1:6379"
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
echo "[BACKEND] REDIS_URL=${REDIS_URL}"
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

if [ -z "$OPENAI_API_KEY" ]; then
    echo "[BACKEND] WARNING: OPENAI_API_KEY is not set!"
    echo "[BACKEND] Video transcription features will not work without it"
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

# Wait for Nginx to be ready
echo "[BACKEND] Waiting for Nginx..."
for i in {1..10}; do
    if curl -f http://localhost:5001/health > /dev/null 2>&1; then
        echo "[BACKEND] Nginx is ready!"
        break
    fi
    echo "[BACKEND] Waiting for Nginx... attempt $i/10"
    sleep 1
done

# Override Redis URL to use local Redis
export REDIS_URL=redis://127.0.0.1:6379

# Start backend with all environment variables
echo "[BACKEND] Starting Node.js application..."
cd /app/backend

# Run with full error output
exec node src/server.js
EOF

RUN chmod +x /app/start-backend.sh

# Create simple health check script
RUN cat > /app/health.sh << 'EOF'
#!/bin/sh
# Check if services are responding
redis-cli ping > /dev/null 2>&1 || exit 1
curl -f http://localhost:5001/health > /dev/null 2>&1 || exit 1
curl -f http://localhost:5000/health > /dev/null 2>&1 || exit 1
exit 0
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

# Simple health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
    CMD /app/health.sh || exit 1

# Start services with supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]