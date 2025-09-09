# ProcessLink Dockerfile
# Note: This Dockerfile expects backend and frontend directories to be present
# If using Coolify, ensure these directories are included in your repository

FROM node:18-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++

WORKDIR /app

# Copy everything (Coolify will provide the full context)
COPY . .

# Check if directories exist
RUN ls -la && \
    if [ ! -d "backend" ] || [ ! -d "frontend" ]; then \
        echo "ERROR: backend or frontend directories not found!" && \
        echo "Make sure these directories are committed to your git repository" && \
        exit 1; \
    fi

# Install and build backend
WORKDIR /app/backend
RUN npm install --production

# Install and build frontend
WORKDIR /app/frontend
RUN npm install && npm run build

# Setup for production
WORKDIR /app

# Create a simple startup script
RUN cat > /app/start.sh << 'EOF'
#!/bin/sh
echo "Starting ProcessLink..."

# Start backend
cd /app/backend
NODE_ENV=production node src/server.js &

# Wait for backend to start
sleep 5

# Simple file server for frontend (if nginx is not available)
cd /app/frontend/build
python3 -m http.server 5001 &

# Keep container running
wait
EOF

RUN chmod +x /app/start.sh

# Expose ports
EXPOSE 5000 5001

# Start services
CMD ["/app/start.sh"]