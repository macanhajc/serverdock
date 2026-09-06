# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS frontend-builder
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:24-bookworm-slim AS backend-builder
# Safety net for any native dep (bcrypt, better-sqlite3, sharp) without a
# prebuilt binary for this Node/libc combo — the common path is a prebuilt
# download, this just keeps the build from hard-failing if one is missing.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY backend/ ./

FROM node:24-bookworm-slim
ENV NODE_ENV=production
# Matches the documented production install path (see CLAUDE.md / README) —
# app.js and containers.js both rely on this being the *real* path on the
# Docker host too, since docker-compose.yml bind-mounts backend/games here
# 1:1 (see its comments for why an identity mount matters).
WORKDIR /opt/serverdock

COPY --from=backend-builder /src/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/
COPY --from=frontend-builder /src/frontend/dist ./frontend/dist

EXPOSE 4000
CMD ["node", "backend/src/index.js"]
