# E-Commerce CQRS & CDC Architecture Lab

Um projeto prático de arquitetura distribuída focado na implementação e evolução progressiva dos padrões **CQRS** (*Command Query Responsibility Segregation*), **API Gateway Pattern**, **Event-Driven Architecture** e **CDC** (*Change Data Capture* via Debezium e Outbox Pattern) utilizando **Node.js**, **TypeScript**, **PostgreSQL**, **MongoDB** e **Docker**.

---

## 🎯 Por que esta arquitetura?

A maioria dos sistemas nasce como um monólito CRUD tradicional onde leituras e escritas compartilham o mesmo banco e o mesmo modelo de dados. Conforme o sistema cresce, surgem conflitos:
1. **Contenção de Recursos**: Relatórios e listagens pesadas de catálogo degradam a performance de checkout e criação de pedidos.
2. **Modelos Conflitantes**: O modelo ideal para escrita (normalizado, ACID, focado em consistência de estoque) é o oposto do modelo ideal para leitura (desnormalizado, agregado, focado em velocidade de busca).
3. **Escala Desbalanceada**: Em e-commerces, a proporção de leitura para escrita costuma ultrapassar 100:1.
4. **Ponto Único de Entrada vs Topologia de Microsserviços**: O cliente não deve se preocupar com quais portas ou servidores executam cada serviço; um **API Gateway** deve unificar a API pública.

Este laboratório demonstra passo a passo a segregação de responsabilidade entre comandos e consultas, orquestrados por um Gateway transparente.

---

## 🗺️ Roadmap de Evolução Arquitetural

| Fase | Descrição | Status | Branch |
| :--- | :--- | :---: | :--- |
| **Fase 1** | **Write Service + PostgreSQL**: Modelagem relacional, Commands, Handlers e transações ACID | 🟢 Concluído | `feature/phase-1-write-service-cqrs` |
| **Fase 2** | **Read Service**: Segregação de Query Handlers no mesmo banco (CQRS a nível de código/processo) | 🟢 Concluído | `feature/phase-2-read-service` |
| **Fase 3** | **API Gateway**: Roteamento transparente de comandos e queries em porta única (3000) | 🟢 Concluído | `feature/phase-3-api-gateway` |
| **Fase 4** | **Banco de Leitura Separado**: MongoDB + Worker consumidor + Mensageria assíncrona | ⚪ Planejado | `feature/phase-4-read-db-messaging` |
| **Fase 5** | **CDC com Debezium + Outbox Pattern**: Garantia de entrega atômica sem 2PC (*Two-Phase Commit*) | ⚪ Planejado | `feature/phase-5-cdc-outbox` |
| **Fase 6** | **Observabilidade, Testes & CI/CD**: OpenTelemetry/Prometheus, testes automatizados e GitHub Actions | ⚪ Planejado | `feature/phase-6-observability-ci` |

---

## 🏗️ Visão Geral da Arquitetura (Fase 3)

```mermaid
graph TD
    Client([Cliente / Web / Mobile / Postman]) -->|Porta 3000| Gateway[API Gateway - Fastify]

    subgraph "Camada de Microsserviços Internos"
        Gateway -->|POST /products, POST /orders| WS[Write Service - Porta 3001]
        Gateway -->|GET /products, GET /orders/:id| RS[Read Service - Porta 3002]
        
        WS --> CH[Command Handlers: CreateProduct, CreateOrder]
        RS --> QH[Query Handlers: ListProducts, GetProductById, GetOrderById]
    end

    subgraph "Camada de Persistência Relacional"
        CH -->|Transações ACID / Baixa de Estoque| PG[(PostgreSQL 16 - ecommerce_write)]
        QH -->|SELECT / Projeções Agregadas| PG
    end
```

---

## 🚀 Como Executar Localmente

### Opção 1: Execução com Apenas Um Comando (Recomendado)

O projeto está 100% containerizado com Docker Compose e executa as migrações automaticamente:

```bash
docker compose up --build
```

