# ADR 002: Adoção do Prisma com Driver Adapter (@prisma/adapter-pg) no PostgreSQL

## Status
Aceito

## Contexto
O serviço de escrita (`write-service`) lida com criação de produtos e checkout de pedidos. Essa operação envolve:
1. Verificação de estoque concorrente.
2. Baixa atômica de saldo no estoque.
3. Criação do cabeçalho do pedido e de cada item associado.
4. Rollback imediato se qualquer item falhar (garantias ACID).

O Prisma tradicional utiliza um engine nativo em Rust que gerencia as conexões internamente. Contudo, em ambientes de microsserviços modernos e com foco em alta eficiência de conexões no ecossistema Node.js, é desejável ter controle granular sobre o pool de conexões TCP via driver `pg` nativo.

## Decisão
Utilizamos o **Prisma ORM** com a funcionalidade de **Driver Adapters** (`@prisma/adapter-pg` integrado ao pool da biblioteca `pg`).

### Por que esta abordagem?
* **Pool de Conexões Especializado**: Permite configurar `max`, `idleTimeoutMillis` e `connectionTimeoutMillis` diretamente no driver `pg` do Node.js, respeitando limites de conexões do PostgreSQL em ambientes com múltiplos containers.
* **Segurança de Migrations**: O Prisma CLI gerencia migrações SQL declarativas e reproduzíveis (`prisma/migrations`), facilitando a automação em CI/CD e testes.
* **Transações Interativas Fortemente Tipadas**: `prisma.$transaction(async (tx) => { ... })` garante isolamento serializado ou read committed previsível com tipagem estrita para o schema relacional.

## Consequências
### Positivas
* Gestão transparente de conexões TCP entre Node.js e o PostgreSQL 16.
* Tipagem automática dos modelos `Product`, `Order` e `OrderItem`.
* Rastreamento e log de queries SQL diretamente no console durante o desenvolvimento.

### Negativas / Mitigações
* A configuração exige instanciar explicitamente o `Pool` e o adaptador antes de passar ao `PrismaClient`. Esse setup foi encapsulado no arquivo de infraestrutura (`infrastructure/prisma.ts`).
