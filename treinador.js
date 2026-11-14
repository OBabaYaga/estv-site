// ===================================================================
// ESTV Treinador — interface (Carreira, Liga ESTV, Desafios, Ranking)
// O motor está em treinador-motor.js (o mesmo que corre no servidor).
// ===================================================================
(function () {
  'use strict';
  const TM = window.TreinadorMotor;
  const LS_KEY = 'estv_treinador_carreira_v1';
  const LS_PREF = 'estv_treinador_pref';
  const EU = 'eu';

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = (v) => TM.fmtEur(v);
  const n0 = (v) => Math.round(Number(v) || 0).toLocaleString('pt-PT');
  const POS_NOME = { G: 'GR', D: 'DEF', M: 'MED', A: 'AV' };
  const BANDEIRA = { PT: '🇵🇹', BR: '🇧🇷', ES: '🇪🇸', AR: '🇦🇷', CV: '🇨🇻', AO: '🇦🇴', FR: '🇫🇷', SN: '🇸🇳', UY: '🇺🇾', RS: '🇷🇸' , IT: '🇮🇹', EN: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' };
  const CAR_CURTA = { fin: 'FIN', cab: 'CAB', cru: 'CRU', dri: 'DRI', vel: 'VEL', arm: 'ARM', pas: 'PAS', des: 'DES', mar: 'MAR', res: 'RES', ref: 'REF', col: 'COL', sai: 'SAI', dpe: 'DPE' };

  function apiBase() {
    const b = (typeof ESTV_CONFIG !== 'undefined' && ESTV_CONFIG.API_BASE_URL) || 'https://estv-api-delta.vercel.app';
    return b.replace(/\/$/, '') + '/api/health?modo=treinador';
  }
  function token() {
    try { return localStorage.getItem('estv_twitch_token'); } catch (e) { return null; }
  }
  function tw() {
    return typeof TwitchAuth !== 'undefined' ? TwitchAuth : null;
  }
  function meuLogin() {
    const t = tw();
    const u = t && t.getUser && t.getUser();
    return u ? String(u.login || '').toLowerCase() : null;
  }
  function meuNome() {
    const t = tw();
    const u = t && t.getUser && t.getUser();
    return u ? u.displayName || u.login : 'Treinador';
  }
  async function api(acao, dados, metodo) {
    const t = token();
    const url = apiBase() + '&acao=' + encodeURIComponent(acao);
    const opts = { method: metodo || (dados ? 'POST' : 'GET'), headers: {}, cache: 'no-store' };
    if (t) opts.headers.Authorization = 'Bearer ' + t;
    if (dados) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(dados);
    }
    const r = await fetch(url, opts);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.erro) {
      const e = new Error(j.erro || j.error || 'Algo correu mal. Tenta outra vez.');
      e.status = r.status;
      throw e;
    }
    return j;
  }

  // ---------------------------------------------------------------
  // Estado
  // ---------------------------------------------------------------
  const S = {
    modo: 'carreira',
    vista: 'equipa',
    fonte: null, // Carreira | Liga
    sel: null, // { tipo:'slot'|'jog', v }
    div: null,
    mercado: 'leiloes',
    filtro: { pos: '', min: 0 },
    aoVivo: null,
  };
  try {
    const p = JSON.parse(localStorage.getItem(LS_PREF) || '{}');
    if (p.vel) S.vel = p.vel;
    if (p.pausaIntervalo != null) S.pausaIntervalo = p.pausaIntervalo;
  } catch (e) {}
  if (!S.vel) S.vel = 2;
  if (S.pausaIntervalo == null) S.pausaIntervalo = true;
  function guardarPref() {
    try { localStorage.setItem(LS_PREF, JSON.stringify({ vel: S.vel, pausaIntervalo: S.pausaIntervalo })); } catch (e) {}
  }

  // ---------------------------------------------------------------
  // Fonte: Carreira (tudo no browser, guardado aqui e na nuvem)
  // ---------------------------------------------------------------
  const Carreira = {
    tipo: 'carreira',
    mundo: null,
    carregar() {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          if (d && d.mundo) TM.migrar(d.mundo);
          if (d && d.mundo && d.mundo.v === TM.VERSAO) {
            this.mundo = d.mundo;
            this.atualizado = d.ts || 0;
            return true;
          }
        }
      } catch (e) {}
      return false;
    },
    guardar() {
      const ts = Date.now();
      this.atualizado = ts;
      try { localStorage.setItem(LS_KEY, JSON.stringify({ mundo: this.mundo, ts })); } catch (e) { toast('Não consegui guardar neste browser (espaço cheio?).', 'erro'); }
      this.agendarNuvem();
    },
    agendarNuvem() {
      if (!token()) return;
      clearTimeout(this._t);
      this._t = setTimeout(() => this.nuvem().catch(() => {}), 1500);
    },
    async nuvem() {
      if (!token() || !this.mundo) return;
      await api('carreira-guardar', { mundo: this.mundo, ts: this.atualizado });
    },
    meu() {
      if (!this.mundo) return null;
      return Object.values(this.mundo.clubes).find((c) => c.hum === EU) || null;
    },
    treinador() {
      return this.mundo ? TM.treinadorDe(this.mundo, EU) : null;
    },
    podeJogar: true,
    async acao(nome, ...args) {
      const m = this.mundo;
      const c = this.meu();
      let r;
      switch (nome) {
        case 'licitar': r = TM.licitar(m, c.id, args[0], args[1]); break;
        case 'leilao': r = TM.porLeilao(m, args[0], args[1], true); break;
        case 'comprar': r = TM.comprarDireto(m, c.id, args[0]); break;
        case 'vender': r = TM.venderJa(m, c.id, args[0], TM.criarRng(Date.now() & 0xffffffff)); break;
        case 'dispensar': r = TM.dispensar(m, c.id, args[0]); break;
        case 'estadio': r = TM.ampliarEstadio(m, c.id, args[0]); break;
        case 'bilhete': r = TM.definirBilhete(m, c.id, args[0]); break;
        case 'emprestimo': r = TM.emprestimo(m, c.id, args[0]); break;
        case 'escalacao':
          c.tat = args[0].tat;
          c.xi = args[0].xi;
          c.banco = args[0].banco;
          r = { ok: true };
          break;
        case 'assumir': r = TM.assumirClube(m, EU, args[0]); break;
        case 'retirarLance': {
          const l = m.mercado.leiloes.find((x) => x.j === args[0]);
          if (l) delete l.lances[c.id];
          r = { ok: true };
          break;
        }
        default: r = { erro: 'Ação desconhecida.' };
      }
      if (r && r.erro) throw new Error(r.erro);
      this.guardar();
      return r;
    },
  };

  // ---------------------------------------------------------------
  // Fonte: Liga ESTV (o mundo vive no servidor)
  // ---------------------------------------------------------------
  const Liga = {
    tipo: 'liga',
    mundo: null,
    info: null,
    async carregar() {
      const j = await api('liga');
      this.aplicar(j);
      return j;
    },
    aplicar(j) {
      if (j.mundo) this.mundo = TM.migrar(j.mundo);
      this.info = j.info || this.info;
      this.login = j.login || this.login;
    },
    meu() {
      if (!this.mundo || !this.login) return null;
      return Object.values(this.mundo.clubes).find((c) => c.hum === this.login) || null;
    },
    treinador() {
      return this.mundo && this.login ? this.mundo.treinadores[this.login] || null : null;
    },
    podeJogar: false,
    async acao(nome, ...args) {
      const j = await api('liga-acao', { acao: nome, args });
      this.aplicar(j);
      return j.r || { ok: true };
    },
  };

  // ---------------------------------------------------------------
  // Utilitários de UI
  // ---------------------------------------------------------------
  function toast(txt, tipo) {
    let box = $('#trToast');
    if (!box) {
      box = document.createElement('div');
      box.id = 'trToast';
      document.body.appendChild(box);
    }
    const el = document.createElement('div');
    el.className = 'tr-toast ' + (tipo || '');
    el.textContent = txt;
    box.appendChild(el);
    setTimeout(() => el.classList.add('sai'), 3200);
    setTimeout(() => el.remove(), 3700);
  }
  function modal(html, opts) {
    fecharModal();
    const el = document.createElement('div');
    el.className = 'tr-modal-fundo';
    el.innerHTML = '<div class="tr-modal' + (opts && opts.largo ? ' largo' : '') + '" role="dialog" aria-modal="true"><button class="tr-modal-x" data-acao="fechar-modal" aria-label="Fechar">✕</button>' + html + '</div>';
    el.addEventListener('click', (e) => {
      if (e.target === el) fecharModal();
    });
    document.body.appendChild(el);
    document.body.classList.add('tr-com-modal');
    return el;
  }
  function fecharModal() {
    $$('.tr-modal-fundo').forEach((x) => x.remove());
    document.body.classList.remove('tr-com-modal');
  }
  function emblema(c, tam) {
    if (!c) return '';
    const [c1, c2] = c.cor || ['#333', '#fff'];
    return '<span class="tr-emb' + (tam ? ' ' + tam : '') + '" style="--c1:' + esc(c1) + ';--c2:' + esc(c2) + '"><b>' + esc(c.c || c.id) + '</b></span>';
  }
  function nomeClube(m, id, curto) {
    const c = m.clubes[id];
    return c ? (curto ? c.c : c.n) : '?';
  }
  function barra(f) {
    const v = Math.max(1, Math.min(99, f));
    const cor = v >= 70 ? '#22c55e' : v >= 50 ? '#84cc16' : v >= 35 ? '#f0b429' : '#f97316';
    return '<span class="tr-forca"><b>' + Math.round(v) + '</b><i style="width:' + v + '%;background:' + cor + '"></i></span>';
  }
  function posTag(p) {
    return '<span class="tr-pos tr-pos-' + p + '">' + POS_NOME[p] + '</span>';
  }
  function estadoJog(m, j) {
    let s = '';
    if (j.les > 0) s += '<span class="tr-est les" title="Lesionado ' + j.les + ' jornada(s)">🚑' + j.les + '</span>';
    if (j.cas > 0) s += '<span class="tr-est cas" title="Castigado ' + j.cas + ' jogo(s)">🟥' + j.cas + '</span>';
    if (j.am > 0) s += '<span class="tr-est am" title="' + j.am + ' amarelo(s) acumulado(s)">🟨' + j.am + '</span>';
    if (m.mercado.leiloes.some((l) => l.j === j.id)) s += '<span class="tr-est lei" title="Em leilão">🔨</span>';
    return s;
  }
  function nomeJog(j) {
    return esc(j.n) + (j.c ? ' <span class="tr-craque" title="Craque">★</span>' : '');
  }
  function cars(j) {
    return j.ca.map((k) => '<span class="tr-car" title="' + esc(TM.CARACT[k]) + '">' + CAR_CURTA[k] + '</span>').join('');
  }
  function proximoJogo(m, cid) {
    const p = m.cal[m.passo];
    if (!p) return null;
    if (p.t === 'L') {
      const c = m.clubes[cid];
      const par = m.fix[c.div][p.r].find((x) => x[0] === cid || x[1] === cid);
      return { tipo: 'L', r: p.r, h: par[0], a: par[1] };
    }
    const tc = minhaTaca(m, m.clubes[cid]);
    const joga = tc && !tc.campeao && p.r >= tc.inicio;
    return { tipo: 'T', r: p.r, vivo: !!(joga && tc.vivos.includes(cid)), joga, rn: tc ? TM.nomeRonda(tc) : '' };
  }
  function nomePasso(m, k) {
    const p = m.cal[k == null ? m.passo : k];
    if (!p) return '';
    if (p.t === 'L') return 'Jornada ' + (p.r + 1);
    // ronda de Taça em que ninguém joga (ex.: só há taças mais curtas): mostra o passo seguinte
    const algum = Object.values(m.tacas || {}).some((t) => !t.campeao && p.r >= t.inicio);
    if (!algum) return nomePasso(m, (k == null ? m.passo : k) + 1);
    const c = S.fonte && S.fonte.meu && S.fonte.mundo === m ? S.fonte.meu() : null;
    const tc = minhaTaca(m, c);
    return tc && !tc.campeao && p.r >= tc.inicio ? 'Taça — ' + TM.nomeRonda(tc) : 'Taça (noutras ligas)';
  }
  function nd(m, d) {
    return TM.nomeDiv(m, d);
  }
  function multi(m) {
    return (m.paises || []).length > 1;
  }
  function ndComPais(m, d) {
    const i = TM.infoDiv(m, d);
    return (multi(m) ? (TM.PAISES[i.p] || {}).band + ' ' : '') + nd(m, d);
  }
  function minhaTaca(m, c) {
    return (m.tacas && m.tacas[(c && c.pais) || 'PT']) || null;
  }
  function epocaTxt(m) {
    return m.ano + '/' + String(m.ano + 1).slice(2);
  }

  // ---------------------------------------------------------------
  // Render principal
  // ---------------------------------------------------------------
  function app() {
    return $('#trApp');
  }
  function render() {
    $$('.tr-modo').forEach((b) => b.classList.toggle('ativo', b.dataset.modo === S.modo));
    if (S.aoVivo) return renderAoVivo();
    if (S.modo === 'carreira') return renderCarreira();
    if (S.modo === 'liga') return renderLiga();
    if (S.modo === 'desafios') return renderDesafios();
    if (S.modo === 'ranking') return renderRanking();
  }

  // ---------------------- Carreira ----------------------
  function renderCarreira() {
    S.fonte = Carreira;
    if (!Carreira.mundo && !Carreira.carregar()) return renderInicio();
    const c = Carreira.meu();
    if (!c) return renderOfertas(Carreira);
    renderPainel(Carreira);
  }

  function renderInicio() {
    const pais = S.paisInicio;
    const textoBase =
      '<ul class="tr-dicas"><li>⚽ Jogos simulados minuto a minuto, com substituições e tática.</li><li>💰 Leilões, compras, vendas, bilheteira, estádio e banco.</li><li>🏆 Divisões, Taça, melhor marcador e carreira de treinador.</li></ul>';
    if (!pais) {
      app().innerHTML =
        '<div class="tr-inicio"><div class="tr-inicio-txt"><h2>Começa a tua carreira</h2>' +
        '<p>Escolhe o país onde queres treinar. Como no Elifoot, começas por baixo, na divisão mais baixa, e tens de chegar ao topo.</p>' + textoBase + '</div>' +
        '<div class="tr-ofertas">' +
        Object.entries(TM.PAISES).map(([k, P]) => '<button class="tr-oferta" data-acao="pais-inicio" data-p="' + k + '"><span class="tr-band">' + P.band + '</span><span class="tr-oferta-nome">' + esc(P.nome) + '</span><span class="tr-oferta-info">' + P.divs.length + ' divisões · ' + P.clubes.length + ' clubes · começas na ' + esc(P.divs[P.divs.length - 1]) + '</span></button>').join('') +
        '</div></div>';
      return;
    }
    const sem = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    S.semente = S.semente || sem;
    const preview = TM.criarMundo(S.semente, { paises: [pais] });
    const rng = TM.criarRng(S.semente ^ 0x9e3779b9);
    const ds = TM.divsDoPais(preview, pais);
    const ultima = ds[ds.length - 1];
    const d4 = preview.divs[ultima].slice().sort(() => rng.r() - 0.5).slice(0, 3);
    S.preview = preview;
    app().innerHTML =
      '<div class="tr-inicio">' +
      '<div class="tr-inicio-txt"><h2>' + TM.PAISES[pais].band + ' Começa a tua carreira em ' + esc(TM.PAISES[pais].nome) + '</h2>' +
      '<p>Escolhe um dos três clubes da <b>' + esc(TM.nomeDiv(preview, ultima)) + '</b> que te convidaram. Ganha jogos, compra bem, sobe de divisão e espera pelos convites dos clubes grandes. Se perderes muitos jogos seguidos ou afundares o clube em dívidas, és despedido.</p>' +
      textoBase +
      (token() ? '<p class="tr-nota">A tua carreira fica guardada neste browser e na tua conta, para continuares noutro PC ou telemóvel.</p>' : '<p class="tr-nota">Dica: entra com a Twitch para guardar a carreira na tua conta e continuares noutro PC ou telemóvel.</p>') +
      '</div><div class="tr-ofertas">' +
      d4
        .map((id) => {
          const c = preview.clubes[id];
          const f = c.pl.map((x) => preview.jog[x].f).sort((a, b) => b - a).slice(0, 14);
          const media = f.reduce((s, x) => s + x, 0) / f.length;
          return '<button class="tr-oferta" data-acao="escolher-clube" data-id="' + id + '">' + emblema(c, 'g') + '<span class="tr-oferta-nome">' + esc(c.n) + '</span><span class="tr-oferta-info">Força média ' + Math.round(media) + ' · ' + n0(c.lug) + ' lugares · ' + eur(c.din) + '</span></button>';
        })
        .join('') +
      '<button class="tr-link" data-acao="outros-clubes"><i class="fas fa-dice"></i> Outros convites</button><button class="tr-link" data-acao="pais-inicio" data-p=""><i class="fas fa-earth-europe"></i> Escolher outro país</button></div></div>';
  }

  function renderOfertas(fonte) {
    const m = fonte.mundo;
    const t = fonte.treinador() || {};
    const ofertas = (t.ofertas || []).filter((id) => m.clubes[id] && !m.clubes[id].hum);
    app().innerHTML =
      '<div class="tr-inicio"><div class="tr-inicio-txt"><h2>' + (t.despedido ? '🚪 Foste despedido' : 'Sem clube') + '</h2>' +
      '<p>' + (t.despedido ? 'A direção perdeu a paciência. Mas há clubes interessados em ti:' : 'Escolhe um clube para treinar:') + '</p></div>' +
      '<div class="tr-ofertas">' +
      (ofertas.length ? ofertas : Object.values(m.clubes).filter((c) => !c.hum && c.div === 3).slice(0, 3).map((c) => c.id))
        .map((id) => {
          const c = m.clubes[id];
          return '<button class="tr-oferta" data-acao="assumir" data-id="' + id + '">' + emblema(c, 'g') + '<span class="tr-oferta-nome">' + esc(c.n) + '</span><span class="tr-oferta-info">' + ndComPais(m, c.div) + ' · ' + eur(c.din) + '</span></button>';
        })
        .join('') +
      (fonte === Carreira ? '<button class="tr-link" data-acao="nova-carreira"><i class="fas fa-rotate"></i> Começar uma carreira nova</button>' : '') +
      '</div></div>';
  }

  // ---------------------- Painel do clube ----------------------
  const VISTAS = [
    ['equipa', 'fa-shirt', 'Equipa'],
    ['jogo', 'fa-futbol', 'Jornada'],
    ['tabelas', 'fa-list-ol', 'Tabelas'],
    ['taca', 'fa-trophy', 'Taça'],
    ['mercado', 'fa-right-left', 'Mercado'],
    ['financas', 'fa-coins', 'Finanças'],
    ['noticias', 'fa-newspaper', 'Notícias'],
  ];
  function renderPainel(fonte) {
    const m = fonte.mundo;
    const c = fonte.meu();
    const t = fonte.treinador() || {};
    const cls = TM.classificacao(m, c.div);
    const lugar = cls.findIndex((x) => x.id === c.id) + 1;
    const ofertas = (t.ofertas || []).filter((id) => m.clubes[id] && !m.clubes[id].hum);
    app().innerHTML =
      '<div class="tr-jogo">' +
      '<aside class="tr-clube">' +
      '<div class="tr-clube-topo">' + emblema(c, 'g') + '<div><div class="tr-clube-nome">' + esc(c.n) + '</div><div class="tr-clube-div">' + esc(ndComPais(m, c.div)) + ' · ' + lugar + '.º lugar</div></div></div>' +
      '<div class="tr-clube-linha"><span>Época</span><b>' + epocaTxt(m) + '</b></div>' +
      '<div class="tr-clube-linha"><span>A seguir</span><b>' + esc(nomePasso(m)) + '</b></div>' +
      '<div class="tr-clube-linha"><span>Dinheiro</span><b class="' + (c.din < 0 ? 'neg' : '') + '">' + eur(c.din) + '</b></div>' +
      (c.emp ? '<div class="tr-clube-linha"><span>Empréstimo</span><b class="neg">' + eur(c.emp) + '</b></div>' : '') +
      '<div class="tr-clube-linha"><span>Moral</span><span class="tr-moral"><i style="width:' + c.mor * 5 + '%"></i></span></div>' +
      '<div class="tr-clube-linha"><span>Treinador</span><b>' + esc(fonte === Carreira ? meuNome() : fonte.login) + ' · ' + (t.pts || 0) + ' pts</b></div>' +
      (fonte.podeJogar
        ? '<button class="tr-btn-jogar" data-acao="jogar"><i class="fas fa-play"></i> Jogar ' + esc(nomePasso(m)) + '</button>'
        : renderRelogioLiga(fonte)) +
      (ofertas.length ? '<button class="tr-btn-convite" data-acao="ver-convites"><i class="fas fa-envelope"></i> ' + ofertas.length + ' convite(s) de outros clubes</button>' : '') +
      (fonte === Carreira ? '<button class="tr-link perigo tr-recomecar" data-acao="nova-carreira"><i class="fas fa-rotate-left"></i> Recomeçar do zero</button>' : '') +
      '</aside>' +
      '<div class="tr-conteudo"><nav class="tr-tabs">' +
      VISTAS.map((v) => '<button class="tr-tab' + (S.vista === v[0] ? ' ativo' : '') + '" data-vista="' + v[0] + '"><i class="fas ' + v[1] + '"></i><span>' + v[2] + '</span></button>').join('') +
      '</nav><div id="trVista" class="tr-vista"></div></div></div>';
    renderVista(fonte);
  }

  function renderVista(fonte) {
    const el = $('#trVista');
    if (!el) return;
    const fn = { equipa: vEquipa, jogo: vJornada, tabelas: vTabelas, taca: vTaca, mercado: vMercado, financas: vFinancas, noticias: vNoticias }[S.vista] || vEquipa;
    el.innerHTML = fn(fonte);
  }

  // ---------------------- Equipa / escalação ----------------------
  function escAtual(fonte) {
    const m = fonte.mundo;
    const c = fonte.meu();
    if (!S.esc || S.esc.clube !== c.id || S.esc.mundo !== m) {
      const e = TM.escalacaoHumana(m, c);
      S.esc = { clube: c.id, mundo: m, tat: e.tat, xi: e.xi.slice(), banco: e.banco.slice(), sujo: false };
    }
    return S.esc;
  }
  function vEquipa(fonte) {
    const m = fonte.mundo;
    const c = fonte.meu();
    const e = escAtual(fonte);
    const pos = TM.posicoesDa(e.tat.f);
    const linhas = { A: [], M: [], D: [], G: [] };
    pos.forEach((p, k) => linhas[p].push(k));
    const slot = (k) => {
      const id = e.xi[k];
      const j = id && m.jog[id];
      const fora = j && j.p !== pos[k];
      const sel = S.sel && S.sel.tipo === 'slot' && S.sel.v === k;
      const ind = j && (j.les > 0 || j.cas > 0);
      return '<button class="tr-slot' + (sel ? ' sel' : '') + (fora ? ' fora' : '') + (ind ? ' ind' : '') + (j ? '' : ' vazio') + '" data-acao="slot" data-k="' + k + '">' +
        '<span class="tr-slot-pos">' + POS_NOME[pos[k]] + '</span>' +
        (j ? '<span class="tr-slot-nome">' + esc(j.n) + (j.c ? ' ★' : '') + '</span><span class="tr-slot-f">' + Math.round(j.f * (j.p === pos[k] ? 1 : 0.8)) + '</span>' : '<span class="tr-slot-nome">—</span>') +
        '</button>';
    };
    const sel = (nome, opcoes, atual) => '<label class="tr-sel"><span>' + nome + '</span><select data-tat="' + nome + '">' + Object.entries(opcoes).map(([k, v]) => '<option value="' + k + '"' + (k === atual ? ' selected' : '') + '>' + esc(v) + '</option>').join('') + '</select></label>';
    const formOpts = {};
    Object.keys(TM.FORMACOES).forEach((f) => (formOpts[f] = f));
    const total = TM.forcaOnze(m, e.xi, e.tat.f);
    const jogs = c.pl.map((id) => m.jog[id]).sort((a, b) => 'GDMA'.indexOf(a.p) - 'GDMA'.indexOf(b.p) || b.f - a.f);
    return (
      '<div class="tr-equipa">' +
      '<div class="tr-tatica">' +
      sel('Formação', formOpts, e.tat.f).replace('data-tat="Formação"', 'data-tat="f"') +
      sel('Estilo', TM.ESTILOS, e.tat.e).replace('data-tat="Estilo"', 'data-tat="e"') +
      sel('Marcação', TM.MARCACOES, e.tat.m).replace('data-tat="Marcação"', 'data-tat="m"') +
      sel('Ataques', TM.FOCOS, e.tat.foco).replace('data-tat="Ataques"', 'data-tat="foco"') +
      '<div class="tr-tatica-bts"><button class="tr-btn2" data-acao="auto-xi"><i class="fas fa-wand-magic-sparkles"></i> Melhor equipa</button>' +
      '<button class="tr-btn" data-acao="guardar-xi"' + (e.sujo ? '' : ' disabled') + '><i class="fas fa-floppy-disk"></i> Guardar</button></div>' +
      '</div>' +
      '<p class="tr-ajuda">' + (S.sel ? 'Agora toca no jogador ou na posição para trocar.' : 'Toca numa posição do campo e depois num jogador da lista (ou ao contrário) para trocar. Fora de posição o jogador rende menos (a amarelo).') + ' Força do onze: <b>' + Math.round(total) + '</b></p>' +
      '<div class="tr-campo-wrap"><div class="tr-campo">' +
      ['A', 'M', 'D', 'G'].map((p) => '<div class="tr-linha">' + linhas[p].map(slot).join('') + '</div>').join('') +
      '</div>' +
      '<div class="tr-banco"><h4>Banco (' + e.banco.length + '/7)</h4>' +
      (e.banco.length ? e.banco.map((id) => {
        const j = m.jog[id];
        return '<button class="tr-banco-j' + (S.sel && S.sel.tipo === 'jog' && S.sel.v === id ? ' sel' : '') + '" data-acao="jog" data-id="' + id + '">' + posTag(j.p) + ' ' + esc(j.n) + ' <b>' + Math.round(j.f) + '</b></button>';
      }).join('') : '<p class="tr-vazio">Sem suplentes.</p>') +
      '</div></div>' +
      '<h3 class="tr-h3">Plantel (' + c.pl.length + '/' + TM.MAX_PLANTEL + ')</h3>' +
      '<div class="tr-tabela-wrap"><table class="tr-tabela tr-plantel"><thead><tr><th></th><th>Jogador</th><th>Força</th><th class="m-esc">Idade</th><th class="m-esc">Caract.</th><th class="m-esc">Golos</th><th>Estado</th><th></th></tr></thead><tbody>' +
      jogs.map((j) => {
        const noXi = e.xi.includes(j.id);
        const noBanco = e.banco.includes(j.id);
        const sel2 = S.sel && S.sel.tipo === 'jog' && S.sel.v === j.id;
        return '<tr class="' + (noXi ? 'xi' : noBanco ? 'bn' : '') + (sel2 ? ' sel' : '') + '" data-acao="jog" data-id="' + j.id + '">' +
          '<td>' + posTag(j.p) + '</td><td class="tr-nomej">' + (BANDEIRA[j.nac] || '') + ' ' + nomeJog(j) + (noXi ? ' <span class="tr-tag">titular</span>' : noBanco ? ' <span class="tr-tag b">banco</span>' : '') + '</td>' +
          '<td>' + barra(j.f) + '</td><td class="m-esc">' + j.i + '</td><td class="m-esc">' + cars(j) + '</td><td class="m-esc">' + (j.gol || 0) + '</td><td>' + estadoJog(m, j) + '</td>' +
          '<td><button class="tr-mini" data-acao="ficha" data-id="' + j.id + '" aria-label="Ficha de ' + esc(j.n) + '">⋯</button></td></tr>';
      }).join('') +
      '</tbody></table></div></div>'
    );
  }

  function trocarNaEscalacao(fonte, slotK, jid) {
    const e = S.esc;
    const atualNoSlot = e.xi[slotK];
    const k2 = e.xi.indexOf(jid);
    const b2 = e.banco.indexOf(jid);
    if (k2 >= 0) {
      e.xi[k2] = atualNoSlot;
      e.xi[slotK] = jid;
    } else {
      e.xi[slotK] = jid;
      if (b2 >= 0) e.banco.splice(b2, 1);
      if (atualNoSlot) {
        if (b2 >= 0) e.banco.splice(b2, 0, atualNoSlot);
        else if (e.banco.length < 7) e.banco.push(atualNoSlot);
      }
    }
    e.sujo = true;
  }
  function alternarBanco(fonte, jid) {
    const e = S.esc;
    if (e.xi.includes(jid)) return;
    const b = e.banco.indexOf(jid);
    if (b >= 0) e.banco.splice(b, 1);
    else if (e.banco.length < 7) e.banco.push(jid);
    else return toast('O banco só leva 7 jogadores.', 'erro');
    e.sujo = true;
  }

  function fichaJogador(fonte, jid) {
    const m = fonte.mundo;
    const j = m.jog[jid];
    const c = fonte.meu();
    const meu = j.cl === c.id;
    const dono = j.cl ? m.clubes[j.cl] : null;
    const lei = m.mercado.leiloes.find((l) => l.j === jid);
    const v = TM.valor(j);
    let acoes = '';
    if (meu) {
      acoes =
        (lei ? '<p class="tr-nota">Está em leilão (base ' + eur(lei.base) + '). Resolve-se na próxima jornada.</p>' : '<div class="tr-form-linha"><label>Base do leilão <input type="number" id="trBase" min="' + Math.round(v * 0.5) + '" step="10000" value="' + Math.round(v * 0.9) + '"></label><button class="tr-btn" data-acao="leilao" data-id="' + jid + '"><i class="fas fa-gavel"></i> Pôr em leilão</button></div>') +
        '<div class="tr-form-linha"><button class="tr-btn2" data-acao="vender" data-id="' + jid + '">Vender já por ' + eur(Math.round((v * 0.65) / 1000) * 1000) + '</button><button class="tr-btn2 perigo" data-acao="dispensar" data-id="' + jid + '">Dispensar</button></div>';
    } else if (lei) {
      const meuLance = lei.lances[c.id];
      acoes = '<div class="tr-form-linha"><label>O teu lance <input type="number" id="trLance" min="' + lei.base + '" step="10000" value="' + (meuLance || lei.base) + '"></label><button class="tr-btn" data-acao="licitar" data-id="' + jid + '"><i class="fas fa-gavel"></i> Licitar</button></div><p class="tr-nota">Base ' + eur(lei.base) + '. O leilão fecha na próxima jornada e ganha o lance mais alto (a IA também licita).</p>';
    } else if (!dono || !dono.hum) {
      const preco = TM.precoPedido(m, j);
      acoes = '<div class="tr-form-linha"><button class="tr-btn" data-acao="comprar" data-id="' + jid + '"><i class="fas fa-cart-shopping"></i> ' + (dono ? 'Comprar por ' + eur(preco) : 'Contratar (livre)') + '</button></div>';
    } else {
      acoes = '<p class="tr-nota">Jogador de outro treinador. Só o podes comprar se ele o puser em leilão.</p>';
    }
    modal(
      '<div class="tr-ficha"><div class="tr-ficha-topo">' + posTag(j.p) + '<h3>' + nomeJog(j) + '</h3></div>' +
      '<div class="tr-ficha-grid">' +
      '<div><span>Clube</span><b>' + (dono ? esc(dono.n) : 'Livre') + '</b></div>' +
      '<div><span>Força</span><b>' + barra(j.f) + '</b></div>' +
      '<div><span>Idade</span><b>' + j.i + ' anos</b></div>' +
      '<div><span>Nacionalidade</span><b>' + (BANDEIRA[j.nac] || '') + ' ' + j.nac + '</b></div>' +
      '<div><span>Características</span><b>' + (j.ca.map((k) => esc(TM.CARACT[k])).join(', ') || '—') + '</b></div>' +
      '<div><span>Comportamento</span><b>' + TM.COMPORTAMENTO[j.cp] + '</b></div>' +
      '<div><span>Salário</span><b>' + eur(j.sal) + ' / jornada</b></div>' +
      '<div><span>Valor</span><b>' + eur(v) + '</b></div>' +
      '<div><span>Época</span><b>' + (j.jg || 0) + ' jogos · ' + (j.gol || 0) + ' golos</b></div>' +
      '<div><span>Estado</span><b>' + (estadoJog(m, j) || 'Disponível') + '</b></div>' +
      '</div>' + acoes + '</div>'
    );
  }

  // ---------------------- Jornada ----------------------
  function vJornada(fonte) {
    const m = fonte.mundo;
    const c = fonte.meu();
    const pj = proximoJogo(m, c.id);
    let prox = '';
    if (!pj) prox = '<p>Época terminada.</p>';
    else if (pj.tipo === 'L') {
      const adv = pj.h === c.id ? pj.a : pj.h;
      const ca = m.clubes[adv];
      const tA = m.tab[adv];
      const fm = ca.pl.map((x) => m.jog[x].f).sort((a, b) => b - a).slice(0, 14);
      prox =
        '<div class="tr-prox"><div class="tr-prox-eq">' + emblema(m.clubes[pj.h], 'g') + '<b>' + esc(nomeClube(m, pj.h)) + '</b></div><div class="tr-prox-vs">VS<small>' + esc(nomePasso(m)) + '</small></div><div class="tr-prox-eq">' + emblema(m.clubes[pj.a], 'g') + '<b>' + esc(nomeClube(m, pj.a)) + '</b></div></div>' +
        '<p class="tr-prox-info">' + esc(ca.n) + ': força média ' + Math.round(fm.reduce((s, x) => s + x, 0) / fm.length) + ', ' + (tA ? tA.p + ' pontos, forma ' + (tA.forma || '—').split('').map((x) => '<span class="tr-f ' + x + '">' + x + '</span>').join('') : '') + (ca.hum && ca.hum !== EU ? ' · treinado por <b>' + esc(ca.hum) + '</b>' : '') + '</p>';
    } else {
      prox = '<div class="tr-prox taca"><i class="fas fa-trophy"></i><div><b>' + esc(nomePasso(m)) + '</b><br>' + (pj.vivo ? 'Estás em prova. O adversário sai no sorteio.' : 'Já foste eliminado — a ronda joga-se na mesma.') + '</div></div>';
    }
    const u = m.ultimos;
    let ult = '';
    if (u && u.jogos && u.jogos.length) {
      const meus = u.t === 'L' ? u.jogos.filter((x) => x.dv === c.div) : u.jogos.filter((x) => (x.pa || 'PT') === c.pais);
      ult = '<h3 class="tr-h3">Resultados — ' + (u.t === 'L' ? 'Jornada ' + (u.r + 1) : 'Taça') + '</h3><div class="tr-res">' + meus.map((x) => linhaRes(m, x, c.id)).join('') + '</div>';
      if (u.t === 'L') ult += '<details class="tr-det"><summary>Outras divisões</summary><div class="tr-res">' + u.jogos.filter((x) => x.dv !== c.div).map((x) => linhaRes(m, x, c.id)).join('') + '</div></details>';
      else if (multi(m)) ult += '<details class="tr-det"><summary>Taças dos outros países</summary><div class="tr-res">' + u.jogos.filter((x) => (x.pa || 'PT') !== c.pais).map((x) => linhaRes(m, x, c.id)).join('') + '</div></details>';
    }
    return '<div class="tr-jornada">' + prox + (fonte.podeJogar ? '<button class="tr-btn-jogar grande" data-acao="jogar"><i class="fas fa-play"></i> Jogar ' + esc(nomePasso(m)) + '</button>' : '') + ult + '</div>';
  }
  function linhaRes(m, x, meu) {
    const destaque = x.h === meu || x.a === meu;
    return '<button class="tr-res-l' + (destaque ? ' meu' : '') + '" data-acao="ver-jogo" data-h="' + x.h + '" data-a="' + x.a + '"><span class="h">' + esc(nomeClube(m, x.h)) + '</span><b>' + x.gh + ' - ' + x.ga + '</b><span class="a">' + esc(nomeClube(m, x.a)) + '</span>' + (x.pen ? '<small>pen. ' + x.pen[0] + '-' + x.pen[1] + '</small>' : '') + '</button>';
  }
  function detalheJogo(fonte, h, a) {
    const m = fonte.mundo;
    const x = m.ultimos && m.ultimos.jogos.find((j) => j.h === h && j.a === a);
    if (!x) return;
    const evs = x.ev.filter((e) => e.t !== 'int').map((e) => '<li class="' + (e.l || '') + '"><span>' + e.m + "'</span>" + esc(TM.textoEvento(m, e, nomeClube(m, e.l === 'h' ? x.h : x.a))) + '</li>').join('');
    modal('<div class="tr-detjogo"><div class="tr-prox">' + '<div class="tr-prox-eq">' + emblema(m.clubes[h], 'g') + '<b>' + esc(nomeClube(m, h)) + '</b></div><div class="tr-placar">' + x.gh + ' - ' + x.ga + (x.pen ? '<small>pen. ' + x.pen[0] + '-' + x.pen[1] + '</small>' : '') + '</div><div class="tr-prox-eq">' + emblema(m.clubes[a], 'g') + '<b>' + esc(nomeClube(m, a)) + '</b></div></div>' +
      '<p class="tr-prox-info">Posse de bola ' + x.ps + '% - ' + (100 - x.ps) + '% · Público ' + n0(x.pub) + '</p><ul class="tr-eventos">' + (evs || '<li>Sem lances de registo.</li>') + '</ul></div>');
  }

  // ---------------------- Tabelas ----------------------
  function vTabelas(fonte) {
    const m = fonte.mundo;
    const c = fonte.meu();
    const d = S.div == null ? c.div : S.div;
    const cls = TM.classificacao(m, d);
    const art = TM.artilheiros(m, 10);
    return (
      '<div class="tr-divsel">' + m.divs.map((_, k) => '<button class="tr-chip' + (k === d ? ' ativo' : '') + '" data-acao="div" data-d="' + k + '">' + esc(ndComPais(m, k)) + '</button>').join('') + '</div>' +
      '<div class="tr-tabela-wrap"><table class="tr-tabela tr-class"><thead><tr><th>#</th><th>Clube</th><th>P</th><th>J</th><th class="m-esc">V</th><th class="m-esc">E</th><th class="m-esc">D</th><th>GM</th><th>GS</th><th class="m-esc">Forma</th></tr></thead><tbody>' +
      cls.map((l, k) => {
        const cl = m.clubes[l.id];
        const inf = TM.infoDiv(m, d);
        const nDivs = TM.divsDoPais(m, inf.p).length;
        const zona = inf.n > 0 && k < 2 ? 'sobe' : inf.n < nDivs - 1 && k >= 8 ? 'desce' : '';
        return '<tr class="' + zona + (l.id === c.id ? ' meu' : '') + '"><td>' + (k + 1) + '</td><td class="tr-nomec">' + emblema(cl, 'p') + ' ' + esc(cl.n) + (cl.hum && cl.hum !== EU ? ' <small class="tr-hum">' + esc(cl.hum) + '</small>' : '') + '</td><td><b>' + l.p + '</b></td><td>' + l.j + '</td><td class="m-esc">' + l.v + '</td><td class="m-esc">' + l.e + '</td><td class="m-esc">' + l.d + '</td><td>' + l.gm + '</td><td>' + l.gs + '</td><td class="m-esc">' + (l.forma || '').split('').map((x) => '<span class="tr-f ' + x + '">' + x + '</span>').join('') + '</td></tr>';
      }).join('') +
      '</tbody></table></div><p class="tr-legenda"><span class="sobe">■</span> sobem · <span class="desce">■</span> descem · 2 sobem e 2 descem no fim da época</p>' +
      '<h3 class="tr-h3">Melhores marcadores</h3><div class="tr-tabela-wrap"><table class="tr-tabela"><tbody>' +
      (art.length ? art.map((j, k) => '<tr' + (j.cl === c.id ? ' class="meu"' : '') + '><td>' + (k + 1) + '</td><td>' + nomeJog(j) + '</td><td>' + esc(nomeClube(m, j.cl)) + '</td><td><b>' + j.gol + '</b></td></tr>').join('') : '<tr><td>Ainda sem golos esta época.</td></tr>') +
      '</tbody></table></div>'
    );
  }

  // ---------------------- Taça ----------------------
  function vTaca(fonte) {
    const m = fonte.mundo;
    const c = fonte.meu();
    const pais = S.pTaca && m.tacas[S.pTaca] ? S.pTaca : c.pais || 'PT';
    const tc = m.tacas[pais];
    let html = multi(m) ? '<div class="tr-divsel">' + m.paises.map((p) => '<button class="tr-chip' + (p === pais ? ' ativo' : '') + '" data-acao="pais-taca" data-p="' + p + '">' + TM.PAISES[p].band + ' ' + esc(TM.PAISES[p].nome) + '</button>').join('') + '</div>' : '';
    const emProva = !tc.campeao && tc.vivos.concat(tc.isentos || []).includes(c.id);
    html += '<div class="tr-taca-topo"><i class="fas fa-trophy"></i><div><b>Taça' + (multi(m) ? ' de ' + esc(TM.PAISES[pais].nome) : '') + ' ' + epocaTxt(m) + '</b><br>' + (tc.campeao ? 'Vencedor: <b>' + esc(nomeClube(m, tc.campeao)) + '</b>' : 'Próxima ronda: ' + esc(TM.nomeRonda(tc)) + ' · ' + (tc.vivos.length + (tc.isentos || []).length) + ' clubes em prova') + (emProva ? ' · <b class="ok">o teu clube continua em prova</b>' : '') + '</div></div>';
    const rondas = [];
    for (const x of tc.jogos) if (!rondas.includes(x.r)) rondas.push(x.r);
    rondas.sort((a, b) => b - a);
    for (const r of rondas) {
      const js = tc.jogos.filter((x) => x.r === r);
      html += '<h3 class="tr-h3">' + esc(js[0].rn || TM.RONDAS_TACA[r] || '') + '</h3><div class="tr-res">' + js.map((x) => linhaRes(m, Object.assign({}, x), c.id).replace('data-acao="ver-jogo"', 'data-acao="nada"')).join('') + '</div>';
    }
    const hist = m.historia.filter((h) => (h.tacas || {})[pais]).slice(0, 8);
    if (hist.length) html += '<h3 class="tr-h3">Vencedores anteriores</h3><ul class="tr-lista">' + hist.map((h) => '<li>' + h.ano + '/' + String(h.ano + 1).slice(2) + ': <b>' + esc(nomeClube(m, h.tacas[pais])) + '</b></li>').join('') + '</ul>';
    return html;
  }


  // ---------------------- Mercado ----------------------
  function vMercado(fonte) {
    const m = fonte.mundo;
    const c = fonte.meu();
    const tabs = [['leiloes', 'Leilões (' + m.mercado.leiloes.length + ')'], ['procurar', 'Procurar jogadores'], ['livres', 'Livres (' + m.mercado.livres.length + ')'], ['meus', 'Os meus']];
    let corpo = '';
    const linhaJ = (j, extra) => '<tr data-acao="ficha" data-id="' + j.id + '"><td>' + posTag(j.p) + '</td><td class="tr-nomej">' + (BANDEIRA[j.nac] || '') + ' ' + nomeJog(j) + '<small>' + (j.cl ? esc(nomeClube(m, j.cl)) : 'livre') + ' · ' + j.i + ' anos</small></td><td>' + barra(j.f) + '</td><td class="m-esc">' + cars(j) + '</td>' + extra + '</tr>';
    if (S.mercado === 'leiloes') {
      const ls = m.mercado.leiloes.map((l) => ({ l, j: m.jog[l.j] })).filter((x) => x.j).sort((a, b) => b.j.f - a.j.f);
      corpo = ls.length
        ? '<table class="tr-tabela"><thead><tr><th></th><th>Jogador</th><th>Força</th><th class="m-esc">Caract.</th><th>Base</th><th>O teu lance</th></tr></thead><tbody>' +
          ls.map(({ l, j }) => linhaJ(j, '<td>' + eur(l.base) + '</td><td>' + (l.de === c.id ? '<span class="tr-tag">teu</span>' : l.lances[c.id] ? '<b class="ok">' + eur(l.lances[c.id]) + '</b>' : '—') + '</td>')).join('') + '</tbody></table>'
        : '<p class="tr-vazio">Não há leilões abertos. Aparecem novos a cada jornada.</p>';
      corpo = '<p class="tr-ajuda">Os leilões fecham na próxima jornada: ganha o lance mais alto. Os clubes da IA também licitam. Toca num jogador para licitar.</p>' + corpo;
    } else if (S.mercado === 'procurar') {
      const f = S.filtro;
      const todos = Object.values(m.jog).filter((j) => j.cl && j.cl !== c.id && (!f.pos || j.p === f.pos) && j.f >= (f.min || 0) && (!f.pais || m.clubes[j.cl].pais === f.pais)).sort((a, b) => b.f - a.f).slice(0, 60);
      corpo = '<div class="tr-filtros">' + (multi(m) ? ['', ...m.paises].map((p) => '<button class="tr-chip' + ((f.pais || '') === p ? ' ativo' : '') + '" data-acao="filtro-pais" data-p="' + p + '">' + (p ? TM.PAISES[p].band : 'Todos os países') + '</button>').join('') + '<br>' : '') + ['', 'G', 'D', 'M', 'A'].map((p) => '<button class="tr-chip' + (f.pos === p ? ' ativo' : '') + '" data-acao="filtro-pos" data-p="' + p + '">' + (p ? POS_NOME[p] : 'Todos') + '</button>').join('') +
        '<label class="tr-sel inline"><span>Força mín.</span><select data-acao-change="filtro-min">' + [0, 30, 40, 50, 60, 70, 80].map((v) => '<option value="' + v + '"' + (f.min === v ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label></div>' +
        '<table class="tr-tabela"><thead><tr><th></th><th>Jogador</th><th>Força</th><th class="m-esc">Caract.</th><th>Preço</th></tr></thead><tbody>' +
        todos.map((j) => linhaJ(j, '<td>' + (m.clubes[j.cl].hum ? '<small>treinador</small>' : eur(TM.precoPedido(m, j))) + '</td>')).join('') + '</tbody></table>';
    } else if (S.mercado === 'livres') {
      const ls = m.mercado.livres.map((id) => m.jog[id]).filter(Boolean).sort((a, b) => b.f - a.f);
      corpo = '<p class="tr-ajuda">Jogadores sem clube: só pagas o salário.</p><table class="tr-tabela"><thead><tr><th></th><th>Jogador</th><th>Força</th><th class="m-esc">Caract.</th><th>Salário</th></tr></thead><tbody>' + ls.map((j) => linhaJ(j, '<td>' + eur(j.sal) + '</td>')).join('') + '</tbody></table>';
    } else {
      const ls = c.pl.map((id) => m.jog[id]).sort((a, b) => b.f - a.f);
      corpo = '<p class="tr-ajuda">Toca num jogador para o pôr em leilão, vender já ou dispensar.</p><table class="tr-tabela"><thead><tr><th></th><th>Jogador</th><th>Força</th><th class="m-esc">Caract.</th><th>Valor</th></tr></thead><tbody>' + ls.map((j) => linhaJ(j, '<td>' + eur(TM.valor(j)) + '</td>')).join('') + '</tbody></table>';
    }
    return '<div class="tr-divsel">' + tabs.map(([k, n]) => '<button class="tr-chip' + (S.mercado === k ? ' ativo' : '') + '" data-acao="mercado" data-m="' + k + '">' + n + '</button>').join('') + '</div><div class="tr-saldo">Dinheiro: <b class="' + (c.din < 0 ? 'neg' : '') + '">' + eur(c.din) + '</b> · Plantel ' + c.pl.length + '/' + TM.MAX_PLANTEL + '</div><div class="tr-tabela-wrap">' + corpo + '</div>';
  }

  // ---------------------- Finanças ----------------------
  function vFinancas(fonte) {
    const m = fonte.mundo;
    const c = fonte.meu();
    const D = TM.econ(m, c.div);
    const sal = c.pl.reduce((s, id) => s + m.jog[id].sal, 0);
    const valorPl = c.pl.reduce((s, id) => s + TM.valor(m.jog[id]), 0);
    const uf = c.ultFin || {};
    return (
      '<div class="tr-fin">' +
      '<div class="tr-fin-cards">' +
      '<div class="tr-fin-c"><span>Dinheiro</span><b class="' + (c.din < 0 ? 'neg' : '') + '">' + eur(c.din) + '</b></div>' +
      '<div class="tr-fin-c"><span>Empréstimo</span><b class="' + (c.emp ? 'neg' : '') + '">' + eur(c.emp) + '</b><small>juros ' + (TM.JURO * 100).toFixed(1) + '% por jornada</small></div>' +
      '<div class="tr-fin-c"><span>Salários / jornada</span><b>' + eur(sal) + '</b></div>' +
      '<div class="tr-fin-c"><span>Valor do plantel</span><b>' + eur(valorPl) + '</b></div>' +
      '</div>' +
      '<h3 class="tr-h3">Última jornada</h3><ul class="tr-lista">' +
      '<li>Público em casa: <b>' + n0(c.ultPublico || 0) + '</b> de ' + n0(c.lug) + ' lugares</li>' +
      '<li>Bilheteira: <b class="ok">+' + eur(c.ultReceita || 0) + '</b></li>' +
      '<li>Patrocínio: <b class="ok">+' + eur(uf.pat || 0) + '</b> (' + eur(D.patrocinio) + ' por jornada de liga na ' + esc(nd(m, c.div)) + ')</li>' +
      '<li>Salários: <b class="neg">−' + eur(uf.sal || 0) + '</b></li>' +
      (uf.juros ? '<li>Juros: <b class="neg">−' + eur(uf.juros) + '</b></li>' : '') +
      '</ul>' +
      '<h3 class="tr-h3">Bilhetes</h3><div class="tr-form-linha"><label>Preço do bilhete (€) <input type="number" id="trBil" min="1" max="150" value="' + c.bil + '"></label><button class="tr-btn" data-acao="bilhete">Mudar</button></div>' +
      '<p class="tr-ajuda">Preço de referência na tua divisão: ' + D.bilhete + ' €. Mais caro dá mais por bilhete mas vem menos gente. O público também depende da força das duas equipas e da moral.</p>' +
      '<h3 class="tr-h3">Estádio</h3><p>' + n0(c.lug) + ' lugares' + (c.obras ? ' · <b>+' + n0(c.obras) + ' em obras</b> (prontos na próxima jornada)' : '') + '</p>' +
      '<div class="tr-form-linha"><label>Ampliar <select id="trObras">' + [1, 2, 3, 5, 10].map((n) => '<option value="' + n + '">' + n0(n * 1000) + ' lugares — ' + eur(n * TM.CUSTO_LUGARES) + '</option>').join('') + '</select></label><button class="tr-btn" data-acao="estadio"><i class="fas fa-helmet-safety"></i> Ampliar</button></div>' +
      '<h3 class="tr-h3">Banco</h3><p>Podes pedir até <b>' + eur(D.credito) + '</b> na ' + esc(nd(m, c.div)) + '. Os juros são cobrados todas as jornadas e o saldo negativo baixa a moral.</p>' +
      '<div class="tr-form-linha"><label>Montante (€) <input type="number" id="trEmp" min="0" step="50000" value="250000"></label><button class="tr-btn" data-acao="pedir">Pedir</button><button class="tr-btn2" data-acao="pagar"' + (c.emp ? '' : ' disabled') + '>Pagar</button></div>' +
      '</div>'
    );
  }

  // ---------------------- Notícias ----------------------
  function vNoticias(fonte) {
    const m = fonte.mundo;
    const c = fonte.meu();
    const t = fonte.treinador() || {};
    const minhas = m.noticias.slice(0, 40);
    return (
      '<div class="tr-not">' +
      '<div class="tr-trein"><h3 class="tr-h3">O treinador</h3><ul class="tr-lista">' +
      '<li>Pontos de treinador: <b>' + (t.pts || 0) + '</b></li><li>Vitórias / empates / derrotas: <b>' + (t.v || 0) + ' / ' + (t.e || 0) + ' / ' + (t.d || 0) + '</b></li>' +
      '<li>Títulos: ' + ((t.titulos || []).length ? t.titulos.map((x) => '<b>🏆 ' + esc(x.t) + '</b> (' + esc(x.cl) + ', ' + x.ano + ')').join(', ') : '—') + '</li>' +
      ((t.hist || []).length ? '<li>Percurso: ' + t.hist.slice(-8).map((h) => esc(h.cl) + ' ' + h.ano + (h.lugar ? ' (' + h.lugar + '.º, ' + esc(h.dn || nd(m, h.div)) + ')' : ' (despedido)')).join(' · ') + '</li>' : '') +
      '</ul>' + (fonte === Carreira ? '<button class="tr-link perigo" data-acao="nova-carreira"><i class="fas fa-rotate"></i> Começar carreira nova</button>' : '') + '</div>' +
      '<h3 class="tr-h3">Notícias</h3><ul class="tr-feed">' + minhas.map((n) => '<li class="' + (n.cl === c.id ? 'meu' : '') + '"><small>' + (n.e ? n.p != null ? 'Ép. ' + n.e : '' : '') + '</small>' + esc(n.txt) + '</li>').join('') + '</ul>' +
      (m.historia.length ? (() => {
        const ds = TM.divsDoPais(m, c.pais || 'PT');
        return '<h3 class="tr-h3">Épocas anteriores' + (multi(m) ? ' — ' + esc(TM.PAISES[c.pais].nome) : '') + '</h3><div class="tr-tabela-wrap"><table class="tr-tabela"><thead><tr><th>Época</th>' + ds.map((d, k) => '<th' + (k ? ' class="m-esc"' : '') + '>' + esc(nd(m, d)) + '</th>').join('') + '<th>Taça</th></tr></thead><tbody>' +
          m.historia.slice(0, 15).map((h) => '<tr><td>' + h.ano + '/' + String(h.ano + 1).slice(2) + '</td>' + ds.map((d, k) => '<td' + (k ? ' class="m-esc"' : '') + '>' + esc(h.campeoes[d] ? nomeClube(m, h.campeoes[d]) : '—') + '</td>').join('') + '<td>' + esc((h.tacas || {})[c.pais] ? nomeClube(m, h.tacas[c.pais]) : '—') + '</td></tr>').join('') + '</tbody></table></div>';
      })() : '') +
      '</div>'
    );
  }

  // ---------------------------------------------------------------
  // AO VIVO (Carreira: simulado aqui; Liga: repetição dos eventos)
  // ---------------------------------------------------------------
  const VELS = [
    { n: '1×', ms: 650 },
    { n: '2×', ms: 300 },
    { n: '4×', ms: 120 },
    { n: '⚡', ms: 15 },
  ];
  function iniciarJornada() {
    const fonte = Carreira;
    const m = fonte.mundo;
    const c = fonte.meu();
    // guarda a escalação que estava a ser editada
    if (S.esc && S.esc.sujo) {
      c.tat = S.esc.tat;
      c.xi = S.esc.xi;
      c.banco = S.esc.banco;
    }
    S.esc = null;
    let jogos = TM.prepararJornada(m);
    // passos sem jogos (ronda de Taça que só existe noutros países) passam logo
    let seguranca = 0;
    while (!jogos.length && seguranca++ < 3) {
      TM.concluirJornada(m, []);
      jogos = TM.prepararJornada(m);
    }
    const meuJ = jogos.find((j) => j.h.id === c.id || j.a.id === c.id) || null;
    S.aoVivo = {
      tipo: 'carreira',
      m,
      jogos,
      meu: meuJ,
      lado: meuJ ? (meuJ.h.id === c.id ? 'h' : 'a') : null,
      pausa: false,
      fim: false,
      vistos: 0,
      comentarios: [],
      titulo: nomePasso(m),
    };
    render();
    agendarTick();
  }
  function agendarTick() {
    const av = S.aoVivo;
    if (!av || av.fim) return;
    clearTimeout(av.t);
    av.t = setTimeout(tick, VELS[S.vel].ms);
  }
  function tick() {
    const av = S.aoVivo;
    if (!av || av.pausa || av.fim) return;
    const m = av.m;
    const { rng, guardar } = TM.rngDoMundo(m);
    const meuId = av.meu ? av.meu[av.lado].id : null;
    let pausar = false;
    for (const jg of av.jogos) {
      if (jg.fim) continue;
      const antes = jg.ev.length;
      TM.passo(m, jg, rng, meuId ? [meuId] : []);
      if (jg === av.meu) {
        for (const ev of jg.ev.slice(antes)) {
          if (ev.l === av.lado && (ev.t === 'les' || ev.t === 'vm' || ev.t === 'va')) pausar = true;
          if (ev.t === 'int' && S.pausaIntervalo) pausar = true;
        }
      }
      for (const ev of jg.ev.slice(antes)) if (ev.t === 'g') av.golo = { jg, t: Date.now() };
    }
    guardar();
    av.fim = av.jogos.every((j) => j.fim);
    if (pausar && !av.fim) {
      av.pausa = true;
      av.painelSubs = true;
    }
    desenharAoVivo();
    if (!av.fim && !av.pausa) agendarTick();
  }
  function minutoTxt(jg) {
    if (jg.fim) return jg.pen ? 'Pen.' : 'Fim';
    if (jg.min <= 45) return jg.min + "'";
    if (jg.min <= 90) return jg.min + "'";
    return '90+' + (jg.min - 90) + "'";
  }
  // ---------------------------------------------------------------
  // SOM: adeptos no estádio e festejo dos golos (gerado no browser,
  // volume baixo; liga/desliga no botão 🔊 dos jogos ao vivo)
  // ---------------------------------------------------------------
  const Som = {
    ctx: null,
    ligado: (function () {
      try { return localStorage.getItem('estv_treinador_som') !== '0'; } catch (e) { return true; }
    })(),
    ambiente: null,
    garantir() {
      if (!this.ligado) return null;
      try {
        if (!this.ctx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return null;
          this.ctx = new AC();
          this.mestre = this.ctx.createGain();
          this.mestre.gain.value = 1;
          this.mestre.connect(this.ctx.destination);
          // ruído rosa (base de tudo)
          const n = this.ctx.sampleRate * 3;
          const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
          const d = buf.getChannelData(0);
          let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
          for (let i = 0; i < n; i++) {
            const w = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
            b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
            d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
            b6 = w * 0.115926;
          }
          this.ruido = buf;
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
      } catch (e) {
        return null;
      }
    },
    fonteRuido() {
      const src = this.ctx.createBufferSource();
      src.buffer = this.ruido;
      src.loop = true;
      src.loopStart = Math.random();
      return src;
    },
    // murmúrio contínuo dos adeptos, com ondas a subir e descer
    iniciarAmbiente() {
      if (this.ambiente) return;
      const c = this.garantir();
      if (!c) return;
      const src = this.fonteRuido();
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 520;
      bp.Q.value = 0.7;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1600;
      const g = c.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.4, c.currentTime + 2.5);
      // ondas lentas no volume (cânticos ao longe)
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.13;
      const lfoG = c.createGain();
      lfoG.gain.value = 0.11;
      lfo.connect(lfoG).connect(g.gain);
      src.connect(bp).connect(lp).connect(g).connect(this.mestre);
      src.start();
      lfo.start();
      this.ambiente = { src, g, lfo };
    },
    pararAmbiente() {
      const a = this.ambiente;
      if (!a || !this.ctx) return;
      this.ambiente = null;
      const t = this.ctx.currentTime;
      a.g.gain.cancelScheduledValues(t);
      a.g.gain.setValueAtTime(a.g.gain.value, t);
      a.g.gain.linearRampToValueAtTime(0, t + 1.5);
      setTimeout(() => {
        try { a.src.stop(); a.lfo.stop(); } catch (e) {}
      }, 1700);
    },
    // festejo do golo (a nosso favor) ou lamento (contra)
    golo(nosso) {
      const c = this.garantir();
      if (!c) return;
      const t = c.currentTime;
      const src = this.fonteRuido();
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.55;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      if (nosso) {
        bp.frequency.setValueAtTime(700, t);
        bp.frequency.linearRampToValueAtTime(1100, t + 0.6);
        bp.frequency.linearRampToValueAtTime(800, t + 4);
        g.gain.exponentialRampToValueAtTime(0.9, t + 0.35);
        g.gain.setValueAtTime(0.9, t + 1.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 4.8);
      } else {
        bp.frequency.setValueAtTime(420, t);
        bp.frequency.linearRampToValueAtTime(300, t + 1.5);
        g.gain.exponentialRampToValueAtTime(0.45, t + 0.25);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      }
      src.connect(bp).connect(g).connect(this.mestre);
      src.start(t);
      src.stop(t + 5);
    },
    // "uuuh" curto numa bola ao poste / grande defesa
    quase() {
      const c = this.garantir();
      if (!c) return;
      const t = c.currentTime;
      const src = this.fonteRuido();
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(600, t);
      bp.frequency.linearRampToValueAtTime(380, t + 1);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.38, t + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      src.connect(bp).connect(g).connect(this.mestre);
      src.start(t);
      src.stop(t + 1.5);
    },
    alternar() {
      this.ligado = !this.ligado;
      try { localStorage.setItem('estv_treinador_som', this.ligado ? '1' : '0'); } catch (e) {}
      if (!this.ligado) this.pararAmbiente();
      else if (S.aoVivo && !S.aoVivo.fim) this.iniciarAmbiente();
    },
  };
  // segue os eventos do meu jogo e toca os sons certos
  function sonsDoJogo(av) {
    const jg = av.meu || av.jogos[0];
    if (!jg) return;
    const vistos = av.somVistos || 0;
    const novos = jg.ev.slice(vistos);
    av.somVistos = jg.ev.length;
    for (const e of novos) {
      if (e.t === 'g') Som.golo(!av.lado || e.l === av.lado);
      else if (e.t === 'pos' || e.t === 'bar' || e.t === 'pf') Som.quase();
    }
    if (av.fim) Som.pararAmbiente();
  }
  function renderAoVivo() {
    const av = S.aoVivo;
    app().innerHTML =
      '<div class="tr-vivo">' +
      '<div class="tr-vivo-topo"><div class="tr-vivo-tit"><span class="tr-pulse"></span> ' + esc(av.titulo) + '</div>' +
      '<div class="tr-vivo-ctl">' +
      (av.tipo === 'carreira'
        ? '<button class="tr-btn2" data-acao="pausa" id="trPausa"></button>' + VELS.map((v, k) => '<button class="tr-vel' + (S.vel === k ? ' ativo' : '') + '" data-acao="vel" data-v="' + k + '">' + v.n + '</button>').join('') +
          '<label class="tr-check"><input type="checkbox" id="trPausaInt"' + (S.pausaIntervalo ? ' checked' : '') + '> Parar ao intervalo</label>'
        : '') +
      '<button class="tr-vel tr-som" data-acao="som" title="Som dos adeptos" aria-label="Ligar ou desligar o som">' + (Som.ligado ? '🔊' : '🔇') + '</button>' +
      '</div></div><div id="trVivoCorpo"></div></div>';
    if (!av.fim) Som.iniciarAmbiente();
    desenharAoVivo();
  }
  function desenharAoVivo() {
    const av = S.aoVivo;
    const el = $('#trVivoCorpo');
    if (!el) return;
    const m = av.m;
    sonsDoJogo(av);
    const pb = $('#trPausa');
    if (pb) pb.innerHTML = av.fim ? '' : av.pausa ? '<i class="fas fa-play"></i> Continuar' : '<i class="fas fa-pause"></i> Pausa';
    if (pb) pb.style.display = av.fim ? 'none' : '';
    const meu = av.meu;
    let topo = '';
    if (meu) {
      const ch = m.clubes[meu.h.id];
      const ca = m.clubes[meu.a.id];
      const evs = meu.ev.filter((e) => e.t !== 'int' || true).slice(-14).reverse();
      topo =
        '<div class="tr-vivo-meu">' +
        '<div class="tr-placar-g"><div class="tr-pg-eq">' + emblema(ch, 'g') + '<b>' + esc(ch.n) + '</b></div><div class="tr-pg-res' + (av.golo && av.golo.jg === meu && Date.now() - av.golo.t < 1500 ? ' golo' : '') + '"><span>' + meu.gh + '</span><i>-</i><span>' + meu.ga + '</span><small>' + minutoTxt(meu) + (meu.pen ? ' · ' + meu.pen[0] + '-' + meu.pen[1] : '') + '</small></div><div class="tr-pg-eq">' + emblema(ca, 'g') + '<b>' + esc(ca.n) + '</b></div></div>' +
        '<div class="tr-posse"><i style="width:' + Math.round(((meu.posse || 0) / Math.max(1, meu.min)) * 100) + '%"></i></div>' +
        '<ul class="tr-eventos vivo">' + (evs.length ? evs.map((e) => '<li class="' + e.l + (e.t === 'g' ? ' golo' : '') + '"><span>' + e.m + "'</span>" + esc(TM.textoEvento(m, e, nomeClube(m, e.l === 'h' ? meu.h.id : meu.a.id))) + '</li>').join('') : '<li>O jogo vai começar…</li>') + '</ul>' +
        (av.tipo === 'carreira' && !av.fim ? '<button class="tr-btn2" data-acao="abrir-subs"><i class="fas fa-right-left"></i> Substituições e tática (' + meu[av.lado].subs + '/' + TM.MAX_SUBS + ')</button>' : '') +
        '</div>';
    }
    const outros = av.jogos.filter((j) => j !== meu);
    const grupo = (js) => js.map((jg) => '<div class="tr-vivo-l' + (av.golo && av.golo.jg === jg && Date.now() - av.golo.t < 1500 ? ' golo' : '') + '"><span class="h">' + esc(nomeClube(m, jg.h.id)) + '</span><b>' + jg.gh + ' - ' + jg.ga + '</b><span class="a">' + esc(nomeClube(m, jg.a.id)) + '</span><small>' + minutoTxt(jg) + '</small></div>').join('');
    let lista = '';
    if (outros.length) {
      if (outros[0].tipo === 'L') {
        for (let d = 0; d < m.divs.length; d++) {
          const js = outros.filter((j) => j.div === d);
          if (js.length) lista += '<h4>' + esc(ndComPais(m, d)) + '</h4>' + grupo(js);
        }
      } else {
        for (const pais of m.paises || ['PT']) {
          const js = outros.filter((j) => (j.pais || 'PT') === pais);
          if (js.length) lista += '<h4>Taça' + (multi(m) ? ' de ' + esc(TM.PAISES[pais].nome) : '') + ' — ' + esc(js[0].rn || '') + '</h4>' + grupo(js);
        }
      }
    }
    const subs = av.painelSubs && av.tipo === 'carreira' && meu && !av.fim ? painelSubs(av) : '';
    el.innerHTML =
      (meu ? '' : '<p class="tr-nota">O teu clube não joga nesta ronda.</p>') + topo + subs +
      (av.fim ? '<div class="tr-vivo-fim"><button class="tr-btn-jogar grande" data-acao="concluir"><i class="fas fa-flag-checkered"></i> ' + (av.tipo === 'carreira' ? 'Terminar jornada' : 'Fechar') + '</button></div>' : '') +
      '<div class="tr-vivo-lista">' + lista + '</div>';
  }
  function painelSubs(av) {
    const m = av.m;
    const L = av.meu[av.lado];
    const xi = L.xi.map((id, k) => (id ? { j: m.jog[id], pos: L.pos[k] } : null)).filter(Boolean);
    const sai = S.subSai;
    return (
      '<div class="tr-subs"><div class="tr-subs-col"><h4>Em campo — escolhe quem sai</h4>' +
      xi.map(({ j, pos }) => '<button class="tr-sub-j' + (sai === j.id ? ' sel' : '') + (L.lesoes.includes(j.id) ? ' les' : '') + '" data-acao="sub-sai" data-id="' + j.id + '">' + posTag(pos) + ' ' + esc(j.n) + ' <b>' + Math.round(j.f) + '</b>' + (L.lesoes.includes(j.id) ? ' 🚑' : '') + (L.am[j.id] ? ' 🟨' : '') + '</button>').join('') +
      '</div><div class="tr-subs-col"><h4>Banco — escolhe quem entra</h4>' +
      (L.subs >= TM.MAX_SUBS ? '<p class="tr-vazio">Já fizeste as ' + TM.MAX_SUBS + ' substituições.</p>' : L.banco.map((id) => {
        const j = m.jog[id];
        return '<button class="tr-sub-j" data-acao="sub-entra" data-id="' + id + '"' + (sai ? '' : ' disabled') + '>' + posTag(j.p) + ' ' + esc(j.n) + ' <b>' + Math.round(j.f) + '</b></button>';
      }).join('')) +
      '</div><div class="tr-subs-tat"><h4>Tática</h4>' +
      '<label class="tr-sel"><span>Estilo</span><select data-vivo-tat="e">' + Object.entries(TM.ESTILOS).map(([k, v]) => '<option value="' + k + '"' + (L.tat.e === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>' +
      '<label class="tr-sel"><span>Marcação</span><select data-vivo-tat="m">' + Object.entries(TM.MARCACOES).map(([k, v]) => '<option value="' + k + '"' + (L.tat.m === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>' +
      '<label class="tr-sel"><span>Ataques</span><select data-vivo-tat="foco">' + Object.entries(TM.FOCOS).map(([k, v]) => '<option value="' + k + '"' + (L.tat.foco === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>' +
      '<button class="tr-btn" data-acao="fechar-subs"><i class="fas fa-play"></i> Voltar ao jogo</button></div></div>'
    );
  }
  function concluirAoVivo() {
    const av = S.aoVivo;
    Som.pararAmbiente();
    if (av.tipo !== 'carreira') {
      S.aoVivo = null;
      render();
      return;
    }
    const m = av.m;
    const c = Carreira.meu();
    const antes = c ? { div: c.div, epoca: m.epoca } : null;
    TM.concluirJornada(m, av.jogos);
    Carreira.guardar();
    S.aoVivo = null;
    S.vista = 'jogo';
    render();
    const c2 = Carreira.meu();
    if (!c2) {
      toast('Foste despedido!', 'erro');
      return;
    }
    if (antes && m.epoca !== antes.epoca && m.fimEpoca) mostrarFimEpoca(m, c2, antes);
  }
  function mostrarFimEpoca(m, c, antes) {
    const f = m.fimEpoca;
    const subiu = TM.infoDiv(m, c.div).n < TM.infoDiv(m, antes.div).n;
    const desceu = TM.infoDiv(m, c.div).n > TM.infoDiv(m, antes.div).n;
    modal(
      '<div class="tr-fimep"><h2>📅 Fim da época ' + f.ano + '/' + String(f.ano + 1).slice(2) + '</h2>' +
      (subiu ? '<p class="tr-grande ok">⬆️ Subiste à ' + esc(nd(m, c.div)) + '!</p>' : desceu ? '<p class="tr-grande neg">⬇️ Desceste à ' + esc(nd(m, c.div)) + '.</p>' : '') +
      '<ul class="tr-lista">' + f.campeoes.map((id, d) => '<li>🏆 ' + esc(ndComPais(m, d)) + ': <b>' + esc(nomeClube(m, id)) + '</b></li>').join('') +
      Object.entries(f.tacas || {}).filter(([, id]) => id).map(([p, id]) => '<li>🏆 Taça' + (multi(m) ? ' de ' + esc(TM.PAISES[p].nome) : '') + ': <b>' + esc(nomeClube(m, id)) + '</b></li>').join('') +
      (f.artilheiro ? '<li>👟 Melhor marcador: <b>' + esc(f.artilheiro.n) + '</b> (' + esc(nomeClube(m, f.artilheiro.cl)) + ', ' + f.artilheiro.gol + ' golos)</li>' : '') +
      '</ul><p class="tr-nota">Os jogadores ficaram um ano mais velhos, alguns reformaram-se e subiram juniores. Vê as Notícias.</p></div>'
    );
  }

  // ---------------------------------------------------------------
  // LIGA ESTV
  // ---------------------------------------------------------------
  function renderRelogioLiga(fonte) {
    const i = fonte.info || {};
    if (!i.proxima) return '<div class="tr-relogio"><i class="fas fa-pause"></i> Liga em pausa</div>';
    return '<div class="tr-relogio" data-prox="' + i.proxima + '"><i class="fas fa-clock"></i> ' + esc(nomePasso(fonte.mundo)) + '<b class="tr-cd">' + contagem(i.proxima) + '</b><small>Jornadas: ' + esc((i.horas || []).join(' · ')) + ' (hora de Lisboa)</small></div>';
  }
  function contagem(ts) {
    const d = Math.max(0, ts - Date.now());
    const h = Math.floor(d / 3600000);
    const mi = Math.floor((d % 3600000) / 60000);
    const s = Math.floor((d % 60000) / 1000);
    if (d <= 0) return 'a começar…';
    return (h ? h + 'h ' : '') + String(mi).padStart(2, '0') + 'm ' + String(s).padStart(2, '0') + 's';
  }
  async function renderLiga() {
    S.fonte = Liga;
    if (!token() || !meuLogin()) {
      app().innerHTML = '<div class="tr-gate"><i class="fas fa-users"></i><h2>Liga ESTV</h2><p>Os espectadores do Edu treinam clubes na mesma liga de 4 divisões. As jornadas jogam-se a horas certas, para todos ao mesmo tempo.</p><button class="gate-login-btn" data-acao="login"><i class="fab fa-twitch"></i> Entrar com Twitch para jogar</button></div>';
      return;
    }
    if (!Liga.mundo) app().innerHTML = '<div class="tr-carregar">A carregar a Liga ESTV…</div>';
    const pedido = (S.ligaPedido = (S.ligaPedido || 0) + 1);
    try {
      await Liga.carregar();
      if (pedido !== S.ligaPedido || S.aoVivo) return;
    } catch (e) {
      if (pedido !== S.ligaPedido) return;
      app().innerHTML = '<div class="tr-gate"><h2>Liga ESTV</h2><p>' + esc(e.message) + '</p><button class="tr-btn" data-acao="recarregar-liga">Tentar outra vez</button></div>';
      return;
    }
    if (S.modo !== 'liga') return;
    if (!Liga.mundo) {
      app().innerHTML = '<div class="tr-gate"><i class="fas fa-hourglass-half"></i><h2>Liga ESTV</h2><p>A liga ainda não começou. O Edu (ou o moderador) tem de a criar no Painel de Controlo.</p></div>';
      return;
    }
    const c = Liga.meu();
    if (!c) {
      const t = Liga.treinador();
      if (t && (t.ofertas || []).length) return renderOfertas(Liga);
      const humanos = Object.values(Liga.mundo.clubes).filter((x) => x.hum).length;
      app().innerHTML = '<div class="tr-gate"><i class="fas fa-users"></i><h2>Liga ESTV</h2><p>Há <b>' + humanos + '</b> treinador(es) na liga. Entra e ficas com um clube livre da divisão mais baixa que tiver vaga, como no Elifoot.</p><p class="tr-nota">' + esc((Liga.mundo.paises || ['PT']).map((p) => TM.PAISES[p].band + ' ' + TM.PAISES[p].nome).join(' · ')) + ' · começas na 4.ª divisão portuguesa · jornadas às ' + esc(((Liga.info && Liga.info.horas) || []).join(' e ')) + '</p><button class="tr-btn-jogar grande" data-acao="entrar-liga"><i class="fas fa-handshake"></i> Entrar na liga</button></div>';
      return;
    }
    renderPainel(Liga);
    // repetição ao vivo se a jornada acabou de ser jogada
    const i = Liga.info || {};
    if (i.ultimaEm && Date.now() - i.ultimaEm < 100000 && Liga.mundo.ultimos && S.vistoReplay !== i.ultimaEm) {
      S.vistoReplay = i.ultimaEm;
      iniciarReplay(Liga.mundo, i.ultimaEm);
    }
  }
  // repetição: reconstrói os jogos minuto a minuto a partir dos eventos
  function iniciarReplay(m, inicio) {
    const u = m.ultimos;
    const meuId = Liga.meu() && Liga.meu().id;
    const jogos = u.jogos.map((x) => ({ tipo: x.tp, div: x.dv, ronda: x.r, h: { id: x.h }, a: { id: x.a }, gh: 0, ga: 0, min: 0, fim: false, ev: [], todos: x.ev, pen: null, penFinal: x.pen, posse: 0, ps: x.ps }));
    const meu = jogos.find((j) => j.h.id === meuId || j.a.id === meuId) || null;
    S.aoVivo = { tipo: 'liga', m, jogos, meu, lado: meu ? (meu.h.id === meuId ? 'h' : 'a') : null, fim: false, titulo: u.t === 'L' ? 'Jornada ' + (u.r + 1) + ' — ao vivo' : 'Taça — ao vivo', inicio };
    render();
    const passoReplay = () => {
      const av = S.aoVivo;
      if (!av || av.tipo !== 'liga') return;
      const min = Math.min(95, Math.floor((Date.now() - av.inicio) / 1000));
      for (const jg of av.jogos) {
        const maxMin = Math.max(90, ...jg.todos.filter((e) => e.m < 120).map((e) => e.m));
        jg.min = Math.min(min, maxMin);
        jg.ev = jg.todos.filter((e) => e.m <= jg.min && e.t !== 'gp');
        jg.gh = jg.ev.filter((e) => e.t === 'g' && e.l === 'h').length;
        jg.ga = jg.ev.filter((e) => e.t === 'g' && e.l === 'a').length;
        jg.posse = (jg.ps / 100) * jg.min;
        if (min >= maxMin) {
          jg.fim = true;
          jg.pen = jg.penFinal;
        }
      }
      av.fim = av.jogos.every((j) => j.fim);
      desenharAoVivo();
      if (!av.fim) av.t = setTimeout(passoReplay, 1000);
    };
    passoReplay();
  }

  // ---------------------------------------------------------------
  // DESAFIOS e RANKING
  // ---------------------------------------------------------------
  async function renderDesafios() {
    if (!token() || !meuLogin()) {
      app().innerHTML = '<div class="tr-gate"><i class="fas fa-bolt"></i><h2>Desafios</h2><p>Desafia o clube de outro treinador da Liga ESTV. O jogo é simulado no servidor, em campo neutro, e conta para o ranking de desafios.</p><button class="gate-login-btn" data-acao="login"><i class="fab fa-twitch"></i> Entrar com Twitch</button></div>';
      return;
    }
    app().innerHTML = '<div class="tr-carregar">A carregar…</div>';
    let d;
    try {
      d = await api('desafios');
    } catch (e) {
      app().innerHTML = '<div class="tr-gate"><p>' + esc(e.message) + '</p></div>';
      return;
    }
    if (S.modo !== 'desafios') return;
    const eu = d.eu;
    app().innerHTML =
      '<div class="tr-desafios">' +
      (eu ? '<div class="tr-eu-card">' + emblema({ c: (eu.nome || '?').slice(0, 3).toUpperCase(), cor: eu.cor }, 'g') + '<div><b>' + esc(eu.nome) + '</b><small>O teu clube na Liga ESTV · ' + esc(eu.dn || '') + ' · força ' + eu.forca + ' · Elo ' + eu.elo + ' · ' + eu.v + 'V ' + eu.e + 'E ' + eu.d + 'D</small></div><small class="tr-nota">Hoje: ' + d.hoje + '/' + d.limite + ' desafios</small></div><p class="tr-ajuda">Os desafios usam o teu clube e a escalação que guardaste na Liga ESTV. Não mexem na tabela da liga, só no ranking de desafios.</p>' : '<div class="tr-gate pequeno"><p>Os desafios usam o teu clube da <b>Liga ESTV</b>. ' + (d.liga ? 'Entra na liga e ficas logo com um clube.' : 'A liga ainda não começou.') + '</p>' + (d.liga ? '<button class="tr-btn" data-acao="modo" data-modo="liga">Ir para a Liga ESTV</button>' : '') + '</div>') +
      '<h3 class="tr-h3">Adversários</h3><div class="tr-tabela-wrap"><table class="tr-tabela"><thead><tr><th>Treinador</th><th>Equipa</th><th>Elo</th><th class="m-esc">Força</th><th></th></tr></thead><tbody>' +
      (d.lista.length ? d.lista.map((x) => '<tr><td><b>' + esc(x.nomeT) + '</b></td><td>' + esc(x.nome) + '<small>' + esc(x.dn || '') + '</small></td><td>' + x.elo + '</td><td class="m-esc">' + x.forca + '</td><td>' + (eu ? '<button class="tr-btn" data-acao="desafiar" data-login="' + esc(x.login) + '"><i class="fas fa-bolt"></i> Desafiar</button>' : '') + '</td></tr>').join('') : '<tr><td colspan="5">Ainda não há outros treinadores na Liga ESTV. Partilha o jogo no chat!</td></tr>') +
      '</tbody></table></div>' +
      '<h3 class="tr-h3">Últimos desafios</h3><ul class="tr-feed">' + (d.historico.length ? d.historico.map((h) => '<li><small>' + new Date(h.ts).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</small><b>' + esc(h.a) + '</b> ' + h.ga + ' - ' + h.gb + ' <b>' + esc(h.b) + '</b>' + (h.pen ? ' (pen. ' + h.pen[0] + '-' + h.pen[1] + ')' : '') + '</li>').join('') : '<li>Ainda sem desafios.</li>') + '</ul></div>';
  }
  function mostrarDesafio(r) {
    const evs = r.ev.filter((e) => e.t !== 'int').map((e) => '<li class="' + (e.l || '') + (e.t === 'g' ? ' golo' : '') + '"><span>' + e.m + "'</span>" + esc(textoSolto(e, e.l === 'h' ? r.a.nome : r.b.nome)) + '</li>').join('');
    modal('<div class="tr-detjogo"><div class="tr-prox"><div class="tr-prox-eq">' + emblema({ c: r.a.nome.slice(0, 3).toUpperCase(), cor: r.a.cor }, 'g') + '<b>' + esc(r.a.nome) + '</b><small>' + esc(r.a.login) + '</small></div><div class="tr-placar">' + r.gh + ' - ' + r.ga + (r.pen ? '<small>pen. ' + r.pen[0] + '-' + r.pen[1] + '</small>' : '') + '</div><div class="tr-prox-eq">' + emblema({ c: r.b.nome.slice(0, 3).toUpperCase(), cor: r.b.cor }, 'g') + '<b>' + esc(r.b.nome) + '</b><small>' + esc(r.b.login) + '</small></div></div>' +
      '<p class="tr-prox-info">' + (r.ganhou ? '🏆 Ganhaste! ' : r.empate ? '' : 'Perdeste. ') + 'Elo: ' + r.eloAntes + ' → <b>' + r.eloDepois + '</b> · Posse ' + r.posse + '%</p><ul class="tr-eventos">' + (evs || '<li>Sem lances de registo.</li>') + '</ul></div>');
  }
  function textoSolto(e, clube) {
    return TM.textoEvento({ jog: {} }, e, clube);
  }
  async function renderRanking() {
    app().innerHTML = '<div class="tr-carregar">A carregar o ranking…</div>';
    let d;
    try {
      d = await api('ranking');
    } catch (e) {
      app().innerHTML = '<div class="tr-gate"><p>' + esc(e.message) + '</p></div>';
      return;
    }
    if (S.modo !== 'ranking') return;
    const eu = meuLogin();
    const tab = (titulo, linhas, cols) => '<h3 class="tr-h3">' + titulo + '</h3><div class="tr-tabela-wrap"><table class="tr-tabela"><thead><tr><th>#</th>' + cols.map((c) => '<th' + (c[2] ? ' class="m-esc"' : '') + '>' + c[0] + '</th>').join('') + '</tr></thead><tbody>' + (linhas.length ? linhas.map((l, k) => '<tr' + (l.login === eu ? ' class="meu"' : '') + '><td>' + (k + 1) + '</td>' + cols.map((c) => '<td' + (c[2] ? ' class="m-esc"' : '') + '>' + c[1](l) + '</td>').join('') + '</tr>').join('') : '<tr><td colspan="9">Ainda vazio.</td></tr>') + '</tbody></table></div>';
    app().innerHTML =
      '<div class="tr-ranking">' +
      tab('Liga ESTV — treinadores', d.liga, [['Treinador', (l) => '<b>' + esc(l.login) + '</b>'], ['Clube', (l) => esc(l.clube || '—')], ['Pontos', (l) => '<b>' + l.pts + '</b>'], ['V-E-D', (l) => l.v + '-' + l.e + '-' + l.d, true], ['Títulos', (l) => l.titulos || 0, true]]) +
      tab('Desafios — Elo', d.desafios, [['Treinador', (l) => '<b>' + esc(l.login) + '</b>'], ['Clube', (l) => esc(l.nome)], ['Elo', (l) => '<b>' + l.elo + '</b>'], ['V-E-D', (l) => l.v + '-' + l.e + '-' + l.d, true]]) +
      '<p class="tr-nota">Pontos de treinador: vitória em casa 2, fora 3, empate 1, mais bónus por títulos e subidas. Os rankings só contam a Liga ESTV e os Desafios, que são jogados no servidor. A Carreira é para jogares sozinho.</p></div>';
  }

  // ---------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------
  async function correr(fn) {
    try {
      const r = await fn();
      return r;
    } catch (e) {
      toast(e.message || 'Erro', 'erro');
      return null;
    }
  }
  document.addEventListener('click', async (ev) => {
    const raiz = ev.target.closest('#trApp, .tr-modal-fundo, #trModos');
    if (!raiz) return;
    const modoBtn = ev.target.closest('.tr-modo');
    if (modoBtn) {
      if (S.aoVivo && S.aoVivo.tipo === 'carreira' && !S.aoVivo.fim) return toast('Acaba primeiro a jornada.', 'erro');
      Som.pararAmbiente();
      S.aoVivo = null;
      S.modo = modoBtn.dataset.modo;
      S.esc = null;
      S.sel = null;
      render();
      return;
    }
    const tab = ev.target.closest('[data-vista]');
    if (tab && S.fonte) {
      S.vista = tab.dataset.vista;
      S.sel = null;
      $$('.tr-tab').forEach((b) => b.classList.toggle('ativo', b.dataset.vista === S.vista));
      renderVista(S.fonte);
      return;
    }
    const b = ev.target.closest('[data-acao]');
    if (!b) return;
    const a = b.dataset.acao;
    const fonte = S.fonte;
    const id = b.dataset.id;
    switch (a) {
      case 'fechar-modal': fecharModal(); return;
      case 'login': if (tw()) tw().login(); return;
      case 'modo': S.modo = b.dataset.modo; render(); return;
      case 'outros-clubes': S.semente = null; renderInicio(); return;
      case 'pais-inicio': S.paisInicio = b.dataset.p || null; S.semente = null; renderInicio(); return;
      case 'pais-taca': S.pTaca = b.dataset.p; renderVista(fonte); return;
      case 'filtro-pais': S.filtro.pais = b.dataset.p; renderVista(fonte); return;
      case 'escolher-clube': {
        const m = S.preview;
        Carreira.mundo = m;
        TM.assumirClube(m, EU, id);
        TM.treinadorDe(m, EU).ofertas = [];
        Carreira.guardar();
        S.vista = 'equipa';
        S.semente = null;
        render();
        toast('Bem-vindo ao ' + m.clubes[id].n + '!');
        return;
      }
      case 'nova-carreira':
        if (!confirm('Recomeçar do zero?\n\nA carreira atual é apagada para sempre (neste browser' + (token() ? ' e na tua conta' : '') + ') e não dá para recuperar.')) return;
        clearTimeout(Carreira._t);
        try { localStorage.removeItem(LS_KEY); } catch (e) {}
        if (token()) api('carreira-apagar', {}).catch(() => toast('Não consegui apagar a carreira da conta. Tenta outra vez.', 'erro'));
        Carreira.mundo = null;
        Carreira.atualizado = 0;
        S.esc = null;
        S.vista = 'equipa';
        toast('Carreira apagada. Escolhe o país para começar de novo.');
        fecharModal();
        S.semente = null;
        S.paisInicio = null;
        render();
        return;
      case 'assumir':
        await correr(() => fonte.acao('assumir', id));
        fecharModal();
        S.esc = null;
        render();
        return;
      case 'ver-convites': {
        const m = fonte.mundo;
        const t = fonte.treinador();
        modal('<h3>Convites</h3><p>Estes clubes querem-te como treinador. Se aceitares, deixas o clube atual.</p><div class="tr-ofertas">' + t.ofertas.filter((x) => m.clubes[x] && !m.clubes[x].hum).map((x) => '<button class="tr-oferta" data-acao="assumir" data-id="' + x + '">' + emblema(m.clubes[x], 'g') + '<span class="tr-oferta-nome">' + esc(m.clubes[x].n) + '</span><span class="tr-oferta-info">' + ndComPais(m, m.clubes[x].div) + ' · ' + eur(m.clubes[x].din) + '</span></button>').join('') + '</div><button class="tr-link" data-acao="recusar-convites">Recusar todos</button>');
        return;
      }
      case 'recusar-convites':
        if (fonte === Carreira) {
          fonte.treinador().ofertas = [];
          Carreira.guardar();
        } else await correr(() => fonte.acao('recusar'));
        fecharModal();
        render();
        return;
      case 'jogar':
        if (S.esc && S.esc.sujo && fonte !== Carreira) return toast('Guarda primeiro a escalação.', 'erro');
        iniciarJornada();
        return;
      case 'som':
        Som.alternar();
        b.textContent = Som.ligado ? '🔊' : '🔇';
        return;
      case 'pausa': {
        const av = S.aoVivo;
        av.pausa = !av.pausa;
        if (av.pausa) Som.pararAmbiente();
        else Som.iniciarAmbiente();
        av.painelSubs = false;
        S.subSai = null;
        desenharAoVivo();
        if (!av.pausa) agendarTick();
        return;
      }
      case 'vel':
        S.vel = Number(b.dataset.v);
        guardarPref();
        $$('.tr-vel').forEach((x) => x.classList.toggle('ativo', Number(x.dataset.v) === S.vel));
        return;
      case 'abrir-subs':
        S.aoVivo.pausa = true;
        S.aoVivo.painelSubs = true;
        S.subSai = null;
        desenharAoVivo();
        return;
      case 'fechar-subs':
        S.aoVivo.pausa = false;
        S.aoVivo.painelSubs = false;
        desenharAoVivo();
        agendarTick();
        return;
      case 'sub-sai':
        S.subSai = id;
        desenharAoVivo();
        return;
      case 'sub-entra': {
        const av = S.aoVivo;
        if (TM.substituir(av.m, av.meu, av.lado, S.subSai, id)) {
          S.subSai = null;
          toast('Substituição feita.');
        }
        desenharAoVivo();
        return;
      }
      case 'concluir': concluirAoVivo(); return;
      case 'slot': {
        const k = Number(b.dataset.k);
        if (S.sel && S.sel.tipo === 'jog') {
          trocarNaEscalacao(fonte, k, S.sel.v);
          S.sel = null;
        } else if (S.sel && S.sel.tipo === 'slot' && S.sel.v !== k) {
          const e = S.esc;
          [e.xi[k], e.xi[S.sel.v]] = [e.xi[S.sel.v], e.xi[k]];
          e.sujo = true;
          S.sel = null;
        } else S.sel = S.sel && S.sel.v === k ? null : { tipo: 'slot', v: k };
        renderVista(fonte);
        return;
      }
      case 'jog': {
        if (ev.target.closest('[data-acao="ficha"]')) return;
        if (S.vista !== 'equipa') return;
        if (S.sel && S.sel.tipo === 'slot') {
          trocarNaEscalacao(fonte, S.sel.v, id);
          S.sel = null;
        } else if (S.sel && S.sel.tipo === 'jog' && S.sel.v === id) {
          alternarBanco(fonte, id);
          S.sel = null;
        } else S.sel = { tipo: 'jog', v: id };
        renderVista(fonte);
        return;
      }
      case 'ficha':
        ev.stopPropagation();
        fichaJogador(fonte, id);
        return;
      case 'auto-xi': {
        const e = escAtual(fonte);
        const r = TM.melhorOnze(fonte.mundo, fonte.meu(), e.tat.f);
        e.xi = r.xi;
        e.banco = r.banco;
        e.sujo = true;
        renderVista(fonte);
        return;
      }
      case 'guardar-xi': {
        const e = S.esc;
        const ok = await correr(() => fonte.acao('escalacao', { tat: e.tat, xi: e.xi, banco: e.banco }));
        if (ok) {
          e.sujo = false;
          toast('Escalação guardada.');
          S.esc = null;
          renderVista(fonte);
        }
        return;
      }
      case 'leilao': {
        const v = Number(($('#trBase') || {}).value);
        if (await correr(() => fonte.acao('leilao', id, v))) {
          toast('Em leilão até à próxima jornada.');
          fecharModal();
          renderPainel(fonte);
        }
        return;
      }
      case 'licitar': {
        const v = Number(($('#trLance') || {}).value);
        if (await correr(() => fonte.acao('licitar', id, v))) {
          toast('Lance registado.');
          fecharModal();
          renderVista(fonte);
        }
        return;
      }
      case 'comprar': {
        if (!confirm('Confirmas a compra?')) return;
        if (await correr(() => fonte.acao('comprar', id))) {
          toast('Contratado!');
          fecharModal();
          S.esc = null;
          renderPainel(fonte);
        }
        return;
      }
      case 'vender':
        if (!confirm('Vender já este jogador?')) return;
        if (await correr(() => fonte.acao('vender', id))) {
          toast('Vendido.');
          fecharModal();
          S.esc = null;
          renderPainel(fonte);
        }
        return;
      case 'dispensar':
        if (!confirm('Dispensar este jogador? Fica livre e não recebes nada.')) return;
        if (await correr(() => fonte.acao('dispensar', id))) {
          fecharModal();
          S.esc = null;
          renderPainel(fonte);
        }
        return;
      case 'bilhete':
        if (await correr(() => fonte.acao('bilhete', Number($('#trBil').value)))) {
          toast('Preço do bilhete atualizado.');
          renderPainel(fonte);
        }
        return;
      case 'estadio':
        if (!confirm('Confirmas as obras?')) return;
        if (await correr(() => fonte.acao('estadio', Number($('#trObras').value)))) {
          toast('Obras encomendadas.');
          renderPainel(fonte);
        }
        return;
      case 'pedir':
        if (await correr(() => fonte.acao('emprestimo', Math.abs(Number($('#trEmp').value))))) renderPainel(fonte);
        return;
      case 'pagar':
        if (await correr(() => fonte.acao('emprestimo', -Math.abs(Number($('#trEmp').value))))) renderPainel(fonte);
        return;
      case 'div': S.div = Number(b.dataset.d); renderVista(fonte); return;
      case 'mercado': S.mercado = b.dataset.m; renderVista(fonte); return;
      case 'filtro-pos': S.filtro.pos = b.dataset.p; renderVista(fonte); return;
      case 'ver-jogo': detalheJogo(fonte, b.dataset.h, b.dataset.a); return;
      case 'entrar-liga': {
        const r = await correr(() => api('liga-entrar', {}));
        if (r) {
          Liga.aplicar(r);
          toast('Bem-vindo à Liga ESTV!');
          render();
        }
        return;
      }
      case 'recarregar-liga': render(); return;
      case 'desafiar': {
        b.disabled = true;
        const r = await correr(() => api('desafiar', { adversario: b.dataset.login }));
        b.disabled = false;
        if (r) {
          mostrarDesafio(r);
          renderDesafios();
        }
        return;
      }
      default:
    }
  });
  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.matches('[data-tat]') && S.esc) {
      const k = t.dataset.tat;
      S.esc.tat[k] = t.value;
      if (k === 'f') {
        // ajusta o onze à nova formação sem perder ninguém
        const r = TM.melhorOnze(S.fonte.mundo, S.fonte.meu(), t.value);
        S.esc.xi = r.xi;
        S.esc.banco = r.banco;
      }
      S.esc.sujo = true;
      renderVista(S.fonte);
    } else if (t.matches('[data-vivo-tat]') && S.aoVivo) {
      const o = {};
      o[t.dataset.vivoTat] = t.value;
      TM.mudarTatica(S.aoVivo.meu, S.aoVivo.lado, o);
    } else if (t.matches('[data-acao-change="filtro-min"]')) {
      S.filtro.min = Number(t.value);
      renderVista(S.fonte);
    } else if (t.id === 'trPausaInt') {
      S.pausaIntervalo = t.checked;
      guardarPref();
    }
  });
  document.addEventListener('pointerdown', () => {
    if (Som.ctx && Som.ctx.state === 'suspended') Som.ctx.resume();
    else if (!Som.ctx && Som.ligado && S.aoVivo && !S.aoVivo.fim) {
      Som.ambiente = null;
      Som.iniciarAmbiente();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharModal();
  });
  // relógio da Liga
  setInterval(() => {
    const r = $('.tr-relogio[data-prox]');
    if (!r) return;
    const ts = Number(r.dataset.prox);
    const cd = $('.tr-cd', r);
    if (cd) cd.textContent = contagem(ts);
    if (ts && Date.now() > ts + 4000 && S.modo === 'liga' && !S.aoVivo && !S.recarregando) {
      S.recarregando = true;
      setTimeout(() => {
        S.recarregando = false;
        render();
      }, 2000);
    }
  }, 1000);
  // avisa antes de sair a meio de uma jornada
  window.addEventListener('beforeunload', (e) => {
    if (S.aoVivo && S.aoVivo.tipo === 'carreira' && !S.aoVivo.fim) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // modo pela hash (#liga, #desafios, #ranking)
  function lerHash() {
    const h = (location.hash || '').replace('#', '');
    if (['carreira', 'liga', 'desafios', 'ranking'].includes(h)) S.modo = h;
  }
  window.addEventListener('hashchange', () => {
    lerHash();
    render();
  });

  // quando o login muda, recarrega (e tenta trazer a carreira da nuvem)
  const antigo = window.onAuthChange;
  window.onAuthChange = function () {
    if (typeof antigo === 'function') antigo();
    if (!S.iniciado) return;
    if (S.modo !== 'carreira') render();
    else puxarNuvem();
  };
  async function puxarNuvem() {
    if (!token()) return;
    try {
      const d = await api('carreira');
      if (d && d.mundo) TM.migrar(d.mundo);
      if (d && d.mundo && d.mundo.v === TM.VERSAO && (!Carreira.mundo || (d.ts || 0) > (Carreira.atualizado || 0))) {
        if (!Carreira.mundo || confirm('Encontrei uma carreira mais recente na tua conta (' + d.mundo.ano + '/' + String(d.mundo.ano + 1).slice(2) + '). Queres continuar essa?')) {
          Carreira.mundo = d.mundo;
          Carreira.atualizado = d.ts;
          try { localStorage.setItem(LS_KEY, JSON.stringify({ mundo: d.mundo, ts: d.ts })); } catch (e) {}
          S.esc = null;
          if (S.modo === 'carreira' && !S.aoVivo) render();
        }
      } else if (Carreira.mundo && (!d || !d.mundo || (d.ts || 0) < (Carreira.atualizado || 0))) {
        Carreira.nuvem().catch(() => {});
      }
    } catch (e) {}
  }

  function iniciar() {
    if (!app()) return;
    if (!TM) {
      app().innerHTML = '<p>Não consegui carregar o motor do jogo.</p>';
      return;
    }
    lerHash();
    S.iniciado = true;
    $$('.tr-modo').forEach((b) => b.addEventListener('click', () => {
      try { history.replaceState(null, '', '#' + b.dataset.modo); } catch (e) {}
    }));
    render();
    puxarNuvem();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
