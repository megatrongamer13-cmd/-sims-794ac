# SIMS 794AC — manual operacional (leia isto, NÃO releia o index.html inteiro)

Ferramenta **single-file** (`index.html`, ~440 linhas, vanilla puro — sem build/CDN/backend) que mapeia
uma **descrição textual de falha** da frota Caterpillar **794AC** num **código SIMS** (ex.: `VAZA ÓLEO → C17`).
A equipe Sotreq S11D usa pra classificar/aprovar backlogs. Publicada na **Vercel**: push na `main` → redeploy
automático (a Vercel serve só o HTML estático; ignora `tools/` e este arquivo).

> **Tarefa nº 1 (quase sempre é esta):** "tal descrição retorna *Nenhum código* (ou retorna X e deveria ser Y)".
> Resolve-se adicionando **1 gatilho/keyword** + **1 caso de teste** — sem ler o `index.html` todo. Veja o Cookbook.

## Como me pedir um ajuste (prompt curto que basta)
> "No sims-794ac, a descrição «…» retorna 'Nenhum código' (ou X, deveria ser Y). Siga o CLAUDE.md:
> reproduza com `tools/harness.js`, adicione o gatilho/keyword certo, registre o caso (e os negativos) em
> `cases.json`, rode o harness até verde e commite. Atualize CLAUDE.md/memória se for decisão nova."

## Arquitetura do motor (por ÂNCORA de busca — nunca por nº de linha, que envelhece)
Tudo vive no único `<script>` do `index.html`:

| Âncora (string de busca) | O que é |
|---|---|
| `var regras = [` | ~55 regras base `{codigo, desc, palavras[], complementares[]:vazio, dica}` |
| `var complementaresEspeciais = [` | ~90 **gatilhos curados** `{gatilho[], principal, complementares[{c,d}]}` |
| `function normalizar(txt)` | lowercase + tira acento + pontuação→espaço |
| `function casaPalavra(textoNorm, palavra)` | **matcher** (regex `(^\|[^a-z0-9])` + termo) |
| `var prioridade = [` | ordem de desempate do principal e dos complementares |
| `function identificar()` | orquestra; lê `#ia-input.value`, escreve `#ia-result.innerHTML` |
| `var temFerragem` / `var faltaOuSolta` | os 2 regex que governam o gate **P22** |
| `var data = [` | catálogo SIMS p/ consulta manual (92 linhas) — **não é usado pelo motor** |

## Ordem de decisão do `identificar()` (não mudar sem motivo)
1. **Pré-processo contextual** do texto: `S.O.S`→`sos`; `bracadeira`→`abracadeira`; `ferro/cobre`→`metal`
   (só em contexto de óleo/SOS); `acima do especificado`→`contaminacao` (só em contexto de elemento/metal/SOS).
2. **`complementaresEspeciais`**: 1º gatilho cujos termos **TODOS** casam → fixa principal + complementares curados.
3. **Gate de ferragem** → `P22` se `temFerragem && faltaOuSolta` (substantivo de ferragem **E** sinal de falta/solta).
4. `(limalha|sos|metal)` **e** `(contaminacao|particula)` → `B62`.
5. **Cascata** pelo array `prioridade` entre as regras encontradas por keyword.
6. Senão → "Nenhum código identificado".

Saída no HTML: `🔴 CÓDIGO PRINCIPAL: <cod> — <desc>` + complementares (curados primeiro, depois por prioridade).

## Semântica do matcher (o que você PRECISA saber pra escrever gatilho que funcione)
- **Left-anchored:** casa só no **início de uma palavra**; pega plural/sufixo (`folgado` casa `folgados`),
  mas **nunca no meio** (`sos` não casa em `parafuSOS`; `roca` não casa em `tROCA`).
- **Cuidado com flexão:** o termo precisa ser prefixo exato. `aplicar` **≠** `aplicacao`; `quebrado` **≠** `quebrada`.
  Quando o caso usar gênero/conjugação diferente, use o **radical comum** (`quebrad`, `reposicionad`) ou liste as variantes.
