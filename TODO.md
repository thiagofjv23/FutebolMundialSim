# TODO

## Calibração de xGBase por era

O expoente de prestígio foi alterado de `0.75 → 0.55` e o `xGBase` da ERA_AMADORA foi recalibrado para `2.6` (commit f5de792). Os valores das outras duas eras foram definidos antes dessa mudança e precisam de recalibração via benchmark.

| Era | Anos | xGBase atual | g/j esperado atual | g/j histórico alvo |
|---|---|---|---|---|
| ERA_PROFISSIONAL_INICIAL | 1933–1969 | 1.7 | ~2.2 (estimado) | ~4.5–5.0 (WM adaptation) |
| ERA_MODERNA | 1970–9999 | 1.6 | ~2.1 (estimado) | ~2.5–3.0 (futebol moderno) |

### O que fazer

- [ ] Rodar benchmark `bench_caos.js` para ERA_PROFISSIONAL_INICIAL (simular a partir de 1933)
- [ ] Encontrar `xGBase` que produza ~4.5 g/j para a Football League nos anos 1933–1969
- [ ] Rodar benchmark para ERA_MODERNA e calibrar para ~2.5–3.0 g/j
- [ ] Considerar recalibrar `xGBase` da ERA_AMADORA pós-1925 (evento 3.84) se o pico histórico de ~6.09 g/j em 1925/26 precisar de mais fidelidade
- [ ] Avaliar se as ligas brasileiras precisam de calibração separada após as mudanças acima

### Referências históricas

- Football League 1920/21 (pré-impedimento): **3.59 g/j**
- Football League 1925/26 (pós-regra nova): **~6.09 g/j**
- Football League ~1930 (defesas adaptadas, formação WM): **~4.5–5.0 g/j**
- Futebol moderno médio (Bundesliga, La Liga, Premier League): **~2.7–3.1 g/j**

## Pendências adiadas (itens deixados para depois)

Itens de escopo/cosmética que foram conscientemente adiados durante implementações anteriores, registrados aqui para não serem esquecidos.

### Sistema de divisões (acesso/descenso)

- [ ] `js/tabela.js`: a zona de promoção usa `numPromovidos > 1` — funciona para a Segunda Divisão Carioca (3 promovidos), mas uma liga com apenas 1 promovido não pintaria a zona verde. Revisar se/quando existir liga com 1 vaga de acesso.

### Grandeza histórica / regens

- [ ] Exibir `grandezaHistorica` na tela de detalhe do clube (o sistema hoje não tem UI para esse campo).
- [ ] Ajustar atributos **secundários** dos regens por clube — hoje só o atributo primário da posição escala com prestígio/grandeza; os secundários continuam aleatórios baixos.
- [ ] Reavaliar o balanceamento 50/50 (grandeza × prestígio) e a taxa de reversão à média (0.10) após observar simulações longas; aumentar o peso da grandeza se o destino histórico não estiver se impondo o suficiente.

### Persistência / modo de teste

- [ ] Desligar `MODO_TESTE` (`js/engine.js`) quando a fase de testes terminar, reativando o save de `mundo_atual`. Antes disso, investigar e corrigir a causa dos bugs de restore de save que motivaram o modo de teste.

### Realismo do 1º ano (extensão do trabalho do Carioca 1920)

O Carioca div1 foi calibrado (ρ 0.42→0.59; Flamengo 10%→33%, co-favorito com o Fluminense; g/j ~3.4). Aplicar a mesma técnica às outras ligas:

- [ ] **Paulista 1920**: realinhar `prestigio` ao pecking order real (campeão de 1920 foi o **Palestra Italia**, não o Paulistano, que hoje tem prestígio 82) e ancorar com jogadores reais (Friedenreich já existe no Paulistano).
- [ ] **Football League (EN)**: realinhar prestígio de 1920/21 (Burnley foi campeão — já tem prestígio 85, ok) e avaliar ligar `returno` para a liga inglesa (hoje roda turno único; alinhar com o calendário CRUZADO — returno dobraria para ~42 rodadas).
- [ ] Rever se `grandezaHistorica` e `prestigio` das outras eras/clubes precisam de ajuste após o alargamento do spread dos regens (μ = 24 + 0.46·métrica).
- [ ] Reconsiderar o expoente 0.55 apenas com um benchmark cruzado de g/j (ligado ao item de calibração de xGBase acima).

### Gerador de clubes (tools/gerar_clubes.mjs)

- [ ] Adicionar um modo "update" ao gerador para **editar clubes já existentes** a partir da tabela (`tools/clubes_novos.json`). Hoje ele é add-only (idempotente por nome), então ajustes em clubes existentes (ex.: mudar divisão/prestígio) são feitos direto no JSON, o que gera risco de divergência entre a tabela-fonte e `data/br/clubes.json`.
- [ ] Estender a expansão a mais estados (Pernambuco, Bahia, Paraná) e realinhar o favorito de 1920 do Paulista (campeão real foi o Palestra Itália, não o Paulistano) — ver seção de realismo acima.

### Reestruturação da UI (ver docs/GUIA_UI.md)

Roadmap faseado do guia de estruturação estilo Championship Manager 01/02:

- [ ] **Fase 1** — Navegação hierárquica (Nação → Estado → Divisão → Clube → Jogador) + campo de busca global, substituindo os dropdowns planos (`atualizarNavSelects`).
- [ ] **Fase 2** — Tela de Jogador (`linkJogador` + `data-player-id` + `renderizarTelaJogador`): atributos com barra, bio, carreira. Hoje jogadores não são clicáveis.
- [ ] **Fase 3** — Tela de Estado/Região (agrega divisões, clubes ativos e campeões por `state_id`).
- [ ] **Fase 4** — Reorganizar a tela de Clube (`renderizarTelaTime`) em abas: Visão geral · Elenco · Jogos · Histórico.
- [ ] **Fase 5** — Enriquecer a tela de Competição: artilheiros, faixas de acesso/rebaixamento, link ao estado, histórico de campeões.
- [ ] Considerar mesclar a branch em `main` e apontar o GitHub Pages para `main` (deploys estáveis, em vez de publicar a branch de feature).
