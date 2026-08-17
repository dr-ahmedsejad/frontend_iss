# ═══════════════════════════════════════════════════════════════
# STAGE 1 : Build
# Compile Next.js (npm run build) — image lourde, on ne garde pas
# ═══════════════════════════════════════════════════════════════
FROM node:20-alpine AS builder

WORKDIR /app

# Copier d'abord package.json pour profiter du cache Docker
# (les dependances ne sont reinstallees que si package*.json change)
COPY package*.json ./
RUN npm ci

# Copier le code source (filtre par .dockerignore)
COPY . .

# URL de l'API backend, injectee a la build (Next.js inline les NEXT_PUBLIC_*)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# S'assurer que le dossier public existe (Next.js l'attend, meme vide)
RUN mkdir -p public

# Build production
RUN npm run build

# ═══════════════════════════════════════════════════════════════
# STAGE 2 : Runtime
# Image legere, contient juste le build + node_modules production
# ═══════════════════════════════════════════════════════════════
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Copier le build et les deps depuis le stage builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000
CMD ["npm", "start"]
