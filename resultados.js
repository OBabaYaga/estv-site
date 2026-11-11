// ===================================================================
// ESTV — Resultados em direto (API-Football / api-sports.io)
// ===================================================================
//
// O site NUNCA fala diretamente com a API-Football (a chave ficaria
// visível a qualquer pessoa). Pede tudo à nossa estv-api:
//   GET {API_BASE_URL}/api/resultados?data=AAAA-MM-DD
// que devolve { atualizadoEm, jogos: [...] } com os jogos no MESMO
// formato da API-Football ("response" de /fixtures), já filtrados pelas
// ligas que interessam e guardados em cache no Redis — assim os 100
// pedidos/dia do plano grátis chegam para todos os visitantes.
//
// Os dados de exemplo só aparecem quando abres a página no teu próprio
// computador (ficheiro local / localhost), para testares o aspeto.
// ===================================================================

(function () {
  // IDs das ligas na API-Football
  const LIGAS = [
    { id: 94, nome: 'Liga Portugal', pais: 'Portugal' },
    { id: 2, nome: 'Champions League', pais: 'Europa' },
    { id: 5, nome: 'Liga das Nações', pais: 'Seleções' },
    { id: 32, nome: 'Qualificação Mundial', pais: 'Seleções · Europa' },
    { id: 960, nome: 'Qualificação Europeu', pais: 'Seleções' },
    { id: 1, nome: 'Mundial', pais: 'Seleções' },
    { id: 4, nome: 'Europeu', pais: 'Seleções' },
    { id: 10, nome: 'Amigáveis', pais: 'Seleções' },
    { id: 39, nome: 'Premier League', pais: 'Inglaterra' },
    { id: 140, nome: 'La Liga', pais: 'Espanha' },
    { id: 135, nome: 'Serie A', pais: 'Itália' },
    { id: 78, nome: 'Bundesliga', pais: 'Alemanha' },
    { id: 61, nome: 'Ligue 1', pais: 'França' },
  ];

  const AO_VIVO = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'];
  const TERMINADO = ['FT', 'AET', 'PEN'];
  const REFRESH_MS = 60 * 1000;

  // O plano grátis da API-Football só dá acesso a ontem, hoje e amanhã.
  const DIAS_ANTES = 1;
  const DIAS_DEPOIS = 1;
  let diaOffset = 0; // 0 = hoje, -1 = ontem, 1 = amanhã, ...
  let saltouDeHoje = false;
  let ligaAtiva = 'todas';
  let soDireto = false;
  let jogos = [];
  let abertos = new Set();
  let timer = null;

  // ---------------------------------------------------------------
  // Dados
  // ---------------------------------------------------------------
  function dataISO(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function emModoLocal() {
    return location.protocol === 'file:' || /^(localhost|127\.|192\.168\.)/.test(location.hostname);
  }

  let erroAtual = null;

  async function carregar(opcoes) {
    opcoes = opcoes || {};
    const data = dataISO(diaOffset);
    const base = typeof ESTV_CONFIG !== 'undefined' ? ESTV_CONFIG.API_BASE_URL : '';
    try {
      if (!base) throw new Error('A ligação aos resultados não está configurada.');
      const res = await fetch(`${base}/api/resultados?data=${data}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error('Não foi possível carregar os resultados agora. Tenta daqui a pouco.');
      jogos = Array.isArray(json.jogos) ? json.jogos : [];
      erroAtual = null;
      mostrarDemo(false);
      setAtualizado(json.atualizadoEm || Date.now(), json.aviso);
      if (opcoes.procurarProximo && !jogos.length && diaOffset < DIAS_DEPOIS) {
        // Hoje não há jogos: salta para o próximo dia que tenha.
        diaOffset++;
        saltouDeHoje = true;
        return carregar(opcoes);
      }
      if (opcoes.procurarProximo && !jogos.length) {
        diaOffset = 0;
        saltouDeHoje = false;
        return carregar();
      }
    } catch (e) {
      if (emModoLocal()) {
        jogos = dadosExemplo(diaOffset);
        erroAtual = null;
        mostrarDemo(true);
        setAtualizado(Date.now());
      } else {
        // Se já havia jogos no ecrã, mantém-nos em vez de os apagar.
        if (!jogos.length) erroAtual = e.message;
      }
    }
    render();
  }

  function mostrarDemo(sim) {
    const el = document.getElementById('resDemoBanner');
    if (el) el.classList.toggle('hidden', !sim);
  }

  function setAtualizado(ts, aviso) {
    const el = document.getElementById('resUpdated');
    if (!el) return;
    const d = new Date(ts);
    el.textContent = 'Atualizado às ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    el.title = aviso || '';
  }

  // ---------------------------------------------------------------
  // Traduções (a API-Football devolve tudo em inglês)
  // ---------------------------------------------------------------
  const NOMES_PT = {
    Spain: 'Espanha', France: 'França', England: 'Inglaterra', Germany: 'Alemanha', Italy: 'Itália',
    Netherlands: 'Países Baixos', Belgium: 'Bélgica', Croatia: 'Croácia', Switzerland: 'Suíça',
    Denmark: 'Dinamarca', Austria: 'Áustria', Scotland: 'Escócia', Wales: 'País de Gales',
    'Northern Ireland': 'Irlanda do Norte', Ireland: 'Irlanda', Norway: 'Noruega', Sweden: 'Suécia',
    Finland: 'Finlândia', Iceland: 'Islândia', Poland: 'Polónia', 'Czech Republic': 'Chéquia',
    Czechia: 'Chéquia', Slovakia: 'Eslováquia', Slovenia: 'Eslovénia', Hungary: 'Hungria',
    Romania: 'Roménia', Bulgaria: 'Bulgária', Greece: 'Grécia', Turkey: 'Turquia', Türkiye: 'Turquia',
    Ukraine: 'Ucrânia', Serbia: 'Sérvia', Albania: 'Albânia', Georgia: 'Geórgia', Armenia: 'Arménia',
    Israel: 'Israel', Cyprus: 'Chipre', Luxembourg: 'Luxemburgo', Andorra: 'Andorra',
    Brazil: 'Brasil', Argentina: 'Argentina', Uruguay: 'Uruguai', Colombia: 'Colômbia', Mexico: 'México',
    USA: 'EUA', Canada: 'Canadá', Morocco: 'Marrocos', Japan: 'Japão', 'South Korea': 'Coreia do Sul',
    'Cape Verde Islands': 'Cabo Verde', Angola: 'Angola', Mozambique: 'Moçambique', Senegal: 'Senegal',
    Egypt: 'Egito', Nigeria: 'Nigéria', Australia: 'Austrália', 'Saudi Arabia': 'Arábia Saudita',
  };

  function nomeEquipa(nome) {
    return NOMES_PT[nome] || nome;
  }

  function traduzirRonda(r) {
    if (!r) return '';
    return r
      .replace(/^Regular Season - (\d+)/, 'Jornada $1')
      .replace(/^League Stage - (\d+)/, 'Fase de liga · J$1')
      .replace(/^League ([A-D]) - (\d+)/, 'Liga $1 · J$2')
      .replace(/^Group Stage - (\d+)/, 'Fase de grupos · J$1')
      .replace(/^Group ([A-Z]) - (\d+)/, 'Grupo $1 · J$2')
      .replace(/^Round of 16/, 'Oitavos de final')
      .replace(/^Quarter-finals/, 'Quartos de final')
      .replace(/^Semi-finals/, 'Meias-finais')
      .replace(/^Final$/, 'Final')
      .replace(/^Friendlies( \d+)?/, 'Amigável');
  }

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function iniciais(nome) {
    return nomeEquipa(nome)
      .replace(/^(FC|SC|SL|CD|AC|AS|SS|RC|CF|Sp\.)\s+/i, '')
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  function emblema(team) {
    const fallback = `<span class="res-crest-fallback">${esc(iniciais(team.name))}</span>`;
    if (!team.logo) return `<span class="res-crest">${fallback}</span>`;
    return `<span class="res-crest"><img src="${esc(team.logo)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'res-crest-fallback',textContent:'${esc(iniciais(team.name))}'}))"></span>`;
  }

  function estadoHtml(f) {
    const s = f.fixture.status;
    if (AO_VIVO.includes(s.short)) {
      const txt = s.short === 'HT' ? 'Intervalo' : `${s.elapsed}'`;
      return `<span class="res-status res-status-live"><span class="res-live-dot"></span>${txt}</span>`;
    }
    if (TERMINADO.includes(s.short)) return `<span class="res-status res-status-ft">Final</span>`;
    if (s.short === 'PST') return `<span class="res-status res-status-off">Adiado</span>`;
    if (s.short === 'CANC') return `<span class="res-status res-status-off">Cancelado</span>`;
    const hora = new Date(f.fixture.date).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    return `<span class="res-status res-status-ns">${hora}</span>`;
  }

  function eventosHtml(f) {
    const evs = (f.events || []).filter((e) => e.type === 'Goal' || e.type === 'Card');
    if (!evs.length) {
      return `<div class="res-events-empty">${f.fixture.status.short === 'NS' ? (f.fixture.venue && f.fixture.venue.name ? '<i class="fas fa-location-dot"></i> ' + esc(f.fixture.venue.name) : 'Ainda não começou.') : 'Sem golos nem cartões.'}</div>`;
    }
    return evs
      .map((e) => {
        const casa = e.team.id === f.teams.home.id;
        let icon = '<i class="fas fa-futbol"></i>';
        if (e.type === 'Card') icon = `<span class="res-card ${e.detail === 'Red Card' ? 'red' : 'yellow'}"></span>`;
        const extra = e.detail === 'Penalty' ? ' (g.p.)' : e.detail === 'Own Goal' ? ' (p.b.)' : '';
        const min = `${e.time.elapsed}${e.time.extra ? '+' + e.time.extra : ''}'`;
        return `
          <div class="res-event ${casa ? 'home' : 'away'}">
            <span class="res-event-min">${min}</span>
            <span class="res-event-icon">${icon}</span>
            <span class="res-event-player">${esc(e.player.name)}${extra}</span>
          </div>`;
      })
      .join('');
  }

  function jogoHtml(f) {
    const g = f.goals;
    const vivo = AO_VIVO.includes(f.fixture.status.short);
    const naoComecou = g.home == null;
    const vence = (lado) => (f.teams[lado].winner ? ' winner' : '');
    const aberto = abertos.has(f.fixture.id);
    return `
      <div class="res-match${vivo ? ' live' : ''}${aberto ? ' open' : ''}" data-id="${f.fixture.id}">
        <button class="res-match-row" type="button">
          <span class="res-match-status">${estadoHtml(f)}</span>
          <span class="res-teams">
            <span class="res-team${vence('home')}">${emblema(f.teams.home)}<span class="res-team-name">${esc(nomeEquipa(f.teams.home.name))}</span></span>
            <span class="res-team${vence('away')}">${emblema(f.teams.away)}<span class="res-team-name">${esc(nomeEquipa(f.teams.away.name))}</span></span>
          </span>
          <span class="res-score${vivo ? ' live' : ''}">
            <span>${naoComecou ? '' : g.home}</span>
            <span>${naoComecou ? '' : g.away}</span>
          </span>
          <i class="fas fa-chevron-down res-chevron"></i>
        </button>
        <div class="res-events">${eventosHtml(f)}</div>
      </div>`;
  }

  function renderDias() {
    const wrap = document.getElementById('resDays');
    const nomes = { '-1': 'Ontem', 0: 'Hoje', 1: 'Amanhã' };
    const offsets = [];
    for (let o = -DIAS_ANTES; o <= DIAS_DEPOIS; o++) offsets.push(o);
    wrap.innerHTML = offsets
      .map((o) => {
        const d = new Date();
        d.setDate(d.getDate() + o);
        const semana = d.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '');
        const titulo = nomes[o] || semana.charAt(0).toUpperCase() + semana.slice(1);
        const sub = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
        return `<button class="res-day${o === diaOffset ? ' active' : ''}${o === 0 ? ' today' : ''}" data-dia="${o}"><strong>${titulo}</strong><span>${sub}</span></button>`;
      })
      .join('');
    const ativo = wrap.querySelector('.res-day.active');
    if (ativo && wrap.scrollWidth > wrap.clientWidth) {
      wrap.scrollLeft = ativo.offsetLeft - wrap.clientWidth / 2 + ativo.clientWidth / 2;
    }
    const aviso = document.getElementById('resSaltoAviso');
    if (aviso) aviso.classList.toggle('hidden', !(saltouDeHoje && diaOffset > 0));
  }

  function renderLigas() {
    const wrap = document.getElementById('resLeagues');
    const vivosPorLiga = {};
    jogos.forEach((f) => {
      if (AO_VIVO.includes(f.fixture.status.short)) vivosPorLiga[f.league.id] = (vivosPorLiga[f.league.id] || 0) + 1;
    });
    const chips = [{ id: 'todas', nome: 'Todas' }].concat(LIGAS.filter((l) => jogos.some((f) => f.league.id === l.id)));
    wrap.innerHTML = chips
      .map((l) => {
        const n = l.id === 'todas' ? Object.values(vivosPorLiga).reduce((a, b) => a + b, 0) : vivosPorLiga[l.id] || 0;
        return `<button class="res-league-chip${String(l.id) === String(ligaAtiva) ? ' active' : ''}" data-liga="${l.id}">${esc(l.nome)}${n ? `<span class="res-chip-live">${n}</span>` : ''}</button>`;
      })
      .join('');
  }

  function render() {
    renderDias();
    renderLigas();
    const lista = document.getElementById('resList');
    let filtrados = jogos.filter((f) => ligaAtiva === 'todas' || String(f.league.id) === String(ligaAtiva));
    if (soDireto) filtrados = filtrados.filter((f) => AO_VIVO.includes(f.fixture.status.short));

    if (erroAtual) {
      lista.innerHTML = `<div class="res-empty"><i class="fas fa-triangle-exclamation"></i><p>${esc(erroAtual)}</p></div>`;
      return;
    }

    if (!filtrados.length) {
      lista.innerHTML = `<div class="res-empty"><i class="fas fa-futbol"></i><p>${soDireto ? 'Não há jogos em direto agora.' : 'Não há jogos neste dia.'}</p></div>`;
      return;
    }

    const html = LIGAS.map((liga) => {
      const daLiga = filtrados
        .filter((f) => f.league.id === liga.id)
        .sort((a, b) => {
          const va = AO_VIVO.includes(a.fixture.status.short) ? 0 : 1;
          const vb = AO_VIVO.includes(b.fixture.status.short) ? 0 : 1;
          return va - vb || new Date(a.fixture.date) - new Date(b.fixture.date);
        });
      if (!daLiga.length) return '';
      const ronda = esc(traduzirRonda(daLiga[0].league.round));
      return `
        <div class="res-league">
          <div class="res-league-head">
            <span class="res-league-logo"><img src="https://media.api-sports.io/football/leagues/${liga.id}.png" alt="" onerror="this.parentNode.innerHTML='<i class=&quot;fas fa-trophy&quot;></i>'"></span>
            <span class="res-league-name">${esc(liga.nome)}<small>${esc(liga.pais)}${ronda ? ' · ' + ronda : ''}</small></span>
          </div>
          ${daLiga.map(jogoHtml).join('')}
        </div>`;
    }).join('');
    lista.innerHTML = html;
  }

  // ---------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------
  function ligarEventos() {
    document.getElementById('resDays').addEventListener('click', (e) => {
      const b = e.target.closest('[data-dia]');
      if (!b) return;
      diaOffset = Number(b.dataset.dia);
      saltouDeHoje = false;
      ligaAtiva = 'todas';
      carregar();
    });
    document.getElementById('resLeagues').addEventListener('click', (e) => {
      const b = e.target.closest('[data-liga]');
      if (!b) return;
      ligaAtiva = b.dataset.liga;
      render();
    });
    document.getElementById('resSoLive').addEventListener('change', (e) => {
      soDireto = e.target.checked;
      render();
    });
    document.getElementById('resList').addEventListener('click', (e) => {
      const row = e.target.closest('.res-match-row');
      if (!row) return;
      const card = row.closest('.res-match');
      const id = Number(card.dataset.id);
      if (abertos.has(id)) abertos.delete(id);
      else abertos.add(id);
      card.classList.toggle('open');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    ligarEventos();
    carregar({ procurarProximo: true });
    timer = setInterval(() => {
      if (document.visibilityState === 'visible' && diaOffset === 0) carregar();
    }, REFRESH_MS);
  });

  // ---------------------------------------------------------------
  // Dados de exemplo (mesmo formato que a API-Football devolve)
  // ---------------------------------------------------------------
  function dadosExemplo(offset) {
    let id = 1000 + (offset + 1) * 100;
    const liga = (lid, round) => {
      const l = LIGAS.find((x) => x.id === lid);
      return { id: lid, name: l.nome, country: l.pais, round };
    };
    const t = (tid, name) => ({ id: tid, name, logo: '' });
    const hora = (h, m) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      d.setHours(h, m || 0, 0, 0);
      return d.toISOString();
    };
    const golo = (min, tid, nome, detail) => ({ time: { elapsed: min }, team: { id: tid }, player: { name: nome }, type: 'Goal', detail: detail || 'Normal Goal' });
    const cartao = (min, tid, nome, red) => ({ time: { elapsed: min }, team: { id: tid }, player: { name: nome }, type: 'Card', detail: red ? 'Red Card' : 'Yellow Card' });
    const jogo = (lg, h, m, casa, fora, short, elapsed, gh, ga, events, venue) => ({
      fixture: { id: id++, date: hora(h, m), status: { short, elapsed }, venue: { name: venue || '' } },
      league: lg,
      teams: {
        home: Object.assign(casa, { winner: TERMINADO.includes(short) ? gh > ga : null }),
        away: Object.assign(fora, { winner: TERMINADO.includes(short) ? ga > gh : null }),
      },
      goals: { home: gh, away: ga },
      events: events || [],
    });

    const lp = liga(94, 'Regular Season - 11');
    const pl = liga(39, 'Regular Season - 12');
    const ll = liga(140, 'Regular Season - 13');
    const sa = liga(135, 'Regular Season - 12');
    const bl = liga(78, 'Regular Season - 11');
    const l1 = liga(61, 'Regular Season - 13');

    if (offset === -1) {
      return [
        jogo(lp, 20, 15, t(211, 'Benfica'), t(212, 'SC Braga'), 'FT', 90, 2, 1, [golo(23, 211, 'V. Pavlidis'), golo(51, 212, 'R. Horta'), golo(78, 211, 'G. Sudakov')]),
        jogo(pl, 20, 0, t(40, 'Liverpool'), t(49, 'Chelsea'), 'FT', 90, 1, 1, [golo(12, 49, 'C. Palmer', 'Penalty'), golo(66, 40, 'M. Salah')]),
        jogo(ll, 20, 0, t(530, 'Atlético Madrid'), t(536, 'Sevilla'), 'FT', 90, 3, 0, [golo(8, 530, 'J. Álvarez'), golo(44, 530, 'A. Griezmann'), golo(81, 530, 'A. Sørloth')]),
      ];
    }
    if (offset === 1) {
      return [
        jogo(lp, 18, 0, t(228, 'Sporting CP'), t(762, 'Gil Vicente'), 'NS', null, null, null, [], 'Estádio José Alvalade'),
        jogo(lp, 20, 30, t(212, 'Vitória SC'), t(240, 'Estoril'), 'NS', null, null, null, [], 'Estádio D. Afonso Henriques'),
        jogo(bl, 19, 30, t(157, 'Bayern München'), t(165, 'Borussia Dortmund'), 'NS', null, null, null, [], 'Allianz Arena'),
        jogo(l1, 20, 0, t(85, 'Paris Saint-Germain'), t(81, 'Marseille'), 'NS', null, null, null, [], 'Parc des Princes'),
      ];
    }
    return [
      jogo(lp, 19, 0, t(212, 'FC Porto'), t(4716, 'Famalicão'), '2H', 67, 2, 1, [
        golo(14, 212, 'Samu Aghehowa'),
        cartao(31, 4716, 'Gustavo Sá'),
        golo(39, 4716, 'Gil Dias'),
        golo(58, 212, 'Gabri Veiga'),
      ], 'Estádio do Dragão'),
      jogo(lp, 19, 30, t(225, 'Casa Pia'), t(242, 'Rio Ave'), 'HT', 45, 0, 0, [cartao(22, 242, 'A. Brandão')]),
      jogo(lp, 21, 15, t(211, 'Benfica'), t(228, 'Sporting CP'), 'NS', null, null, null, [], 'Estádio da Luz'),
      jogo(pl, 17, 30, t(50, 'Manchester City'), t(42, 'Arsenal'), 'FT', 90, 1, 2, [
        golo(19, 42, 'B. Saka'),
        golo(55, 50, 'E. Haaland'),
        cartao(70, 50, 'Rodri'),
        golo(88, 42, 'M. Ødegaard'),
      ]),
      jogo(pl, 20, 0, t(33, 'Manchester United'), t(47, 'Tottenham'), '1H', 28, 1, 0, [golo(17, 33, 'B. Fernandes', 'Penalty')]),
      jogo(ll, 20, 0, t(541, 'Real Madrid'), t(548, 'Real Sociedad'), '1H', 31, 0, 0, []),
      jogo(ll, 18, 0, t(529, 'Barcelona'), t(533, 'Villarreal'), 'FT', 90, 4, 2, [
        golo(5, 529, 'Lamine Yamal'),
        golo(27, 533, 'A. Moleiro'),
        golo(40, 529, 'R. Lewandowski'),
        golo(62, 529, 'Raphinha'),
        cartao(74, 533, 'D. Parejo', true),
        golo(80, 533, 'G. Mikautadze'),
        golo(90, 529, 'Pedri'),
      ]),
      jogo(sa, 19, 45, t(505, 'Inter'), t(489, 'AC Milan'), '2H', 52, 1, 1, [golo(9, 489, 'C. Pulisic'), golo(41, 505, 'L. Martínez')]),
      jogo(bl, 19, 30, t(168, 'Bayer Leverkusen'), t(173, 'RB Leipzig'), 'PST', null, null, null),
    ];
  }
})();
