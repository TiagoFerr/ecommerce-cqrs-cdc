# E-Commerce CQRS & CDC Architecture Lab

Laboratório de arquitetura distribuída demonstrando a implementação progressiva dos padrões **CQRS** (*Command Query Responsibility Segregation*), **API Gateway**, **Event-Driven Architecture** e **CDC** (*Change Data Capture* via Debezium e Outbox Pattern) utilizando Node.js, TypeScript, PostgreSQL, MongoDB e Docker.

---

## 🎯 O Problema que a Arquitetura Resolve

Em aplicações de comércio eletrônico, a proporção entre consultas de catálogo e compras reais costuma ultrapassar 100 para 1. 

Manter leituras e escritas no mesmo banco relacional traz gargalos conhecidos:
* **Concorrência de recursos**: consultas pesadas de busca e relatórios competem por CPU, memória e conexões com o checkout e a baixa de estoque.
* **Modelos de dados opostos**: a escrita exige dados normalizados para garantir integridade e evitar inconsistências (ACID). A leitura se beneficia de dados desnormalizados e agregados para responder rápido sem múltiplos JOINs.
* **Topologia interna exposta**: se o cliente precisar falar com portas e serviços diferentes para ler ou comprar, qualquer mudança no backend quebra o frontend.

Este projeto resolve esses pontos separando as rotas de comando das rotas de consulta, unificadas por um API Gateway.

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

## 🏗️ Visão da Arquitetura Atual (Fase 3)

```mermaid
graph TD
    Client([Cliente / Web / Mobile / Postman]) -->|Porta 3000| Gateway[API Gateway - Fastify]

    subgraph "Serviços Internos"
        Gateway -->|POST /products, POST /orders| WS[Write Service - 3001]
        Gateway -->|GET /products, GET /orders/:id| RS[Read Service - 3002]
        
        WS --> CH[Command Handlers: CreateProduct, CreateOrder]
        RS --> QH[Query Handlers: ListProducts, GetProductById, GetOrderById]
    end

    subgraph "Persistência Relacional"
        CH -->|Transações ACID / Baixa de Estoque| PG[(PostgreSQL 16 - ecommerce_write)]
        QH -->|SELECT / Projeções Agregadas| PG
    end
```

---

## 🚀 Como Executar Localmente

### Opção 1: Executar com Um Comando (Recomendado)

O projeto está configurado no Docker Compose e roda as migrações automaticamente:

```bash
docker compose up --build
```

Serviços disponíveis após inicialização:
* **API Gateway (Entrada única)**: `http://localhost:3000`
* **Write Service (Comandos internos)**: `http://localhost:3001`
* **Read Service (Consultas internas)**: `http://localhost:3002`
* **PostgreSQL**: `localhost:5432`

---

### Opção 2: Execução Manual para Desenvolvimento

1. **Subir o PostgreSQL:**
   ```bash
   docker compose up -d postgres
   ```

2. **Instalar dependências e compilar:**
   ```bash
   npm install
   npm run build
   ```

3. **Rodar migrações do Prisma:**
   ```bash
   cd services/write-service
   npx prisma migrate dev
   ```

4. **Iniciar os serviços:**
   ```bash
   # Terminal 1 - Write Service (3001)
   npm run dev --workspace=@ecommerce/write-service

   # Terminal 2 - Read Service (3002)
   npm run dev --workspace=@ecommerce/read-service

   # Terminal 3 - API Gateway (3000)
   npm run dev --workspace=@ecommerce/api-gateway
   ```

---

## 🧪 Testes Automatizados

O monorepo conta com **20 testes automatizados** cobrindo regras de negócio, transações com rollback, projeções e roteamento reverso:

```bash
npm test
```

Pipeline contínuo configurado no GitHub Actions em [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

---

## 📬 Exemplos de Requisição via API Gateway (Porta 3000)

Importe a coleção do Postman:
📁 [`docs/ecommerce-cqrs-cdc.postman_collection.json`](./docs/ecommerce-cqrs-cdc.postman_collection.json)

> **Observação:** Todas as chamadas apontam para a porta `3000`. O Gateway inspeciona o método HTTP e encaminha a requisição para o serviço correto.

### 1. Healthcheck Consolidado
```bash
curl http://localhost:3000/health
```

### 2. Criar Produto (Command -> Write Service)
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

### 3. Criar Pedido com Baixa de Estoque (Command -> Write Service)
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

### 4. Listar Produtos com Filtros (Query -> Read Service)
```bash
curl "http://localhost:3000/products?search=Teclado&minPrice=100&maxPrice=500"
```

### 5. Consultar Pedido com Projeções Agregadas (Query -> Read Service)
```bash
curl "http://localhost:3000/orders/<ORDER_ID>"
```

---

## 🏛️ Decisões Arquiteturais (ADRs)

* [ADR 001 - Fastify e TypeScript para os Microsserviços](./docs/adr/001-fastify-typescript.md)
* [ADR 002 - PostgreSQL com Driver Adapter no Prisma 7](./docs/adr/002-prisma-pg-adapter.md)
* [ADR 003 - CQRS a Nível de Código no Mesmo Banco Inicial](./docs/adr/003-cqrs-same-database-first.md)
* [ADR 004 - API Gateway com Fastify e Proxy Reverso](./docs/adr/004-api-gateway-reverse-proxy.md)

---

## ⚠️ Escopo e Limitações

Para um e-commerce pequeno ou com volume moderado de acessos, adotar microsserviços distribuídos com CQRS e mensageria seria overengineering — um monolito modular bem estruturado resolveria o problema com menos custo operacional. 

Este projeto foi construído como um laboratório prático para estudar e demonstrar padrões de arquitetura distribuída onde a separação física entre leitura e escrita é realmente necessária. Autenticação complexa (OAuth2/JWT) e gateways de pagamento externos foram deliberadamente deixados fora para manter o foco estritamente na arquitetura de dados e mensageria.
