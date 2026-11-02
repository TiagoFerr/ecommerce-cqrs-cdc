# E-Commerce CQRS & CDC Architecture Lab

Um projeto prático de arquitetura distribuída focado na implementação e evolução progressiva dos padrões **CQRS** (*Command Query Responsibility Segregation*), **Event-Driven Architecture** e **CDC** (*Change Data Capture* via Debezium e Outbox Pattern) utilizando **Node.js**, **TypeScript**, **PostgreSQL**, **MongoDB** e **Docker**.

---

## 🎯 Por que esta arquitetura?

A maioria dos sistemas nasce como um monólito CRUD tradicional onde leituras e escritas compartilham o mesmo banco e o mesmo modelo de dados. Conforme o sistema cresce, surgem conflitos:
1. **Contenção de Recursos**: Relatórios e listagens pesadas de catálogo degradam a performance de checkout e criação de pedidos.
2. **Modelos Conflitantes**: O modelo ideal para escrita (normalizado, ACID, focado em consistência de estoque) é o oposto do modelo ideal para leitura (desnormalizado, agregado, focado em velocidade de busca).
3. **Escala Desbalanceada**: Em e-commerces, a proporção de leitura para escrita costuma ultrapassar 100:1.

Este projeto resolve esses problemas segregando a responsabilidade de comandos (escrita) e consultas (leitura), evoluindo passo a passo para sincronização assíncrona orientada a eventos.

---

## 🗺️ Roadmap de Evolução Arquitetural

| Fase | Descrição | Status | Branch |
| :--- | :--- | :---: | :--- |
| **Fase 1** | **Write Service + PostgreSQL**: Modelagem relacional, Commands, Handlers e transações ACID | 🟢 Concluído | `feature/phase-1-write-service-cqrs` |
| **Fase 2** | **Read Service**: Segregação de Query Handlers no mesmo banco (CQRS a nível de código) | 🟡 Em Breve | `feature/phase-2-read-service` |
| **Fase 3** | **API Gateway**: Roteamento transparente de comandos e queries | ⚪ Planejado | `feature/phase-3-api-gateway` |
| **Fase 4** | **Banco de Leitura Separado**: MongoDB + Worker consumidor + Mensageria assíncrona | ⚪ Planejado | `feature/phase-4-read-db-messaging` |
| **Fase 5** | **CDC com Debezium + Outbox Pattern**: Garantia de entrega atômica sem 2PC (*Two-Phase Commit*) | ⚪ Planejado | `feature/phase-5-cdc-outbox` |
| **Fase 6** | **Observabilidade, Testes & CI/CD**: OpenTelemetry/Prometheus, testes automatizados e GitHub Actions | ⚪ Planejado | `feature/phase-6-observability-ci` |

---

## 🏗️ Visão Geral da Arquitetura (Fase 1)

```mermaid
graph LR
    Client([Cliente / Postman]) -->|POST /products, POST /orders| WS[Write Service (Fastify)]
    subgraph Write Service
        Routes[Routes / Controllers] -->|Command| Handler[Command Handlers]
        Handler -->|ACID Transaction| Prisma[Prisma ORM (Driver Adapter)]
    end
    Prisma -->|TCP Pool| PG[(PostgreSQL 16)]
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos
* Node.js >= 20
* Docker e Docker Compose

### Passo a Passo

1. **Clonar o repositório:**
   ```bash
   git clone https://github.com/SEU_USUARIO/ecommerce-cqrs-cdc.git
   cd ecommerce-cqrs-cdc
   ```

2. **Subir o banco PostgreSQL:**
   ```bash
   docker compose up -d
   ```

3. **Instalar as dependências do monorepo:**
   ```bash
   npm install
   ```

4. **Configurar as variáveis de ambiente e executar migrations:**
   ```bash
   cd services/write-service
   cp .env.example .env
   npx prisma migrate dev
   ```

5. **Iniciar o serviço de escrita:**
   ```bash
   npm run dev
   ```
   O serviço estará disponível em `http://localhost:3001`.

---

## 🧪 Exemplos de Requisição (Write Service)

### 1. Criar Produto
```bash
curl -X POST http://localhost:3001/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teclado Mecânico RGB",
    "description": "Switch Brown silencioso",
    "price": 350.00,
    "stock": 10
  }'
```

### 2. Criar Pedido (com baixa atômica de estoque)
```bash
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Tiago",
    "items": [
      {
        "productId": "<PRODUCT_ID>",
        "quantity": 2
      }
    ]
  }'
```

---

## 🏛️ Decisões Arquiteturais Registradas (ADRs)

* [ADR 001 - Fastify e TypeScript para o Write Service](./docs/adr/001-fastify-typescript.md)
* [ADR 002 - PostgreSQL com Driver Adapter no Prisma 7](./docs/adr/002-prisma-pg-adapter.md)