- **Gatilho multi-termo = AND não-contíguo:** cada termo precisa aparecer em algum lugar do texto (não juntos).
  Por isso número/unidade no meio quebra keyword-frase: `pressao abaixo` não casa em `pressao 16 psi abaixo`.

## Convenções de classificação do usuário (DECISÕES — não mudar sem perguntar)
- **Eventos `CST_` do drive AC / gerador** (tensão, corrente, temperatura, rotação, barramento, rolamento,
  estator, fase, blower, enrolamento) → **default `E42`**. Inclui evento `CST_` de **FCV** (tendência de
  abertura / diagnóstico-teste): `fcv` é keyword do `E42`. Só perguntar se houver sintoma físico claro de
  outra categoria (vazamento/quebra/trinca) — ex.: "vazamento na FCV" vence e vira `C17` pela prioridade.
- **Lâmpada / botão faltante** (ausente/sem/instalar no painel) → `P22` (escolha do usuário; `R82` seria o mais literal). Gatilhos curados `["falta"/"faltante"/"ausencia"/"sem","botao"|"botoes"]` — `botao` e `botoes` (plural irregular) listados separados pois o matcher é prefixo; `falta` puro não está em `faltaOuSolta`, por isso gatilho curado em vez do gate.
- **Farol/lente ofuscada/embaçada/amarelada** → `B13` + `E42`. Farol só "fraco/não acende" (sem lente) → `E42`.
- **SOS com ISO alto / limalha** → `B62` + `B13`. **Patinamento de marcha** → `E58`. **Filtro entupido** → `E57`.
  **Lockup oscilando** → `E64`. **"fora de posição" / reposicionamento negado** → `D93`.
- **Parafuso que caiu** (`queda`/`caiu` + ferragem) → `P22`; a solda paliativa é ação corretiva, não gera código.
- **Componente de escapamento faltante/solto** (silencioso, ponteira, tubo de exaustão/escapamento + falta/solta) → `P22` — esses substantivos vivem no `temFerragem`, junto de `protetor`/`tampa`/`coxim`. Temperatura do escape segue `E53` (sem falta/solta o gate não dispara).
- **Payload com problema + suspensão batendo** (resolução = calibração conforme manual) → `H91` (AJUSTAGEM INAPROPRIADA): calibração = reajuste. Gatilhos `["payload","suspensao"]` e `["batendo","suspensao"]`. ⚠️ o Identificador só lê o campo **Sintoma**, não a Ação — por isso o gatilho usa o vocabulário do sintoma (payload/suspensão batendo), não a palavra "calibração". Payload sozinho como falha eletrônica (VIMS) seria `E42` — só dispara H91 com o par.
- **Ausência/falta de lubrificação** (pino/articulação seco; resolução = relubrificar / testar injetor / desobstruir linha) → `G49` (REPARO GERAL): é **serviço de manutenção**, não falha de componente. Gatilhos `["ausencia","lubrificacao"]` / `["falta","lubrificacao"]` / `["sem","lubrificacao"]` — rodam ANTES do gate P22, então corrigem o **falso-positivo** em que `pino` (ferragem) + `ausencia` virava P22. ⚠️ **G49 foi adicionado à lista `regras`** (antes só existia na tabela `data`; o motor precisa dele lá senão `getRegra` devolve null e o P22 reaparece). Distinção fina: `lubrificação` (o ato, ausente) → G49; **`falta de lubrificante`** (substância/nível) segue `L29`.

- **Cabo elétrico solto** (cabos/fiação soltos, mesmo descritos como "sem isolação") → **E58 (SOLTO OU DESLIZANTE)**: o modo dominante é o *solto* (que é a descrição oficial do E58); o "sem isolação" só descreve o estado, não vira código próprio. Gatilho `["cabo","solto"]` em `complementaresEspeciais` — roda ANTES do gate P22 porque `cabo` não é ferragem (o gate nem dispara, daí o `NENHUM` original). ⚠️ usa `solto` (masculino) **de propósito**: assim NÃO rouba os casos femininos `abraçadeira/porca solta`, que seguem `P22`.

