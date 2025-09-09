# ProcessLink Dockerfile
FROM node:18-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    curl

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
#!/bin/sh
echo "Starting ProcessLink Backend..."
cd /app/backend
NODE_ENV=production PORT=5000 node src/server.js &

echo "Waiting for backend to start..."
sleep 10

echo "Starting Frontend Server..."
cd /app/frontend/build
python3 -m http.server 5001 &

# Keep the container running
while true; do
    sleep 60
    # Check if backend is still running
    if ! curl -f http://localhost:5000/health > /dev/null 2>&1; then
        echo "Backend health check failed, but continuing..."
    fi
done
EOF

RUN chmod +x /app/start.sh

# Expose ports
EXPOSE 5000 5001

# No HEALTHCHECK directive - let Coolify handle it
# Start services
CMD ["/app/start.sh"]