FROM node:22-alpine AS builder

WORKDIR /app

# Instalação de dependências respeitando o monorepo
COPY package*.json ./
COPY services/read-service/package*.json ./services/read-service/

RUN npm ci

# Cópia do código-fonte do serviço de leitura
COPY services/read-service ./services/read-service

WORKDIR /app/services/read-service
RUN npx prisma generate
RUN npm run build

# Stage de execução final (leve e seguro)
FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app /app

WORKDIR /app/services/read-service

EXPOSE 3002

CMD ["node", "dist/index.js"]
