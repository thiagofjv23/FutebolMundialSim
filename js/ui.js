'use strict';

const UI = (() => {
  let _vetoPendente = null;

  // ─── INICIALIZAÇÃO ──────────────────────────────────────────────────────────

  async function inicializarUI() {
    await DB.abrirBanco();
    await inicializarMundo();
    _bindEventos();
    atualizarTodosOsPaineis();
  }

  function _bindEventos() {
    // Controles de tempo
    document.getElementById('btn-rodada')?.addEventListener('click',   () => comandarPassagemDeTempo('rodada'));
    document.getElementById('btn-semana')?.addEventListener('click',   () => comandarPassagemDeTempo('semana'));
    document.getElementById('btn-mes')?.addEventListener('click',      () => comandarPassagemDeTempo('mes'));
    document.getElementById('btn-semestre')?.addEventListener('click', () => comandarPassagemDeTempo('semestre'));
    document.getElementById('btn-ano')?.addEventListener('click',      () => comandarPassagemDeTempo('ano'));

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
    Tabela.renderizarTabelasAtivas();
    atualizarLogNoticias();
    atualizarLogMercado();
    Cronica.popularSeletorAnos();
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
      `<li class="noticia noticia-${n.tipo}"><span class="noticia-icon">${icone[n.tipo] || '•'}</span><span class="noticia-texto">${n.mensagem}</span><span class="noticia-meta">${n.ano} S${n.semana}</span></li>`
    ).join('');
  }

  function atualizarLogMercado() {
    const el = document.getElementById('log-mercado');
    if (!el) return;
    const tranfs = [...Mundo.logTransferencias].reverse().slice(0, 20);
    if (!tranfs.length) { el.innerHTML = '<li class="sem-dados">Sem movimentações registradas.</li>'; return; }
    el.innerHTML = tranfs.map(t =>
      `<li class="transferencia"><strong>${t.jogadorNome}</strong>${t.jogadorTag ? ` <span class="tag">[${t.jogadorTag}]</span>` : ''} <span class="arrow">→</span> ${t.destinoNome} <span class="valor">${t.valor > 0 ? '£' + t.valor : 'Livre'}</span></li>`
    ).join('');
  }

  // ─── CONTROLE DE BOTÕES ─────────────────────────────────────────────────────

  function setBotoesTempoAtivos(ativo) {
    ['btn-rodada','btn-semana','btn-mes','btn-semestre','btn-ano'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !ativo;
    });
    const status = document.getElementById('status-tempo');
    if (status) status.textContent = ativo ? '' : 'Simulando…';
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

  // ─── DETALHE DO CLUBE ────────────────────────────────────────────────────────

  function mostrarDetalheClube(clubeId) {
    const clube = Mundo.clubes.get(clubeId);
    if (!clube) return;
    const jogadores = [...Mundo.jogadores.values()].filter(j => j.club_id === clubeId && j.ativo);
    const forca = Simulador.calcularForcaTime(clubeId);

    const porPosicao = { Goleiro: [], Zagueiro: [], Meia: [], Atacante: [] };
    jogadores.forEach(j => { if (porPosicao[j.posicao]) porPosicao[j.posicao].push(j); });

    const linhasJogadores = Object.entries(porPosicao).map(([pos, lista]) => {
      const sorted = lista.sort((a, b) => {
        const m = { Goleiro:'gol', Zagueiro:'defesa', Meia:'armacao', Atacante:'ataque' };
        return b.atributos[m[pos]] - a.atributos[m[pos]];
      });
      return sorted.map(j => `<tr>
        <td>${j.nome}${j.tag_legado ? ` <span class="tag">[${j.tag_legado}]</span>` : ''}</td>
        <td>${j.posicao}</td><td>${j.idade}</td>
        <td>${j.atributos.gol}/${j.atributos.defesa}/${j.atributos.armacao}/${j.atributos.ataque}</td>
        <td>${j.personalidade}</td><td>${j.moral}</td>
      </tr>`).join('');
    }).join('');

    document.getElementById('modal-titulo').textContent = `${clube.nome} — Elenco`;
    document.getElementById('modal-corpo').innerHTML = `
      <div class="clube-stats">
        <span>Prestígio: <strong>${clube.prestigio}</strong></span>
        <span>Finanças: <strong>${clube.financas}</strong></span>
        <span>Torcida: <strong>${clube.torcida.locais.toLocaleString()}</strong></span>
        <span>Técnico: <strong>${clube.tecnico?.nome || '?'}</strong> (${clube.tecnico?.estiloTatico || '?'})</span>
      </div>
      <div class="clube-forca">
        Força média — Gol: ${Math.round(forca.gol)} | Def: ${Math.round(forca.defesa)} | Arm: ${Math.round(forca.armacao)} | Atk: ${Math.round(forca.ataque)}
      </div>
      <table class="tabela-elenco">
        <thead><tr><th>Jogador</th><th>Pos</th><th>Idade</th><th>G/D/A/T</th><th>Personalidade</th><th>Moral</th></tr></thead>
        <tbody>${linhasJogadores}</tbody>
      </table>`;
    document.getElementById('modal-overlay')?.classList.add('visivel');
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

  return { inicializarUI, atualizarTodosOsPaineis, setBotoesTempoAtivos, mostrarPopupHistorico, mostrarDetalheClube, mostrarCardVeto, mostrarToast };
})();

window.addEventListener('DOMContentLoaded', () => UI.inicializarUI().catch(err => {
  console.error('Falha ao inicializar:', err);
  document.body.innerHTML = `<div style="color:red;padding:2rem;font-family:monospace"><h2>Erro de Inicialização</h2><pre>${err.message}</pre><p>Execute o projeto via servidor HTTP local: <code>python -m http.server 8080</code></p></div>`;
}));
