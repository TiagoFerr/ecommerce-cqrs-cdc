# ADR 001: Fastify e TypeScript para os Microsserviços

## Status
Aceito

## Contexto
O projeto divide as operações em microsserviços que se comunicam via HTTP. Precisamos de uma stack que garanta contratos rígidos de dados entre comandos e consultas, com inicialização rápida e baixo consumo de memória em contêineres Docker.

O Express continua sendo o framework mais popular do Node.js, mas carrega limitações antigas:
* Não trata erros em funções assíncronas nativamente (exige wrappers manuais ou middlewares extras para evitar que o processo trave em promises rejeitadas).
* A serialização de JSON e o roteamento são mais lentos por não compilarem schemas previamente.
* Não inclui logging estruturado por padrão.

## Decisão
Adotamos **TypeScript** e **Fastify** para todos os serviços internos e para o gateway.

### Motivos práticos:
* **Suporte nativo a async/await**: o ciclo de vida de requisição do Fastify foi desenhado para promises, capturando erros sem código defensivo adicional.
* **Logs estruturados com Pino**: o Fastify já vem com o Pino integrado, gerando logs em formato JSON prontos para ferramentas de observabilidade sem overhead extra.
* **Serialização rápida**: o compilador interno de schemas (`fast-json-stringify`) agiliza a resposta de endpoints com payloads repetitivos.
* **Tipagem de ponta a ponta**: interfaces compartilhadas de comandos, DTOs de leitura e respostas HTTP evitam erros comuns de tipagem em tempo de execução.

## Consequências
### Positivas
* Menos código boilerplate para tratar erros e middlewares.
* Baixo consumo de memória por container (~40MB em repouso).
* Contratos explícitos entre o que entra na rota e o que o handler recebe.

### Negativas / Trade-offs
* O ecossistema de bibliotecas e plugins da comunidade para Express ainda é maior. Para as necessidades deste projeto (proxy, CORS, validação básica), os plugins oficiais do Fastify cobrem tudo sem necessidade de pacotes obscuros.
