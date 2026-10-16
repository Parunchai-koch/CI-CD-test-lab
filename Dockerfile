# Digest resolved for node:24-bookworm-slim on 2026-10-15. Update deliberately after review.
FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci

COPY frontend frontend
RUN npm run build --workspace frontend

FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ARG VCS_REF=unknown
ARG VCS_SOURCE=unknown
LABEL org.opencontainers.image.source=$VCS_SOURCE \
      org.opencontainers.image.revision=$VCS_REF

# npm reads the one root lockfile, selects only backend, and omits dev dependencies.
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci --omit=dev --workspace=@task-app/backend --include-workspace-root=false \
    && npm cache clean --force \
    && npm ls --omit=dev --workspace=@task-app/backend

COPY --chown=node:node backend/src backend/src
COPY --from=build --chown=node:node /app/frontend/dist backend/public

USER node
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))"
CMD ["node", "backend/src/server.js"]
