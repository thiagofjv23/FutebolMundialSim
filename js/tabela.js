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
            const clube = Mundo.clubes.get(l.club_id);
            const nome  = clube?.nome || `Clube ${l.club_id}`;
            let cls = '';
            if (i === 0) cls = 'zona-titulo';
            else if (i < 3) cls = 'zona-promocao';
            else if (i >= total - 2) cls = 'zona-rebaixamento';
            return `<tr class="${cls}" data-club-id="${l.club_id}">
              <td>${i + 1}</td>
              <td class="col-nome">${nome}</td>
              <td><strong>${l.pts}</strong></td>
              <td>${l.j}</td><td>${l.v}</td><td>${l.e}</td><td>${l.d}</td>
              <td>${l.gp}</td><td>${l.gc}</td>
              <td class="${l.sg > 0 ? 'pos' : l.sg < 0 ? 'neg' : ''}">${l.sg > 0 ? '+' : ''}${l.sg}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
    containerEl.innerHTML = html;

    // Click em clube para detalhe
    containerEl.querySelectorAll('tr[data-club-id]').forEach(tr => {
      tr.addEventListener('click', () => UI.mostrarDetalheClube(+tr.dataset.clubId));
    });
  }

  function renderizarTabelasAtivas() {
    const wrap = document.getElementById('tabelas-wrap');
    if (!wrap) return;

    const torneiosAtivos = [...Mundo.torneios.values()].filter(t => t.ativo && t.ano === Mundo.cronologia.anoAtual);

    // Tabs
    const tabsHtml = torneiosAtivos.map((t, i) =>
      `<button class="tab-btn${i === 0 ? ' ativo' : ''}" data-torneio-id="${t.tournament_id}">${t.nome}</button>`
    ).join('');

    wrap.innerHTML = `<div id="tabs-torneios" class="tabs">${tabsHtml}</div><div id="tabela-container"></div>`;

    if (torneiosAtivos.length > 0) {
      renderizarTabela(torneiosAtivos[0], document.getElementById('tabela-container'));
    }

    wrap.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        wrap.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('ativo'));
        btn.classList.add('ativo');
        const t = Mundo.torneios.get(+btn.dataset.torneioId);
        renderizarTabela(t, document.getElementById('tabela-container'));
      });
    });
  }

  return { ordenarClassificacao, renderizarTabela, renderizarTabelasAtivas };
})();
