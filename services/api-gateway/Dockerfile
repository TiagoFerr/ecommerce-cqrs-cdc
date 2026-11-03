FROM node:22-alpine AS builder

WORKDIR /app

# Instalação de dependências respeitando o monorepo
COPY package*.json ./
COPY services/api-gateway/package*.json ./services/api-gateway/

RUN npm ci

# Cópia do código-fonte do API Gateway
COPY services/api-gateway ./services/api-gateway

WORKDIR /app/services/api-gateway
RUN npm run build

# Stage de execução final (leve e seguro)
FROM node:22-alpine AS runner

WORKDIR /app

COPY --from=builder /app /app

WORKDIR /app/services/api-gateway

EXPOSE 3000

CMD ["node", "dist/index.js"]
