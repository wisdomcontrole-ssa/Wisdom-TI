# Wisdom TI — M09 V2 — UX do Agente

## Objetivo

Eliminar PowerShell do fluxo normal de instalação do agente Windows e expor no patrimônio os dados já coletados de armazenamento e software.

## Instalação normal

Arquivo universal:

`WisdomTI-Agent-Setup.exe`

O mesmo arquivo pode ser usado em todos os computadores.

Fluxo:

1. No Wisdom TI, abrir o ativo.
2. Criar ou rotacionar o token do agente.
3. Levar `WisdomTI-Agent-Setup.exe` para a máquina.
4. Dar dois cliques.
5. Autorizar UAC.
6. Colar o token.
7. Clicar **Instalar**.

O instalador:

- embute o executável real do agente;
- grava `%ProgramData%\WisdomTI\Agent`;
- protege a pasta com ACL;
- configura inicialização automática;
- configura heartbeat de 15 minutos;
- executa a primeira coleta;
- informa sucesso/erro em interface gráfica.

PowerShell fica apenas como mecanismo de fallback para TI avançado.

## Segurança

- o instalador universal não contém token;
- o token continua individual por agente;
- a credencial pode ser rotacionada/revogada;
- `service_role` e credenciais administrativas não entram no agente;
- token salvo em ProgramData fica protegido por ACL para SYSTEM/Administradores;
- HTTPS obrigatório.

## Inventário exibido

A ficha do ativo passa a mostrar:

- SO/build/arquitetura;
- CPU;
- RAM;
- hostname;
- fabricante/modelo;
- serial;
- armazenamento por volume;
- capacidade;
- usado/livre;
- identificação do volume do sistema;
- programas instalados;
- versão;
- fabricante/publisher;
- busca na lista completa.

## Observação

A captura funcional anterior já mostrou `89 softwares · 1 volumes`, portanto esses dados já chegavam ao snapshot. M09 V2 altera principalmente a experiência de instalação e a visualização desses dados; não requer migração SQL nem novo deploy de Edge Functions.
