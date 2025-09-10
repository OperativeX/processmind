# ProcessLink verwendet Docker Compose für Multi-Service Deployment
# Bitte verwende die Docker Compose Option in Coolify mit der docker-compose.yml

# Falls Coolify ein Dockerfile erwartet, hier ein Hinweis-Container:
FROM alpine:latest
RUN echo "Dieses Projekt verwendet Docker Compose. Bitte konfiguriere Coolify für Docker Compose Deployment."
CMD ["echo", "Bitte verwende docker-compose.yml für das Deployment"]