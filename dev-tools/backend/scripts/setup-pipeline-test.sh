#!/bin/bash

# Setup script for video pipeline test

echo "Setting up video pipeline test environment..."

# Create test directories
mkdir -p test-videos
mkdir -p test-results

# Check if sample video exists
if [ ! -f "test-videos/sample.mp4" ]; then
    echo "⚠️  No test video found!"
    echo "Please add a video file to test-videos/sample.mp4"
    echo ""
    echo "You can create a simple test video with ffmpeg:"
    echo "ffmpeg -f lavfi -i testsrc=duration=30:size=1280x720:rate=30 -f lavfi -i sine=frequency=1000:duration=30 -c:v libx264 -c:a aac test-videos/sample.mp4"
fi

# Install required dependencies
echo "Installing dependencies..."
npm install form-data axios bullmq ioredis chalk table

# Create .env.test file if it doesn't exist
if [ ! -f ".env.test" ]; then
    echo "Creating .env.test file..."
    cat > .env.test << EOF
# Test Configuration
API_URL=http://localhost:5000
TEST_TENANT_ID=test-tenant
AUTH_TOKEN=your-jwt-token-here
TEST_VIDEO=./test-videos/sample.mp4

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Monitoring
MONITOR_INTERVAL=2000
TIMEOUT=600000
EOF
    echo "✅ Created .env.test - Please update AUTH_TOKEN with a valid JWT"
fi

# Make test script executable
chmod +x test-video-pipeline.js

echo ""
echo "✅ Setup complete!"
echo ""
echo "To run the test:"
echo "1. Make sure your backend is running (npm run dev)"
echo "2. Update AUTH_TOKEN in .env.test with a valid JWT token"
echo "3. Add a test video to test-videos/sample.mp4"
echo "4. Run: source .env.test && node test-video-pipeline.js"
echo ""
echo "To get a valid AUTH_TOKEN:"
echo "1. Login via the frontend"
echo "2. Check browser DevTools > Application > Cookies"
echo "3. Copy the 'token' value"