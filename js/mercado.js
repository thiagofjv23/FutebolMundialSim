'use strict';

const Mercado = (() => {

  function distanciaKm(stateA, stateB) {
    const coords = Mundo.regrasGlobais?.coordenadasEstados || {};
    const a = coords[String(stateA)];
    const b = coords[String(stateB)];
    if (!a || !b) return 0;
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const hav = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180) * Math.cos(b.lat*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1-hav));
  }

  function verificarRestricaoEra(origemId, destinoId) {
    if (!Mundo.eraAtual?.restricaoTransferencia?.restricaoRegional) return true;
    const origem = Mundo.clubes.get(origemId);
    const destino = Mundo.clubes.get(destinoId);
    if (!origem || !destino) return false;
    const dist = distanciaKm(origem.state_id, destino.state_id);
    return dist <= (Mundo.eraAtual.restricaoTransferencia.raioMaxKm || 500);
  }

  function avaliarInteresse(jogador, clubeDestinoId) {
    const origem  = Mundo.clubes.get(jogador.club_id);
    const destino = Mundo.clubes.get(clubeDestinoId);
    if (!origem || !destino) return false;
    if (origem.club_id === destino.club_id) return false;

    const deltaPrest = destino.prestigio - origem.prestigio;

    switch (jogador.personalidade) {
      case 'Leal':
        // Só sai se não estiver no clube de identidade; nunca para rivais diretos
        if (jogador.club_id === jogador.clubeIdentidadeId) return false;
        return deltaPrest > 15;

      case 'Ambicioso':
        // Aceita se destino tiver prestígio claramente maior
        return deltaPrest > 8;

      case 'Filho_Prodigo':
        if (jogador.idade >= 32 && destino.club_id === jogador.clubeIdentidadeId) return true;
        if (jogador.idade >= 32) return false;
        return deltaPrest > 8; // jovem: age como ambicioso

      case 'Pragmatico':
      default:
        return deltaPrest > 5;
    }
  }

  function executarTransferencia(jogadorId, origemId, destinoId, valor, motivo) {
    const jogador = Mundo.jogadores.get(jogadorId);
    const origem  = Mundo.clubes.get(origemId);
    const destino = Mundo.clubes.get(destinoId);
    if (!jogador || !destino) return false;

    jogador.club_id = destinoId;
    if (valor > 0) {
      if (origem)  origem.financas  -= valor;
      destino.financas += valor;
    }

    const logEntry = {
      ano: Mundo.cronologia.anoAtual,
      semana: Mundo.cronologia.semanaAtual,
      jogadorId,
      jogadorNome: jogador.nome,
      jogadorTag: jogador.tag_legado,
      jogadorPersonalidade: jogador.personalidade,
      origemId,
      origemNome: origem?.nome || '?',
      destinoId,
      destinoNome: destino.nome,
      valor,
      motivo: motivo || 'mercado',
    };

    Mundo.logTransferencias.push(logEntry);

    const nomes = `${origem?.nome || 'sem clube'} → ${destino.nome}`;
    const tagLabel = jogador.tag_legado ? ` [${jogador.tag_legado}]` : '';
    publicarNoticia('transferencia', `${jogador.nome}${tagLabel} transferido: ${nomes}`);

    DB.salvarTransferencia(logEntry).catch(console.error);
    return true;
  }

  function processarMercadoDaSemana() {
    if (Mundo.politicaVeto === 'todos') return; // UI cuida disso no modo manual

    Mundo.clubes.forEach(clube => {
      if (!clube.ativo) return;

      // Verificar se o clube precisa de reforços (menos de 16 jogadores ativos)
      const squad = [...Mundo.jogadores.values()].filter(j => j.club_id === clube.club_id && j.ativo);
      if (squad.length >= 16) return;

      // Buscar jogadores disponíveis para transferência
      const candidatos = [...Mundo.jogadores.values()].filter(j => {
        if (!j.ativo || j.club_id === clube.club_id) return false;
        if (!verificarRestricaoEra(j.club_id, clube.club_id)) return false;
        if (j.tag_legado && Mundo.politicaVeto === 'apenas_tags') {
          UI.mostrarCardVeto(j, clube);
          return false;
        }
        return avaliarInteresse(j, clube.club_id);
      });

      if (!candidatos.length) return;

      // Selecionar o melhor candidato aleatório dentre os interessados
      const alvo = candidatos[Math.floor(Math.random() * candidatos.length)];
      const valorTransf = Math.floor(Math.random() * (Mundo.eraAtual?.restricaoTransferencia?.valorMax || 50));

      executarTransferencia(alvo.player_id, alvo.club_id, clube.club_id, valorTransf);
    });
  }

  function atualizarMoral(jogadorId, delta) {
    const j = Mundo.jogadores.get(jogadorId);
    if (!j) return;
    j.moral = Math.max(0, Math.min(100, j.moral + delta));
  }

  return { executarTransferencia, processarMercadoDaSemana, avaliarInteresse, atualizarMoral };
})();
