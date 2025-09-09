# ProcessLink - Technische Dokumentation

## Projekt-Übersicht
ProcessLink ist eine SaaS-Anwendung zur automatisierten Verarbeitung von Videos mit KI-gestützter Transkription und Analyse.

## Development Philosophie
- **Minimale Codebase**: Priorität auf schlanken, wartbaren Code ohne Überengineering
- **Funktionalität über Perfektion**: Robuste Kernfunktionen haben Vorrang vor komplexen Sicherheitsfeatures
- **Pragmatischer Ansatz**: Kleinere Sicherheitslücken werden zugunsten schneller Entwicklung und einfacher Wartbarkeit akzeptiert
- **Fokus**: Stabiler, funktionaler Code für schnelle Iteration und Deployment

## Port-Konfiguration
- **Backend Server**: Port 5000
- **Frontend**: Port 5001

## Projekt-Struktur
- **Produktionscode**: Hauptverzeichnisse `/backend/src/` und `/frontend/src/`
- **Development Tools**: Alle Test-, Debug- und Hilfsdateien im `/dev-tools/` Ordner
  - `/dev-tools/backend/`: Backend-Tests, Debug-Skripte, Hilfsskripte
  - `/dev-tools/frontend/`: Frontend-Tests, Debug-Tools
  - `/dev-tools/benchmarks/`: Performance-Tests
  - `/dev-tools/docs/`: Zusätzliche technische Dokumentation

## Core Features
- Video-Upload mit automatischer Transkription (OpenAI Whisper API)
- Video-Komprimierung (FFmpeg: H.264/HEVC, Full HD)
- KI-generierte Tags, Todo-Listen und Überschriften (ChatGPT API)
- Graph/Wolken-Visualisierung mit Tag-basierten Verbindungen
- Multi-Tenant Architektur für SaaS-Skalierung
- Obsidian.md-inspiriertes Dark Theme Design

## Technologie-Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB mit Mongoose ODM
- **Queue System**: Redis + BullMQ für Background-Jobs
- **Authentication**: JWT mit Multi-Tenant Support
- **File Upload**: Multer mit temporärer Speicherung
- **Video Processing**: FFmpeg (fluent-ffmpeg Wrapper)
- **AI Integration**: OpenAI API (Whisper + ChatGPT)

### Frontend
- **Framework**: React 18 mit TypeScript
- **Routing**: React Router v6
- **UI Library**: Material-UI (MUI) mit Obsidian-Theme
- **State Management**: React Query + Context API
- **HTTP Client**: Axios
- **Visualisierung**: D3.js oder Vis.js für Graph-Ansicht

### Infrastructure
- **Containerization**: Docker (optional für MVP)
- **Process Management**: PM2
- **Environment**: dotenv für Konfiguration
- **Logging**: Winston oder Pino

## Multi-Tenant Architektur

### Database Design
```
Tenants Collection:
{
  _id: ObjectId,
  name: String,
  domain: String, // für Subdomain-Routing
  settings: Object,
  createdAt: Date,
  isActive: Boolean
}

Users Collection:
{
  _id: ObjectId,
  tenantId: ObjectId, // Referenz zu Tenant
  email: String,
  password: String (hashed),
  role: String, // 'owner', 'user'
  createdAt: Date
}

Processes Collection (tenant-specific):
{
  _id: ObjectId,
  tenantId: ObjectId, // Für Data Isolation
  userId: ObjectId,
  title: String, // KI-generiert
  originalFilename: String,
  videoPath: String, // Komprimiertes Video
  transcript: {
    text: String,
    segments: [{ start: Number, end: Number, text: String }]
  },
  tags: [String], // KI-generiert
  todoList: [{ 
    task: String, 
    timestamp: Number, 
    completed: Boolean 
  }],
  shareId: String, // Für Public Sharing
  status: String, // 'processing', 'completed', 'failed'
  createdAt: Date,
  updatedAt: Date
}
```

### API-Struktur
```
/api/v1/auth/login
/api/v1/auth/register
/api/v1/tenants/:tenantId/processes
/api/v1/tenants/:tenantId/processes/:id
/api/v1/tenants/:tenantId/processes/:id/share
/api/v1/public/processes/:shareId (Read-only)
```

## Video Processing Pipeline

### 1. Upload Phase
```javascript
POST /api/v1/tenants/:tenantId/processes
- Multer speichert Video temporär
- Erstellt Process-Dokument mit Status 'processing'
- Fügt Jobs zur Redis Queue hinzu
```

### 2. Background Processing Jobs
1. **Video Compression Job**
   - H.264/HEVC Codec, CRF 28, Full HD Auflösung

2. **Audio Extraction Job**
   ```bash
   ffmpeg -i input.mp4 -vn -acodec pcm_s16le -ar 16000 audio.wav
   ```

