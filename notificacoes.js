// ===================================================================
// ESTV — App instalável + notificações de live
// ===================================================================
//
// - Regista o service worker (sw.js), que recebe as notificações.
// - Mostra um cartão "Ativar notificações" (e "Instalar app" quando o
//   browser deixa) e um botão fixo no menu lateral.
// - No iPhone/iPad, as notificações só funcionam com o site instalado no
//   ecrã principal — nesse caso explicamos como instalar.
// - No Painel de Controlo (só streamer) mostra o estado e os botões
//   "Ligar aviso de live" e "Enviar notificação de teste".
// ===================================================================

(function () {
  const API = () => (typeof ESTV_CONFIG !== 'undefined' ? ESTV_CONFIG.API_BASE_URL : '');
  const DISPENSADO_KEY = 'estv_push_cartao_fechado_ate';
  const SINCRONIZADO_KEY = 'estv_push_sincronizado';

  const temSW = 'serviceWorker' in navigator;
  const temPush = temSW && 'PushManager' in window && 'Notification' in window;
  const ehIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const instalada = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  let registo = null;
  let pedidoInstalacao = null;

  function ls(get, key, val) {
    try {
      if (get) return localStorage.getItem(key);
      if (val == null) localStorage.removeItem(key);
      else localStorage.setItem(key, val);
    } catch (e) {
      return null;
    }
  }

  function base64ParaBytes(b64) {
    const padding = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  async function subscricaoAtual() {
    if (!registo) return null;
    return registo.pushManager.getSubscription();
  }

  async function ativar() {
    if (!temPush) {
      mostrarAjudaIOS();
      return false;
    }
    const permissao = await Notification.requestPermission();
    if (permissao !== 'granted') {
      alert('As notificações ficaram bloqueadas. Podes ativá-las nas definições do browser/telemóvel para este site.');
      atualizarUI();
      return false;
    }
    try {
      const res = await fetch(API() + '/api/push');
      const { publicKey } = await res.json();
      let sub = await subscricaoAtual();
      if (!sub) {
        sub = await registo.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaBytes(publicKey) });
      }
      await fetch(API() + '/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'subscrever', subscription: sub.toJSON() }),
      });
      ls(false, SINCRONIZADO_KEY, '1');
      fecharCartao(3650);
    } catch (e) {
      console.error('[notificacoes]', e);
      alert('Não foi possível ativar as notificações. Tenta outra vez daqui a pouco.');
    }
    atualizarUI();
    return true;
  }

  async function desativar() {
    const sub = await subscricaoAtual();
    if (sub) {
      fetch(API() + '/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'cancelar', endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe();
    }
    ls(false, SINCRONIZADO_KEY, null);
    atualizarUI();
  }

  // Se já estava subscrito, volta a enviar a subscrição ao servidor
  // (uma vez por sessão) — assim nunca fica "ativado" só no telemóvel.
  async function sincronizar() {
    const sub = await subscricaoAtual();
    if (!sub || sessionStorage.getItem(SINCRONIZADO_KEY)) return;
    try {
      sessionStorage.setItem(SINCRONIZADO_KEY, '1');
    } catch (e) {}
    fetch(API() + '/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'subscrever', subscription: sub.toJSON() }),
    }).catch(() => {});
  }

  // ---------------------------------------------------------------
  // Interface
  // ---------------------------------------------------------------
  function fecharCartao(dias) {
    ls(false, DISPENSADO_KEY, String(Date.now() + dias * 24 * 3600 * 1000));
    const c = document.getElementById('pushCartao');
    if (c) c.remove();
  }

  function cartaoDispensado() {
    const ate = Number(ls(true, DISPENSADO_KEY)) || 0;
    return Date.now() < ate;
  }

  function mostrarAjudaIOS() {
    let m = document.getElementById('pushAjudaIOS');
    if (!m) {
      m = document.createElement('div');
      m.id = 'pushAjudaIOS';
      m.className = 'push-modal';
      m.innerHTML = `
        <div class="push-modal-box">
          <button class="push-modal-fechar" aria-label="Fechar"><i class="fas fa-xmark"></i></button>
          <img src="assets/app/apple-touch-icon.png" alt="" class="push-modal-icon">
          <h3>Instala a app ESTV</h3>
          <p>No iPhone, as notificações só funcionam com a app instalada:</p>
          <ol>
            <li>Toca em <strong>Partilhar</strong> <i class="fas fa-arrow-up-from-bracket"></i> na barra do Safari</li>
            <li>Escolhe <strong>"Adicionar ao ecrã principal"</strong></li>
            <li>Abre a app ESTV no ecrã principal e toca em <strong>Ativar avisos</strong></li>
          </ol>
        </div>`;
      m.addEventListener('click', (e) => {
        if (e.target === m || e.target.closest('.push-modal-fechar')) m.remove();
      });
      document.body.appendChild(m);
    }
  }

  async function instalar() {
    if (pedidoInstalacao) {
      pedidoInstalacao.prompt();
      await pedidoInstalacao.userChoice.catch(() => null);
      pedidoInstalacao = null;
      atualizarUI();
    } else if (ehIOS) {
      mostrarAjudaIOS();
    }
  }

  async function estado() {
    if (ehIOS && !instalada && !temPush) return 'ios-instalar';
    if (!temPush) return 'sem-suporte';
    if (Notification.permission === 'denied') return 'bloqueado';
    const sub = await subscricaoAtual();
    return sub ? 'ativo' : 'inativo';
  }

  function garantirBotaoMenu() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav || document.getElementById('pushMenuBtn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pushMenuBtn';
    btn.className = 'nav-link push-menu-btn';
    const divisor = nav.querySelector('.sidebar-divider');
    nav.insertBefore(btn, divisor || null);
    btn.addEventListener('click', async () => {
      const e = await estado();
      if (e === 'ativo') {
        if (confirm('Deixar de receber avisos quando o Edu entra em direto?')) desativar();
      } else if (e === 'ios-instalar') mostrarAjudaIOS();
      else if (e === 'bloqueado') alert('As notificações estão bloqueadas para este site. Ativa-as nas definições do browser/telemóvel.');
      else if (e === 'sem-suporte') alert('Este browser não suporta notificações.');
      else ativar();
    });
  }

  function garantirCartao(e) {
    const existente = document.getElementById('pushCartao');
    const mostrar = (e === 'inativo' || e === 'ios-instalar' || pedidoInstalacao) && !cartaoDispensado();
    if (!mostrar) {
      if (existente) existente.remove();
      return;
    }
    const podeInstalar = !instalada && (pedidoInstalacao || ehIOS);
    const cartao = existente || document.createElement('div');
    cartao.id = 'pushCartao';
    cartao.className = 'push-cartao';
    cartao.innerHTML = `
      <button class="push-cartao-fechar" aria-label="Fechar"><i class="fas fa-xmark"></i></button>
      <img src="assets/app/icon-192.png" alt="" class="push-cartao-icon">
      <div class="push-cartao-texto">
        <strong>Não percas nenhuma live</strong>
        <span>${e === 'ios-instalar' ? 'Instala a app ESTV para receberes um aviso quando o Edu entrar em direto.' : 'Recebe um aviso no telemóvel quando o Edu entrar em direto.'}</span>
        <div class="push-cartao-botoes">
          ${e === 'inativo' ? '<button class="push-btn push-btn-ativar"><i class="fas fa-bell"></i> Ativar avisos</button>' : ''}
          ${podeInstalar ? `<button class="push-btn ${e === 'inativo' ? 'push-btn-sec' : ''} push-btn-instalar"><i class="fas fa-mobile-screen"></i> Instalar app</button>` : ''}
        </div>
      </div>`;
    if (!existente) document.body.appendChild(cartao);
    cartao.querySelector('.push-cartao-fechar').onclick = () => fecharCartao(7);
    const a = cartao.querySelector('.push-btn-ativar');
    if (a) a.onclick = ativar;
    const i = cartao.querySelector('.push-btn-instalar');
    if (i) i.onclick = instalar;
  }

  async function atualizarUI() {
    garantirBotaoMenu();
    const e = await estado();
    const btn = document.getElementById('pushMenuBtn');
    if (btn) {
      btn.classList.toggle('push-ativo', e === 'ativo');
      btn.innerHTML =
        e === 'ativo'
          ? '<i class="fas fa-bell"></i> Avisos de live: ligados'
          : '<i class="fas fa-bell-slash"></i> Ativar avisos de live';
    }
    garantirCartao(e);
    renderAdmin();
  }

  // ---------------------------------------------------------------
  // Painel de Controlo (só streamer)
  // ---------------------------------------------------------------
  async function pedidoAdmin(corpo) {
    const token = ls(true, 'estv_twitch_token');
    const res = await fetch(API() + '/api/push', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(corpo),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'O pedido falhou.');
    return data;
  }

  const ESTADOS_LIVE = {
    enabled: '✅ Ligado — quando o canal entrar em direto, toda a gente é avisada.',
    webhook_callback_verification_pending: '⏳ À espera da confirmação da Twitch… atualiza daqui a uns segundos.',
    desligado: '⚪ Desligado — carrega em "Ligar aviso de live".',
    sem_secret: '⚠️ Falta configurar o TWITCH_CLIENT_SECRET no Vercel.',
  };

  let adminCarregado = false;
  async function renderAdmin(forcar) {
    const caixa = document.getElementById('adminPush');
    if (!caixa) return;
    if (typeof TwitchAuth === 'undefined' || !TwitchAuth.isAdmin()) return;
    if (adminCarregado && !forcar) return;
    adminCarregado = true;
    const info = document.getElementById('adminPushInfo');
    info.textContent = 'A carregar…';
    try {
      const d = await pedidoAdmin({ acao: 'estado' });
      const est = d.live && d.live.estado;
      info.innerHTML = `
        <div><strong>${d.subscritores}</strong> ${d.subscritores === 1 ? 'pessoa tem' : 'pessoas têm'} os avisos ligados.</div>
        <div>Aviso automático de live (canal <strong>${d.canal}</strong>): ${ESTADOS_LIVE[est] || (est === 'erro' ? '⚠️ ' + (d.live.erro || 'erro') : '⚠️ ' + est)}</div>`;
    } catch (e) {
      info.textContent = '⚠️ ' + e.message;
    }
  }

  function ligarAdmin() {
    const ligar = document.getElementById('adminPushLigar');
    const testar = document.getElementById('adminPushTestar');
    if (ligar)
      ligar.addEventListener('click', async () => {
        ligar.disabled = true;
        try {
          await pedidoAdmin({ acao: 'ligar-live' });
          setTimeout(() => renderAdmin(true), 4000);
          renderAdmin(true);
        } catch (e) {
          alert(e.message);
        }
        ligar.disabled = false;
      });
    if (testar)
      testar.addEventListener('click', async () => {
        testar.disabled = true;
        try {
          const r = await pedidoAdmin({ acao: 'testar' });
          alert(`Notificação de teste enviada para ${r.enviadas} ${r.enviadas === 1 ? 'aparelho' : 'aparelhos'}.`);
          renderAdmin(true);
        } catch (e) {
          alert(e.message);
        }
        testar.disabled = false;
      });
  }

  // ---------------------------------------------------------------
  // Arranque
  // ---------------------------------------------------------------
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pedidoInstalacao = e;
    atualizarUI();
  });
  window.addEventListener('appinstalled', () => {
    pedidoInstalacao = null;
    atualizarUI();
  });

  document.addEventListener('DOMContentLoaded', async () => {
    ligarAdmin();
    if (temSW) {
      try {
        registo = await navigator.serviceWorker.register('sw.js');
      } catch (e) {
        console.warn('[notificacoes] service worker não registado', e);
      }
    }
    await atualizarUI();
    sincronizar();
    // O painel de admin só sabe se és admin depois do login carregar.
    setTimeout(() => renderAdmin(), 1500);
    setTimeout(() => renderAdmin(), 4000);
  });
})();
