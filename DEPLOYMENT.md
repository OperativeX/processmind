# ProcessLink Deployment Guide

Diese Anleitung erklärt, wie Sie ProcessLink mit Frontend und Backend zusammen bereitstellen.

## 🚀 Quick Start

1. **Environment Setup**
   ```bash
   cp .env.example .env
   # Bearbeiten Sie .env mit Ihren Werten
   ```

2. **Services starten**
   ```bash
   make up
   # oder
   docker-compose up -d
   ```

3. **Logs prüfen**
   ```bash
   make logs-f
   ```

## 📋 Voraussetzungen

- Docker & Docker Compose
- 4GB+ RAM
- 20GB+ freier Speicherplatz
- OpenAI API Key
- SMTP Server für E-Mails

## 🛠️ Konfiguration

### Wichtige Environment Variables

| Variable | Beschreibung | Erforderlich |
|----------|--------------|--------------|
| `MONGODB_URI` | MongoDB Connection String | ✅ |
| `JWT_SECRET` | JWT Secret Key | ✅ |
| `OPENAI_API_KEY` | OpenAI API Key | ✅ |
| `SMTP_USER` | SMTP Username | ✅ |
| `SMTP_PASS` | SMTP Password | ✅ |

### Port-Konfiguration

- **Backend**: Port 5000 (Standard)
- **Frontend**: Port 5001 (Standard)

Ändern Sie die Ports in `.env`:
```env
BACKEND_PORT=5000
FRONTEND_PORT=5001
```

## 🏗️ Architektur

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│   MongoDB   │
│    (React)  │     │  (Express)  │     │             │
│  Port 5001  │     │  Port 5000  │     └─────────────┘
└─────────────┘     └──────┬──────┘              
                           │                      
                           ▼                      
                    ┌─────────────┐              
                    │    Redis    │              
                    │   (Queue)   │              
                    └─────────────┘              
```

## 🚀 Deployment Optionen

### Option 1: Docker Compose (Empfohlen)

```bash
# Build und Start
make build
make up

# Status prüfen
make status

# Logs anzeigen
make logs-f
```

### Option 2: Einzelne Docker Container

```bash
# Backend
cd backend
docker build -t processlink-backend .
docker run -p 5000:5000 --env-file ../.env processlink-backend

# Frontend
cd frontend
docker build -t processlink-frontend .
docker run -p 5001:80 processlink-frontend
```

### Option 3: PM2 (Ohne Docker)

```bash
# Backend
cd backend
npm install
pm2 start ecosystem.config.js --env production

# Frontend (mit Nginx)
cd frontend
npm install
npm run build
# Servieren Sie build/ mit Nginx
```

## 🔧 Wartung

### Backup erstellen
```bash
make backup
```

### Services neustarten
```bash
make restart
# oder einzeln:
make restart-backend
make restart-frontend
```

### Container Shell
```bash
make shell-backend
make shell-frontend
make shell-mongo
```

### Cleanup
```bash
# Alles stoppen und entfernen
make clean
```

## 📊 Monitoring

### Health Checks
```bash
make health
```

### Service Logs
```bash
# Alle Logs
make logs

# Spezifische Services
make logs-backend
make logs-frontend
make logs-mongodb
```

## 🔐 Sicherheit

1. **JWT Secret**: Generieren Sie einen sicheren Secret
   ```bash
   openssl rand -base64 32
   ```

2. **MongoDB**: Setzen Sie sichere Passwörter
3. **CORS**: Konfigurieren Sie `CORS_ORIGIN` für Ihre Domain
4. **HTTPS**: Verwenden Sie einen Reverse Proxy (Nginx/Traefik)

## 🌐 Production Deployment

### Mit Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name processlink.example.com;

    location / {
        proxy_pass http://localhost:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Mit Traefik

Labels in `docker-compose.yml` hinzufügen:
```yaml
services:
  frontend:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`processlink.example.com`)"
      - "traefik.http.services.frontend.loadbalancer.server.port=80"
```

## 🆘 Troubleshooting

### Container startet nicht
```bash
# Logs prüfen
docker-compose logs backend
docker-compose logs frontend

# Container neu bauen
make build
```

### MongoDB Verbindungsfehler
- Prüfen Sie `MONGODB_URI` in `.env`
- Stellen Sie sicher, dass MongoDB läuft: `make status`

### Upload Fehler
- Prüfen Sie Dateiberechtigungen
- Max File Size in `.env` anpassen

## 📚 Weitere Ressourcen

- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)
- [API Dokumentation](./backend/docs/API.md)
- [Troubleshooting Guide](./docs/TROUBLESHOOTING.md)