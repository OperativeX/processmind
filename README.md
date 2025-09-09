# ProcessLink

Eine SaaS-Anwendung zur automatisierten Verarbeitung von Videos mit KI-gestützter Transkription und Analyse.

## Features

- 🎥 **Video-Upload & Komprimierung** - Automatische H.265 Komprimierung auf Full HD
- 🎤 **AI-Transkription** - OpenAI Whisper API mit Zeitstempeln
- 🏷️ **Automatische Tags** - KI-generierte Tags für bessere Auffindbarkeit
- ✅ **Todo-Listen** - Automatisch erstellte Aufgabenlisten aus Video-Inhalten
- 🌐 **Graph-Visualisierung** - Obsidian-inspirierte Wolken-Ansicht mit Tag-Verbindungen
- 👥 **Multi-Tenant** - SaaS-ready Architektur
- 🌙 **Dark Theme** - Obsidian.md-inspiriertes Design

## Tech Stack

### Backend
- Node.js + Express.js
- MongoDB (Mongoose ODM)
- Redis + BullMQ (Background Jobs)
- FFmpeg (Video Processing)
- OpenAI API (Whisper + ChatGPT)
- JWT Authentication

### Frontend
- React 18 + TypeScript
- Material-UI (Obsidian Theme)
- React Query + Context API
- D3.js (Graph Visualization)
- React Router v6

## Schnellstart

### Voraussetzungen
```bash
# Node.js 18+
node --version

# MongoDB (lokal oder Cloud)
mongod --version

# Redis
redis-server --version

# FFmpeg
ffmpeg -version
```

### Installation

1. **Repository klonen**
```bash
git clone <repository-url>
cd ProcessLink
```

2. **Environment Setup**
```bash
cp .env.example .env
# .env Datei mit Ihren API-Keys ausfüllen
```

3. **Backend Setup**
```bash
cd backend
npm install
npm run dev
```

4. **Frontend Setup** (neues Terminal)
```bash
cd frontend
npm install
npm start
```

5. **Services starten**
```bash
# MongoDB
mongod

# Redis
redis-server
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