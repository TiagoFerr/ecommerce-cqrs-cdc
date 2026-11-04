FROM node:22-alpine AS builder

WORKDIR /app

# Instalação de dependências respeitando o monorepo
COPY package*.json ./
COPY services/sync-worker/package*.json ./services/sync-worker/

RUN npm ci

# Cópia do código-fonte do sync-worker
COPY services/sync-worker ./services/sync-worker

WORKDIR /app/services/sync-worker
RUN npm run build

# Stage de execução final
FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app /app

WORKDIR /app/services/sync-worker

CMD ["node", "dist/index.js"]
