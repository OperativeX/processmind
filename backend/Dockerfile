# Multi-stage Dockerfile for ProcessMind Backend
# Stage 1: Dependencies
FROM node:18-alpine AS dependencies

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ 

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
# Using npm install as package-lock.json might not exist
RUN npm install --omit=dev

# Copy production dependencies aside for final stage
RUN cp -R node_modules prod_node_modules

# Install all dependencies (including dev)
RUN npm install

# Stage 2: Build (if needed for TypeScript or other build steps)
FROM node:18-alpine AS build

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy source code
COPY . .

# If you have a build step, run it here
# RUN npm run build

# Stage 3: Production
FROM node:18-alpine AS production

# Install FFmpeg with full codec support and curl for healthchecks
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    curl \
    && apk add --no-cache --virtual .build-deps \
    && apk del .build-deps

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy production dependencies
COPY --from=dependencies /app/prod_node_modules ./node_modules

# Copy source code (use built code from build stage if applicable)
COPY --chown=nodejs:nodejs . .

# Create necessary directories with correct permissions
RUN mkdir -p uploads/temp uploads/processed logs && \
    chown -R nodejs:nodejs uploads logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start command with signal handling for graceful shutdown
CMD ["node", "src/server.js"]