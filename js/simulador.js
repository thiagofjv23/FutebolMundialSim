'use strict';

const Simulador = (() => {

  // ─── FORÇA DO TIME ──────────────────────────────────────────────────────────

  function calcularForcaTime(clubeId) {
    const squad = [...Mundo.jogadores.values()].filter(j => j.club_id === clubeId && j.ativo);
    const por = { Goleiro: [], Zagueiro: [], Meia: [], Atacante: [] };
    squad.forEach(j => { if (por[j.posicao]) por[j.posicao].push(j); });

    const med = (arr, attr) => arr.length ? arr.reduce((s, j) => s + j.atributos[attr], 0) / arr.length : 40;

    return {
      gol:     med(por.Goleiro,  'gol'),
      defesa:  med(por.Zagueiro, 'defesa'),
      armacao: med(por.Meia,     'armacao'),
      ataque:  med(por.Atacante, 'ataque'),
    };
  }

  function aplicarMultiplicadorTatico(f, estilo) {
    const r = { ...f };
    if (estilo === 'ofensivo')             { r.ataque *= 1.2;  r.armacao *= 1.1; r.defesa *= 0.9; }
    else if (estilo === 'defensivo' || estilo === 'retranca') { r.defesa *= 1.25; r.gol *= 1.1; r.ataque *= 0.85; }
    return r;
  }

  // ─── MOTOR DE PARTIDAS ──────────────────────────────────────────────────────

  function simularGols(xG) {
    // Poisson approximation via successive multiplication
    let k = 0, p = Math.exp(-xG), cumP = p;
    const r = Math.random();
    while (cumP < r && k < 12) { k++; p *= xG / k; cumP += p; }
    return k;
  }

  function calcularXG(ataqNorm, defNorm) {
    const base = (Mundo.eraAtual?.xGBase || 1.5) * Math.pow(ataqNorm / Math.max(0.1, defNorm), 0.75);
    const caos = Mundo.eraAtual?.fatorCaos || 0.35;
    const fator = 1.0 + (Math.random() * 2 - 1) * caos;
    return Math.max(0, base * fator * 0.65);
  }

  function determinarArtilheiros(clubeId, numGols) {
    if (numGols === 0) return [];
    const atacantes = [...Mundo.jogadores.values()].filter(
      j => j.club_id === clubeId && j.ativo && (j.posicao === 'Atacante' || j.posicao === 'Meia')
    );
    if (!atacantes.length) return [];

    const totalAtk = atacantes.reduce((s, j) => s + j.atributos.ataque, 0);
    const artilheiros = [];

    for (let g = 0; g < numGols; g++) {
      let r = Math.random() * totalAtk;
      for (const j of atacantes) {
        r -= j.atributos.ataque;
        if (r <= 0) { artilheiros.push({ player_id: j.player_id, nome: j.nome, club_id: clubeId }); break; }
      }
    }
    return artilheiros;
  }

  function calcularResultado(casaId, visitanteId) {
    const fCasa = calcularForcaTime(casaId);
    const fVisit = calcularForcaTime(visitanteId);
    const eCasa  = Mundo.clubes.get(casaId)?.tecnico?.estiloTatico  || 'equilibrado';
    const eVisit = Mundo.clubes.get(visitanteId)?.tecnico?.estiloTatico || 'equilibrado';

    const tCasa  = aplicarMultiplicadorTatico(fCasa,  eCasa);
    const tVisit = aplicarMultiplicadorTatico(fVisit, eVisit);

    // Vantagem do mando de campo: leve boost ofensivo
    const atNormCasa  = (tCasa.ataque  * 0.6 + tCasa.armacao  * 0.4) * 1.08 / 100;
    const defNormCasa = (tVisit.gol    * 0.4 + tVisit.defesa  * 0.6) / 100;
    const atNormVisit = (tVisit.ataque * 0.6 + tVisit.armacao * 0.4) / 100;
    const defNormVisit= (tCasa.gol     * 0.4 + tCasa.defesa   * 0.6) / 100;

    const golsCasa  = simularGols(calcularXG(atNormCasa,  defNormCasa));
    const golsVisit = simularGols(calcularXG(atNormVisit, defNormVisit));

    return {
      golsCasa,
      golsVisit,
      artilheiros: [
        ...determinarArtilheiros(casaId,    golsCasa),
        ...determinarArtilheiros(visitanteId, golsVisit),
      ],
    };
  }

  function registrarResultado(torneio, fixture, resultado) {
    fixture.resultado = resultado;

    // Atualizar classificação
    const { golsCasa, golsVisit } = resultado;
    const ptsCasa  = golsCasa  > golsVisit ? 3 : golsCasa  === golsVisit ? 1 : 0;
    const ptsVisit = golsVisit > golsCasa  ? 3 : golsCasa  === golsVisit ? 1 : 0;

    atualizarLinhaClassificacao(torneio, fixture.casaId,      golsCasa,  golsVisit, ptsCasa);
    atualizarLinhaClassificacao(torneio, fixture.visitanteId, golsVisit, golsCasa,  ptsVisit);

    Tabela.ordenarClassificacao(torneio);

    // H2H
    atualizarH2H(fixture.casaId, fixture.visitanteId, golsCasa, golsVisit);

    // Noticias
    const nCasa  = Mundo.clubes.get(fixture.casaId)?.nome  || '?';
    const nVisit = Mundo.clubes.get(fixture.visitanteId)?.nome || '?';
    const art = resultado.artilheiros.map(a => a.nome).join(', ');
    publicarNoticia('gol', `${nCasa} ${golsCasa}×${golsVisit} ${nVisit}${art ? ` — Gols: ${art}` : ''}`);

    // Persistir na base
    DB.salvarPartida({
      torneio_id: torneio.tournament_id,
      ano: Mundo.cronologia.anoAtual,
      semana: Mundo.cronologia.semanaAtual,
      casaId: fixture.casaId,
      visitanteId: fixture.visitanteId,
      ...resultado,
    }).catch(console.error);
  }

  function atualizarLinhaClassificacao(torneio, clubeId, gp, gc, pts) {
    let linha = torneio.classificacao.find(l => l.club_id === clubeId);
    if (!linha) {
      linha = { club_id: clubeId, pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0 };
      torneio.classificacao.push(linha);
    }
    linha.j++;
    linha.gp += gp;
    linha.gc += gc;
    linha.sg = linha.gp - linha.gc;
    linha.pts += pts;
    if (pts === 3) linha.v++;
    else if (pts === 1) linha.e++;
    else linha.d++;
  }

  function atualizarH2H(idA, idB, golsA, golsB) {
    const chave = `${Math.min(idA, idB)}_vs_${Math.max(idA, idB)}`;
    if (!Mundo.tabelaH2H.has(chave)) {
      Mundo.tabelaH2H.set(chave, { idA, idB, dominanteId: null, invencibilidade: 0 });
    }
    const h2h = Mundo.tabelaH2H.get(chave);
    const vencedorId = golsA > golsB ? idA : golsB > golsA ? idB : null;

    if (vencedorId === null) return; // empate: sem alteração de tabu

    if (h2h.dominanteId === vencedorId) {
      h2h.invencibilidade++;
    } else {
      if (h2h.dominanteId !== null && h2h.invencibilidade >= 5) {
        const dominado = vencedorId;
        const dominante = h2h.dominanteId;
        const nDominante = Mundo.clubes.get(dominante)?.nome || '?';
        const nDominado  = Mundo.clubes.get(dominado)?.nome  || '?';
        publicarNoticia('tabu', `TABU QUEBRADO! ${nDominado} vence ${nDominante} após ${h2h.invencibilidade} jogos de domínio!`);
      }
      h2h.dominanteId = vencedorId;
      h2h.invencibilidade = 1;
    }
  }

  // ─── RODADAS ────────────────────────────────────────────────────────────────

  function processarRodadasDaSemana() {
    Mundo.torneios.forEach(torneio => {
      if (!torneio.ativo) return;
      const fixtures = torneio.fixtures.filter(f => f.semana === Mundo.cronologia.semanaAtual && !f.resultado);
      fixtures.forEach(f => {
        const resultado = calcularResultado(f.casaId, f.visitanteId);
        registrarResultado(torneio, f, resultado);
      });
    });
  }

  // ─── FÁBRICA DE TORNEIOS ────────────────────────────────────────────────────

  function criarTorneio(config) {
    const id = Mundo._torneioIdCounter++;
    const participantes = config.participantes || [];

    const torneio = {
      tournament_id: id,
      nome: config.nome || `Torneio ${id}`,
      ano: Mundo.cronologia.anoAtual,
      formato: config.formato || 'LIGA',
      tier: config.tier || 'ESTADUAL',
      tipoParticipante: config.tipoParticipante || 'CLUBE',
      state_id: config.state_id || null,
      ativo: true,
      participantes,
      fixtures: [],
      classificacao: participantes.map(id => ({ club_id: id, pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0 })),
      campeao: null,
    };

    if (torneio.formato === 'LIGA') {
      torneio.fixtures = gerarFixturesLiga(participantes);
    }

    Mundo.torneios.set(id, torneio);
    return torneio;
  }

  function gerarFixturesLiga(participantes) {
    const times = [...participantes];
    if (times.length % 2 !== 0) times.push(null); // bye
    const n = times.length;
    const rodadas = [];

    for (let r = 0; r < n - 1; r++) {
      const rodada = [];
      for (let i = 0; i < n / 2; i++) {
        const casa = times[i];
        const visit = times[n - 1 - i];
        if (casa !== null && visit !== null) rodada.push({ casa, visit });
      }
      rodadas.push(rodada);
      // Rotacionar mantendo o primeiro fixo
      times.splice(1, 0, times.pop());
    }

    // Distribuir rodadas uniformemente nas 52 semanas (começando na semana 3)
    const totalRodadas = rodadas.length;
    const semanas = [];
    for (let i = 0; i < totalRodadas; i++) {
      semanas.push(Math.round(3 + (i * (48 / Math.max(1, totalRodadas - 1)))));
    }

    const fixtures = [];
    rodadas.forEach((rodada, idx) => {
      const semana = semanas[idx];
      rodada.forEach(({ casa, visit }) => {
        fixtures.push({ semana, casaId: casa, visitanteId: visit, resultado: null });
      });
    });
    return fixtures;
  }

  function criarTorneiosIniciais() {
    const clubesSP = [...Mundo.clubes.values()].filter(c => c.ativo && c.state_id === 25).map(c => c.club_id);
    const clubesRJ = [...Mundo.clubes.values()].filter(c => c.ativo && c.state_id === 21).map(c => c.club_id);

    if (clubesSP.length >= 2) {
      criarTorneio({ nome: `Campeonato Paulista ${Mundo.cronologia.anoAtual}`, formato: 'LIGA', tier: 'ESTADUAL', tipoParticipante: 'CLUBE', state_id: 25, participantes: clubesSP });
    }
    if (clubesRJ.length >= 2) {
      criarTorneio({ nome: `Campeonato Carioca ${Mundo.cronologia.anoAtual}`, formato: 'LIGA', tier: 'ESTADUAL', tipoParticipante: 'CLUBE', state_id: 21, participantes: clubesRJ });
    }
  }

  function renovarTorneiosAnuais() {
    // Encerrar torneios do ano anterior e criar novos
    Mundo.torneios.forEach(t => {
      if (t.ativo && t.ano < Mundo.cronologia.anoAtual) {
        // Determinar campeão
        if (t.classificacao.length > 0) {
          t.campeao = t.classificacao[0].club_id;
          const nCampeao = Mundo.clubes.get(t.campeao)?.nome || '?';
          publicarNoticia('titulo', `Campeão do ${t.nome}: ${nCampeao}!`);
        }
        t.ativo = false;
      }
    });
    criarTorneiosIniciais();
  }

  function montarSelecaoEstadual(stateId) {
    const clubesDoEstado = [...Mundo.clubes.values()].filter(c => c.ativo && c.state_id === stateId).map(c => c.club_id);
    const jogadores = [...Mundo.jogadores.values()].filter(j => j.ativo && clubesDoEstado.includes(j.club_id));

    const por = { Goleiro: [], Zagueiro: [], Meia: [], Atacante: [] };
    jogadores.forEach(j => { if (por[j.posicao]) por[j.posicao].push(j); });

    const porAtributo = { Goleiro: 'gol', Zagueiro: 'defesa', Meia: 'armacao', Atacante: 'ataque' };
    const selecao = [];

    const alvo = { Goleiro: 1, Zagueiro: 4, Meia: 4, Atacante: 2 };
    for (const pos of Object.keys(alvo)) {
      const sorted = por[pos].sort((a, b) => b.atributos[porAtributo[pos]] - a.atributos[porAtributo[pos]]);
      selecao.push(...sorted.slice(0, alvo[pos]));
    }
    return selecao;
  }

  return {
    calcularForcaTime,
    calcularResultado,
    processarRodadasDaSemana,
    criarTorneio,
    criarTorneiosIniciais,
    renovarTorneiosAnuais,
    montarSelecaoEstadual,
  };
})();