3. **Audio Segmentation Job** (10-Min Chunks)
   ```bash
   ffmpeg -i audio.wav -f segment -segment_time 600 -c copy segment_%03d.wav
   ```

4. **Whisper Transcription Jobs** (parallel)
   - Model: whisper-1
   - Format: verbose_json mit Timestamps

5. **Transcript Merging Job**
   - Zusammenfügen der Segmente mit korrekten Zeitstempeln
   - Speicherung in MongoDB

6. **AI Analysis Jobs**
   ```javascript
   // Tags Generation
   // Tag-Generierung mit gpt-3.5-turbo

   // Todo-Listen Generierung mit gpt-3.5-turbo

   // Titel-Generierung mit gpt-3.5-turbo
   ```

7. **Cleanup Job**
   - Löscht temporäre Audio-Dateien
   - Setzt Status auf 'completed'

## UI Design

- **Theme**: Obsidian.md-inspiriertes Dark Theme
- **Visualisierung**: D3.js für interaktive Tag-Netzwerke
- **Color Palette**: GitHub Dark Mode (#0d1117 primary, #7c3aed accent)

## Performance Considerations

### Queue Configuration
- **BullMQ Worker**: Max. 3 parallele Video-Processing Jobs
- **Job Retention**: 10 erfolgreiche, 50 fehlgeschlagene Jobs

### Database Optimization
- **Indices**: tenantId + createdAt, tenantId + tags, shareId
- **Unique Constraints**: tenantId + email für Users

### File Storage Strategy
- **Entwicklung**: Lokaler Storage
- **Produktion**: AWS S3 oder ähnlicher Cloud Storage
- **CDN**: CloudFlare für Video-Delivery

## Environment Setup

Siehe `.env.example` für alle erforderlichen Umgebungsvariablen:
- OpenAI API Key für Whisper & GPT-3.5
- MongoDB & Redis Verbindungen
- JWT Secret für Authentication
- FFmpeg Pfade für Video-Processing

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Benutzer registrieren
- `POST /api/v1/auth/login` - Benutzer anmelden
- `POST /api/v1/auth/refresh` - Token erneuern

### Process Management
- `GET /api/v1/tenants/:tenantId/processes` - Alle Prozesse abrufen
- `POST /api/v1/tenants/:tenantId/processes` - Video hochladen
- `GET /api/v1/tenants/:tenantId/processes/:id` - Einzelnen Prozess abrufen
- `PUT /api/v1/tenants/:tenantId/processes/:id` - Prozess bearbeiten
- `DELETE /api/v1/tenants/:tenantId/processes/:id` - Prozess löschen
- `POST /api/v1/tenants/:tenantId/processes/:id/share` - Share-Link erstellen

### Public Sharing
- `GET /api/v1/public/processes/:shareId` - Geteilten Prozess abrufen (read-only)

### Real-time Updates

#### WebSocket Events
- `processing-status` - Live Status-Updates während Video-Processing
- `job-completed` - Benachrichtigung bei erfolgreichem Abschluss
- `job-failed` - Fehlerbenachrichtigungen mit Details
- `transcript-chunk` - Streaming von Transkript-Segmenten

#### Error Handling Strategy
- **Retry Logic**: 3 Versuche für fehlgeschlagene API Calls
- **Graceful Degradation**: Teilweise Ergebnisse bei Fehlern speichern
- **User Feedback**: Detaillierte Fehlermeldungen im UI
- **Logging**: Winston Logger für strukturierte Fehleranalyse

## Security & Error Handling

### Security Measures
- **Multi-Tenant Isolation**: Automatische tenantId-Filterung
- **File Validation**: Nur Video-Formate, max. 500MB
- **Rate Limiting**: 10 Uploads pro Stunde pro User
- **JWT Security**: httpOnly Cookies, 7 Tage Gültigkeit

### API Cost Optimization
- **Transcript Caching**: Vermeidung doppelter Whisper API Calls
- **Batch Processing**: Parallele Verarbeitung von Audio-Segmenten
- **Model Selection**: gpt-3.5-turbo statt gpt-4 für Kosteneffizienz
- **Token Limits**: Max 4000 Zeichen Transkript für AI-Analyse

### Kostenübersicht (Stand 2024)
- **Whisper API**: $0.006 pro Minute Audio
- **GPT-3.5-turbo**: $0.0005/$0.0015 pro 1K Input/Output Tokens
- **Geschätzte Kosten pro Video**: ~$0.10-0.20 (10 Min Video)

## Development Commands

```bash
# Setup
npm install              # Dependencies installieren
npm run dev             # Development Server starten

# Quality Checks
npm run lint            # ESLint ausführen
npm run typecheck       # TypeScript Validation
npm run test            # Tests ausführen

# Production
npm run build           # Production Build
npm run start           # Server starten
```