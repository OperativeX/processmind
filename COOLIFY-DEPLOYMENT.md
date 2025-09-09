# ProcessLink Coolify Deployment Guide

## 🚀 Quick Start

### 1. Vorbereitung
- MongoDB Server bereits eingerichtet ✓
- Coolify Account und Server bereit
- GitHub Repository verbunden

### 2. In Coolify

#### Neue Resource erstellen:
1. **Add Resource** → **Docker Image** oder **GitHub Repository**
2. Repository URL eingeben
3. **Build Pack**: Docker

#### Build Konfiguration:
```
Dockerfile Name: Dockerfile.coolify
Docker Context: .
```

#### Environment Variables (ERFORDERLICH):
```bash
MONGODB_URI=mongodb://user:pass@dein-mongodb-server:27017/process-mind
JWT_SECRET=generiere-einen-sicheren-32-zeichen-string
OPENAI_API_KEY=sk-dein-openai-key
```

#### Port Configuration:
- **Port**: 5001
- **Expose Port**: aktivieren

#### Health Check anpassen:
- **Health Check Path**: /health
- **Health Check Interval**: 60
- **Health Check Timeout**: 30
- **Health Check Retries**: 10
- **Health Check Start Period**: 180

### 3. Deploy
1. **Save** alle Einstellungen
2. **Deploy** klicken
3. Logs beobachten
4. Warten bis Health Check grün wird (kann 3-5 Minuten dauern)

## 📝 Was passiert beim Start?

1. Redis startet lokal im Container
2. Backend wartet auf Redis
3. Nginx startet und serviert das Frontend
4. Backend verbindet sich mit deinem externen MongoDB
5. Alles läuft auf Port 5001

## 🔍 Debugging

### Container startet nicht:
```bash
# In Coolify Logs schauen für:
"[BACKEND] ERROR: MONGODB_URI is required!"
"[BACKEND] ERROR: JWT_SECRET is required!"
```

### Health Check failed:
- Start Period auf 300 Sekunden erhöhen
- Timeout auf 60 Sekunden erhöhen

### MongoDB Connection Error:
- Firewall Rules prüfen
- MongoDB erlaubt externe Verbindungen?
- Connection String korrekt?

## 📋 Deployment Checkliste

- [ ] `.dockerignore.coolify` zu `.dockerignore` umbenennen
- [ ] Environment Variables in Coolify gesetzt
- [ ] Port 5001 konfiguriert
- [ ] Health Check Timeouts erhöht
- [ ] MongoDB Server erreichbar

## 🎯 Nach erfolgreichem Deployment

1. **Frontend testen**: https://deine-app.coolify.app
2. **API testen**: https://deine-app.coolify.app/api/v1/health
3. **Registrierung testen**: Neuen User anlegen
4. **Video Upload**: Kleine Testdatei hochladen

## ⚡ Performance Tipps

- **Resource Limits**: Mindestens 2GB RAM, 2 CPUs
- **Disk Space**: 10GB für Video-Uploads
- **Restart Policy**: "Unless Stopped"

## 🆘 Notfall-Kommandos

Falls du SSH-Zugang zum Coolify Server hast:
```bash
# Container Logs
docker logs <container-id> --tail 100

# In Container schauen
docker exec -it <container-id> sh

# Redis testen
docker exec -it <container-id> redis-cli ping

# Backend Logs
docker exec -it <container-id> tail -f /app/backend/logs/app.log
```