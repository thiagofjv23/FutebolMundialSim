'use strict';

const Cronica = (() => {

  async function capturarSnapshotAnual(ano) {
    // Campeões por torneio
    const campeoes = [];
    Mundo.torneios.forEach(t => {
      // Inclui torneios do próprio ano E torneios CRUZADOS do ano anterior (que encerram neste ano)
      const pertenceAEsteAno = t.ano === ano
        || (t.tipoCalendario === 'CRUZADO' && t.ano === ano - 1);
      if (!pertenceAEsteAno || !t.classificacao.length) return;
      const c = Mundo.clubes.get(t.classificacao[0].club_id);
      campeoes.push({ torneio: t.nome, clube: c?.nome || '?', club_id: t.classificacao[0].club_id });
    });

    // Artilheiro global (do log de notícias de gol)
    const contagem = {};
    Mundo.logNoticias
      .filter(n => n.tipo === 'gol' && n.ano === ano)
      .forEach(n => {
        // Extrair nomes do campo "Gols:"
        const match = n.mensagem.match(/Gols: (.+)/);
        if (match) {
          match[1].split(', ').forEach(nome => {
            contagem[nome] = (contagem[nome] || 0) + 1;
          });
        }
      });

    let artilheiroNome = 'Desconhecido';
    let artilheiroGols = 0;
    let artilheiroTag = null;

    for (const [nome, gols] of Object.entries(contagem)) {
      if (gols > artilheiroGols) {
        artilheiroGols = gols;
        artilheiroNome = nome;
        // Tentar encontrar a tag
        const j = [...Mundo.jogadores.values()].find(j => j.nome === nome);
        artilheiroTag = j?.tag_legado || null;
      }
    }

    // Tabus H2H relevantes
    const tabus = [];
    Mundo.tabelaH2H.forEach((h2h) => {
      if (h2h.invencibilidade >= 5) {
        const nDom  = Mundo.clubes.get(h2h.dominanteId)?.nome || '?';
        const outraId = h2h.idA === h2h.dominanteId ? h2h.idB : h2h.idA;
        const nDomado = Mundo.clubes.get(outraId)?.nome || '?';
        tabus.push({ dominante: nDom, domado: nDomado, streak: h2h.invencibilidade });
      }
    });

    // Transferências notáveis do ano
    const transfsAno = Mundo.logTransferencias.filter(t => t.ano === ano && t.jogadorTag);

    const snapshot = { ano, campeoes, artilheiroNome, artilheiroGols, artilheiroTag, tabus, transfsAno };
    await DB.salvarCronica(ano, snapshot);

    // Resetar log de transferências anual
    Mundo.logTransferencias = [];
    return snapshot;
  }

  async function gerarPromptCronicaAnual(ano) {
    const snapshot = await DB.carregarCronica(ano);
    if (!snapshot) {
      document.getElementById('txt_prompt_ia').value = `Nenhum dado encontrado para o ano ${ano}.`;
      return;
    }

    const era = Mundo.eraAtual || { nome: 'ERA_AMADORA', nome_jornalismo: 'Cronista Esportivo dos Anos 20' };
    const decada = Math.floor(ano / 10) * 10;

    const blocoCampeoes = snapshot.campeoes.map(c => `- ${c.torneio}: ${c.clube}`).join('\n') || '- Dados não disponíveis.';

    const blocoArtilheiro = snapshot.artilheiroGols > 0
      ? `- Artilheiro Máximo: ${snapshot.artilheiroNome} (${snapshot.artilheiroGols} gols${snapshot.artilheiroTag ? ', DNA: ' + snapshot.artilheiroTag : ''})`
      : '- Sem dados de artilharia disponíveis.';

    const blocoTabus = snapshot.tabus.length
      ? snapshot.tabus.map(t => `- ${t.dominante} mantém sequência de ${t.streak} vitórias contra ${t.domado}.`).join('\n')
      : '- Os clássicos mantiveram a alternância regular nesta temporada.';

    const blocoTransf = snapshot.transfsAno.length
      ? snapshot.transfsAno.map(t => `- ${t.jogadorNome} (${t.jogadorTag || 'Regen'} / ${t.jogadorPersonalidade}): ${t.origemNome} → ${t.destinoNome}`).join('\n')
      : '- Sem transferências de craques notáveis nesta janela.';

    const prompt = `Siga estritamente as instruções de atuação abaixo para processar os dados brutos de uma simulação de futebol:

[DIRETRIZES DE ATUAÇÃO]
1. Atue como um cronista e jornalista esportivo característico da era: "${era.nome_jornalismo}".
2. Use o vocabulário, o charme, os jargões e o ritmo de escrita típicos da década de ${decada}.
3. Crie um título de manchete jornalística de impacto para a temporada.
4. Escreva uma crônica detalhada conectando os fatos de forma fluida e apaixonada.

[DADOS FRIOS DA TEMPORADA SIMULADA]
- Ano Corrente: ${ano}
- Era do Mundo: ${era.nome}

[CAMPEÕES]
${blocoCampeoes}

[ARTILHARIA]
${blocoArtilheiro}

[MOVIMENTAÇÕES DE MERCADO E BASTIDORES]
${blocoTransf}

[COMPORTAMENTO DOS CLÁSSICOS E TABUS]
${blocoTabus}

Gere o texto do jornal impresso completo com base nos dados acima:`;

    const textarea = document.getElementById('txt_prompt_ia');
    if (textarea) textarea.value = prompt.trim();

    const container = document.getElementById('container-prompt-ia');
    if (container) container.style.display = 'block';
  }

  function popularSeletorAnos() {
    const select = document.getElementById('sel_ano_cronica');
    if (!select) return;
    select.innerHTML = '';
    for (let a = 1920; a < Mundo.cronologia.anoAtual; a++) {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      select.appendChild(opt);
    }
    if (select.options.length > 0) select.value = select.options[select.options.length - 1].value;
  }

  return { capturarSnapshotAnual, gerarPromptCronicaAnual, popularSeletorAnos };
})();
