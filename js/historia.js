'use strict';

const Historia = (() => {
  let _cache = null;
  let _anoCache = null;

  // ─── CÁLCULO DE ESTATÍSTICAS ───────────────────────────────────────────────
  // Itera Mundo.torneios uma única vez. Resultado em cache até o ano avançar.

  function _computarEstatisticas() {
    if (_cache && _anoCache === Mundo.cronologia.anoAtual) return _cache;

    const palmares       = [];  // { ano, torneioNome, campeoId }
    const titulosPorClube = {}; // { club_id: count }
    let recMaisPts = null, recMaisV = null, recMelhorSG = null, recMaisGP = null;

    // Gols por player_id → { nome, gols } (all-time e por ano)
    const golsMap     = {};  // { player_id|nome: { nome, gols } }
    const golsMapAno  = {};  // { ano: { player_id|nome: { nome, gols } } }

    Mundo.torneios.forEach(t => {
      if (!t.campeao) return; // torneio ainda não encerrado

      // Palmarès
      palmares.push({ ano: t.ano, torneioNome: t.nome, campeoId: t.campeao });
      titulosPorClube[t.campeao] = (titulosPorClube[t.campeao] || 0) + 1;

      // Recordes de temporada (iterar toda a classificação, não só o campeão)
      t.classificacao.forEach(l => {
        if (!recMaisPts || l.pts > recMaisPts.pts)
          recMaisPts = { pts: l.pts, clubeId: l.club_id, ano: t.ano, torneioNome: t.nome };
        if (!recMaisV || l.v > recMaisV.v)
          recMaisV = { v: l.v, clubeId: l.club_id, ano: t.ano, torneioNome: t.nome };
        if (!recMelhorSG || l.sg > recMelhorSG.sg)
          recMelhorSG = { sg: l.sg, clubeId: l.club_id, ano: t.ano, torneioNome: t.nome };
        if (!recMaisGP || l.gp > recMaisGP.gp)
          recMaisGP = { gp: l.gp, clubeId: l.club_id, ano: t.ano, torneioNome: t.nome };
      });

      // Artilheiros (player_id como chave para evitar colisão entre regens de mesmo nome)
      if (!golsMapAno[t.ano]) golsMapAno[t.ano] = {};
      t.fixtures.forEach(f => {
        if (!f.resultado) return;
        f.resultado.artilheiros.forEach(a => {
          const chave = a.player_id != null ? String(a.player_id) : a.nome;
          if (!golsMap[chave])    golsMap[chave]           = { nome: a.nome, gols: 0 };
          if (!golsMapAno[t.ano][chave]) golsMapAno[t.ano][chave] = { nome: a.nome, gols: 0 };
          golsMap[chave].gols++;
          golsMapAno[t.ano][chave].gols++;
        });
      });
    });

    palmares.sort((a, b) => (b.ano - a.ano) || a.torneioNome.localeCompare(b.torneioNome));

    const artilheirosGeral = Object.values(golsMap)
      .sort((a, b) => b.gols - a.gols)
      .slice(0, 15);

    const artilheirosPorAno = Object.entries(golsMapAno)
      .map(([ano, mapa]) => {
        const top = Object.values(mapa).sort((a, b) => b.gols - a.gols)[0];
        return { ano: +ano, nome: top?.nome || '—', gols: top?.gols || 0 };
      })
      .sort((a, b) => b.ano - a.ano);

    const rankingTitulos = Object.entries(titulosPorClube)
      .map(([id, n]) => ({ clubeId: +id, titulos: n }))
      .sort((a, b) => b.titulos - a.titulos);

    const rivalidades = [...Mundo.tabelaH2H.values()]
      .filter(h => h.dominanteId && h.invencibilidade >= 3)
      .sort((a, b) => b.invencibilidade - a.invencibilidade)
      .slice(0, 20);

    _cache = { palmares, titulosPorClube, recMaisPts, recMaisV, recMelhorSG, recMaisGP, artilheirosGeral, artilheirosPorAno, rankingTitulos, rivalidades };
    _anoCache = Mundo.cronologia.anoAtual;
    return _cache;
  }

  // ─── PONTO DE ENTRADA ─────────────────────────────────────────────────────

  function renderizarTelaHistoria() {
    const el = document.getElementById('historia-conteudo');
    if (!el) return;

    _cache = null; // força recalculo a cada render para refletir estado atual
    const stats = _computarEstatisticas();

    if (!stats.palmares.length) {
      el.innerHTML = `
        <div class="entidade-header">
          <h2>📊 História do Mundo</h2>
          <div class="sub">Nenhum campeonato encerrado ainda. Simule pelo menos uma temporada completa para ver os registros históricos.</div>
        </div>`;
      return;
    }

    const anoInicio = stats.palmares[stats.palmares.length - 1].ano;
    const anoFim    = stats.palmares[0].ano;
    const nomesTorneios = [...new Set(stats.palmares.map(p => p.torneioNome.replace(/ \d+$/, '')))];

    el.innerHTML = `
      <div class="entidade-header">
        <h2>📊 História do Mundo</h2>
        <div class="sub">Temporadas de ${anoInicio} a ${anoFim}</div>
        <div class="badges">
          <span class="crono-badge">${stats.palmares.length} título(s) distribuídos</span>
          <span class="crono-badge">${stats.rankingTitulos.length} clube(s) campeão</span>
          ${stats.recMaisPts ? `<span class="crono-badge">Recorde de pts: ${stats.recMaisPts.pts}</span>` : ''}
          ${stats.artilheirosGeral[0] ? `<span class="crono-badge">Top scorer: ${stats.artilheirosGeral[0].nome} (${stats.artilheirosGeral[0].gols} gols)</span>` : ''}
        </div>
      </div>

      <div class="card">
        <div class="tabs" id="historia-tabs">
          <button class="tab-btn ativo" data-hist-tab="palmares">🏆 Palmarès</button>
          <button class="tab-btn" data-hist-tab="recordes">📈 Recordes</button>
          <button class="tab-btn" data-hist-tab="artilheiros">⚽ Artilheiros</button>
          <button class="tab-btn" data-hist-tab="rivalidades">🔥 Rivalidades</button>
        </div>
        <div id="historia-tab-conteudo">
          ${_renderTabPalmares(stats, nomesTorneios, '')}
        </div>
      </div>`;

    _bindTabs(el, stats, nomesTorneios);
    _bindFiltro(el, stats, nomesTorneios);
  }

  function _bindTabs(el, stats, nomesTorneios) {
    el.querySelectorAll('[data-hist-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('[data-hist-tab]').forEach(b => b.classList.remove('ativo'));
        btn.classList.add('ativo');
        const conteudo = document.getElementById('historia-tab-conteudo');
        const tab = btn.dataset.histTab;
        if (tab === 'palmares')        conteudo.innerHTML = _renderTabPalmares(stats, nomesTorneios, '');
        else if (tab === 'recordes')   conteudo.innerHTML = _renderTabRecordes(stats);
        else if (tab === 'artilheiros') conteudo.innerHTML = _renderTabArtilheiros(stats);
        else if (tab === 'rivalidades') conteudo.innerHTML = _renderTabRivalidades(stats);
        if (tab === 'palmares') _bindFiltro(el, stats, nomesTorneios);
      });
    });
  }

  function _bindFiltro(el, stats, nomesTorneios) {
    const sel = document.getElementById('hist-filtro-torneio');
    if (!sel) return;
    sel.addEventListener('change', () => {
      const filtro = sel.value;
      const conteudo = document.getElementById('historia-tab-conteudo');
      conteudo.innerHTML = _renderTabPalmares(stats, nomesTorneios, filtro);
      _bindFiltro(el, stats, nomesTorneios);
    });
  }

  // ─── TAB: PALMARÈS ────────────────────────────────────────────────────────

  function _renderTabPalmares(stats, nomesTorneios, filtro) {
    const lista = filtro
      ? stats.palmares.filter(p => p.torneioNome.replace(/ \d+$/, '') === filtro)
      : stats.palmares;

    const opcoes = nomesTorneios.map(n =>
      `<option value="${n}"${filtro === n ? ' selected' : ''}>${n}</option>`
    ).join('');

    const linhasHistorico = lista.map((p, i) => {
      const base = p.torneioNome.replace(/ \d+$/, '');
      return `<tr>
        <td style="color:var(--text-muted)">${i + 1}</td>
        <td>${p.ano}</td>
        <td class="col-nome">${UI.linkClube(p.campeoId)}</td>
        <td style="color:var(--text-muted);font-size:11px">${base}</td>
      </tr>`;
    }).join('');

    // Ranking de títulos filtrado
    const contagemFiltrada = {};
    lista.forEach(p => { contagemFiltrada[p.campeoId] = (contagemFiltrada[p.campeoId] || 0) + 1; });
    const linhasRanking = Object.entries(contagemFiltrada)
      .sort(([, a], [, b]) => b - a)
      .map(([id, n], i) => `<tr>
        <td style="color:var(--text-muted)">${i + 1}</td>
        <td class="col-nome">${UI.linkClube(+id)}</td>
        <td style="font-weight:700;color:var(--gold)">${n} 🏆</td>
      </tr>`).join('');

    const semDados = '<tr><td colspan="4" class="sem-dados" style="padding:14px;text-align:center">Nenhum campeão encontrado.</td></tr>';
    const semRanking = '<tr><td colspan="3" class="sem-dados" style="padding:14px;text-align:center">—</td></tr>';

    return `
      <div class="hist-filtro-bar">
        <label>Filtrar competição:</label>
        <select id="hist-filtro-torneio">
          <option value="">Todas</option>${opcoes}
        </select>
      </div>
      <div class="hist-duas-colunas">
        <div>
          <div class="card-header">Campeões por Temporada</div>
          <div style="overflow-x:auto">
            <table class="tabela-classificacao">
              <thead><tr><th>#</th><th>Ano</th><th class="col-nome">Clube</th><th>Torneio</th></tr></thead>
              <tbody>${linhasHistorico || semDados}</tbody>
            </table>
          </div>
        </div>
        <div>
          <div class="card-header">🏆 Ranking de Títulos</div>
          <div style="overflow-x:auto">
            <table class="tabela-classificacao">
              <thead><tr><th>#</th><th class="col-nome">Clube</th><th>Títulos</th></tr></thead>
              <tbody>${linhasRanking || semRanking}</tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  // ─── TAB: RECORDES ────────────────────────────────────────────────────────

  function _renderTabRecordes(stats) {
    const { recMaisPts, recMaisV, recMelhorSG, recMaisGP, artilheirosGeral, rankingTitulos } = stats;
    const topScorer = artilheirosGeral[0];
    const topTitulos = rankingTitulos[0];

    let maiorEstadio = null;
    Mundo.clubes.forEach(c => {
      if (!c.stadium?.capacidade) return;
      if (!maiorEstadio || c.stadium.capacidade > maiorEstadio.capacidade)
        maiorEstadio = { nome: c.stadium.nome, capacidade: c.stadium.capacidade, clubeId: c.club_id };
    });

    const card = (icone, label, valor, sub, destaque = false) => `
      <div class="recorde-card">
        <div class="recorde-icone">${icone}</div>
        <div class="recorde-info">
          <div class="recorde-label">${label}</div>
          <div class="recorde-valor${destaque ? ' recorde-destaque' : ''}">${valor}</div>
          <div class="recorde-sub">${sub}</div>
        </div>
      </div>`;

    return `<div class="recordes-grid">
      ${recMaisPts  ? card('📈', 'Maior Pontuação', recMaisPts.pts + ' pts',
          `${UI.linkClube(recMaisPts.clubeId)} · ${recMaisPts.torneioNome}`, true) : ''}
      ${recMaisV    ? card('🥊', 'Mais Vitórias', recMaisV.v + ' vitórias',
          `${UI.linkClube(recMaisV.clubeId)} · ${recMaisV.torneioNome}`) : ''}
      ${recMelhorSG ? card('⚖️', 'Melhor Saldo de Gols', (recMelhorSG.sg > 0 ? '+' : '') + recMelhorSG.sg,
          `${UI.linkClube(recMelhorSG.clubeId)} · ${recMelhorSG.torneioNome}`) : ''}
      ${recMaisGP   ? card('⚽', 'Mais Gols Marcados (Equipe)', recMaisGP.gp + ' gols',
          `${UI.linkClube(recMaisGP.clubeId)} · ${recMaisGP.torneioNome}`) : ''}
      ${topScorer   ? card('🌟', 'Maior Artilheiro All-Time', topScorer.nome,
          topScorer.gols + ' gols no total') : ''}
      ${topTitulos  ? card('🏆', 'Clube Mais Campeão', UI.linkClube(topTitulos.clubeId),
          topTitulos.titulos + ' título(s)', true) : ''}
      ${maiorEstadio ? card('🏟️', 'Maior Estádio', maiorEstadio.capacidade.toLocaleString() + ' cap.',
          `${maiorEstadio.nome} · ${UI.linkClube(maiorEstadio.clubeId)}`) : ''}
    </div>`;
  }

  // ─── TAB: ARTILHEIROS ─────────────────────────────────────────────────────

  function _renderTabArtilheiros(stats) {
    const linhasGeral = stats.artilheirosGeral.map(({ nome, gols }, i) => `<tr>
      <td style="color:var(--text-muted)">${i + 1}</td>
      <td class="col-nome" style="text-align:left">${nome}</td>
      <td style="font-weight:700;color:var(--green)">${gols}</td>
    </tr>`).join('');

    const linhasPorAno = stats.artilheirosPorAno.map(({ ano, nome, gols }) => `<tr>
      <td>${ano}</td>
      <td class="col-nome" style="text-align:left">${nome}</td>
      <td style="color:var(--green)">${gols}</td>
    </tr>`).join('');

    const semDados = '<tr><td colspan="3" class="sem-dados" style="padding:14px;text-align:center">Sem dados disponíveis.</td></tr>';

    return `
      <div class="hist-duas-colunas">
        <div>
          <div class="card-header">🌟 Maiores Artilheiros de Todos os Tempos</div>
          <div style="overflow-x:auto">
            <table class="tabela-classificacao">
              <thead><tr><th>#</th><th class="col-nome">Jogador</th><th>Gols</th></tr></thead>
              <tbody>${linhasGeral || semDados}</tbody>
            </table>
          </div>
        </div>
        <div>
          <div class="card-header">⚽ Artilheiro por Temporada</div>
          <div style="overflow-x:auto">
            <table class="tabela-classificacao">
              <thead><tr><th>Ano</th><th class="col-nome">Jogador</th><th>Gols</th></tr></thead>
              <tbody>${linhasPorAno || semDados}</tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  // ─── TAB: RIVALIDADES ─────────────────────────────────────────────────────

  function _renderTabRivalidades(stats) {
    if (!stats.rivalidades.length) {
      return '<p class="sem-dados" style="padding:20px;text-align:center">Nenhuma rivalidade histórica detectada ainda. São necessários 3+ jogos de domínio ininterrupto.</p>';
    }

    const linhas = stats.rivalidades.map((h, i) => {
      const outroId = h.idA === h.dominanteId ? h.idB : h.idA;
      return `<tr>
        <td style="color:var(--text-muted)">${i + 1}</td>
        <td class="col-nome">${UI.linkClube(h.dominanteId)}</td>
        <td style="color:var(--text-muted);font-size:11px">domina</td>
        <td class="col-nome">${UI.linkClube(outroId)}</td>
        <td style="font-weight:700;color:var(--red)">${h.invencibilidade} jogos</td>
      </tr>`;
    }).join('');

    return `
      <div class="card-header">🔥 Séries de Domínio — Confrontos Diretos</div>
      <div style="overflow-x:auto">
        <table class="tabela-classificacao">
          <thead><tr><th>#</th><th class="col-nome">Dominante</th><th></th><th class="col-nome">Dominado</th><th>Série</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>`;
  }

  return { renderizarTelaHistoria };
})();