## COOKBOOK — "descrição X não retorna código" (o passo a passo)
1. **Reproduzir** (sem reler o index.html): `node tools/harness.js "DESCRIÇÃO AQUI"` → vê o código atual (ou `NENHUM`).
2. **Escolher o tipo de fix:**
   - combinação específica de termos → **novo gatilho** em `complementaresEspeciais` (ex.: `{gatilho:["queda","parafuso"], principal:"P22", complementares:[]}`).
   - só falta vocabulário de um código já existente → **nova keyword** no `palavras[]` daquela `regra`.
   - é falta/solta de ferragem genérica → termo em `temFerragem`/`faltaOuSolta` (⚠️ **efeito global**, teste regressões).
3. **Escrever left-anchored** (lembre `aplicar`≠`aplicacao`, `quebrado`≠`quebrada` — use radical).
4. **Registrar em `tools/cases.json`**: 1 caso positivo do alvo **+** os negativos que poderiam quebrar
   (ex.: ao mexer em P22, garanta que "queda de pressão"→`E66` continua).
5. **Rodar** `node tools/harness.js` → tem que dar **0 FAIL** (xfail é limitação conhecida, tudo bem).
6. **Commitar e push** (ver Git abaixo) → Vercel redeploya sozinho.

## Protocolo de atualização ("todo ajuste atualiza o contexto")
- Toda **regra nova/alterada** ⇒ pelo menos 1 caso positivo + os negativos de regressão em `cases.json`.
- Toda **decisão de classificação do usuário** ⇒ 1 bullet em "Convenções" acima.
- Mudou **âncora/estrutura** do código ⇒ atualizar a tabela "Arquitetura" (sempre por âncora, nunca por linha).
- Mantenha este arquivo **enxuto** (alvo ≤ ~200 linhas): ele descreve *como* ajustar e *quais decisões* existem;
  **não** duplica a tabela `data` nem a lista de regras (a fonte é o `index.html`; o registro de regressão é o `cases.json`).

## Teste (`tools/`)
- `node tools/harness.js "TEXTO"` → classifica uma descrição (imprime o código ou `NENHUM`).
- `node tools/harness.js` → roda toda a suíte `cases.json` (`N PASS, M FAIL`; sai com erro se houver FAIL).
- O harness lê o `index.html` **ao vivo** (extrai o `<script>`, shim de DOM, chama o `identificar()` real) — não duplica o motor.
- Node puro (sem `npm install`). Em **PowerShell 5.1**, descrição com aspas/`—` pode precisar de here-string; no Bash, aspas normais.

## Git / Vercel (gotchas)
- author **e** committer = `megatrongamer13@gmail.com` (exigência da Vercel, senão bloqueia o deploy).
- **PowerShell 5.1 quebra** `git commit -m` com aspas duplas/`->` na mensagem → usar a tool **Bash** (heredoc) ou `git commit -F`.
- Push na `main` → redeploy automático.

## Limites conhecidos (são `xfail` em cases.json — não "corrija às cegas")
- **Número/unidade intercalado** ("16 psi abaixo") → `NENHUM` (a keyword-frase exige contiguidade).
- **`lâmpada quebrada`** (feminino) cai em `D93` porque o gatilho curado usa `quebrado` (masc.) — mesma classe do `aplicar`/`aplicacao`.
- Gatilho `["rotacao","ventilador"]`→`E77` assume rotação **alta**; "baixa rotação do ventilador" daria `E77` errado (com `blower` não dá).
- Tabela `data`: `A27` duplicado e `B1`/`B3` ambos "CORROÍDO" — precisa da **planilha Excel oficial** (fonte de verdade, não versionada).
