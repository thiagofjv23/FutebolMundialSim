# Guia de Estruturação da UI — Universo Alternativo do Futebol

> Referência de arquitetura de telas, navegação e componentes, inspirada no **Championship Manager 01/02**.
> Objetivo: com a base crescendo (nações, estados, divisões, dezenas de clubes e centenas de jogadores),
> as páginas devem apresentar a informação de forma **coesa, densa e navegável**, sem retrabalho de design a cada tela nova.
>
> Este guia é ancorado no código atual (`js/ui.js`, `js/tabela.js`, `css/style.css`). Consulte-o **antes** de criar qualquer tela.

---

## 1. Princípios (o "jeito CM 01/02")

1. **Tudo é hyperlink.** Todo nome de entidade é clicável e leva à sua tela: clube ↔ jogador ↔ competição ↔ estado ↔ nação. O usuário navega "puxando o fio" (do campeonato para o clube, do clube para o jogador, do jogador de volta para o clube atual). Nunca deixe um nome de entidade como texto morto.
2. **Layout consistente por entidade.** Toda tela de entidade segue o mesmo esqueleto: **header de entidade** (nome + fatos-chave) → **abas** de subseções → **grid de cards**. O usuário aprende a estrutura uma vez e a reconhece em qualquer tela.
3. **Densidade escaneável.** Preferir tabelas ordenáveis e listas compactas a cards grandes e espaçados. Muita informação por tela, mas hierarquizada (título > badges > tabela). É um jogo de banco de dados, não um site de marketing.
4. **Navegação hierárquica + busca** em vez de listas planas. Um `<select>` com 5 itens funciona; com 50 clubes e 8 competições, não. Estrutura: **Nação → Estado → Divisão → Clube → Jogador**, com um campo de busca global por cima.
5. **Contexto temporal sempre visível.** Ano/semana/era no header global (já existe). Cada tela deixa claro "de qual temporada" são os dados.

---

## 2. Arquitetura de informação — entidades e telas

Sistema de telas (`section.tela`, alternadas por `_mostrarTela` em `js/ui.js`). Estado atual e alvo:

| Entidade | Tela hoje | Alvo (abas) |
|---|---|---|
| **Início** (dashboard) | ✅ `#tela-inicio` | Notícias, classificações resumidas, mercado, atalhos |
| **Competição** | ✅ `renderizarTelaCampeonato` | Classificação · Jogos · Artilheiros · Campeões (histórico) |
| **Clube** | ✅ `renderizarTelaTime` | Visão geral · Elenco · Jogos · Histórico/Palmarés · (futuro) Finanças/Estádio |
| **Jogador** | ❌ **criar** | Visão geral · Atributos · Carreira |
| **Estado/Região** | ❌ **criar** | Divisões · Clubes · Campeões |
| **Nação** | ❌ **criar** | Estados/Ligas · Seleção · Recordes |
| **Técnico** | ❌ opcional | Perfil · Clubes dirigidos |

### 2.1 Jogador (nova — prioridade alta)
Hoje jogadores aparecem só como linha na tabela de elenco e **não são clicáveis**. Criar tela própria:
- **Header**: nome + tag de legado; sub: `posição · idade · clube atual (link)`.
- **Atributos** (ver §5): Gol / Defesa / Armação / Ataque com rótulo + barra proporcional (não o "G/D/A/T" cru).
- **Bio/estado**: personalidade, moral, condição física, ano de estreia.
- **Carreira**: clubes por temporada, gols (das notícias/crônica), títulos.
- Ativar: adicionar `linkJogador(playerId)` e tratar `data-player-id` na delegação de cliques (hoje em `js/ui.js:167`).

### 2.2 Estado/Região (nova — prioridade alta)
Com múltiplos estados (RJ, SP, MG, RS…), é o índice natural do país. Ex.: "Minas Gerais":
- **Header**: nome do estado (de `coordenadasEstados[state_id].nome`).
- **Divisões**: 1ª, 2ª… cada uma lincando para o torneio do ano.
- **Clubes ativos** do estado (filtro `c.state_id === X && c.ativo`), agrupados por divisão.
- **Campeão atual** e histórico de campeões estaduais.

### 2.3 Nação (nova)
Topo da hierarquia (`country_id`): lista estados/ligas do país (Brasil: estaduais; Inglaterra: Football League). Porta de entrada da navegação.

---

## 3. Modelo de navegação

**Trocar os dropdowns planos** (`#nav-sel-campeonato`, `#nav-sel-time` em `atualizarNavSelects`, `js/ui.js:235`) por:

1. **Navegador hierárquico** (drill-down): Nação → Estado → Divisão → Clube → Jogador. Cada nível é uma tela-índice que lista o nível seguinte (ver Estado/Nação acima).
2. **Busca global**: um campo que casa nome de clube/jogador/competição e navega direto. Reusar o índice de nomes já existente (`_obterIndiceNomes`, `linkificarTexto` em `js/ui.js:79-116`).
3. **Breadcrumb + Voltar**: já há pilha de navegação (`navegarPara`/`voltar`/`_atualizarBotaoVoltar`). Manter o botão "← Voltar" e, opcionalmente, exibir a trilha (Brasil › Minas Gerais › Campeonato Mineiro › Atlético-MG).

