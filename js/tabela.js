'use strict';

const Tabela = (() => {

  function ordenarClassificacao(torneio) {
    torneio.classificacao.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.sg  !== a.sg)  return b.sg  - a.sg;
      if (b.gp  !== a.gp)  return b.gp  - a.gp;
      return (Mundo.clubes.get(a.club_id)?.nome || '').localeCompare(Mundo.clubes.get(b.club_id)?.nome || '');
    });
  }

  function renderizarTabela(torneio, containerEl) {
    if (!torneio || !containerEl) return;

    const total = torneio.classificacao.length;
    const html = `
      <table class="tabela-classificacao">
        <thead>
          <tr>
            <th>Pos</th><th class="col-nome">Clube</th>
            <th>Pts</th><th>J</th><th>V</th><th>E</th><th>D</th>
            <th>GP</th><th>GC</th><th>SG</th>
          </tr>
        </thead>
        <tbody>
          ${torneio.classificacao.map((l, i) => {
            let cls = '';
            if (i === 0) cls = 'zona-titulo';
            else if (i < 3) cls = 'zona-promocao';
            else if (i >= total - 2) cls = 'zona-rebaixamento';
            return `<tr class="${cls}" data-club-id="${l.club_id}">
              <td>${i + 1}</td>
              <td class="col-nome">${UI.linkClube(l.club_id)}</td>
              <td><strong>${l.pts}</strong></td>
              <td>${l.j}</td><td>${l.v}</td><td>${l.e}</td><td>${l.d}</td>
              <td>${l.gp}</td><td>${l.gc}</td>
              <td class="${l.sg > 0 ? 'pos' : l.sg < 0 ? 'neg' : ''}">${l.sg > 0 ? '+' : ''}${l.sg}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
    containerEl.innerHTML = html;
    // Cliques tratados pela delegação global em ui.js (data-club-id nas linhas/links).
  }

  function renderizarTabelasAtivas() {
    const wrap = document.getElementById('tabelas-wrap');
    if (!wrap) return;

    const torneiosAtivos = [...Mundo.torneios.values()].filter(t => t.ativo && t.ano === Mundo.cronologia.anoAtual);

    // Tabs
    const tabsHtml = torneiosAtivos.map((t, i) =>
      `<button class="tab-btn${i === 0 ? ' ativo' : ''}" data-torneio-id-tab="${t.tournament_id}">${t.nome}</button>`
    ).join('');

    wrap.innerHTML = `<div id="tabs-torneios" class="tabs">${tabsHtml}</div>
      <div id="tabela-container"></div>
      <div style="padding:8px 12px 12px"><button class="btn-ghost" id="btn-ver-campeonato">Ver campeonato completo →</button></div>`;

    let torneioSelecionado = torneiosAtivos[0] || null;
    if (torneioSelecionado) {
      renderizarTabela(torneioSelecionado, document.getElementById('tabela-container'));
    }

    wrap.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('ativo'));
        btn.classList.add('ativo');
        torneioSelecionado = Mundo.torneios.get(+btn.dataset.torneioIdTab);
        renderizarTabela(torneioSelecionado, document.getElementById('tabela-container'));
      });
    });

    wrap.querySelector('#btn-ver-campeonato')?.addEventListener('click', () => {
      if (torneioSelecionado) UI.navegarPara('campeonato', { torneioId: torneioSelecionado.tournament_id });
    });
  }

  // ─── GRELHA DE JOGOS ──────────────────────────────────────────────────────

  // Semanas distintas (ordenadas) de um torneio mapeiam para números de rodada.
  function _semanasOrdenadas(torneio) {
    return [...new Set((torneio.fixtures || []).map(f => f.semana))].sort((a, b) => a - b);
  }

  function rodadaDaSemana(torneio, semana) {
    return _semanasOrdenadas(torneio).indexOf(semana) + 1;
  }

  function _grelhaJogos(torneio) {
    const semanas = _semanasOrdenadas(torneio);
    if (!semanas.length) return '<p class="sem-dados">Calendário não disponível.</p>';

    return semanas.map((semana, idx) => {
      const jogos = torneio.fixtures.filter(f => f.semana === semana);
      const linhas = jogos.map(f => {
        const casa = UI.linkClube(f.casaId);
        const visit = UI.linkClube(f.visitanteId);
        let placar;
        if (f.resultado) {
          placar = `<span class="placar">${f.resultado.golsCasa} × ${f.resultado.golsVisit}</span>`;
        } else {
          placar = `<span class="placar pendente">a realizar</span>`;
        }
        return `<div class="jogo-linha"><span class="casa">${casa}</span>${placar}<span class="visit">${visit}</span></div>`;
      }).join('');
      return `<div class="rodada-bloco">
        <div class="rodada-titulo">Rodada ${idx + 1} — Semana ${semana}</div>
        ${linhas}
      </div>`;
    }).join('');
  }

  function _statsCampeonato(torneio) {
    const totalJogos = (torneio.fixtures || []).length;
    const disputados = (torneio.fixtures || []).filter(f => f.resultado).length;
    const restantes  = totalJogos - disputados;

    // Artilheiro do ano (das notícias de gol) — mesma técnica da crônica.
    const contagem = {};
    Mundo.logNoticias
      .filter(n => n.tipo === 'gol' && n.ano === torneio.ano)
      .forEach(n => {
        const m = n.mensagem.match(/Gols: (.+)/);
        if (m) m[1].split(', ').forEach(nome => { contagem[nome] = (contagem[nome] || 0) + 1; });
      });
    let artNome = null, artGols = 0;
    for (const [nome, g] of Object.entries(contagem)) { if (g > artGols) { artGols = g; artNome = nome; } }

    const lider = torneio.classificacao[0];
    const liderTxt = torneio.campeao
      ? `Campeão: ${UI.linkClube(torneio.campeao)}`
      : (lider ? `Líder: ${UI.linkClube(lider.club_id)}` : '—');

    return `<div class="badges">
      <span class="crono-badge">${liderTxt}</span>
      <span class="crono-badge">${torneio.participantes.length} clubes</span>
      <span class="crono-badge">${disputados}/${totalJogos} jogos · ${restantes} restantes</span>
      ${artNome ? `<span class="crono-badge">Artilheiro: ${artNome} (${artGols})</span>` : ''}
    </div>`;
  }

  function renderizarTelaCampeonato(torneioId) {
    const el = document.getElementById('campeonato-conteudo');
    if (!el) return;
    const torneio = Mundo.torneios.get(torneioId);
    if (!torneio) { el.innerHTML = '<p class="sem-dados">Campeonato não encontrado.</p>'; return; }

    el.innerHTML = `
      <div class="entidade-header">
        <h2>${torneio.nome}</h2>
        <div class="sub">Temporada ${torneio.ano} · ${torneio.tier || ''} · ${torneio.formato || 'LIGA'}${torneio.ativo ? '' : ' · encerrado'}</div>
        ${_statsCampeonato(torneio)}
      </div>
      <div class="tela-grid">
        <div class="card">
          <div class="card-header">🏅 Classificação</div>
          <div style="overflow-x:auto"><div id="campeonato-tabela"></div></div>
        </div>
        <div class="card">
          <div class="card-header">📅 Jogos</div>
          <div class="card-body">${_grelhaJogos(torneio)}</div>
        </div>
      </div>`;

    renderizarTabela(torneio, document.getElementById('campeonato-tabela'));
  }

  return { ordenarClassificacao, renderizarTabela, renderizarTabelasAtivas, renderizarTelaCampeonato, rodadaDaSemana };
})();
