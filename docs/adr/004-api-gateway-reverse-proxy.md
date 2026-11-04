# ADR 004: API Gateway com Fastify e Proxy Reverso

## Status
Aceito

## Contexto
Com a separação física entre `write-service` (porta 3001) e `read-service` (porta 3002), surgiu o problema de como o frontend ou aplicativos móveis devem consumir a API.

Sem uma camada intermediária:
* O cliente precisaria conhecer as portas de cada serviço e alternar URLs base para ler ou escrever dados.
* Configurações de CORS precisariam ser duplicadas em cada microsserviço.
* Se a porta ou o host de um serviço mudar, o frontend quebra.

## Decisão
Implementamos um **API Gateway** na pasta `services/api-gateway` rodando na porta `3000`, usando **Fastify** com os plugins `@fastify/http-proxy` e `@fastify/cors`.

O roteamento funciona inspecionando o método HTTP:
* Requisições mutativas (`POST /products`, `POST /orders`) são repassadas ao `write-service`.
* Consultas (`GET /products`, `GET /orders/:id`) são repassadas ao `read-service`.

```mermaid
graph TD
    Client([Cliente / Web / Mobile]) -->|Porta 3000| Gateway[API Gateway - Fastify]
    
    Gateway -->|POST (Commands)| WS[Write Service - 3001]
    Gateway -->|GET (Queries)| RS[Read Service - 3002]
    
    WS --> PG[(PostgreSQL)]
    RS --> PG
```

### Por que Fastify e não Nginx ou Kong neste momento?
* **Testes rápidos no CI**: como o gateway é uma aplicação Node/TypeScript, podemos testar o roteamento de ponta a ponta com `app.inject()` no pipeline do GitHub Actions em frações de segundo, sem precisar subir containers auxiliares de Nginx só para rodar testes.
* **Manutenção na mesma stack**: a equipe trabalha com a mesma linguagem (TypeScript), facilitando a leitura e a evolução do código.
* **Streaming nativo**: o plugin `@fastify/http-proxy` usa o motor `fast-proxy`, transmitindo payloads por streams sem carregar o corpo inteiro da requisição na memória do processo.
* **Healthcheck centralizado**: o endpoint `GET /health` do gateway faz requisições paralelas para os serviços downstream e retorna se o ecossistema está operando normalmente ou em modo degradado.

## Consequências
### Positivas
* O cliente consome apenas uma URL base (`http://localhost:3000`).
* Políticas de CORS centralizadas em um só lugar.
* Isolamento: mudanças internas nos serviços de leitura ou escrita não afetam o cliente externo.

### Negativas / Trade-offs
* Existe um salto de rede adicional entre o cliente e o serviço final. Em redes locais e contêineres Docker, o impacto medido é inferior a 1ms, o que é desprezível diante da flexibilidade obtida.
