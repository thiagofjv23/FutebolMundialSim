'use strict';

const UI = (() => {
  const BUILD = '20260709';
  let _vetoPendente = null;
  let _buscaMapa = new Map();

  // ─── ROTEADOR DE TELAS ──────────────────────────────────────────────────────

  let _telaAtual = { view: 'inicio', params: {} };
  let _historico = [];

  const _TELAS = { inicio: 'tela-inicio', campeonato: 'tela-campeonato', time: 'tela-time', historia: 'tela-historia', nacao: 'tela-nacao', estado: 'tela-estado' };

  function _mostrarTela(view) {
    document.querySelectorAll('.tela').forEach(s => s.classList.remove('ativa'));
    document.getElementById(_TELAS[view] || _TELAS.inicio)?.classList.add('ativa');
  }

  function _renderizarTela(view, params) {
    if (view === 'campeonato')      Tabela.renderizarTelaCampeonato(params.torneioId);
    else if (view === 'time')       renderizarTelaTime(params.clubeId);
    else if (view === 'historia')   Historia.renderizarTelaHistoria();
    else if (view === 'nacao')      renderizarTelaNacao(params.countryId);
    else if (view === 'estado')     renderizarTelaEstado(params.stateId);
    else                            atualizarTodosOsPaineis();
  }

  function navegarPara(view, params = {}) {
    if (view === 'campeonato' && !params.torneioId) return;
    if (view === 'time' && !params.clubeId) return;
    if (view === 'estado' && params.stateId == null) return;
    if (view === 'nacao' && params.countryId == null) return;
    _historico.push(_telaAtual);
    _telaAtual = { view, params };
    _mostrarTela(view);
    _renderizarTela(view, params);
    _atualizarBotaoVoltar();
    window.scrollTo(0, 0);
  }

  function voltar() {
    if (!_historico.length) return;
    _telaAtual = _historico.pop();
    _mostrarTela(_telaAtual.view);
    _renderizarTela(_telaAtual.view, _telaAtual.params);
    _atualizarBotaoVoltar();
    window.scrollTo(0, 0);
  }

  function irParaInicio() {
    _historico = [];
    _telaAtual = { view: 'inicio', params: {} };
    _mostrarTela('inicio');
    _renderizarTela('inicio', {});
    _atualizarBotaoVoltar();
    window.scrollTo(0, 0);
  }

  function _atualizarBotaoVoltar() {
    const btn = document.getElementById('nav-voltar');
    if (btn) btn.hidden = _historico.length === 0;
  }

  // ─── LINKS DE NAVEGAÇÃO ─────────────────────────────────────────────────────

  function _escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function _escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function linkClube(clubeId) {
    const c = Mundo.clubes.get(clubeId);
    return `<a class="link-nav" data-club-id="${clubeId}">${_escapeHtml(c?.nome || `Clube ${clubeId}`)}</a>`;
  }
  function linkTorneio(torneioId) {
    const t = Mundo.torneios.get(torneioId);
    return `<a class="link-nav" data-torneio-id="${torneioId}">${_escapeHtml(t?.nome || `Torneio ${torneioId}`)}</a>`;
  }
  function _nomeEstado(stateId) {
    return Mundo.regrasGlobais?.coordenadasEstados?.[stateId]?.nome || `Estado ${stateId}`;
  }
  function _nomeNacao(countryId) {
    return countryId === 44 ? 'Inglaterra' : countryId === 55 ? 'Brasil' : `Nação ${countryId}`;
  }
  function linkEstado(stateId) {
    return `<a class="link-nav" data-state-id="${stateId}">${_escapeHtml(_nomeEstado(stateId))}</a>`;
  }
  function linkNacao(countryId) {
    return `<a class="link-nav" data-country-id="${countryId}">${_escapeHtml(_nomeNacao(countryId))}</a>`;
  }

  // Índice de nomes (clubes + torneios) para linkar texto livre. Recriado quando muda a contagem.
  let _indiceNomes = null;
  let _indiceStamp = '';

  function _obterIndiceNomes() {
    const stamp = `${Mundo.clubes.size}_${Mundo.torneios.size}`;
    if (_indiceNomes && _indiceStamp === stamp) return _indiceNomes;

    const entradas = [];
    Mundo.clubes.forEach(c => { if (c.nome) entradas.push({ nome: c.nome, tipo: 'clube', id: c.club_id }); });
    Mundo.torneios.forEach(t => { if (t.nome) entradas.push({ nome: t.nome, tipo: 'torneio', id: t.tournament_id }); });

    // Mais longos primeiro: casa "Campeonato Paulista 1920" antes de qualquer substring.
    entradas.sort((a, b) => b.nome.length - a.nome.length);

    const mapa = new Map();
    entradas.forEach(e => { if (!mapa.has(e.nome)) mapa.set(e.nome, e); });

    const regex = entradas.length
      ? new RegExp(entradas.map(e => _escapeRegex(_escapeHtml(e.nome))).join('|'), 'g')
      : null;

    _indiceNomes = { regex, mapa };
    _indiceStamp = stamp;
    return _indiceNomes;
  }

  function linkificarTexto(txt) {
    const seguro = _escapeHtml(txt);
    const { regex, mapa } = _obterIndiceNomes();
    if (!regex) return seguro;
    return seguro.replace(regex, (match) => {
      const e = mapa.get(match);
      if (!e) return match;
      return e.tipo === 'clube'
        ? `<a class="link-nav" data-club-id="${e.id}">${match}</a>`
        : `<a class="link-nav" data-torneio-id="${e.id}">${match}</a>`;
    });
  }

  // ─── INICIALIZAÇÃO ──────────────────────────────────────────────────────────

  async function inicializarUI() {
    await DB.abrirBanco();
    await inicializarMundo();
    _bindEventos();
    const stamp = document.getElementById('build-stamp');
    if (stamp) stamp.textContent = `build ${BUILD} · v${typeof DATA_VERSION !== 'undefined' ? DATA_VERSION : '?'}`;
    atualizarTodosOsPaineis();
  }

  function _bindEventos() {
    // Controles de tempo
    document.getElementById('btn-rodada')?.addEventListener('click',   () => comandarPassagemDeTempo('rodada'));
    document.getElementById('btn-semana')?.addEventListener('click',   () => comandarPassagemDeTempo('semana'));
    document.getElementById('btn-mes')?.addEventListener('click',      () => comandarPassagemDeTempo('mes'));
    document.getElementById('btn-semestre')?.addEventListener('click', () => comandarPassagemDeTempo('semestre'));
    document.getElementById('btn-ano')?.addEventListener('click',      () => comandarPassagemDeTempo('ano'));

    // Controle de tempo persistente no cabeçalho
    document.getElementById('btn-avancar-tempo')?.addEventListener('click', (e) => {
      e.stopPropagation();
      _alternarMenuTempo();
    });
    document.querySelectorAll('.menu-tempo-item').forEach(btn => {
      btn.addEventListener('click', () => {
        if (Mundo.filaDeExecucao.passosRestantes > 0) return;
        _fecharMenuTempo();
        comandarPassagemDeTempo(btn.dataset.escala);
      });
    });

    // Navegação
    document.getElementById('nav-inicio')?.addEventListener('click', irParaInicio);
    document.getElementById('nav-explorar')?.addEventListener('click', () => navegarPara('nacao', { countryId: 55 }));
    document.getElementById('nav-historia')?.addEventListener('click', () => navegarPara('historia'));
    document.getElementById('nav-voltar')?.addEventListener('click', voltar);

    // Busca global (clube ou torneio) via datalist
    const buscaInput = document.getElementById('nav-busca-input');
    buscaInput?.addEventListener('change', () => {
      const alvo = _buscaMapa.get(buscaInput.value.trim());
      if (!alvo) return;
      if (alvo.tipo === 'clube') navegarPara('time', { clubeId: alvo.id });
      else navegarPara('campeonato', { torneioId: alvo.id });
      buscaInput.value = '';
    });
    document.getElementById('nav-sel-campeonato')?.addEventListener('change', (e) => {
      const id = +e.target.value;
      if (id) navegarPara('campeonato', { torneioId: id });
      e.target.value = '';
    });
    document.getElementById('nav-sel-time')?.addEventListener('change', (e) => {
      const id = +e.target.value;
      if (id) navegarPara('time', { clubeId: id });
      e.target.value = '';
    });

    // Delegação global de links de navegação (clube / torneio) + fechar menu de tempo
    document.addEventListener('click', (e) => {
      // Fecha o menu de avanço de tempo ao clicar fora dele
      if (!e.target.closest('#tempo-wrap')) _fecharMenuTempo();

      const a = e.target.closest('[data-club-id], [data-torneio-id], [data-state-id], [data-country-id]');
      if (!a) return;
      if (a.dataset.clubId)         { e.preventDefault(); navegarPara('time', { clubeId: +a.dataset.clubId }); }
      else if (a.dataset.torneioId) { e.preventDefault(); navegarPara('campeonato', { torneioId: +a.dataset.torneioId }); }
      else if (a.dataset.stateId)   { e.preventDefault(); navegarPara('estado', { stateId: +a.dataset.stateId }); }
      else if (a.dataset.countryId) { e.preventDefault(); navegarPara('nacao', { countryId: +a.dataset.countryId }); }
    });

    // Reset salvo (header + painel)
    const resetHandler = () => {
      if (confirm('Resetar simulação? Todo o progresso será perdido.')) {
        DB.salvarEstado('mundo_atual', null).then(() => location.reload());
      }
    };
    document.getElementById('btn-reset')?.addEventListener('click', resetHandler);
    document.getElementById('btn-nova-simulacao')?.addEventListener('click', resetHandler);

    // Crônica
    document.getElementById('btn-gerar-prompt')?.addEventListener('click', () => {
      const ano = +document.getElementById('sel_ano_cronica')?.value;
      if (ano) Cronica.gerarPromptCronicaAnual(ano);
    });
    document.getElementById('btn-copiar-prompt')?.addEventListener('click', () => {
      const txt = document.getElementById('txt_prompt_ia')?.value;
      if (txt) navigator.clipboard.writeText(txt).then(() => mostrarToast('Prompt copiado!'));
    });

    // Modo Deus
    document.getElementById('btn-forcar-transferencia')?.addEventListener('click', () => mostrarModalDeus('transfer'));
    document.getElementById('btn-deduzir-pontos')?.addEventListener('click',       () => mostrarModalDeus('pontos'));
    document.getElementById('btn-fundar-clube')?.addEventListener('click',         () => mostrarModalDeus('fundar'));
    document.getElementById('btn-boost-jogador')?.addEventListener('click',        () => mostrarModalDeus('boost'));
    document.getElementById('sel-veto')?.addEventListener('change', (e) => Deus.setarPoliticaVeto(e.target.value));

    // Modal genérico
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') fecharModal();
    });
    document.getElementById('btn-modal-cancelar')?.addEventListener('click', fecharModal);
    document.getElementById('btn-modal-confirmar')?.addEventListener('click', confirmarModal);

    // Pop-up histórico
    document.getElementById('btn-popup-sim')?.addEventListener('click', () => {
      const popup = document.getElementById('popup-historico');
      const eventoId = popup?.dataset.eventoId;
      if (eventoId) {
        const evento = Mundo.eventos.find(e => e.evento_id === eventoId);
        if (evento) executarAcaoEvento(evento);
      }
      fecharPopupHistorico();
    });
    document.getElementById('btn-popup-nao')?.addEventListener('click', () => {
      fecharPopupHistorico();
      publicarNoticia('evento', 'Evento histórico ignorado pelo Modo Deus.');
    });
  }

  // ─── ATUALIZAÇÃO GERAL ──────────────────────────────────────────────────────

  function atualizarTodosOsPaineis() {
    atualizarCabecalho();
    atualizarNavSelects();
    Tabela.renderizarTabelasAtivas();
    atualizarLogNoticias();
    atualizarLogMercado();
    Cronica.popularSeletorAnos();
    // Re-renderiza a tela ativa se não for a inicial (dados podem ter mudado)
    if (_telaAtual.view === 'campeonato')    Tabela.renderizarTelaCampeonato(_telaAtual.params.torneioId);
    else if (_telaAtual.view === 'time')     renderizarTelaTime(_telaAtual.params.clubeId);
    else if (_telaAtual.view === 'historia') Historia.renderizarTelaHistoria();
    else if (_telaAtual.view === 'nacao')    renderizarTelaNacao(_telaAtual.params.countryId);
    else if (_telaAtual.view === 'estado')   renderizarTelaEstado(_telaAtual.params.stateId);
  }

  function atualizarNavSelects() {
    const torneios = [...Mundo.torneios.values()].sort((a, b) => (b.ano - a.ano) || a.nome.localeCompare(b.nome));
    const clubes = [...Mundo.clubes.values()].filter(c => c.ativo).sort((a, b) => a.nome.localeCompare(b.nome));

    const selT = document.getElementById('nav-sel-campeonato');
    if (selT) {
      selT.innerHTML = '<option value="">—</option>' +
        torneios.map(t => `<option value="${t.tournament_id}">${t.nome}</option>`).join('');
    }
    const selC = document.getElementById('nav-sel-time');
    if (selC) {
      selC.innerHTML = '<option value="">—</option>' +
        clubes.map(c => `<option value="${c.club_id}">${c.nome}</option>`).join('');
    }

    // Índice de busca (datalist): clubes + torneios por nome.
    _buscaMapa = new Map();
    clubes.forEach(c => _buscaMapa.set(c.nome, { tipo: 'clube', id: c.club_id }));
    torneios.forEach(t => _buscaMapa.set(t.nome, { tipo: 'torneio', id: t.tournament_id }));
    const dl = document.getElementById('nav-busca-lista');
    if (dl) dl.innerHTML = [..._buscaMapa.keys()].map(n => `<option value="${_escapeHtml(n)}"></option>`).join('');
  }

  function atualizarCabecalho() {
    const mes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const { anoAtual, mesAtual, semanaAtual } = Mundo.cronologia;
    _setText('hdr-ano',  anoAtual);
    _setText('hdr-semana', `Sem. ${semanaAtual}`);
    _setText('hdr-mes',  mes[(mesAtual || 1) - 1] || 'Jan');
    _setText('hdr-era',  Mundo.eraAtual?.nome?.replace('_', ' ') || '');
  }

  function atualizarLogNoticias() {
    const el = document.getElementById('log-noticias');
    if (!el) return;
    const icone = { gol: '⚽', transferencia: '🔄', evento: '📜', fundacao: '🏛', tabu: '💥', sistema: 'ℹ', estreia: '✨', titulo: '🏆', aposentadoria: '👴', deus: '⚡' };
    el.innerHTML = Mundo.logNoticias.slice(0, 50).map(n =>
      `<li class="noticia noticia-${n.tipo}"><span class="noticia-icon">${icone[n.tipo] || '•'}</span><span class="noticia-texto">${linkificarTexto(n.mensagem)}</span><span class="noticia-meta">${n.ano} S${n.semana}</span></li>`
    ).join('');
  }

  function atualizarLogMercado() {
    const el = document.getElementById('log-mercado');
    if (!el) return;
    const tranfs = [...Mundo.logTransferencias].reverse().slice(0, 20);
    if (!tranfs.length) { el.innerHTML = '<li class="sem-dados">Sem movimentações registradas.</li>'; return; }
    el.innerHTML = tranfs.map(t =>
      `<li class="transferencia"><strong>${_escapeHtml(t.jogadorNome)}</strong>${t.jogadorTag ? ` <span class="tag">[${_escapeHtml(t.jogadorTag)}]</span>` : ''} <span class="arrow">→</span> ${linkClube(t.destinoId)} <span class="valor">${t.valor > 0 ? '£' + t.valor : 'Livre'}</span></li>`
    ).join('');
  }

  // ─── CONTROLE DE BOTÕES ─────────────────────────────────────────────────────

  function setBotoesTempoAtivos(ativo) {
    ['btn-rodada','btn-semana','btn-mes','btn-semestre','btn-ano','btn-avancar-tempo'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !ativo;
    });
    document.querySelectorAll('.menu-tempo-item').forEach(el => { el.disabled = !ativo; });
    if (!ativo) _fecharMenuTempo();
    const status = document.getElementById('status-tempo');
    if (status) status.textContent = ativo ? '' : 'Simulando…';
  }

  // ─── MENU DE AVANÇO DE TEMPO (cabeçalho) ─────────────────────────────────────

  function _alternarMenuTempo() {
    const menu = document.getElementById('menu-tempo');
    if (!menu) return;
    menu.hidden = !menu.hidden;
  }
  function _fecharMenuTempo() {
    const menu = document.getElementById('menu-tempo');
    if (menu && !menu.hidden) menu.hidden = true;
  }

  // ─── MODAL MODO DEUS ────────────────────────────────────────────────────────

  let _modalAcao = null;

  function mostrarModalDeus(tipo) {
    _modalAcao = tipo;
    const modal = document.getElementById('modal-overlay');
    const titulo = document.getElementById('modal-titulo');
    const corpo  = document.getElementById('modal-corpo');
    if (!modal) return;

    const configs = {
      transfer: {
        t: 'Forçar Transferência',
        html: `<label>ID do Jogador:<input id="m-jogador-id" type="number" placeholder="ex: 1001"></label>
               <label>ID do Clube Destino:<input id="m-clube-id" type="number" placeholder="ex: 202"></label>`
      },
      pontos: {
        t: 'Deduzir Pontos',
        html: `<label>ID do Clube:<input id="m-clube-id" type="number"></label>
               <label>ID do Torneio:<input id="m-torneio-id" type="number"></label>
               <label>Pontos a deduzir:<input id="m-pontos" type="number" value="3"></label>`
      },
      fundar: {
        t: 'Fundar Clube Fora de Época',
        html: `<label>ID do Clube:<input id="m-clube-id" type="number"></label>`
      },
      boost: {
        t: 'Boost de Atributos',
        html: `<label>ID do Jogador:<input id="m-jogador-id" type="number"></label>
               <label>Delta (+/-):<input id="m-delta" type="number" value="10"></label>`
      },
    };

    const cfg = configs[tipo] || { t: 'Ação', html: '' };
    titulo.textContent = cfg.t;
    corpo.innerHTML = cfg.html;
    modal.classList.add('visivel');
  }

  function confirmarModal() {
    const v = id => +document.getElementById(id)?.value;
    switch (_modalAcao) {
      case 'transfer': Deus.forcarTransferencia(v('m-jogador-id'), v('m-clube-id')); break;
      case 'pontos':   Deus.deduzirPontos(v('m-clube-id'), v('m-torneio-id'), v('m-pontos')); break;
      case 'fundar':   Deus.fundacaoForcada(v('m-clube-id')); break;
      case 'boost':    Deus.boostAtributos(v('m-jogador-id'), v('m-delta')); break;
    }
    fecharModal();
    atualizarTodosOsPaineis();
  }

  function fecharModal() {
    document.getElementById('modal-overlay')?.classList.remove('visivel');
    _modalAcao = null;
  }

  // ─── POP-UP HISTÓRICO ────────────────────────────────────────────────────────

  let _popupQueue = [];
  let _popupAberto = false;

  function mostrarPopupHistorico(evento) {
    _popupQueue.push(evento);
    if (!_popupAberto) _exibirProximoPopup();
  }

  function _exibirProximoPopup() {
    if (!_popupQueue.length) { _popupAberto = false; return; }
    _popupAberto = true;
    const evento = _popupQueue.shift();
    const popup = document.getElementById('popup-historico');
    if (!popup) return;
    popup.dataset.eventoId = evento.evento_id;
    _setText('popup-titulo', evento.titulo);
    _setText('popup-descricao', evento.descricao);
    popup.classList.add('visivel');
  }

  function fecharPopupHistorico() {
    document.getElementById('popup-historico')?.classList.remove('visivel');
    setTimeout(_exibirProximoPopup, 300);
  }

  // ─── CARD DE VETO ────────────────────────────────────────────────────────────

  function mostrarCardVeto(jogador, clubeDestino) {
    if (_vetoPendente) return; // um veto por vez
    _vetoPendente = { jogador, clubeDestino };
    const card = document.getElementById('card-veto');
    if (!card) return;
    _setText('veto-jogador', `${jogador.nome} [${jogador.tag_legado}] (${jogador.personalidade})`);
    _setText('veto-origem',  Mundo.clubes.get(jogador.club_id)?.nome || '?');
    _setText('veto-destino', clubeDestino.nome);
    card.classList.add('visivel');
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-veto-aprovar')?.addEventListener('click', () => {
      if (_vetoPendente) {
        Mercado.executarTransferencia(_vetoPendente.jogador.player_id, _vetoPendente.jogador.club_id, _vetoPendente.clubeDestino.club_id, 0, 'veto-aprovado');
      }
      _vetoPendente = null;
      document.getElementById('card-veto')?.classList.remove('visivel');
    });
    document.getElementById('btn-veto-rejeitar')?.addEventListener('click', () => {
      _vetoPendente = null;
      document.getElementById('card-veto')?.classList.remove('visivel');
    });
  });

  // ─── TELA DE TIME — PALMARÈS E HISTÓRICO ─────────────────────────────────────

  function _renderPalmaresClube(clubeId) {
    const titulos = [...Mundo.torneios.values()]
      .filter(t => t.campeao === clubeId)
      .sort((a, b) => b.ano - a.ano);

    if (!titulos.length) return `
      <div class="card" style="margin-top:12px">
        <div class="card-header">🏆 Palmarès</div>
        <div class="card-body"><p class="sem-dados">Nenhum título conquistado ainda.</p></div>
      </div>`;

    const linhas = titulos.map(t => `<tr>
      <td>${t.ano}</td>
      <td class="col-nome" style="text-align:left">${_escapeHtml(t.nomeBase || t.nome.replace(/ [\d\/]+$/, ''))}</td>
    </tr>`).join('');

    return `
      <div class="card" style="margin-top:12px">
        <div class="card-header">🏆 Palmarès — ${titulos.length} título(s)</div>
        <div style="overflow-x:auto">
          <table class="tabela-classificacao">
            <thead><tr><th>Ano</th><th class="col-nome">Competição</th></tr></thead>
            <tbody>${linhas}</tbody>
          </table>
        </div>
      </div>`;
  }

  function _renderHistoricoTorneiosClube(clubeId, filtro) {
    const todos = [...Mundo.torneios.values()]
      .filter(t => Array.isArray(t.participantes) && t.participantes.includes(clubeId)
              && Array.isArray(t.classificacao) && t.classificacao.length)
      .sort((a, b) => (b.ano - a.ano) || a.nome.localeCompare(b.nome));

    const baseNames = [...new Set(todos.map(t => t.nomeBase || t.nome.replace(/ [\d\/]+$/, '')))];
    const lista = filtro ? todos.filter(t => t.nomeBase || t.nome.replace(/ [\d\/]+$/, '') === filtro) : todos;
    const opcoes = baseNames.map(n =>
      `<option value="${n}"${filtro === n ? ' selected' : ''}>${n}</option>`
    ).join('');

    const semDados = '<tr><td colspan="9" class="sem-dados" style="padding:14px;text-align:center">Sem participações registradas.</td></tr>';

    const linhas = lista.map(t => {
      const idx = t.classificacao.findIndex(l => l.club_id === clubeId);
      if (idx === -1) return '';
      const l = t.classificacao[idx];
      const pos = idx + 1;
      const icone = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : '';
      const isCampeao = t.campeao === clubeId;
      const sg = l.gp > l.gc
        ? `<span class="pos">+${l.gp - l.gc}</span>`
        : l.sg < 0 ? `<span class="neg">${l.sg}</span>` : String(l.sg);
      return `<tr${isCampeao ? ' class="zona-titulo"' : ''}>
        <td>${t.ano}</td>
        <td class="col-nome" style="text-align:left;font-size:12px">${_escapeHtml(t.nomeBase || t.nome.replace(/ [\d\/]+$/, ''))}</td>
        <td>${icone}${pos}º</td>
        <td>${l.pts}</td><td>${l.j}</td><td>${l.v}</td><td>${l.e}</td><td>${l.d}</td><td>${sg}</td>
      </tr>`;
    }).filter(Boolean).join('');

    return `
      <div id="hist-clube-historico-card" class="card" style="margin-top:12px">
        <div class="card-header">📊 Histórico em Campeonatos</div>
        <div class="hist-filtro-bar">
          <label>Filtrar competição:</label>
          <select id="hist-clube-filtro-torneio">
            <option value="">Todas</option>${opcoes}
          </select>
        </div>
        <div style="overflow-x:auto">
          <table class="tabela-classificacao">
            <thead><tr><th>Ano</th><th class="col-nome">Torneio</th><th>Pos</th><th>Pts</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr></thead>
            <tbody>${linhas || semDados}</tbody>
          </table>
        </div>
      </div>`;
  }

  function _bindFiltroClubeHistorico(el, clubeId) {
    el.querySelector('#hist-clube-filtro-torneio')?.addEventListener('change', (e) => {
      const card = el.querySelector('#hist-clube-historico-card');
      if (!card) return;
      const temp = document.createElement('div');
      temp.innerHTML = _renderHistoricoTorneiosClube(clubeId, e.target.value);
      card.replaceWith(temp.firstElementChild);
      _bindFiltroClubeHistorico(el, clubeId);
    });
  }

  // ─── TELA DE TIME ────────────────────────────────────────────────────────────

  // ─── TELAS-ÍNDICE: NAÇÃO / ESTADO ───────────────────────────────────────────

  function renderizarTelaNacao(countryId) {
    const el = document.getElementById('nacao-conteudo');
    if (!el) return;
    const ano = Mundo.cronologia.anoAtual;
    const clubes = [...Mundo.clubes.values()].filter(c => c.country_id === countryId);

    const estadosMap = new Map();
    clubes.forEach(c => {
      if (c.state_id == null) return;
      if (!estadosMap.has(c.state_id)) estadosMap.set(c.state_id, { total: 0, ativos: 0 });
      const s = estadosMap.get(c.state_id);
      s.total++; if (c.ativo) s.ativos++;
    });
    const estados = [...estadosMap.entries()].sort((a, b) => _nomeEstado(a[0]).localeCompare(_nomeEstado(b[0])));
    const ligasNacionais = [...Mundo.torneios.values()].filter(t => t.country_id === countryId && t.ativo);

    const cardEstado = ([sid, s]) => `<div class="idx-item">
      <div class="idx-nome">${linkEstado(sid)}</div>
      <div class="idx-sub">${s.ativos} clube(s) ativo(s)${s.total !== s.ativos ? ` · ${s.total} no total` : ''}</div>
    </div>`;

    el.innerHTML = `
      <div class="entidade-header">
        <h2>${_escapeHtml(_nomeNacao(countryId))}</h2>
        <div class="sub">Nações: ${linkNacao(55)} · ${linkNacao(44)}</div>
        <div class="badges"><span class="crono-badge">${clubes.filter(c => c.ativo).length} clubes ativos em ${ano}</span></div>
      </div>
      ${estados.length ? `<div class="card"><div class="card-header">🗺️ Estados</div><div class="idx-grid">${estados.map(cardEstado).join('')}</div></div>` : ''}
      ${ligasNacionais.length ? `<div class="card" style="margin-top:12px"><div class="card-header">🏆 Ligas nacionais</div><div class="card-body">${ligasNacionais.map(t => `<div class="jogo-linha">${linkTorneio(t.tournament_id)}</div>`).join('')}</div></div>` : ''}`;
  }

  function renderizarTelaEstado(stateId) {
    const el = document.getElementById('estado-conteudo');
    if (!el) return;
    const ano = Mundo.cronologia.anoAtual;
    const ativos = [...Mundo.clubes.values()].filter(c => c.state_id === stateId && c.ativo);
    const torneios = [...Mundo.torneios.values()].filter(t => t.state_id === stateId && t.ativo);

    const porDiv = new Map();
    ativos.forEach(c => {
      const d = c.divisao ?? 1;
      if (!porDiv.has(d)) porDiv.set(d, []);
      porDiv.get(d).push(c);
    });
    const divisoes = [...porDiv.keys()].sort((a, b) => a - b);

    const blocoDiv = (d) => {
      const lista = porDiv.get(d).sort((a, b) => b.prestigio - a.prestigio);
      const torneioDiv = torneios.find(t => (t.divisao ?? 1) === d);
      return `<div class="card" style="margin-top:12px">
        <div class="card-header">${d}ª Divisão${torneioDiv ? ' — ' + linkTorneio(torneioDiv.tournament_id) : ''}</div>
        <div class="idx-grid">${lista.map(c => `<div class="idx-item">
          <div class="idx-nome">${linkClube(c.club_id)}</div>
          <div class="idx-sub">Prestígio ${c.prestigio} · fund. ${c.anoFundacao}</div>
        </div>`).join('')}</div>
      </div>`;
    };

    el.innerHTML = `
      <div class="entidade-header">
        <h2>${_escapeHtml(_nomeEstado(stateId))}</h2>
        <div class="sub">${linkNacao(55)} · ${ativos.length} clube(s) ativo(s) em ${ano}</div>
      </div>
      ${divisoes.length ? divisoes.map(blocoDiv).join('') : '<p class="sem-dados">Nenhum clube ativo neste estado.</p>'}`;
  }

  function renderizarTelaTime(clubeId) {
    const el = document.getElementById('time-conteudo');
    if (!el) return;
    const clube = Mundo.clubes.get(clubeId);
    if (!clube) { el.innerHTML = '<p class="sem-dados">Clube não encontrado.</p>'; return; }

    const jogadores = [...Mundo.jogadores.values()].filter(j => j.club_id === clubeId && j.ativo);
    const forca = Simulador.calcularForcaTime(clubeId);
    const estado = Mundo.regrasGlobais?.coordenadasEstados?.[clube.state_id]?.nome || `Estado ${clube.state_id}`;

    // Escalação por posição
    const porPosicao = { Goleiro: [], Zagueiro: [], Meia: [], Atacante: [] };
    jogadores.forEach(j => { if (porPosicao[j.posicao]) porPosicao[j.posicao].push(j); });
    const mapaAttr = { Goleiro: 'gol', Zagueiro: 'defesa', Meia: 'armacao', Atacante: 'ataque' };

    const linhasJogadores = Object.entries(porPosicao).map(([pos, lista]) => {
      const sorted = lista.sort((a, b) => b.atributos[mapaAttr[pos]] - a.atributos[mapaAttr[pos]]);
      return sorted.map(j => {
        const cond = j.condicaoFisica ?? 100;
        const corCond = cond >= 80 ? 'pos' : cond < 50 ? 'neg' : '';
        return `<tr>
          <td>${_escapeHtml(j.nome)}${j.tag_legado ? ` <span class="tag">[${_escapeHtml(j.tag_legado)}]</span>` : ''}</td>
          <td>${j.posicao}</td><td>${j.idade}</td>
          <td>${j.atributos.gol}/${j.atributos.defesa}/${j.atributos.armacao}/${j.atributos.ataque}</td>
          <td>${j.personalidade}</td><td>${j.moral}</td>
          <td class="${corCond}">${cond}%</td>
        </tr>`;
      }).join('');
    }).join('');

    // Jogos do clube (todos os torneios)
    const jogosClube = [];
    Mundo.torneios.forEach(t => {
      (t.fixtures || []).forEach(f => {
        if (f.casaId !== clubeId && f.visitanteId !== clubeId) return;
        const emCasa = f.casaId === clubeId;
        const advId  = emCasa ? f.visitanteId : f.casaId;
        jogosClube.push({
          torneioId: t.tournament_id, semana: f.semana, emCasa, advId,
          rodada: Tabela.rodadaDaSemana(t, f.semana), resultado: f.resultado,
        });
      });
    });
    jogosClube.sort((a, b) => a.semana - b.semana);

    const linhaJogo = (g) => {
      const adv = linkClube(g.advId);
      const mando = g.emCasa ? '(C)' : '(F)';
      let placar;
      if (g.resultado) {
        const gp = g.emCasa ? g.resultado.golsCasa : g.resultado.golsVisit;
        const gc = g.emCasa ? g.resultado.golsVisit : g.resultado.golsCasa;
        const cls = gp > gc ? 'pos' : gp < gc ? 'neg' : '';
        placar = `<span class="placar ${cls}">${gp} × ${gc}</span>`;
      } else {
        placar = `<span class="placar pendente">Sem. ${g.semana}</span>`;
      }
      return `<div class="jogo-linha"><span class="casa">${adv} <small style="color:var(--text-muted)">${mando}</small></span>${placar}<span class="visit" style="color:var(--text-muted);font-size:11px">R${g.rodada} · ${linkTorneio(g.torneioId)}</span></div>`;
    };

    const disputados = jogosClube.filter(g => g.resultado);
    const proximos   = jogosClube.filter(g => !g.resultado);

    el.innerHTML = `
      <div class="entidade-header">
        <h2>${_escapeHtml(clube.nome)}</h2>
        <div class="sub">${_escapeHtml(clube.apelido || '')}${clube.apelido ? ' · ' : ''}${_escapeHtml(estado)} · Fundado em ${clube.anoFundacao}</div>
        <div class="badges">
          <span class="crono-badge">Prestígio ${clube.prestigio}</span>
          <span class="crono-badge">Finanças £${clube.financas}</span>
          <span class="crono-badge">Torcida ${(clube.torcida?.locais || 0).toLocaleString()}</span>
          <span class="crono-badge">Técnico: ${_escapeHtml(clube.tecnico?.nome || '?')} (${_escapeHtml(clube.tecnico?.estiloTatico || '?')}) · ${_escapeHtml(clube.tecnico?.formacao || '—')}</span>
          ${clube.stadium ? `<span class="crono-badge">${_escapeHtml(clube.stadium.nome)} · ${(clube.stadium.capacidade || 0).toLocaleString()}</span>` : ''}
        </div>
        <div class="clube-forca" style="margin-top:10px">
          Força média — Gol: ${Math.round(forca.gol)} | Def: ${Math.round(forca.defesa)} | Arm: ${Math.round(forca.armacao)} | Atk: ${Math.round(forca.ataque)}
        </div>
      </div>

      <div class="tela-grid">
        <div class="card">
          <div class="card-header">📋 Elenco (${jogadores.length})</div>
          <div style="overflow-x:auto">
            <table class="tabela-elenco">
              <thead><tr><th>Jogador</th><th>Pos</th><th>Idade</th><th>G/D/A/T</th><th>Personalidade</th><th>Moral</th><th>Cond</th></tr></thead>
              <tbody>${linhasJogadores || '<tr><td colspan="7" class="sem-dados">Sem jogadores.</td></tr>'}</tbody>
            </table>
          </div>
        </div>

        <div>
          <div class="card" style="margin-bottom:12px">
            <div class="card-header">📅 Próximos Jogos</div>
            <div class="card-body">${proximos.length ? proximos.map(linhaJogo).join('') : '<p class="sem-dados">Sem jogos agendados.</p>'}</div>
          </div>
          <div class="card">
            <div class="card-header">📊 Resultados</div>
            <div class="card-body">${disputados.length ? [...disputados].reverse().map(linhaJogo).join('') : '<p class="sem-dados">Nenhum jogo disputado ainda.</p>'}</div>
          </div>
        </div>
      </div>`;
    try {
      el.insertAdjacentHTML('beforeend', _renderPalmaresClube(clubeId));
      el.insertAdjacentHTML('beforeend', _renderHistoricoTorneiosClube(clubeId, ''));
      _bindFiltroClubeHistorico(el, clubeId);
    } catch (err) {
      console.error('[Clube] Erro nas seções históricas:', err);
    }
  }

  // Mantido por compatibilidade: agora navega para a tela de time.
  function mostrarDetalheClube(clubeId) {
    navegarPara('time', { clubeId });
  }

  // ─── TOAST ──────────────────────────────────────────────────────────────────

  function mostrarToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('visivel');
    setTimeout(() => t.classList.remove('visivel'), 2500);
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────────

  function _setText(id, txt) {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  }

  return {
    inicializarUI, atualizarTodosOsPaineis, setBotoesTempoAtivos,
    mostrarPopupHistorico, mostrarDetalheClube, mostrarCardVeto, mostrarToast,
    navegarPara, voltar, irParaInicio,
    linkClube, linkTorneio, linkEstado, linkNacao, linkificarTexto,
    renderizarTelaTime,
  };
})();

window.addEventListener('DOMContentLoaded', () => UI.inicializarUI().catch(err => {
  console.error('Falha ao inicializar:', err);
  document.body.innerHTML = `<div style="color:red;padding:2rem;font-family:monospace"><h2>Erro de Inicialização</h2><pre>${err.message}</pre><p>Execute o projeto via servidor HTTP local: <code>python -m http.server 8080</code></p></div>`;
}));
