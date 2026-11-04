FROM node:22-alpine AS builder

WORKDIR /app

# Instalação de dependências respeitando o monorepo
COPY package*.json ./
COPY services/write-service/package*.json ./services/write-service/

RUN npm ci

# Cópia do código-fonte do serviço de escrita
COPY services/write-service ./services/write-service

WORKDIR /app/services/write-service
RUN npx prisma generate
RUN npm run build

# Stage de execução final (leve e seguro)
FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app /app

WORKDIR /app/services/write-service

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
