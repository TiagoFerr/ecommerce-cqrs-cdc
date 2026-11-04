# ADR 006: Observabilidade com OpenTelemetry, Jaeger e Resiliência com Dead Letter Queue (DLQ)

## Status
Aceito

## Contexto
Em arquiteturas orientadas a eventos que utilizam CQRS, Transactional Outbox e CDC via Debezium, o fluxo de uma operação não se encerra quando a requisição HTTP retorna `201 Created` para o cliente. 

A escrita inicial ocorre no PostgreSQL e a projeção de leitura é atualizada de forma assíncrona no MongoDB através do Apache Kafka. Essa dissociação temporal (consistência eventual) introduz dois desafios operacionais clássicos:

1. **Invisibilidade da Latência Assíncrona**: Ferramentas convencionais de APM monitoram apenas o ciclo de vida síncrono da requisição HTTP. Quando há atrasos na sincronização entre o banco de escrita e o banco de leitura, fica difícil mensurar quanto tempo a mensagem passou no Write-Ahead Log (WAL), no broker Kafka ou no processamento do worker.
2. **Poison Pills no Consumidor**: Se um evento com formato corrompido ou JSON inválido chegar ao tópico Kafka, o consumidor padrão trava ou entra em loop infinito de retentativas, paralisando a sincronização de todos os outros pedidos e clientes.

## Decisão

Adotamos uma abordagem combinada de rastreabilidade ponta a ponta e contenção de falhas:

### 1. Tracing Distribuído com OpenTelemetry e W3C TraceContext
- **API Gateway**: Intercepta a requisição do cliente. Se o cabeçalho `traceparent` não estiver presente, gera um identificador padrão W3C (`00-${traceId}-${spanId}-01`) e o injeta nos cabeçalhos encaminhados para os serviços downstream.
- **Write Service**: Grava o `traceparent` junto com os dados da entidade dentro da coluna `payload` da tabela `outbox`.
- **Sync Worker**: Ao consumir o evento CDC do Debezium, extrai o `traceparent` do payload e inicia um span filho (`sync-worker:sync-product` ou `sync-worker:sync-order`), conectando o ciclo assíncrono diretamente à requisição HTTP original.
- **Jaeger All-In-One**: Instância local no `docker-compose.yml` que coleta os spans via protocolo padrão OTLP/HTTP (porta 4318) e oferece interface web (porta 16686) para inspecionar a linha do tempo da transação.

### 2. Resiliência e Isolamento de Falhas com Dead Letter Queue (DLQ)
- O `Sync Worker` conta com um produtor Kafka dedicado para a fila de mensagens mortas (`ecommerce.cdc.outbox.dlq`).
- Se uma mensagem contiver JSON inválido ou formato incompatível com a tabela Outbox, ela é despachada imediatamente para o tópico de DLQ com metadados de diagnóstico nos headers (`x-dlq-reason`, `x-dlq-error`, `x-dlq-timestamp`).
- Se a escrita no MongoDB falhar por timeout ou erro transitório, após a falha ela é roteada para a DLQ, liberando o commit do offset para que as próximas mensagens saudáveis continuem sendo processadas sem interrupção.

### 3. Aferição Automatizada de Consistência Eventual (E2E)
- Criado o script `scripts/verify-e2e.ts` (`npm run verify:e2e`), que simula um ciclo completo de compra no ecossistema e mede o tempo exato (lag em milissegundos) que o MongoDB leva para refletir a mutação realizada no PostgreSQL.

## Consequências

### Positivas
- **Rastreamento Unificado**: Visibilidade completa do caminho percorrido pelo dado, desde a entrada no Gateway até o salvamento no banco orientado a documentos.
- **Proteção Contra Travamentos**: Falhas em mensagens específicas não bloqueiam a esteira de sincronização do e-commerce.
- **Diagnóstico Transparente**: Recrutadores e engenheiros podem inspecionar o Jaeger ou rodar o script E2E para constatar a consistência eventual e o lag de replicação em tempo real.

### Trade-offs
- Pequeno acréscimo de memória operacional para executar o Jaeger em ambiente local (~40MB).
- Necessidade de monitorar e reprocessar mensagens que caem no tópico de DLQ em um ambiente de produção real.
