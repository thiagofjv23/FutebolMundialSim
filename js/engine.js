'use strict';

// Incrementar quando mudanças estruturais no save state exigirem reinício automático.
// Saves com versão diferente são descartados e o jogo começa do zero.
const DATA_VERSION = 8;

// Época de testes: quando true, o estado do mundo não é salvo nem restaurado.
// Cada reload recomeça do zero em 1920. Colocar em false para reativar a persistência.
let MODO_TESTE = true;
if (typeof window !== 'undefined') window.MODO_TESTE = MODO_TESTE; // permite toggle via console

function persistirMundo() {
  if (MODO_TESTE) return Promise.resolve();
  return DB.salvarEstado('mundo_atual', serializarMundo());
}

const Mundo = {
  cronologia: { anoAtual: 1920, mesAtual: 1, semanaAtual: 1 },
  filaDeExecucao: { passosRestantes: 0, escalaAtiva: 'parado' },
  clubes: new Map(),
  jogadores: new Map(),
  torneios: new Map(),
  tabelaH2H: new Map(),
  indiceElencos: new Map(), // club_id -> Set<player_id> (apenas jogadores ativos)
  logNoticias: [],
  logTransferencias: [],
  politicaVeto: 'nenhum',
  eraAtual: null,
  regrasGlobais: null,
  eventos: [],
  _eventosFiredIds: new Set(),
  _regenIdCounter: 5000,
  _torneioIdCounter: 1,
};

// ─── RNG ──────────────────────────────────────────────────────────────────────

