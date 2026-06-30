'use strict';

const Deus = (() => {

  function forcarTransferencia(jogadorId, destinoId) {
    const jogador = Mundo.jogadores.get(jogadorId);
    const destino = Mundo.clubes.get(destinoId);
    if (!jogador) { alert(`Jogador ID ${jogadorId} não encontrado.`); return; }
    if (!destino) { alert(`Clube ID ${destinoId} não encontrado.`); return; }
    const origemId = jogador.club_id;
    Mercado.executarTransferencia(jogadorId, origemId, destinoId, 0, 'Intervenção Divina');
    publicarNoticia('deus', `MODO DEUS: ${jogador.nome} teletransportado para ${destino.nome}.`);
  }

  function deduzirPontos(clubeId, torneioId, pontos) {
    const torneio = Mundo.torneios.get(torneioId);
    if (!torneio) { alert(`Torneio ${torneioId} não encontrado.`); return; }
    const linha = torneio.classificacao.find(l => l.club_id === clubeId);
    if (!linha) { alert(`Clube ${clubeId} não está neste torneio.`); return; }
    linha.pts = Math.max(0, linha.pts - pontos);
    Tabela.ordenarClassificacao(torneio);
    const nClube = Mundo.clubes.get(clubeId)?.nome || clubeId;
    publicarNoticia('deus', `MODO DEUS: ${nClube} perde ${pontos} pontos no ${torneio.nome}.`);
    UI.atualizarTodosOsPaineis();
  }

  function adicionarClubeAoTorneio(clubeId, torneioId) {
    const torneio = Mundo.torneios.get(torneioId);
    const clube   = Mundo.clubes.get(clubeId);
    if (!torneio || !clube) { alert('ID inválido.'); return; }
    if (torneio.participantes.includes(clubeId)) { alert('Clube já está neste torneio.'); return; }
    torneio.participantes.push(clubeId);
    torneio.classificacao.push({ club_id: clubeId, pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0 });
    publicarNoticia('deus', `MODO DEUS: ${clube.nome} adicionado ao ${torneio.nome}.`);
  }

  function fundacaoForcada(clubeId) {
    const clube = Mundo.clubes.get(clubeId);
    if (!clube) { alert(`Clube ${clubeId} não encontrado.`); return; }
    clube.ativo = true;
    gerarRegensParaClube(clube);
    publicarNoticia('deus', `MODO DEUS: ${clube.nome} ativado fora de época!`);
  }

  function setarPoliticaVeto(politica) {
    if (!['nenhum', 'apenas_tags', 'todos'].includes(politica)) return;
    Mundo.politicaVeto = politica;
    publicarNoticia('sistema', `Política de veto de mercado: "${politica}"`);
  }

  function acionarEvento(eventoId) {
    const evento = Mundo.eventos.find(e => e.evento_id === eventoId);
    if (!evento) { alert(`Evento ${eventoId} não encontrado.`); return; }
    Mundo._eventosFiredIds.add(eventoId);
    executarAcaoEvento(evento);
    publicarNoticia('deus', `MODO DEUS: Evento "${evento.titulo}" acionado manualmente.`);
  }

  function boostAtributos(jogadorId, delta) {
    const j = Mundo.jogadores.get(jogadorId);
    if (!j) { alert(`Jogador ${jogadorId} não encontrado.`); return; }
    Object.keys(j.atributos).forEach(attr => {
      j.atributos[attr] = Math.min(100, Math.max(0, j.atributos[attr] + delta));
    });
    publicarNoticia('deus', `MODO DEUS: Atributos de ${j.nome} alterados em ${delta > 0 ? '+' : ''}${delta}.`);
  }

  return { forcarTransferencia, deduzirPontos, adicionarClubeAoTorneio, fundacaoForcada, setarPoliticaVeto, acionarEvento, boostAtributos };
})();