**Novos linkers** (seguir o padrão de `linkClube`/`linkTorneio`, `js/ui.js:66-77` — retornam `<a data-*-id>`):
```js
linkJogador(playerId)  // data-player-id  → tela 'jogador'
linkEstado(stateId)    // data-state-id   → tela 'estado'
linkNacao(countryId)   // data-country-id → tela 'nacao'
```
E registrar cada `data-*-id` na delegação global de cliques (`js/ui.js:167-168`).

---

## 4. Template de tela (padrão único — reusar sempre)

Toda tela de entidade usa este esqueleto (classes já existentes no CSS):

```html
<div class="entidade-header">
  <h2>Nome da Entidade</h2>
  <div class="sub">subtítulo · fatos curtos · contexto</div>
  <div class="badges">
    <span class="crono-badge">Fato-chave 1</span>
    <span class="crono-badge">Fato-chave 2</span>
  </div>
</div>

<div class="tabs">
  <button class="tab-btn ativo" data-aba="visao">Visão geral</button>
  <button class="tab-btn" data-aba="elenco">Elenco</button>
  <!-- … -->
</div>

<div class="tela-grid">
  <div class="card"><div class="card-header">Título</div> … </div>
  <div class="card"> … </div>
</div>
```

- `.entidade-header`, `.sub`, `.badges`, `.tabs`, `.tab-btn`, `.tela-grid`, `.card`, `.card-header` **já existem** e são usados em `renderizarTelaTime`/`renderizarTelaCampeonato`. Não invente classes novas sem necessidade.
- As abas usam a mesma marcação das abas de classificação (§ `renderizarTabelasAtivas`, `js/tabela.js`). Um handler troca a subseção visível.

---

## 5. Convenções de tabelas e atributos

- **Tabelas ordenáveis**: cabeçalhos clicáveis que reordenam (reusar a lógica de `ordenarClassificacao`, `js/tabela.js:5`). Zebra + hover; números alinhados à direita.
- **Atributos do jogador**: exibir com **rótulo + barra proporcional** (0–100), não o compacto `gol/defesa/armacao/ataque`. Ex.:
  ```html
  <div class="attr-linha"><span>Ataque</span><div class="attr-bar"><i style="width:88%"></i></div><b>88</b></div>
  ```
  Destacar o atributo primário da posição. Lendas (`tag_legado`) recebem realce.
- **Cores semânticas** (usar as classes/vars existentes): positivo `--green` / `.pos`, negativo `--red` / `.neg`, neutro/secundário `--text-muted`, destaque `--blue`, título/ouro `--gold`. Condição física e forma seguem o mesmo código (verde ≥80, vermelho <50) já usado em `renderizarTelaTime`.

---

## 6. Tokens de design (não redefinir — reutilizar)

Variáveis em `:root` (`css/style.css:4`):

| Token | Uso |
|---|---|
| `--bg` `--bg2` `--bg3` | fundos (página, card, elevado) |
| `--border` | bordas e divisórias |
| `--text` `--text-muted` | texto primário / secundário |
| `--green` `--red` | positivo / negativo (vitória, saldo, condição) |
| `--blue` | links e seleção ativa |
| `--gold` | títulos/campeão/destaque |
| `--purple` `--orange` | acentos (era, badges especiais) |
| `--radius` | cantos (8px) |
| `--font` `--font-mono` | textos / números-tabela |

Classes reutilizáveis: `.card`, `.card-header`, `.card-body`, `.crono-badge`, `.badges`, `.tela-grid`, `.tabs`/`.tab-btn`, `.tabela-classificacao`, `.tabela-elenco`, `.entidade-header`, `.sub`, `.sem-dados`, `.pos`/`.neg`, `.tag`.

---

## 7. Regras de escala (conforme a base cresce)

- **Listas longas → agrupar e/ou paginar.** Clubes por estado e divisão; jogadores por posição; competições por nação/estado.
- **Filtros locais** em telas-índice (por divisão, por status ativo/histórico), como o filtro de histórico de torneios do clube (`_bindFiltroClubeHistorico`, `js/ui.js:494`).
- **Heurística de navegação**: enquanto uma dimensão tiver ≤ ~8 itens, um `<select>`/abas basta; acima disso, use tela-índice hierárquica + busca.
- **Ativação temporal**: telas de estado/nação devem distinguir clubes **ativos no ano** dos ainda não fundados (`anoFundacao <= anoAtual`) — não listar clubes que "ainda não existem".

---

## 8. Roadmap de implementação (faseado)

Cada fase é independente e reusa funções existentes. Ordem sugerida por valor/esforço:

1. **Navegação hierárquica + busca** — telas Nação/Estado como índices; campo de busca. Base para tudo. (Reusa `navegarPara`, `_obterIndiceNomes`.)
2. **Tela de Jogador** — `linkJogador` + `data-player-id` + `renderizarTelaJogador`. Maior ganho de "coesão" (fecha o ciclo clube↔jogador).
3. **Tela de Estado** — agrega divisões/clubes/campeões por `state_id`.
4. **Abas no Clube** — reorganizar `renderizarTelaTime` em Visão geral / Elenco / Jogos / Histórico.
5. **Enriquecer Competição** — artilheiros, faixas de acesso/rebaixamento visíveis, link ao estado, histórico de campeões.

> Implementar tela a tela, sempre seguindo o **Template (§4)** e os **Tokens (§6)**. Nenhuma tela nova deve reabrir decisões de arquitetura — este guia é a fonte da verdade.
