# Wisdom TI — M09 — Testes V2

## Estado antes do teste

- SQL M09 aplicado.
- `agent-admin` e `agent-ingest` publicados.
- agente real já comprovado online.
- M09 V2 não altera banco nem Edge Functions.

## 1. Instalar M09 V2

Executar o instalador de código entregue para a revisão.

Esperado:

- frontend build OK;
- lint 0 errors;
- .NET 10 OK;
- `WisdomTI-Agent-Setup.exe` gerado em Downloads.

## 2. Interface do patrimônio

Abrir um ativo com snapshot.

Validar:

- sistema;
- CPU;
- RAM;
- hostname;
- fabricante/modelo;
- serial;
- armazenamento;
- capacidade total por volume;
- espaço usado;
- espaço livre;
- volume do sistema;
- programas instalados;
- botão `Ver todos`;
- busca de programa;
- versão;
- fabricante/publisher.

## 3. Instalação gráfica

Na ficha do ativo:

1. Rotacionar o token para o teste.
2. Copiar o novo token.
3. Na máquina, abrir `WisdomTI-Agent-Setup.exe` com dois cliques.
4. Aceitar UAC.
5. Colar token.
6. Clicar Instalar.

Não abrir PowerShell.

Esperado:

- mensagem `Instalação concluída com sucesso`;
- agente volta a aparecer Online;
- heartbeat atualizado;
- nova coleta registrada.

## 4. Persistência

Reiniciar a máquina ou aguardar o heartbeat.

Esperado:

- tarefa de startup executa;
- heartbeat continua automático;
- inventário permanece atualizando.

## 5. Segurança

Validar:

- instalador não possui token embutido;
- token antigo rotacionado deixa de funcionar;
- token não é exibido em log;
- agente não contém service_role;
- pasta ProgramData não é acessível a usuário comum.

## 6. SmartScreen

Enquanto o executável não tiver assinatura digital, o Windows pode exibir SmartScreen em algumas máquinas. Isso não é falha do agente. Assinatura de código será tratada no hardening/produção.

## Critério M09 V2 OK

Responder:

`M09 V2 UX OK`

somente após:

- instalador gráfico usado sem PowerShell;
- primeira coleta pelo instalador gráfico OK;
- armazenamento visível;
- programas visíveis/pesquisáveis;
- agente Online após a reinstalação.
