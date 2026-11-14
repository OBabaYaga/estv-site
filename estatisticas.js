// ===================================================================
// ESTV — Estatísticas do site (aba Estatísticas)
// Só o Edu e o moderador (ver ADMIN_LOGINS em twitch-auth.js e na API).
// Os dados vêm de /api/health?modo=stats (é a mesma função, por causa do limite de 12 funções do Vercel).
// ===================================================================
(function () {
  const API = ((typeof ESTV_CONFIG !== 'undefined' && ESTV_CONFIG.API_BASE_URL) || 'https://estv-api-delta.vercel.app').replace(/\/$/, '') + '/api/health?modo=stats';
  const TOKEN_KEY = 'estv_twitch_token';
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const PAGINAS = {
    '/index.html': 'Início', '/apostas.html': 'Apostas', '/cartas.html': 'Cartas', '/penaltis.html': 'Penáltis', '/resultados.html': 'Resultados',
    '/ranking.html': 'Ranking', '/minijogo.html': 'Minijogo', '/contacto.html': 'Contacto', '/controlador.html': 'Painel de Controlo', '/estatisticas.html': 'Estatísticas',
  };
  const PG = { inicio: 'Início', apostas: 'Apostas', cartas: 'Cartas', penaltis: 'Penáltis', resultados: 'Resultados', ranking: 'Ranking', minijogo: 'Minijogo', contacto: 'Contacto', outra: 'Outra página' };
  const LOCAL = { menu: 'menu', pagina: 'página', rodape: 'rodapé', outro: 'outro' };
  function nomeSitio(s) { const [p, l] = s.split(':'); return (PG[p] || p) + ' · ' + (LOCAL[l] || l); }
  const CORES = { twitch: '#9146ff', youtube: '#ff3b3b', instagram: '#e1306c', outro: '#9ca3af' };

  const $ = (id) => document.getElementById(id);
  const fmt = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let dados = null;
  let mesSel = null; // 'AAAA-MM'
  let vista = 'mes';

  function token() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  async function carregar() {
    const t = token();
    if (!t) return;
    const q = new URLSearchParams({ dias: '30' });
    if (mesSel) { q.set('mes', mesSel); q.set('ano', mesSel.slice(0, 4)); }
    $('stNota').textContent = 'A carregar…';
    try {
      const r = await fetch(API + '&' + q, { headers: { Authorization: 'Bearer ' + t }, cache: 'no-store' });
      if (r.status === 403 || r.status === 401) { bloquear('Esta conta não tem acesso', 'Só o Edu e o moderador podem ver as estatísticas.'); return; }
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'erro');
      dados = j;
      if (!mesSel) mesSel = j.mes.id;
      $('stBloqueado').classList.add('hidden');
      $('stPainel').classList.remove('hidden');
      desenhar();
      $('stNota').textContent = 'Atualizado às ' + new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) + '. Os números contam a partir de 14 de novembro de 2026.';
    } catch (e) {
      $('stNota').textContent = 'Não consegui carregar as estatísticas. Tenta outra vez daqui a pouco.';
    }
  }

  function variacao(a, b) {
    if (b == null) return '';
    if (!b) return a ? '<span class="st-var sobe">novo</span>' : '';
    const p = Math.round(((a - b) / b) * 100);
    if (!p) return '<span class="st-var">= ontem</span>';
    return '<span class="st-var ' + (p > 0 ? 'sobe' : 'desce') + '">' + (p > 0 ? '▲ ' : '▼ ') + Math.abs(p) + '% vs ontem</span>';
  }

  function kpi(titulo, v, extra) {
    return '<div class="st-kpi"><div class="st-kpi-tit">' + titulo + '</div>' +
      '<div class="st-kpi-linha"><b>' + fmt(v.visitantes) + '</b><span>visitantes</span></div>' +
      '<div class="st-kpi-linha"><b>' + fmt(v.visitas) + '</b><span>páginas vistas</span></div>' +
      '<div class="st-kpi-linha ouro"><b>' + fmt(v.cliques) + '</b><span>cliques nas redes</span></div>' + (extra || '') + '</div>';
  }

  function nomeMes(id) {
    const [a, m] = id.split('-');
    return MESES[+m - 1] + ' ' + a;
  }

  function desenhar() {
    const d = dados;
    const h = d.hoje, o = d.ontem;
    $('stKpis').innerHTML =
      kpi('Hoje', h, '<div class="st-kpi-var">' + variacao(h.visitantes, o && o.visitantes) + '</div>') +
      kpi('Ontem', o || { visitantes: 0, visitas: 0, cliques: 0 }) +
      kpi(nomeMes(d.mes.id).replace(/^./, (c) => c.toUpperCase()), d.mes) +
      kpi('Ano ' + d.ano.id, d.ano);

    // gráfico dos últimos 30 dias
    const max = Math.max(1, ...d.dias.map((x) => Math.max(x.visitantes, x.cliques)));
    $('stGrafico').innerHTML = d.dias.map((x, i) => {
      const [, m, dia] = x.data.split('-');
      const hv = Math.round((x.visitantes / max) * 100);
      const hc = Math.round((x.cliques / max) * 100);
      const marcas = Object.entries(x.porMarca || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => (d.marcas[k] || k) + ': ' + v).join(', ');
      const dica = dia + '/' + m + ' — ' + x.visitantes + ' visitantes, ' + x.visitas + ' páginas, ' + x.cliques + ' cliques' + (marcas ? ' (' + marcas + ')' : '');
      const mostrar = i === 0 || i === d.dias.length - 1 || dia === '01' || i % 5 === 0;
      return '<div class="st-dia' + (i === d.dias.length - 1 ? ' hoje' : '') + '" title="' + esc(dica) + '" tabindex="0" aria-label="' + esc(dica) + '">' +
        '<div class="st-barras"><i class="st-b st-b-v" style="height:' + hv + '%"></i><i class="st-b st-b-c" style="height:' + hc + '%"></i></div>' +
        '<span class="st-dia-n">' + (mostrar ? +dia + (dia === '01' || i === 0 ? ' ' + MESES_CURTOS[+m - 1] : '') : '') + '</span></div>';
    }).join('');

    // navegação de mês
    $('stMesNome').textContent = vista === 'mes' ? nomeMes(d.mes.id) : 'Ano ' + d.ano.id;
    $('stAnoNome').textContent = d.ano.id;
    const atual = d.hoje.data.slice(0, 7);
    $('stMesSeg').disabled = vista === 'mes' ? d.mes.id >= atual : d.ano.id >= atual.slice(0, 4);
    document.querySelectorAll('.st-vista button').forEach((b) => b.classList.toggle('ativo', b.dataset.vista === vista));

    const fonte = vista === 'mes' ? d.mes : d.ano;

    // cliques por marca, com o sítio onde clicaram
    const ordem = ['twitch', 'youtube', 'instagram', 'outro'];
    const maxM = Math.max(1, ...Object.values(fonte.porMarca || {}));
    const linhas = ordem.filter((m) => m !== 'outro' || fonte.porMarca.outro).map((m) => {
      const v = fonte.porMarca[m] || 0;
      const sitios = Object.entries((fonte.porSitio || {})[m] || {}).sort((a, b) => b[1] - a[1])
        .map(([s, n]) => '<span>' + esc(nomeSitio(s)) + ' <b>' + fmt(n) + '</b></span>').join('');
      return '<div class="st-marca"><div class="st-marca-top"><strong>' + esc(d.marcas[m] || m) + '</strong><b>' + fmt(v) + '</b></div>' +
        '<div class="st-marca-barra"><i style="width:' + Math.round((v / maxM) * 100) + '%;background:' + CORES[m] + '"></i></div>' +
        (sitios ? '<div class="st-sitios">' + sitios + '</div>' : '') + '</div>';
    });
    $('stMarcas').innerHTML = fonte.cliques ? linhas.join('') : '<p class="st-vazio">Ainda ninguém clicou num link de parceria ' + (vista === 'mes' ? 'neste mês' : 'neste ano') + '.</p>';

    $('stPaginas').innerHTML = lista(fonte.paginas, (k) => PAGINAS[k] || k.replace(/^\/|\.html$/g, ''));
    $('stOrigens').innerHTML = lista(fonte.origens, (k) => k);

    // tabela mês a mês
    const comVisitas = d.ano.meses.filter((m) => m.visitas || m.cliques);
    const primeiro = comVisitas.length ? comVisitas[0].id : d.mes.id;
    const mesesComDados = d.ano.meses.filter((m) => m.id >= primeiro && m.id <= atual);
    $('stMeses').innerHTML = '<thead><tr><th>Mês</th><th>Visitantes</th><th>Páginas vistas</th><th>Cliques</th></tr></thead><tbody>' +
      mesesComDados.map((m) => '<tr' + (m.id === d.mes.id ? ' class="sel"' : '') + '><td>' + MESES[+m.id.slice(5) - 1] + '</td><td>' + fmt(m.visitantes) + '</td><td>' + fmt(m.visitas) + '</td><td>' + fmt(m.cliques) + '</td></tr>').join('') +
      '<tr class="total"><td>Total do ano</td><td>' + fmt(d.ano.visitantes) + '</td><td>' + fmt(d.ano.visitas) + '</td><td>' + fmt(d.ano.cliques) + '</td></tr></tbody>';
  }

  function lista(obj, nome) {
    const e = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!e.length) return '<p class="st-vazio">Sem dados ainda.</p>';
    const tot = e.reduce((s, x) => s + x[1], 0) || 1;
    return e.map(([k, v]) => '<div class="st-li"><span>' + esc(nome(k)) + '</span><b>' + fmt(v) + '</b><em>' + Math.round((v / tot) * 100) + '%</em>' +
      '<i style="width:' + Math.round((v / e[0][1]) * 100) + '%"></i></div>').join('');
  }

  function bloquear(titulo, texto) {
    $('stPainel').classList.add('hidden');
    $('stBloqueado').classList.remove('hidden');
    $('stBloqueado').querySelector('.gate-title').textContent = titulo;
    $('stBloqueado').querySelector('.gate-text').textContent = texto;
    $('stLoginBtn').classList.toggle('hidden', titulo !== 'Acesso restrito');
  }

  // decide o que mostrar consoante a conta com sessão iniciada
  function acesso() {
    const tw = typeof TwitchAuth !== 'undefined' ? TwitchAuth : null;
    if (!tw || !tw.isLoggedIn()) { bloquear('Acesso restrito', 'As estatísticas são só para o Edu e para o moderador. Entra com a tua conta Twitch.'); return; }
    if (!tw.isAdmin()) { bloquear('Esta conta não tem acesso', 'Só o Edu e o moderador podem ver as estatísticas.'); return; }
    if (!dados) carregar();
  }

  function mudarMes(delta) {
    if (!mesSel) return;
    let [a, m] = mesSel.split('-').map(Number);
    if (vista === 'ano') a += delta;
    else { m += delta; if (m < 1) { m = 12; a--; } if (m > 12) { m = 1; a++; } }
    mesSel = a + '-' + String(m).padStart(2, '0');
    carregar();
  }

  function iniciar() {
    if (!$('stPainel')) return;
    $('stAtualizar').addEventListener('click', carregar);
    $('stMesAnt').addEventListener('click', () => mudarMes(-1));
    $('stMesSeg').addEventListener('click', () => mudarMes(1));
    document.querySelectorAll('.st-vista button').forEach((b) => b.addEventListener('click', () => { vista = b.dataset.vista; if (dados) desenhar(); }));
    const chk = $('stNaoContar');
    try { chk.checked = localStorage.getItem('estv_nao_contar') === '1'; } catch (e) {}
    chk.addEventListener('change', () => { try { if (chk.checked) localStorage.setItem('estv_nao_contar', '1'); else localStorage.removeItem('estv_nao_contar'); } catch (e) {} });
    $('stLoginBtn').addEventListener('click', () => { if (typeof TwitchAuth !== 'undefined') TwitchAuth.login(); });
    window.onAuthChange = acesso;
    acesso();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
