# syntax=docker/dockerfile:1

# ─── Étape 1 : build (frontend web + déploiement serveur autonome) ───
FROM node:22-bookworm-slim AS builder

# Outils de compilation pour les modules natifs (better-sqlite3, argon2)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable
WORKDIR /repo

# Installation des dépendances du workspace (cache si le lockfile ne change pas)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/package.json
RUN pnpm install --frozen-lockfile

# Code source + build du frontend en mode web (API HTTP)
COPY . .
RUN VITE_API_MODE=http pnpm exec vite build --outDir dist-web

# Déploiement autonome du serveur (node_modules prod réel, modules natifs compilés)
RUN pnpm --filter=horus-server deploy --prod /app

# ─── Étape 2 : image d'exécution ───
FROM node:22-bookworm-slim AS runtime

RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    STATIC_DIR=/app/public \
    COOKIE_SECURE=true

# Serveur autonome + frontend compilé
COPY --from=builder /app /app
COPY --from=builder /repo/dist-web /app/public

# Les données (admin.db + bases par utilisateur) vivent dans un volume
VOLUME /data
EXPOSE 3000

# Arrêt propre : Node reçoit SIGTERM (handler dans src/index.ts)
CMD ["pnpm", "start"]
