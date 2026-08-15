# syntax=docker/dockerfile:1

#############################
# Бэкенд: установка зависимостей и сборка (tsc → dist)
#############################
FROM node:22-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

#############################
# Бэкенд: только prod-зависимости для runtime-образа
#############################
FROM node:22-alpine AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

#############################
# Фронтенд: установка и сборка (Vite → dist)
#############################
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

#############################
# Runtime: один Node-процесс раздаёт SPA + /v1 API на PORT
#############################
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=frontend-build /app/frontend/dist ./static

ENV STATIC_DIR=/app/static
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/v1/call-types" >/dev/null 2>&1 || exit 1

CMD ["node", "dist/index.js"]