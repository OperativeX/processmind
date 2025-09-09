# ProcessLink Makefile
# Vereinfachte Befehle für Docker Compose Deployment

.PHONY: help up down restart logs build clean dev prod status backup

# Default target - Zeigt Hilfe
help:
	@echo "ProcessLink Docker Deployment Commands"
	@echo "====================================="
	@echo "make up        - Start all services"
	@echo "make down      - Stop all services"
	@echo "make restart   - Restart all services"
	@echo "make logs      - Show logs (all services)"
	@echo "make logs-f    - Follow logs (all services)"
	@echo "make build     - Build all images"
	@echo "make clean     - Stop and remove all containers, volumes"
	@echo "make dev       - Start in development mode"
	@echo "make prod      - Start in production mode"
	@echo "make status    - Show container status"
	@echo "make backup    - Create database backup"

# Start all services
up:
	docker-compose up -d

# Stop all services
down:
	docker-compose down

# Restart all services
restart:
	docker-compose restart

# Show logs
logs:
	docker-compose logs

# Follow logs
logs-f:
	docker-compose logs -f

# Build all images
build:
	docker-compose build

# Clean everything (containers, volumes, networks)
clean:
	docker-compose down -v
	@echo "All containers, volumes and networks removed"

# Development mode
dev:
	NODE_ENV=development docker-compose up

# Production mode
prod:
	NODE_ENV=production docker-compose up -d

# Show container status
status:
	docker-compose ps

# Database backup
backup:
	@echo "Creating MongoDB backup..."
	docker exec processlink-mongodb mongodump --out=/data/backup/$(shell date +%Y%m%d_%H%M%S)
	@echo "Backup completed"

# Service-specific logs
logs-backend:
	docker-compose logs backend

logs-frontend:
	docker-compose logs frontend

logs-redis:
	docker-compose logs redis

logs-mongodb:
	docker-compose logs mongodb

# Service-specific restarts
restart-backend:
	docker-compose restart backend

restart-frontend:
	docker-compose restart frontend

# Execute commands in containers
shell-backend:
	docker exec -it processlink-backend sh

shell-frontend:
	docker exec -it processlink-frontend sh

shell-mongo:
	docker exec -it processlink-mongodb mongosh

# Health check
health:
	@echo "Backend health:"
	@curl -s http://localhost:5000/health || echo "Backend not responding"
	@echo "\nFrontend health:"
	@curl -s http://localhost:5001/health || echo "Frontend not responding"