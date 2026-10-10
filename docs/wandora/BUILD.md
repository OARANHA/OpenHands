# Compilação da imagem Wandora OpenHands

A distribuição **Wandora OpenHands** é independente dos repositórios `OpenHands/*`. A origem do fork é preservada apenas por licença, autoria e proveniência. Não execute `Sync fork` ou merge automático do upstream; modificações futuras são decididas e testadas internamente.

## Repositórios de build

- `OARANHA/software-agent-sdk`: Python Agent Server e SDK **nossos**, construídos do checkout local no commit `config/wandora-image.json:sdkCommit`
- `OARANHA/OpenHands`: Canvas e orquestração **nossos**, construídos do checkout local limpo
- Componente: `ghcr.io/oaranha/wandora-agent-server`
- Produto all-in-one: `ghcr.io/oaranha/openhands-wandora`

O SDK é compilado primeiro (target `source`); depois o Canvas usa a imagem do Agent Server criada localmente. O comando não faz `git clone`, `git pull`, `git push`, `docker push` ou deploy.

## Pré-requisitos locais

Docker Engine/BuildKit funcional, Git, Node.js 24 e espaço em disco para compilar frontend, SDK e imagens. O SDK exige runtime Python 3.13 no seu Dockerfile, que é instalado dentro da imagem.

Use dois checkouts separados com os arquivos sob revisão:

```bash
git clone https://github.com/OARANHA/OpenHands.git
git clone https://github.com/OARANHA/software-agent-sdk.git

cd OpenHands
git switch build/wandora-owned-image
cd ../software-agent-sdk
git switch build/wandora-owned-image
cd ../OpenHands

node scripts/wandora-build.mjs ../software-agent-sdk
```

**Nota:** após alterações no SDK, atualize `config/wandora-image.json` com o commit SHA completo previamente revisado e confirme o HEAD do checkout. O script bloqueia divergências de commit, repositório de origem, pasta sem Git, working tree suja, imagens fora do namespace Wandora ou versão do Agent Server diferente da exigida pelo Canvas.

O tag gerado da imagem final tem formato `ghcr.io/oaranha/openhands-wandora:canvas-<sha>-sdk-<sha>`. É um **tag local** até que uma publicação separada seja aprovada e executada. O digest de conteúdo do registro, após publicação, é a referência preferencial para deployments reproduzíveis.

## Política de CI/CD

As alterações nesta branch configuram os workflows herdados de publicação somente para `workflow_dispatch`; a saída é sempre `ghcr.io/oaranha/*`. O workflow Canvas rejeita uso de Agent Server externo e exige tag de SHA Wandora ou digest. Não rodar workflows herdados de lançamento/release sem auditá-los.

Antes de qualquer publicação:

1. Rodar `uv run pytest tests/agent_server` e os testes relevantes do SDK após implementar Chutes/DSML; executar os checks do Canvas (`npm ci`, `npm run lint`, `npm test`, `npm run build`).
2. Validar instalação real do Agent Server modificado dentro da imagem, `/health`, `/api/llm/models` e ferramentas com confirmação.
3. Verificar compatibilidade, limite de recursos, tags/digest, SBOM e rollback.
4. Somente então autorizar publicação da imagem própria. **Publicação no GHCR não é deploy na VPS.** Deploy exige autorização distinta.

## Limitações atuais (não confundir com build final)

- Nenhuma imagem Wandora foi construída ou publicada na data de elaboração deste documento.
- As correções de descoberta de modelos Chutes e DSML ainda serão implementadas no SDK; o build inicial apenas garante proveniência dos dois forks.
- O Dockerfile herdado ainda instala `openhands-automation` da versão fixa em `config/defaults.json` e obtém suas dependências Python: confirmar compatibilidade e origem efetiva dos pacotes desse processo; o Agent Server principal usa o checkout Wandora dentro de `/agent-server/.venv`.
- O upstream usa imagens-base de sistema com algumas referências sem digest imutável. O código Git está fixado, mas builds independentes podem resolver imagens ou pacotes de sistema diferentes. Fazer hardening com digest e cache interno antes de declarar builds bit a bit reproduzíveis.

## Build e publicação pelo GitHub Actions (sem token novo)

O workflow `.github/workflows/wandora-image.yml` é **apenas manual** e usa a autenticação efêmera `GITHUB_TOKEN` do próprio Actions com acesso a `packages: write` no repositório. Após esse workflow ser revisado e integrado à `main`, abra **Actions → Wandora — Build owned OpenHands image → Run workflow**.

- `publish=false` (padrão): executa testes, compila e verifica a imagem no runner; **não publica**.
- `publish=true`: além de testes e verificação, publica **somente** `ghcr.io/oaranha/openhands-wandora:canvas-<sha>-sdk-<sha>` no GHCR da conta `OARANHA`.

O workflow baixa o Canvas do nosso próprio repositório e o SDK do nosso próprio fork fixado por commit. Não envia código ao GitHub upstream nem atualiza a instalação existente. Mesmo após publicar GHCR, **não há deploy na VPS**.

A execução não foi acionada nesta etapa. A compilação pode consumir minutos de runner e armazenamento de imagem; verificar limites de conta e capacidade antes de iniciar. O job atual cobre Linux/amd64; a arquitetura da VPS Vigia ainda precisa ser confirmada antes de qualquer deploy.
