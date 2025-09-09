#!/bin/bash

# ProcessLink Backend Restart Script

echo "==================================="
echo "ProcessLink Backend Restart"
echo "==================================="

# In das richtige Verzeichnis wechseln
cd /home/jonathan/Documents/Node\ Js\ Projekte/Process\ Mind/backend

echo "1. Stopping all PM2 processes..."
pm2 delete all
pm2 kill

echo "2. Waiting for cleanup..."
sleep 3

echo "3. Checking services..."
# Redis prüfen
if ! redis-cli ping > /dev/null 2>&1; then
    echo "⚠️  Redis is not running! Please start it with: sudo systemctl start redis"
    exit 1
fi
echo "✅ Redis is running"

# MongoDB prüfen
if ! mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo "⚠️  MongoDB is not running! Please start it with: sudo systemctl start mongodb"
    exit 1
fi
echo "✅ MongoDB is running"

echo "4. Starting backend with PM2..."
pm2 start ecosystem.config.js

echo "5. Waiting for startup..."
sleep 10

echo "6. Current status:"
pm2 list

echo ""
echo "==================================="
echo "✅ Backend restart complete!"
echo "==================================="
echo ""
echo "To view logs: pm2 logs"
echo "To monitor: pm2 monit"