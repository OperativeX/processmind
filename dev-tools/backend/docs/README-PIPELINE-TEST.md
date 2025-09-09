# Video Pipeline Test Suite

Umfassendes Test- und Debug-Tool für die Video-Verarbeitungspipeline von Process Mind.

## 🚀 Features

- **Echtzeit-Monitoring** aller Queue-Jobs
- **Parallelitätsprüfung** für optimale Performance
- **Visuelle Darstellung** des Pipeline-Fortschritts
- **Detaillierte Timing-Analyse** für Optimierungen
- **Fehlerdiagnose** mit vollständigen Stack-Traces

## 📋 Voraussetzungen

- Backend läuft auf Port 5000 (`npm run dev`)
- Redis läuft (für BullMQ)
- MongoDB läuft
- Gültiger JWT Token eines eingeloggten Users

## 🛠️ Setup

1. **Setup-Script ausführen:**
   ```bash
   ./setup-pipeline-test.sh
   ```

2. **Test-Video bereitstellen:**
   ```bash
   # Option 1: Eigenes Video kopieren
   cp /path/to/your/video.mp4 test-videos/sample.mp4

   # Option 2: Test-Video mit FFmpeg erstellen
   ffmpeg -f lavfi -i testsrc=duration=30:size=1280x720:rate=30 \
          -f lavfi -i sine=frequency=1000:duration=30 \
          -c:v libx264 -c:a aac test-videos/sample.mp4
   ```

3. **Auth-Token holen:**
   - Frontend öffnen und einloggen
   - Browser DevTools → Application → Cookies
   - `token` Wert kopieren
   - In `.env.test` bei `AUTH_TOKEN=` eintragen

## 🚀 Test ausführen

```bash
# Environment laden und Test starten
source .env.test && node test-video-pipeline.js
```

## 📊 Output-Interpretation

### Pipeline Status
```
Stage               Status      Duration   Details
upload              ✓ completed 2s         
audio-extraction    ⟳ active    15s        
video-compression   ⟳ active    12s        
audio-segmentation  ○ pending   -          
transcription       ○ pending   -          3 segments
```

### Queue Statistics
```
Queue            Waiting  Active  Completed  Failed
video-processing 0        1       0          0
audio-extraction 1        1       1          0
transcription    3        0       0          0
```

### Parallelitätsprüfung
```
✓ Phase 1: Video compression and audio processing running in parallel
✓ Phase 2: AI analysis jobs running in parallel
✓ Embedding generation correctly waits for tags and title
```

## 🔍 Debug-Tipps

### 1. Mehr Details in Logs
```bash
# Backend mit Debug-Logs starten
DEBUG=* npm run dev
```

### 2. Queue direkt inspizieren
```bash
# Redis CLI
redis-cli
> keys bull:*
> lrange bull:audio-extraction:wait 0 -1
```

### 3. Spezifischen Prozess debuggen
```bash
# In MongoDB
mongo
> use process-mind
> db.processes.findOne({_id: ObjectId("...")})
```

## 🎯 Performance-Optimierung

Die Pipeline wurde optimiert für:

1. **Parallele Verarbeitung Phase 1:**
   - Audio-Extraktion → Segmentierung → Transkription
   - Video-Komprimierung (parallel dazu)

2. **Parallele Verarbeitung Phase 2:**
   - Tags-Generierung
   - Todo-Listen-Erstellung  
   - Titel-Generierung
   - (Alle 3 parallel mit Promise.all)

3. **Sequenzielle Abhängigkeiten:**
   - Embedding wartet auf Tags + Titel
   - S3-Upload wartet auf Video-Komprimierung
   - Cleanup wartet auf S3-Upload

## ⚠️ Bekannte Probleme

- **Timeout bei großen Videos:** TIMEOUT in .env.test erhöhen
- **Auth-Token abgelaufen:** Neu einloggen und Token aktualisieren
- **Redis-Verbindung:** Prüfen ob Redis läuft (`redis-cli ping`)

## 📈 Erwartete Zeiten

Für ein 10-Minuten Video (Full HD):
- Upload: 5-30s (abhängig von Netzwerk)
- Audio-Extraktion: 10-20s
- Video-Komprimierung: 60-180s (parallel)
- Transkription: 30-60s
- AI-Analyse: 10-20s
- S3-Upload: 10-30s
- **Gesamt:** 2-4 Minuten

## 🐛 Fehlerdiagnose

Bei Fehlern prüfen:

1. **Process Status:** 
   ```bash
   curl -H "Authorization: Bearer $AUTH_TOKEN" \
        http://localhost:5000/api/v1/tenants/test-tenant/processes/{processId}/status
   ```

2. **Failed Jobs:**
   ```javascript
   // In test-video-pipeline.js Console
   const failed = await queue.getFailed();
   console.log(failed);
   ```

3. **Worker Logs:**
   Backend-Logs nach Fehlermeldungen durchsuchen

## 🔧 Anpassungen

### Andere Video-Formate testen
In `.env.test`:
```
TEST_VIDEO=./test-videos/sample.avi
```

### Monitoring-Intervall ändern
```
MONITOR_INTERVAL=1000  # Schnellere Updates
```

### Andere API/Tenant testen
```
API_URL=https://staging.process-mind.com
TEST_TENANT_ID=customer-123
```