function rng() { return Math.random(); }
function rngInt(min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
function rngNormal(mean, sd) {
  let u = 0, v = 0;
  while (!u) u = rng();
  while (!v) v = rng();
  return Math.round(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd + mean);
}

// ─── ÍNDICE DE ELENCOS ────────────────────────────────────────────────────────
// Mantém Mundo.indiceElencos (club_id -> Set<player_id>) em sincronia incremental
// com jogador.club_id/ativo, evitando varreduras completas de Mundo.jogadores.

function indiceAdicionarJogador(clubeId, playerId) {
  if (!clubeId) return;
  let set = Mundo.indiceElencos.get(clubeId);
  if (!set) { set = new Set(); Mundo.indiceElencos.set(clubeId, set); }
  set.add(playerId);
}

function indiceRemoverJogador(clubeId, playerId) {
  if (!clubeId) return;
  Mundo.indiceElencos.get(clubeId)?.delete(playerId);
}

function reconstruirIndiceElencos() {
  Mundo.indiceElencos = new Map();
  Mundo.jogadores.forEach(j => {
    if (j.ativo && j.club_id) indiceAdicionarJogador(j.club_id, j.player_id);
  });
}

// ─── SERIALIZAÇÃO ─────────────────────────────────────────────────────────────

function serializarMundo() {
  return {
    cronologia: { ...Mundo.cronologia },
    clubes: Object.fromEntries(Mundo.clubes),
    jogadores: Object.fromEntries(Mundo.jogadores),
    torneios: Object.fromEntries(Mundo.torneios),
    tabelaH2H: Object.fromEntries(Mundo.tabelaH2H),
    indiceElencos: Object.fromEntries([...Mundo.indiceElencos].map(([k, v]) => [k, [...v]])),
    logNoticias: Mundo.logNoticias.slice(0, 100),
    logTransferencias: Mundo.logTransferencias.slice(0, 200),
    politicaVeto: Mundo.politicaVeto,
    eraAtual: Mundo.eraAtual,
    regrasGlobais: Mundo.regrasGlobais,
    eventos: Mundo.eventos,
    _eventosFiredIds: [...Mundo._eventosFiredIds],
    _regenIdCounter: Mundo._regenIdCounter,
    _torneioIdCounter: Mundo._torneioIdCounter,
    _dataVersion: DATA_VERSION,
  };
}

function restaurarMundo(saved) {
  Mundo.cronologia = saved.cronologia;
  Mundo.clubes = new Map(Object.entries(saved.clubes).map(([k, v]) => [+k, v]));
  Mundo.jogadores = new Map(Object.entries(saved.jogadores).map(([k, v]) => [+k, v]));
  Mundo.torneios = new Map(Object.entries(saved.torneios).map(([k, v]) => [+k, v]));
  Mundo.tabelaH2H = new Map(Object.entries(saved.tabelaH2H));
  Mundo.logNoticias = saved.logNoticias || [];
  Mundo.logTransferencias = saved.logTransferencias || [];
  Mundo.politicaVeto = saved.politicaVeto || 'nenhum';
  Mundo.eraAtual = saved.eraAtual;
  Mundo.regrasGlobais = saved.regrasGlobais;
  Mundo.eventos = saved.eventos || [];
  Mundo._eventosFiredIds = new Set(saved._eventosFiredIds || []);
  Mundo._regenIdCounter = saved._regenIdCounter || 5000;
  Mundo._torneioIdCounter = saved._torneioIdCounter || 1;

  if (saved.indiceElencos) {
    Mundo.indiceElencos = new Map(Object.entries(saved.indiceElencos).map(([k, v]) => [+k, new Set(v)]));
  } else {
    reconstruirIndiceElencos(); // compatibilidade com estados salvos antes deste índice existir
  }
}

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────

async function inicializarMundo() {
  const saved = MODO_TESTE ? null : await DB.carregarEstado('mundo_atual');
  if (saved && saved.cronologia && saved._dataVersion === DATA_VERSION) {
    restaurarMundo(saved);

    // Always reload regras_globais to pick up new configs (new tournaments, EN names, rivalries).
    try {
      const regras = await fetch('data/regras_globais.json', { cache: 'no-cache' }).then(r => r.json());
      Mundo.regrasGlobais = regras;
    } catch (_) { /* keep saved regras on fetch failure */ }

    // If the saved state pre-dates the EN database, inject EN clubs/players/tournament now.
    const temEN = [...Mundo.clubes.values()].some(c => c.country_id === 44);
    if (!temEN) {
      try {
        const [clubesEN, jogadoresEN] = await Promise.all([
          fetch('data/en/clubes.json', { cache: 'no-cache' }).then(r => r.json()),
          fetch('data/en/jogadores.json', { cache: 'no-cache' }).then(r => r.json()),
        ]);
        clubesEN.forEach(c => Mundo.clubes.set(c.club_id, { ...c, ativo: false }));
        jogadoresEN.forEach(j => Mundo.jogadores.set(j.player_id, { ...j, ativo: false }));
        ativarEntidadesParaAno(Mundo.cronologia.anoAtual);
        Mundo.clubes.forEach(c => { if (c.ativo && c.country_id === 44) gerarRegensParaClube(c); });

        // Create the English tournament for the current season without touching existing BR ones.
        const temTorneioEN = [...Mundo.torneios.values()].some(t => t.country_id === 44);
        if (!temTorneioEN) {
          const cfgEN = (Mundo.regrasGlobais?.torneiosIniciais || []).find(c => c.country_id === 44);
          if (cfgEN) {
            const participantes = [...Mundo.clubes.values()]
              .filter(c => c.ativo && c.country_id === 44)
              .map(c => c.club_id);
            if (participantes.length >= (cfgEN.minParticipantes || 10)) {
              const ano = Mundo.cronologia.anoAtual;
              Simulador.criarTorneio({
                nome: `${cfgEN.nome} ${ano}/${String(ano + 1).slice(-2)}`,
                nomeBase: cfgEN.nome,
                formato: cfgEN.formato,
                tier: cfgEN.tier,
                tipoParticipante: cfgEN.tipoParticipante,
                tipoCalendario: 'CRUZADO',
                semanaInicio: cfgEN.semanaInicio ?? 33,
                semanaFim: cfgEN.semanaFim ?? 22,
                country_id: 44,
                participantes,
              });
            }
          }
        }

        publicarNoticia('sistema', 'Base de dados inglesa carregada — Football League Division 1 ativada!');
        await persistirMundo();
      } catch (e) { console.warn('Falha ao carregar dados EN:', e); }
    }

    publicarNoticia('sistema', `Estado restaurado — ${Mundo.cronologia.anoAtual}, Semana ${Mundo.cronologia.semanaAtual}`);
    return;
  }

  const [regras, clubesBR, jogadoresBR, eventosBR, clubesEN, jogadoresEN, eventosEN] = await Promise.all([
    fetch('data/regras_globais.json', { cache: 'no-cache' }).then(r => r.json()),
    fetch('data/br/clubes.json', { cache: 'no-cache' }).then(r => r.json()),
    fetch('data/br/jogadores.json', { cache: 'no-cache' }).then(r => r.json()),
    fetch('data/br/eventos.json', { cache: 'no-cache' }).then(r => r.json()),
    fetch('data/en/clubes.json', { cache: 'no-cache' }).then(r => r.json()),
    fetch('data/en/jogadores.json', { cache: 'no-cache' }).then(r => r.json()),
    fetch('data/en/eventos.json', { cache: 'no-cache' }).then(r => r.json()),
  ]);

  const clubes = [...clubesBR, ...clubesEN];
  const jogadores = [...jogadoresBR, ...jogadoresEN];
  const eventos = [...eventosBR, ...eventosEN];

  Mundo.regrasGlobais = regras;
  Mundo.eventos = eventos;
  Mundo.eraAtual = obterEraParaAno(1920);

  clubes.forEach(c => Mundo.clubes.set(c.club_id, { ...c, ativo: false }));
  jogadores.forEach(j => Mundo.jogadores.set(j.player_id, { ...j, ativo: false }));

  ativarEntidadesParaAno(1920);
  Mundo.clubes.forEach(c => { if (c.ativo) gerarRegensParaClube(c); });

  Simulador.criarTorneiosIniciais();

  await persistirMundo();
  publicarNoticia('sistema', `Simulação iniciada! Brasil & Inglaterra, ${Mundo.cronologia.anoAtual}. Era: ${Mundo.eraAtual.nome}`);
}

// ─── ERAS ─────────────────────────────────────────────────────────────────────

function obterEraParaAno(ano) {
  return Mundo.regrasGlobais.eras.find(e => ano >= e.anoInicio && ano <= e.anoFim)
    || Mundo.regrasGlobais.eras.at(-1);
}

// ─── ATIVAÇÃO TEMPORAL ────────────────────────────────────────────────────────

function ativarEntidadesParaAno(ano) {
  Mundo.clubes.forEach(clube => {
    if (!clube.ativo && clube.anoFundacao <= ano) {
      clube.ativo = true;
    }
  });

  Mundo.jogadores.forEach(jogador => {
    if (jogador.ativo) return;
    if (!jogador.anoEstreia || jogador.anoEstreia > ano) return;
    if ((jogador.anoEstreia + 25) < ano) return;
    if (!jogador.club_id) return;
    const clube = Mundo.clubes.get(jogador.club_id);
    if (!clube || !clube.ativo) return;
    jogador.ativo = true;
    if (jogador.condicaoFisica === undefined) jogador.condicaoFisica = 100;
    indiceAdicionarJogador(jogador.club_id, jogador.player_id);
    normalizarAtributosLenda(jogador);
    publicarNoticia('estreia', `${jogador.nome} (${clube.nome}) entra em cena como ${jogador.posicao}!`);
  });
}

function normalizarAtributosLenda(jogador) {
  if (jogador.tag_legado !== 'Lenda_Do_Futebol') return;
  const mapa = { Goleiro: 'gol', Zagueiro: 'defesa', Meia: 'armacao', Atacante: 'ataque' };
  const attr = mapa[jogador.posicao];
  if (attr) jogador.atributos[attr] = rngInt(96, 100);
}

// ─── GERAÇÃO DE REGENS ────────────────────────────────────────────────────────

function gerarRegensParaClube(clube) {
  const idsExistentes = Mundo.indiceElencos.get(clube.club_id);
  const existentes = idsExistentes ? [...idsExistentes].map(id => Mundo.jogadores.get(id)).filter(Boolean) : [];
  const contagem = { Goleiro: 0, Zagueiro: 0, Meia: 0, Atacante: 0 };
  existentes.forEach(j => { if (contagem[j.posicao] !== undefined) contagem[j.posicao]++; });

  const alvo = { Goleiro: 2, Zagueiro: 5, Meia: 6, Atacante: 7 };
  const nomes = clube.country_id === 44 && Mundo.regrasGlobais.nomesRegensEN
    ? Mundo.regrasGlobais.nomesRegensEN
    : Mundo.regrasGlobais.nomesRegens;
  const personalidades = ['Pragmatico', 'Pragmatico', 'Pragmatico', 'Ambicioso', 'Ambicioso', 'Leal', 'Leal', 'Filho_Prodigo'];

  for (const pos of Object.keys(alvo)) {
    const precisaDe = Math.max(0, alvo[pos] - contagem[pos]);
    for (let i = 0; i < precisaDe; i++) {
      const nome = nomes.masculinos[rngInt(0, nomes.masculinos.length - 1)];
      const sob  = nomes.sobrenomes[rngInt(0, nomes.sobrenomes.length - 1)];
      const idade = rngInt(18, 30);
      const grandeza = clube.grandezaHistorica ?? clube.prestigio ?? 50;
      const metrica = (clube.prestigio ?? 50) * 0.5 + grandeza * 0.5;
      const media = 24 + metrica * 0.46;
      const base = Math.min(85, Math.max(25, rngNormal(media, 12)));

      const atributos = {
        gol:      pos === 'Goleiro'  ? base : rngInt(5, 20),
        defesa:   pos === 'Zagueiro' ? base : rngInt(10, 30),
        armacao:  pos === 'Meia'     ? base : rngInt(15, 40),
        ataque:   pos === 'Atacante' ? base : rngInt(10, 35),
      };

      const jogador = {
        player_id: ++Mundo._regenIdCounter,
        nome: `${nome} ${sob}`,
        idade,
        anoEstreia: Mundo.cronologia.anoAtual - (idade - 18),
        club_id: clube.club_id,
        clubeIdentidadeId: clube.club_id,
        posicao: pos,
        atributos,
        tag_legado: null,
        personalidade: personalidades[rngInt(0, personalidades.length - 1)],
        moral: rngInt(65, 90),
        condicaoFisica: 100,
        ativo: true,
        regen: true,
      };
      Mundo.jogadores.set(jogador.player_id, jogador);
      indiceAdicionarJogador(jogador.club_id, jogador.player_id);
    }
  }
}

// ─── NOTÍCIAS ─────────────────────────────────────────────────────────────────

function publicarNoticia(tipo, mensagem) {
  Mundo.logNoticias.unshift({
    id: Date.now() + rng(),
    tipo,
    mensagem,
    ano: Mundo.cronologia.anoAtual,
    semana: Mundo.cronologia.semanaAtual,
  });
  if (Mundo.logNoticias.length > 200) Mundo.logNoticias.length = 200;
}

// ─── EVENTOS HISTÓRICOS ───────────────────────────────────────────────────────

async function dispararEventosDaSemana(ano, semana) {
  const pendentes = Mundo.eventos.filter(e => e.ano === ano && e.semana === semana && !Mundo._eventosFiredIds.has(e.evento_id));
  for (const evento of pendentes) {
    Mundo._eventosFiredIds.add(evento.evento_id);
    await DB.registrarEvento(evento.evento_id, ano);
    if (evento.exibicaoPopup) {
      UI.mostrarPopupHistorico(evento);
    } else {
      executarAcaoEvento(evento);
    }
  }
}

function executarAcaoEvento(evento) {
  const { tipo, ...p } = evento.acao;
  if (tipo === 'BOOST_PRESTIGIO') {
    const c = Mundo.clubes.get(p.club_id);
    if (c) { c.prestigio = Math.min(100, c.prestigio + p.valor); publicarNoticia('evento', `${evento.titulo} — ${c.nome} +${p.valor} prestígio`); }
  } else if (tipo === 'REDUCAO_PRESTIGIO') {
    const c = Mundo.clubes.get(p.club_id);
    if (c) { c.prestigio = Math.max(0, c.prestigio - p.valor); publicarNoticia('evento', `${evento.titulo} — ${c.nome} -${p.valor} prestígio`); }
  } else if (tipo === 'ATIVAR_CLUBE') {
    const c = Mundo.clubes.get(p.club_id);
    if (c) { c.ativo = true; gerarRegensParaClube(c); publicarNoticia('fundacao', `${evento.titulo} — ${c.nome} entra em cena!`); }
  } else if (tipo === 'BOOST_TORCIDA_GERAL') {
    Mundo.clubes.forEach(c => { if (c.ativo) { c.torcida.locais = Math.round(c.torcida.locais * (1 + p.valor)); } });
    publicarNoticia('evento', evento.titulo);
  } else if (tipo === 'ALTERAR_FATOR_GLOBAL') {
    if (Mundo.eraAtual) Mundo.eraAtual[p.chave] = p.valor;
    publicarNoticia('evento', evento.titulo);
  }
}

// ─── LOOP TEMPORAL ────────────────────────────────────────────────────────────

function comandarPassagemDeTempo(escala) {
  if (Mundo.filaDeExecucao.passosRestantes > 0) return;
  const passos = { rodada: 0.5, semana: 1, mes: 4, semestre: 24, ano: 52 };
  Mundo.filaDeExecucao.passosRestantes = passos[escala] || 1;
  Mundo.filaDeExecucao.escalaAtiva = escala;
  UI.setBotoesTempoAtivos(false);
  executarFila();
}

async function executarFila() {
  while (Mundo.filaDeExecucao.passosRestantes > 0) {
    if (Mundo.filaDeExecucao.passosRestantes === 0.5) {
      Simulador.processarRodadasDaSemana();
      Mundo.filaDeExecucao.passosRestantes = 0;
    } else {
      await passarProximoPasso();
      Mundo.filaDeExecucao.passosRestantes--;
      if (Mundo.cronologia.semanaAtual > 52) {
        await encerramentoDeAno();
        Mundo.filaDeExecucao.passosRestantes = 0;
      }
    }
    await new Promise(r => setTimeout(r, 10));
  }

  Mundo.filaDeExecucao.escalaAtiva = 'parado';
  UI.setBotoesTempoAtivos(true);
  UI.atualizarTodosOsPaineis();
  persistirMundo().catch(console.error);
}

async function passarProximoPasso() {
  Mundo.cronologia.semanaAtual++;
  Mundo.cronologia.mesAtual = Math.min(12, Math.ceil(Mundo.cronologia.semanaAtual / 4.334));

  const _jáAtivos = new Set([...Mundo.clubes.values()].filter(c => c.ativo).map(c => c.club_id));
  ativarEntidadesParaAno(Mundo.cronologia.anoAtual);
  Mundo.clubes.forEach(c => {
    if (c.ativo && !_jáAtivos.has(c.club_id)) gerarRegensParaClube(c);
  });
  await dispararEventosDaSemana(Mundo.cronologia.anoAtual, Mundo.cronologia.semanaAtual);

  // Recuperação física semanal (independente de jogar)
  Mundo.jogadores.forEach(j => {
    if (!j.ativo) return;
    j.condicaoFisica = Math.min(100, (j.condicaoFisica ?? 100) + 12);
  });

  Simulador.processarRodadasDaSemana();

  if (Mundo.cronologia.semanaAtual % 4 === 0) {
    Mercado.processarMercadoDaSemana();
  }
}

async function encerramentoDeAno() {
  const anoFechou = Mundo.cronologia.anoAtual;
  publicarNoticia('sistema', `Temporada ${anoFechou} encerrada. Processando fechamento anual…`);

  // Envelhecer e aposentar jogadores
  const aposentados = [];
  Mundo.jogadores.forEach(j => {
    if (!j.ativo) return;
    j.idade++;
    if (j.idade >= Mundo.eraAtual.idadeAposentadoria) {
      j.ativo = false;
      j.aposentado = true;
      indiceRemoverJogador(j.club_id, j.player_id);
      aposentados.push(j);
    }
  });

  if (aposentados.length > 0) {
    const clubesAfetados = new Set(aposentados.map(j => j.club_id).filter(Boolean));
    clubesAfetados.forEach(id => { const c = Mundo.clubes.get(id); if (c) gerarRegensParaClube(c); });
    const resumo = aposentados.slice(0, 3).map(j => j.nome).join(', ');
    publicarNoticia('aposentadoria', `Aposentadorias: ${resumo}${aposentados.length > 3 ? ` e mais ${aposentados.length - 3}` : ''}.`);
  }

  // Crescimento da torcida e prestígio baseado em resultados
  Mundo.torneios.forEach(torneio => {
    if (!torneio.classificacao || !torneio.classificacao.length) return;
    const lider = torneio.classificacao[0];
    const clube = Mundo.clubes.get(lider.club_id);
    if (!clube) return;
    const taxa = Mundo.eraAtual.crescimentoTorcida;
    clube.torcida.locais = Math.round(clube.torcida.locais * (1 + taxa * 1.5));
    clube.torcida.nacionais = Math.round(clube.torcida.nacionais * (1 + taxa));
    clube.prestigio = Math.min(100, clube.prestigio + 2);
  });

  // Reversão à média: prestígio é puxado gradualmente em direção à grandeza histórica.
  Mundo.clubes.forEach(clube => {
    if (!clube.ativo) return;
    const alvo = clube.grandezaHistorica ?? clube.prestigio;
    const delta = Math.round((alvo - clube.prestigio) * 0.10);
    clube.prestigio = Math.max(0, Math.min(100, clube.prestigio + delta));
  });

  // Crônica e limpeza
  await Cronica.capturarSnapshotAnual(anoFechou);
  await DB.limparPartidasAntigas(anoFechou);

  // Avançar ano e renovar torneios
  Mundo.cronologia.anoAtual++;
  Mundo.cronologia.semanaAtual = 1;
  Mundo.cronologia.mesAtual = 1;
  Mundo.eraAtual = obterEraParaAno(Mundo.cronologia.anoAtual);

  Simulador.renovarTorneiosAnuais();
  publicarNoticia('sistema', `Bem-vindo à temporada ${Mundo.cronologia.anoAtual}!`);
}
