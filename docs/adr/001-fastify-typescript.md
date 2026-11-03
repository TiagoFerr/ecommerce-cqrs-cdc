# ADR 001: Escolha do Fastify e TypeScript para os Microsserviços

## Status
Aceito

## Contexto
Para um projeto que visa demonstrar padrões avançados de arquitetura de software (CQRS, Event-Driven, CDC), a escolha do runtime e do framework HTTP deve priorizar:
1. **Baixa latência e alto throughput**: Microsserviços distribuídos realizam chamadas constantes entre si e com clientes.
2. **Segurança de tipos em tempo de compilação**: O fluxo de dados entre *Commands*, *Queries*, *DTOs* e o banco de dados deve ser fortemente tipado para evitar erros de runtime em produção.
3. **Ergonomia e ecossistema**: Suporte nativo a validação por schemas (JSON Schema), logging de alta performance (Pino) e ciclo de vida de plugins claro.

## Decisão
Adotamos **TypeScript** como linguagem padrão em todo o monorepo e **Fastify** como framework HTTP tanto para o `write-service` quanto para o `read-service`.

### Por que Fastify e não Express?
* **Performance e Overhead**: O Fastify é até 2x mais rápido que o Express em benchmarks reais de throughput e serialização JSON, devido ao seu compilador interno de schema (`fast-json-stringify`).
* **Ecossistema Moderno**: Suporte nativo a async/await sem necessidade de middleware para capturar erros em promises rejeitadas (problema crônico do Express 4).
* **Logging Estruturado Integrado**: O Fastify vem com o logger `pino` por padrão, crucial para observabilidade e rastreamento em arquiteturas distribuídas.
* **Encapsulamento de Plugins**: O modelo de plugins do Fastify permite organizar rotas e dependências com injeção limpa de contexto.

## Consequências
### Positivas
* Tipagem de ponta a ponta desde os controllers/routes até os handlers e repositórios Prisma.
* Inicialização rápida dos containers e baixo consumo de memória (~40MB por instância).
* Logs em JSON estruturados prontos para ingestão em stacks de observabilidade (ex: Loki/ELK).

### Negativas / Mitigações
* A comunidade do Express ainda é maior em tutoriais legados, porém o Fastify já é o padrão moderno no ecossistema Node.js corporativo.