Com apenas este comando, todo o ecossistema distribuído é inicializado:
* **API Gateway (Entrada Unificada)**: `http://localhost:3000`
* **Write Service (Comandos Internos)**: `http://localhost:3001`
* **Read Service (Consultas Internas)**: `http://localhost:3002`
* **PostgreSQL 16**: `localhost:5432`

---

### Opção 2: Execução Manual para Desenvolvimento

1. **Subir o banco PostgreSQL:**
   ```bash
   docker compose up -d postgres
   ```

2. **Instalar dependências e compilar:**
   ```bash
   npm install
   npm run build
   ```

3. **Executar migrações do Prisma no Write Service:**
   ```bash
   cd services/write-service
   npx prisma migrate dev
   ```

4. **Executar os serviços:**
   ```bash
   # Terminal 1 - Write Service (3001)
   npm run dev --workspace=@ecommerce/write-service

   # Terminal 2 - Read Service (3002)
   npm run dev --workspace=@ecommerce/read-service

   # Terminal 3 - API Gateway (3000)
   npm run dev --workspace=@ecommerce/api-gateway
   ```

---

## 🧪 Suíte de Testes Automatizados

O repositório possui **20 testes automatizados** cobrindo regras de negócio, consistência de estoque, projeções e roteamento reverso do Gateway:

```bash
# Executar todos os testes do monorepo
npm test
```

Pipeline contínuo configurado no GitHub Actions em [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

---

## 📬 Coleção de Requisições via API Gateway (Porta 3000)

Importe a coleção completa do Postman:
📁 [`docs/ecommerce-cqrs-cdc.postman_collection.json`](./docs/ecommerce-cqrs-cdc.postman_collection.json)

> **Nota:** Todas as requisições agora apontam diretamente para o **API Gateway** na porta `3000`. O roteamento para o serviço correto de leitura ou escrita ocorre de forma transparente.

### 1. Healthcheck Consolidado do Ecossistema
```bash
curl http://localhost:3000/health
```

### 2. Criar Produto (Command roteado para Write Service)
```bash
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teclado Mecânico RGB",
    "description": "Switch Brown silencioso ABNT2",
    "price": 350.00,
    "stock": 10
  }'
```

### 3. Criar Pedido com Baixa Atômica de Estoque (Command roteado para Write Service)
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Tiago Ferreira",
    "items": [
      {
        "productId": "<PRODUCT_ID>",
        "quantity": 2
      }
    ]
  }'
```

### 4. Listar Produtos com Filtros (Query roteada para Read Service)
```bash
curl "http://localhost:3000/products?search=Teclado&minPrice=100&maxPrice=500"
```

### 5. Consultar Detalhes do Pedido com Projeções Agregadas (Query roteada para Read Service)
```bash
curl "http://localhost:3000/orders/<ORDER_ID>"
```

---

## 🏛️ Decisões Arquiteturais Registradas (ADRs)

* [ADR 001 - Fastify e TypeScript para os Microsserviços](./docs/adr/001-fastify-typescript.md)
* [ADR 002 - PostgreSQL com Driver Adapter no Prisma 7](./docs/adr/002-prisma-pg-adapter.md)
* [ADR 003 - Segregação CQRS no Mesmo Banco Inicial](./docs/adr/003-cqrs-same-database-first.md)
* [ADR 004 - Implementação do API Gateway com Proxy Reverso](./docs/adr/004-api-gateway-reverse-proxy.md)

---

## ⚠️ Limitações e Escopo de Estudo

> **Nota de Transparência:** Este projeto é um laboratório de estudos arquiteturais focado em padrões distribuídos (CQRS, API Gateway, CDC e Event-Driven). Para manter o escopo enxuto e demonstrar as garantias de consistência e mensageria, propositalmente foram omitidas autenticações complexas (OAuth2/JWT) e gateways de pagamento reais. Em um e-commerce em escala real com volume modesto, um CRUD monolítico modularizado poderia ser suficiente; este projeto foi construído para cenários de alta assimetria de leitura/escrita e necessidade de desacoplamento de storage.
