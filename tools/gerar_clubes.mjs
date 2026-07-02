#!/usr/bin/env node
// Gerador de clubes brasileiros a partir de uma tabela compacta.
//
// Uso: node tools/gerar_clubes.mjs [--dry]
//   --dry  apenas valida e imprime o relatório, sem gravar.
//
// Lê tools/clubes_novos.json (tabela compacta) + data/br/clubes.json +
// data/br/jogadores.json + data/regras_globais.json, expande cada linha num
// clube completo (IDs automáticos, finanças/torcida/técnico derivados),
// valida ativação em 1920 por estado e grava de volta. Idempotente: detecta
// clube já inserido pelo nome e não duplica.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const p = (...s) => join(ROOT, ...s);
const readJSON = f => JSON.parse(readFileSync(p(f), 'utf8'));
const dry = process.argv.includes('--dry');
const ANO_INICIAL = 1920;

const tabela = readJSON('tools/clubes_novos.json');
const clubes = readJSON('data/br/clubes.json');
const jogadores = readJSON('data/br/jogadores.json');
const regras = readJSON('data/regras_globais.json');

// ─── Alocação de IDs (blocos altos p/ não colidir com EN 3xx / atuais) ──────────
const maxId = (arr, sel, piso) =>
  Math.max(piso - 1, ...arr.map(sel).filter(n => Number.isFinite(n)));
let nextClub = maxId(clubes, c => c.club_id, 1000) + 1;
let nextCoach = maxId(clubes, c => c.tecnico?.coach_id, 2000) + 1;
let nextStadium = maxId(clubes, c => c.stadium?.stadium_id, 3000) + 1;
let nextPlayer = maxId(jogadores, j => j.player_id < 4000 ? j.player_id : NaN, 1200) + 1;

// ─── Derivações (fórmulas simples; só prestígio/grandeza afetam a partida) ───────
const financasDe = prest => Math.round(prest * 14);
const torcidaDe = prest => {
  const locais = Math.round(Math.pow(prest, 1.6));
  return { locais, nacionais: Math.round(locais * 0.02), mundiais: 0 };
};
const nivelDe = cap => (cap >= 20000 ? 3 : cap >= 6000 ? 2 : 1);
const nomesR = regras.nomesRegens;
const nomeTecnico = seed => {
  const m = nomesR.masculinos[seed % nomesR.masculinos.length];
  const s = nomesR.sobrenomes[(seed * 7 + 3) % nomesR.sobrenomes.length];
  return `${m} ${s}`;
};

// ─── Expansão ───────────────────────────────────────────────────────────────────
const jaExiste = new Set(clubes.map(c => c.nome));
const novos = [];
const erros = [];

for (const row of tabela) {
  for (const campo of ['nome', 'apelido', 'state_id', 'anoFundacao', 'prestigio', 'grandezaHistorica']) {
    if (row[campo] === undefined || row[campo] === null || row[campo] === '') {
      erros.push(`Clube "${row.nome || '(sem nome)'}" sem campo obrigatório: ${campo}`);
    }
  }
  if (jaExiste.has(row.nome)) continue; // idempotência

  const cap = row.capacidade ?? 2000;
  const clube = {
    club_id: nextClub++,
    nome: row.nome,
    apelido: row.apelido,
    country_id: 55,
    state_id: row.state_id,
    divisao: row.divisao ?? 1,
    anoFundacao: row.anoFundacao,
    prestigio: row.prestigio,
    grandezaHistorica: row.grandezaHistorica,
    financas: financasDe(row.prestigio),
    tecnico: {
      coach_id: nextCoach++,
      nome: row.tecnico || nomeTecnico(nextClub),
      estiloTatico: row.estiloTatico || 'equilibrado',
      formacao: row.formacao || '2-3-5',
    },
    stadium: {
      stadium_id: nextStadium++,
      nome: row.estadio || `Campo do ${row.apelido}`,
      capacidade: cap,
      nivelInfraestrutura: nivelDe(cap),
    },
    torcida: torcidaDe(row.prestigio),
  };
  novos.push(clube);
  jaExiste.add(row.nome);

  // Craques opcionais
  for (const cr of (row.craques || [])) {
    jogadores.push({
      player_id: nextPlayer++,
      nome: cr.nome,
      idade: cr.idade ?? 24,
      anoEstreia: cr.anoEstreia ?? clube.anoFundacao,
      club_id: clube.club_id,
      clubeIdentidadeId: clube.club_id,
      posicao: cr.posicao,
      atributos: cr.atributos,
      tag_legado: cr.tag_legado ?? null,
      personalidade: cr.personalidade ?? 'Leal',
      moral: cr.moral ?? 80,
    });
  }
}

