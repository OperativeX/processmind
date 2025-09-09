# ProcessLink Dockerfile
FROM node:18-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    curl \
    bash

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

# Create startup script
RUN cat > /app/start.sh << 'EOF'
#!/bin/bash
set -e

echo "Starting ProcessLink..."

# Start backend
echo "Starting Backend on port 5000..."
cd /app/backend
export NODE_ENV=production
export PORT=5000
node src/server.js &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to start..."
for i in {1..30}; do
    if curl -f http://localhost:5000/health > /dev/null 2>&1; then
        echo "Backend is ready!"
        break
    fi
    echo "Waiting for backend... attempt $i/30"
    sleep 2
done

# Start frontend server
echo "Starting Frontend on port 5001..."
cd /app/frontend/build
python3 -m http.server 5001 &
FRONTEND_PID=$!

echo "ProcessLink is running!"
echo "Backend: http://localhost:5000"
echo "Frontend: http://localhost:5001"

# Keep container running
while true; do
    # Check if processes are still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "Backend died! Exiting..."
        exit 1
    fi
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "Frontend died! Exiting..."
        exit 1
    fi
    sleep 30
done
EOF

RUN chmod +x /app/start.sh

# Create a simple health check script
RUN cat > /app/health.sh << 'EOF'
#!/bin/sh
curl -f http://localhost:5000/health || exit 1
EOF

RUN chmod +x /app/health.sh

# Expose ports
EXPOSE 5000 5001

# Health check - this might be what Coolify needs
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD /app/health.sh

# Start services
CMD ["/app/start.sh"]