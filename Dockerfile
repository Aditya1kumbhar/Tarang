# ==============================================================================
# STAGE 1: Build React Frontend
# ==============================================================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
ARG VITE_CARTO_API_KEY
ENV VITE_CARTO_API_KEY=$VITE_CARTO_API_KEY
RUN npm run build

# ==============================================================================
# STAGE 2: Python Backend Runtime
# ==============================================================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Install security updates and curl for container healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code, seed geospatial data, and configuration
COPY backend/ ./backend/
COPY pytest.ini ./

# Copy built frontend from Stage 1 into the location expected by main.py
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Security hardening: run as non-root user (Rule #10, #15)
RUN useradd -m -u 1000 orcauser && \
    chown -R orcauser:orcauser /app
USER orcauser

ENV PORT=8000
ENV ENV=production
ENV ENVIRONMENT=production
ENV ALLOWED_ORIGINS=https://tarang-0v0t.onrender.com
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/v1/health || exit 1

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT} --workers 1 --no-server-header"]

