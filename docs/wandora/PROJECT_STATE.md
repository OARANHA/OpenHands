# Wandora OpenHands — estado inicial e decisões

> Documento da distribuição **Wandora OpenHands**. O repositório continua sendo um fork do OpenHands; as instruções originais em `AGENTS.md`, licenças e decisões do upstream permanecem vigentes.
>
> Atualizado em 2026-10-10. Não usar este documento como substituto de verificar GitHub, código, CI e imagem instalada em tempo real.

## Autoridades e origem

1. [OpenHands original](https://github.com/OpenHands/OpenHands) — upstream do Agent Canvas e orquestração local.
2. [Fork Wandora](https://github.com/OARANHA/OpenHands) — frontend/distribuição independente. A `main` é nossa; o upstream serve apenas como origem histórica e referência técnica. Nunca sincronizar automaticamente.
3. [OpenHands software-agent-sdk](https://github.com/OpenHands/software-agent-sdk) — Python SDK, Agent Server, execução de ferramentas, API e cliente TypeScript.
4. `AGENTS.md`, `docs/DEVELOPMENT.md`, `config/defaults.json` e skills relevantes dentro do checkout.
5. Para todo trabalho: **REAL NOW → PROVEN EVIDENCE → GAPS → REUSE GATE → DECISION**.

## Baseline verificada

| Item | Evidência | Estado em 2026-10-10 |
| --- | --- | --- |
| Relação com upstream | Metadados GitHub `fork=true`, `parent=OpenHands/OpenHands` | Confirmada |
| HEAD de `main` | `e0a26af82f0b2016423c0d53cc9ae32a357cef2d` | Igual ao upstream na verificação |
| Licença do Canvas | `LICENSE` e GitHub | MIT; manter avisos |
| Versões do Canvas | `config/defaults.json` | Agent Server `1.54.0`, Canvas `1.26.0`, Automation `1.19.3`; mínimo Agent Server `1.51.0` |
| VPS Vigia | Verificação de saúde OpenHands via MCP | Saudável na última leitura; versão, digest e caminho de instalação **não comprovados** |
| Fork de SDK Wandora | `OARANHA/software-agent-sdk` | Ainda não encontrado em 2026-10-10 |
| Build Wandora | GHCR | **Nenhuma imagem personalizada verificada** |
| Deploy Wandora | VPS Vigia | **Não realizado** |

## Objetivo da personalização

Operar OpenHands auto-hospedado com Chutes.ai, seleção real dos modelos do provedor e execução segura de ferramentas por perfis de agentes, preservando o restante das funcionalidades OpenHands. Sem reduzir revisão humana ou limites de execução.

### Descoberta de modelos Chutes.ai

**Comportamento observado:** o modal de adição em lote de perfis mostra lista vazia ao selecionar Chutes.ai, embora haja conexão configurada. Quantidade atual de modelos não está confirmada por consulta autenticada neste registro.

**Cadeia existente:**
- `src/components/features/settings/llm-profiles/add-models-modal.tsx` usa `useProviderModels(selectedProvider)`;
- `src/hooks/query/use-provider-models.ts` chama `ConfigService.searchModels`;
- `src/api/config-service/config-service.api.ts` consulta o catálogo local via `LLMMetadataClient.getModels()`;
- `openhands-agent-server/openhands/agent_server/llm_router.py` no SDK oferece `GET /api/llm/models`;
- `openhands-sdk/openhands/sdk/llm/utils/unverified_models.py` usa listas do LiteLLM; uma conexão reconhecida **não garante** catálogo de modelos preenchido.

**Direção:** incorporar descoberta dinâmica no Agent Server (não no navegador), usando a API de modelos do Chutes quando disponível e permitida. Exigir autenticação adequada, timeout, cache, validação, limite de tamanho, normalização/deduplicação de ids `chutes/`, fallback e redigir segredos. Validar o resultado filtrado por `provider=chutes` e **sem filtro**, pois o Canvas chama o endpoint geral. Testar indisponibilidade, retorno vazio e regressões de provedores existentes.

### Chamadas de ferramentas / DSML

**Sintoma observado:** alguns modelos retornam marcadores DSML no texto em vez de efetuar chamadas de ferramentas; não confundir isso com execução confirmada.

**Cadeia proprietária:** `openhands-sdk/openhands/sdk/llm/mixins/fn_call_converter.py`, `non_native_fc.py` e roteamento de respostas no SDK. Analisar respostas reais e configuração do modelo antes de decidir normalização.

**Requisitos:** normalizar somente dados originados de respostas do modelo no fluxo apropriado, validar ferramentas/argumentos contra schemas autorizados, preservar controles de risco e confirmação; nunca interpretar instruções arbitrárias do usuário ou conteúdo externo como chamadas de terminal. Testar payload malformado, chamadas múltiplas, alias `execute_bash` → `terminal` e regressão de native tool calling.

## Distribuição Docker — gate de segurança

`docker/Dockerfile` usa uma imagem de Agent Server como base. Seu `AGENT_SERVER_SDK_GIT_REF` opcional reinstala apenas `openhands-sdk`, `openhands-tools` e `openhands-workspace` a partir de uma URL upstream fixa. Isso **não substitui** alterações em `openhands-agent-server/llm_router.py`. A correção do catálogo exige instalar/empacotar um Agent Server realmente alterado ou usar uma imagem de base construída a partir do fork do SDK, com SHA e versões compatíveis.

**Atenção ao CI herdado:** `.github/workflows/docker.yml` usa por padrão `ghcr.io/openhands/agent-canvas`, aceita `pull_request` de branches do mesmo repositório e executa build com `push: true`. Não abrir PR/acionar publicação até definir um destino **próprio** (ex.: `ghcr.io/oaranha/openhands-wandora`) e um gate explícito de publicação. Preservar permissões mínimas; não criar token novo por conveniência.

## Próximos gates

1. Preparar fork oficial do **software-agent-sdk** (ação separada); registrar seu HEAD real, licenças e contratos.
2. Implementar catálogo Chutes e testes no SDK; verificar que a imagem efetivamente inclui o `openhands-agent-server` alterado.
3. Tratar compatibilidade DSML em slice separado, com evidência por modelo/perfil.
4. No Canvas, adaptar build/pins e publicação GHCR com tags imutáveis e scan/CI; manter `main` revisável e próxima do upstream.
5. Testar manualmente UI/perfis, ferramenta terminal (com confirmação), volumes e rollback em ambiente isolado.
6. **Nenhum deploy/redeploy na VPS, alteração de credenciais ou merge automático sem autorização explícita.** Não fazer polling contínuo de CI.

## Regra de trabalho

Usar branches curtas e PRs **somente entre branches de `OARANHA/*`**, nunca para `OpenHands/*`. Não sincronizar automaticamente o upstream, não executar `Sync fork` e não usar versões mutáveis em builds. Verificações declaradas apenas quando executadas. Tratar `config/defaults.json` como autoridade para versões e preservar as regras de `AGENTS.md`, inclusive a seção `HUMAN:` reservada ao autor humano em descrições de PR.

## Decisão do proprietário — distribuição independente (2026-10-10)

O objetivo é construir e publicar a **imagem própria** `ghcr.io/oaranha/openhands-wandora`, integrando o Agent Server de `OARANHA/software-agent-sdk`. Não há obrigação de acompanhar as novas versões do OpenHands original. Atualizações externas são avaliadas, cherry-picked/adaptadas e testadas **somente por decisão explícita**; nunca se usa sincronização automática.

- Fonte de build: commits exatos dos nossos dois forks, fixados em `config/wandora-image.json` e identificados nas tags/digests.
- `scripts/wandora-build.mjs`: monta localmente a imagem do Agent Server (`source`) e depois o Canvas, sem `git pull`, `docker push`, deploy ou alteração de segredos.
- Os workflows herdados `.github/workflows/server.yml` (SDK) e `.github/workflows/docker.yml` (Canvas) são **manuais** nas branches de adaptação e apontam apenas ao namespace `ghcr.io/oaranha/`. Ainda não foram integrados na `main`.
- Validação pendente: scripts/CI, dois componentes na imagem, funcionalidade Chutes/DSML, auditoria de workflows herdados e preservação da configuração da VPS.