// ─── Validação ──────────────────────────────────────────────────────────────────
const todos = [...clubes, ...novos];
// IDs únicos
const idsClube = todos.map(c => c.club_id);
if (new Set(idsClube).size !== idsClube.length) erros.push('COLISÃO de club_id detectada!');

// Por estado: ativos em 1920 vs minParticipantes do(s) campeonato(s)
const coords = regras.coordenadasEstados || {};
const torneios = regras.torneiosIniciais || [];
const estados = [...new Set(todos.filter(c => c.country_id === 55).map(c => c.state_id))];
const relatorioEstado = [];
for (const st of estados) {
  const doEstado = todos.filter(c => c.state_id === st);
  const ativos1920 = doEstado.filter(c => c.anoFundacao <= ANO_INICIAL);
  const futuros = doEstado.filter(c => c.anoFundacao > ANO_INICIAL);
  const temCoord = !!coords[String(st)];
  const camps = torneios.filter(t => t.state_id === st);
  relatorioEstado.push({ st, total: doEstado.length, ativos: ativos1920.length, futuros: futuros.length, temCoord, camps });
  if (!temCoord) erros.push(`Estado ${st}: sem coordenadasEstados (transferências viram distância 0).`);
  if (!camps.length) erros.push(`Estado ${st}: sem campeonato em torneiosIniciais (clubes ficariam ociosos).`);
  for (const cmp of camps) {
    const div = cmp.divisao ?? 1;
    const ativosDiv = ativos1920.filter(c => (c.divisao ?? 1) === div).length;
    if (ativosDiv < (cmp.minParticipantes || 2)) {
      erros.push(`Estado ${st} / "${cmp.nome}" (div ${div}): só ${ativosDiv} clube(s) ativo(s) em ${ANO_INICIAL} < minParticipantes ${cmp.minParticipantes}.`);
    }
  }
}

// ─── Relatório ──────────────────────────────────────────────────────────────────
console.log(`\n=== Gerador de clubes ${dry ? '(DRY-RUN)' : ''} ===`);
console.log(`Novos clubes: ${novos.length} | craques adicionados: ${jogadores.length - readJSON('data/br/jogadores.json').length}`);
if (novos.length) {
  console.log(`IDs club: ${novos[0].club_id}–${novos.at(-1).club_id}`);
  novos.forEach(c => console.log(`  ${c.club_id} ${c.nome} (st ${c.state_id}, div ${c.divisao}, fund ${c.anoFundacao}, prest ${c.prestigio}/grand ${c.grandezaHistorica})`));
}
console.log('\n-- Por estado --');
relatorioEstado.forEach(r => console.log(
  `  st ${r.st}: ${r.total} clubes | ativos ${ANO_INICIAL}: ${r.ativos} | fund>${ANO_INICIAL}: ${r.futuros} | coord ${r.temCoord ? 'ok' : 'FALTA'} | camps: ${r.camps.map(c => c.nome + '(div' + (c.divisao ?? 1) + ',min' + (c.minParticipantes || 2) + ')').join(', ') || 'NENHUM'}`));

if (erros.length) {
  console.log('\n❌ ERROS/AVISOS:');
  erros.forEach(e => console.log('  - ' + e));
  console.log('\nNada foi gravado (corrija e rode de novo).');
  process.exit(1);
}

if (dry) {
  console.log('\n✅ Validação OK (dry-run, nada gravado).');
  process.exit(0);
}

clubes.push(...novos);
writeFileSync(p('data/br/clubes.json'), JSON.stringify(clubes, null, 2) + '\n');
writeFileSync(p('data/br/jogadores.json'), JSON.stringify(jogadores, null, 2) + '\n');
console.log('\n✅ Gravado em data/br/clubes.json e data/br/jogadores.json.');
