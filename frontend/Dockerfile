# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build arguments for environment variables
ARG REACT_APP_API_URL
ARG REACT_APP_MAX_FILE_SIZE

# Set environment variables for build
ENV REACT_APP_API_URL=$REACT_APP_API_URL
ENV REACT_APP_MAX_FILE_SIZE=$REACT_APP_MAX_FILE_SIZE

# Build the React app
RUN npm run build

# Production stage
FROM nginx:alpine

# Install timezone data and curl for healthcheck
RUN apk add --no-cache tzdata curl

# Copy custom nginx config (use different config for Docker deployment)
COPY nginx-docker.conf /etc/nginx/nginx.conf

# Copy built React app from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Expose port 80 (Coolify will handle port mapping)
EXPOSE 80

# Add health check with both wget and curl fallback
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]