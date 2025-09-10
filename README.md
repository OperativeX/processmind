# ProcessMind

ProcessMind ist eine KI-gestützte Video-Processing und Transkriptions-Plattform mit Multi-Tenant-Architektur.

## 🚀 Features

- **Video-Upload & Komprimierung**: Automatische Optimierung mit FFmpeg
- **KI-Transkription**: OpenAI Whisper API Integration
- **Smart Tags & Todo-Listen**: Automatisch generiert durch ChatGPT
- **Multi-Tenant SaaS**: Vollständige Mandantentrennung
- **Team Collaboration**: Gemeinsame Arbeitsbereiche
- **Public Sharing**: Teilen von Prozessen via Links

## 📋 Voraussetzungen

- Node.js 18+
- MongoDB (lokal oder Atlas)
- Redis
- FFmpeg
- PM2 (global installiert)
- Nginx (für Production)

## 🛠️ Installation

### 1. Repository klonen

```bash
git clone https://github.com/yourusername/process-mind.git
cd process-mind
```

### 2. Dependencies installieren

```bash
npm install  # Installiert Backend & Frontend
```

### 3. Environment konfigurieren

Backend:
```bash
cd backend
cp .env.example .env
# Bearbeite .env mit deinen Werten
```

Frontend:
```bash
cd ../frontend
cp .env.example .env.local
# Bearbeite .env.local mit deinen Werten
```

### 4. MongoDB & Redis starten

```bash
# MongoDB (wenn lokal)
mongod

# Redis
redis-server
```

## 🚀 Entwicklung

```bash
# Alle Services mit PM2 starten
npm run dev

# Oder einzeln:
cd backend && npm run dev
cd frontend && npm start
```

## 🏭 Production Deployment

### Vorbereitung auf Hetzner VPS

```bash
# System Setup (Ubuntu 22.04)
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs npm nginx certbot python3-certbot-nginx redis-server ffmpeg git

# PM2 global installieren
sudo npm install -g pm2

# MongoDB Atlas verwenden oder lokal installieren
```

### Deployment

1. **Code auf Server**:
```bash
cd /home/deploy
git clone https://github.com/yourusername/process-mind.git
cd process-mind
npm install
```

2. **Environment einrichten**:
```bash
cd backend
cp .env.example .env
nano .env  # Produktions-Werte eintragen
```

3. **Frontend bauen**:
```bash
cd ../frontend
npm run build
```

4. **Nginx konfigurieren**:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /home/deploy/process-mind/frontend/build;
        try_files $uri /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

5. **SSL einrichten**:
```bash
sudo certbot --nginx -d yourdomain.com
```

6. **PM2 starten**:
```bash
cd /home/deploy/process-mind
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## 📦 PM2 Commands

```bash
# Status anzeigen
npm run status

# Logs anzeigen
npm run logs

# Restart (zero-downtime)
npm run restart

# Stop
npm run stop
```

## 🔄 Updates deployen

Updates werden automatisch via GitHub Actions deployed:

1. Code zu `main` branch pushen
2. GitHub Action triggert automatisches Deployment
3. Zero-downtime reload via PM2

Manuelles Update:
```bash
git pull origin main
cd backend && npm install
cd ../frontend && npm install && npm run build
pm2 reload ecosystem.config.js
```

## API Dokumentation

### Authentication
- `POST /api/v1/auth/register` - Benutzer registrieren
- `POST /api/v1/auth/login` - Anmelden
- `POST /api/v1/auth/refresh` - Token erneuern

### Processes
- `GET /api/v1/tenants/:tenantId/processes` - Alle Prozesse
- `POST /api/v1/tenants/:tenantId/processes` - Video hochladen
- `GET /api/v1/tenants/:tenantId/processes/:id` - Einzelner Prozess
- `PUT /api/v1/tenants/:tenantId/processes/:id` - Prozess bearbeiten
- `POST /api/v1/tenants/:tenantId/processes/:id/share` - Share-Link erstellen

### Public
- `GET /api/v1/public/processes/:shareId` - Geteilter Prozess (read-only)

## Development

### Testing
```bash
# Backend
cd backend
npm test

# Frontend  
cd frontend
npm test
```

### Linting
```bash
# Backend
npm run lint

# Frontend
npm run lint
```

## Multi-Tenant Architektur

Die Anwendung ist von Grund auf für Multi-Tenancy ausgelegt:

- **Data Isolation**: Alle Daten sind nach `tenantId` getrennt
- **JWT Integration**: Tenant-Information in JWT Tokens
- **API Design**: Tenant-spezifische Endpoints
- **Database Design**: Skalierbare MongoDB Struktur

## Video Processing Pipeline

1. **Upload** → Temporäre Speicherung
2. **Compression** → H.265, Full HD (Background Job)
3. **Audio Extraction** → FFmpeg Audio-Export
4. **Segmentation** → 10-Minuten Chunks für Whisper API
5. **Transcription** → Parallel processing mit OpenAI Whisper
6. **AI Analysis** → Tags, Todo-Liste, Titel via ChatGPT
7. **Cleanup** → Temporäre Dateien löschen

## Performance

- **Background Jobs**: Redis + BullMQ für Video-Processing
- **Database Indexing**: Optimierte MongoDB Indices
- **Caching**: Redis für häufige Queries
- **File Storage**: Lokaler Storage (MVP) → Cloud Storage (Produktion)

## Deployment

### Docker (Optional)
```bash
# Build
docker build -t processlink .

# Run
docker-compose up
```

### Produktion
```bash
# Backend
npm run start

# Frontend
npm run build
```

## Lizenz

MIT License