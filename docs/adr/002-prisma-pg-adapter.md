# ADR 002: PostgreSQL com Driver Adapter no Prisma 7

## Status
Aceito

## Contexto
O `write-service` é responsável pela criação de produtos e checkout de pedidos. O checkout precisa garantir:
1. Validação de estoque disponível antes da compra.
2. Baixa atômica no estoque do produto.
3. Criação do pedido e dos itens associados.
4. Rollback imediato se qualquer item falhar ou se o estoque acabar durante a transação.

Historicamente, o Prisma usava um engine em Rust para gerenciar conexões com o banco através de um socket interno. Em arquiteturas com múltiplos microsserviços rodando em containers separados, isso dificultava limitar o número exato de conexões TCP que cada processo abria no PostgreSQL.

## Decisão
Usamos o **Prisma 7** configurado com **Driver Adapter** (`@prisma/adapter-pg`), utilizando diretamente o pool da biblioteca `pg` do Node.js.

### Motivos práticos:
* **Controle direto do pool de conexões**: definimos parâmetros de conexões máximas (`max`) e timeouts de ociosidade diretamente no driver Node.js, evitando estourar o limite de conexões do PostgreSQL quando vários serviços sobem simultaneamente.
* **Transações interativas tipadas**: usamos `prisma.$transaction(async (tx) => { ... })`, garantindo que o abatimento de estoque e a gravação do pedido ocorram sob a mesma transação ACID, sem precisar de SQL manual com `BEGIN/COMMIT`.
* **Migrações reproduzíveis**: o histórico de alterações no banco fica versionado em arquivos SQL dentro de `prisma/migrations`, facilitando a execução automática em ambientes de teste e Docker.

## Consequências
### Positivas
* Comportamento previsível de conexões TCP entre o Node.js e o PostgreSQL.
* Rollback garantido em caso de estoque insuficiente ou erros no checkout.
* Schema relacional fortemente tipado no TypeScript.

### Negativas / Trade-offs
* O setup inicial é um pouco mais verboso, pois exige instanciar o `Pool` do `pg`, envelopar no adaptador do Prisma e passá-lo ao `PrismaClient`. Centralizamos essa lógica em `infrastructure/prisma.ts` para que os handlers não precisem lidar com detalhes de conexão.
