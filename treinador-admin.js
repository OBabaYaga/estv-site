// ===================================================================
// Painel de Controlo — gestão da Liga do Treinador ESTV
// ===================================================================
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NOMES_DIV = ['1.ª Div.', '2.ª Div.', '3.ª Div.', '4.ª Div.'];
  let horas = [14, 21];
  let carregado = false;

  function base() {
    const b = (typeof ESTV_CONFIG !== 'undefined' && ESTV_CONFIG.API_BASE_URL) || 'https://estv-api-delta.vercel.app';
    return b.replace(/\/$/, '') + '/api/health?modo=treinador&acao=';
  }
  function token() {
    try { return localStorage.getItem('estv_twitch_token'); } catch (e) { return null; }
  }
  async function pedir(acao, dados) {
    const opts = { method: dados ? 'POST' : 'GET', headers: {}, cache: 'no-store' };
    const t = token();
    if (t) opts.headers.Authorization = 'Bearer ' + t;
    if (dados) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(dados);
    }
    const r = await fetch(base() + acao, opts);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.erro) throw new Error(j.erro || 'Erro');
    return j;
  }
  function desenharHoras() {
    const el = $('#admTrHoras');
    if (!el) return;
    let html = '<p class="adm-tr-tit">Horas das jornadas</p><div class="adm-tr-grelha">';
    for (let h = 0; h < 24; h++) html += '<label class="adm-tr-h' + (horas.includes(h) ? ' on' : '') + '"><input type="checkbox" value="' + h + '"' + (horas.includes(h) ? ' checked' : '') + '>' + String(h).padStart(2, '0') + 'h</label>';
    el.innerHTML = html + '</div>';
  }
  function quando(ts) {
    return ts ? new Date(ts).toLocaleString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  }
  async function carregar() {
    const info = $('#admTrInfo');
    if (!info) return;
    try {
      const d = await pedir('liga');
      if (!d.mundo) {
        info.innerHTML = 'Ainda não há liga. Escolhe as horas e carrega em <b>Criar liga nova</b>.';
        desenharHoras();
        return;
      }
      const m = d.mundo;
      const i = d.info || {};
      horas = i.horas || horas;
      const hum = Object.values(m.clubes).filter((c) => c.hum);
      const p = m.cal[m.passo];
      info.innerHTML =
        '<b>' + (i.ativa ? '🟢 A decorrer' : '⏸️ Em pausa') + '</b> · Época ' + m.ano + '/' + String(m.ano + 1).slice(2) +
        ' · a seguir: ' + (p ? (p.t === 'L' ? 'Jornada ' + (p.r + 1) : 'Taça') : '—') + ' (' + (m.passo + 1) + '/' + m.cal.length + ')' +
        '<br>Próxima jornada automática: <b>' + (i.ativa ? quando(i.proxima) : 'em pausa') + '</b>' +
        '<br>Treinadores (' + hum.length + '/40): ' + (hum.length ? hum.map((c) => esc(c.hum) + ' <small>(' + esc(c.n) + ', ' + NOMES_DIV[c.div] + ')</small>').join(', ') : 'ainda ninguém');
      desenharHoras();
    } catch (e) {
      info.textContent = 'Não consegui carregar a liga: ' + e.message;
    }
  }
  document.addEventListener('change', (e) => {
    if (!e.target.closest('#admTrHoras')) return;
    horas = Array.from(document.querySelectorAll('#admTrHoras input:checked')).map((x) => Number(x.value));
    desenharHoras();
  });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tr-op]');
    if (!b) return;
    const op = b.dataset.trOp;
    const avisos = {
      criar: 'Criar uma liga NOVA? Se já houver uma, todos os clubes, treinadores e resultados são apagados.',
      apagar: 'Apagar a liga? Perde-se tudo.',
      jogar: 'Jogar a próxima jornada agora? Quem estiver no site vê-a ao vivo.',
    };
    if (avisos[op] && !confirm(avisos[op])) return;
    if ((op === 'horas' || op === 'criar') && !horas.length) return alert('Escolhe pelo menos uma hora.');
    b.disabled = true;
    try {
      await pedir('liga-admin', { op, horas });
      await carregar();
    } catch (err) {
      alert(err.message);
    } finally {
      b.disabled = false;
    }
  });
  function talvez() {
    if (carregado) return;
    if (typeof TwitchAuth === 'undefined' || !TwitchAuth.isAdmin()) return;
    carregado = true;
    carregar();
  }
  const antigo = window.onAuthChange;
  window.onAuthChange = function () {
    if (typeof antigo === 'function') antigo();
    talvez();
  };
  document.addEventListener('DOMContentLoaded', () => setTimeout(talvez, 500));
})();
