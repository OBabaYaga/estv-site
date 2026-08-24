// ===================================================================
// ESTV — Login com a Twitch (Implicit Grant Flow, sem servidor)
//        + Modo de Teste (login simulado, sem precisar de app Twitch)
// ===================================================================
//
// COMO CONFIGURAR O LOGIN REAL DA TWITCH (antes de publicar a sério):
// 1. Vai a https://dev.twitch.tv/console/apps e cria uma aplicação.
// 2. Em "OAuth Redirect URLs", adiciona exatamente o valor de REDIRECT_URI
//    abaixo (tem de ser IDÊNTICO, incluindo a barra final "/").
// 3. Copia o "Client ID" gerado e cola-o em CLIENT_ID abaixo.
// 4. Quando isso estiver feito, muda DEV_MODE para false para esconder
//    o botão de "Modo de Teste".
//
// MODO DE TESTE (DEV_MODE = true):
// Como ainda não há app Twitch real registada, existe um botão extra
// "Entrar em Modo de Teste" que simula um login com qualquer nome de
// utilizador — útil para testar o site (incluindo o painel de admin,
// entrando com o nome do streamer) sem depender da Twitch.
//
// PONTOS REAIS (StreamElements): ver estv-config.js. Quando
// ESTV_CONFIG.REMOTE_POINTS estiver ligado, um login Twitch a sério
// passa a ler/escrever o saldo verdadeiro no StreamElements Loyalty
// (através da nossa pequena API) em vez do localStorage. O Modo de
// Teste nunca mexe em pontos reais — continua sempre 100% local.
// ===================================================================

const TwitchAuth = (function () {
  const CONFIG = {
    CLIENT_ID: '2mo7el92ye48x099v7fnj2vaif6ra0',
    REDIRECT_URI: 'https://www.estv.pt/',
    SCOPE: '', // login apenas para identificação, sem permissões extra
    // Contas com acesso de admin (painel de controlo). Inclui a conta de
    // testes do Fabio (obaba_yaga) e a do streamer real (edu___silva) —
    // podes remover a de testes quando já não precisares dela.
    ADMIN_LOGINS: ['edu___silva', 'obaba_yaga'],
  };

  const DEV_MODE = true; // <-- muda para false quando tiveres a app Twitch real configurada

  const TOKEN_KEY = 'estv_twitch_token';
  const LOGIN_KEY = 'estv_twitch_login';
  const AVATAR_KEY = 'estv_twitch_avatar';
  const RETURN_KEY = 'estv_twitch_return_to';
  const STATE_KEY = 'estv_twitch_state';
  const DEV_USER_KEY = 'estv_dev_user';

  let currentUser = null; // { login, displayName, avatar, points, rank, isAdmin }
  let watchTimer = null;

  // Fecha o menu da conta ao clicar fora dele. Registado uma única vez
  // (em vez de dentro de renderAuthUI, que agora corre com muito mais
  // frequência) para não ir acumulando listeners repetidos.
  document.addEventListener('click', (e) => {
    const toggle = document.getElementById('navUserToggle');
    const menu = document.getElementById('navUserMenu');
    if (toggle && menu && !toggle.contains(e.target)) {
      menu.classList.remove('open');
    }
  });

  function randomState() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function buildAuthorizeUrl() {
    const state = randomState();
    sessionStorage.setItem(STATE_KEY, state);
    const params = new URLSearchParams({
      response_type: 'token',
      client_id: CONFIG.CLIENT_ID,
      redirect_uri: CONFIG.REDIRECT_URI,
      scope: CONFIG.SCOPE,
      state: state,
    });
    return 'https://id.twitch.tv/oauth2/authorize?' + params.toString();
  }

  function login() {
    sessionStorage.setItem(RETURN_KEY, window.location.pathname + window.location.search);
    window.location.href = buildAuthorizeUrl();
  }

  // --- Modo de Teste: login simulado sem Twitch ---
  function devLogin() {
    const suggestion = currentUser ? currentUser.login : '';
    const input = window.prompt(
      'MODO DE TESTE — escreve um nome de utilizador para simular o login.\n' +
        'Escreve "' + CONFIG.ADMIN_LOGINS[0] + '" para entrares como admin.',
      suggestion
    );
    if (!input) return;
    const login = input.trim().toLowerCase().replace(/\s+/g, '_');
    if (!login) return;

    const devUser = {
      login: login,
      displayName: input.trim(),
      avatar: 'https://static-cdn.jtvnw.net/user-default-pictures-uv/de130ab0-def7-11e9-b668-784f43822e80-profile_image-70x70.png',
    };
    localStorage.setItem(DEV_USER_KEY, JSON.stringify(devUser));
    // limpa qualquer sessão real da Twitch para não haver conflito
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LOGIN_KEY);
    localStorage.removeItem(AVATAR_KEY);

    applyLoggedInUser(devUser.login, devUser.displayName, devUser.avatar);
    renderAuthUI();
    renderPlayerStats();
    applyGates();
    if (typeof renderLeaderboard === 'function') renderLeaderboard();
    if (typeof onAuthChange === 'function') onAuthChange();
    startWatchTimer();
  }

  function logout() {
    const token = localStorage.getItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LOGIN_KEY);
    localStorage.removeItem(AVATAR_KEY);
    localStorage.removeItem(DEV_USER_KEY);
    currentUser = null;
    stopWatchTimer();

    if (token) {
      fetch('https://id.twitch.tv/oauth2/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: CONFIG.CLIENT_ID, token: token }),
      }).catch(() => {});
    }

    renderAuthUI();
    renderPlayerStats();
    applyGates();
    if (typeof renderLeaderboard === 'function') renderLeaderboard();
    if (typeof onAuthChange === 'function') onAuthChange();
  }

  function parseTokenFromHash() {
    if (!window.location.hash || window.location.hash.indexOf('access_token') === -1) {
      return null;
    }
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const token = hashParams.get('access_token');
    const state = hashParams.get('state');
    const expectedState = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);

    if (!token) return null;
    if (expectedState && state !== expectedState) {
      console.warn('[TwitchAuth] state inválido, a ignorar resposta.');
      return null;
    }
    return token;
  }

  function cleanUrlHash() {
    const cleanUrl = window.location.pathname + window.location.search;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  async function validateToken(token) {
    try {
      const res = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: 'OAuth ' + token },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function fetchUserProfile(token, login) {
    try {
      const res = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          Authorization: 'Bearer ' + token,
          'Client-Id': CONFIG.CLIENT_ID,
        },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const user = data.data && data.data[0];
      if (!user) return null;
      return {
        login: user.login || login,
        displayName: user.display_name || login,
        avatar: user.profile_image_url || '',
      };
    } catch (e) {
      return null;
    }
  }

  // Modo remoto ligado? (ver estv-config.js) — só true quando o backend
  // real (Vercel + StreamElements) já estiver configurado e publicado.
  function isRemoteMode() {
    return typeof ESTVData !== 'undefined' && typeof ESTVData.isRemoteEnabled === 'function' && ESTVData.isRemoteEnabled();
  }

  // Antes de montar o currentUser, busca o saldo REAL (StreamElements) e
  // substitui o valor local em cache por ele — só para logins Twitch a
  // sério (nunca para o Modo de Teste, que não tem token válido para
  // autenticar pedidos ao backend).
  async function syncRemotePointsIfEnabled(login) {
    if (!isRemoteMode() || !login) return;
    const remotePoints = await ESTVData.fetchRemotePoints(login);
    if (remotePoints !== null) {
      ESTVData.setPointsAbsolute(login, remotePoints);
    }
  }

  // Regista/atualiza o utilizador na nossa base de dados local (ESTVData)
  // e monta o objeto currentUser com pontos + ranking atuais.
  function applyLoggedInUser(login, displayName, avatar) {
    login = login.toLowerCase();
    ESTVData.ensureUser(login, displayName, avatar);
    currentUser = {
      login: login,
      displayName: displayName || login,
      avatar: avatar || '',
      points: ESTVData.getPoints(login),
      rank: ESTVData.getRank(login),
      isAdmin: CONFIG.ADMIN_LOGINS.map((l) => l.toLowerCase()).includes(login),
    };
    return currentUser;
  }

  function refreshCurrentUserStats() {
    if (!currentUser) return;
    currentUser.points = ESTVData.getPoints(currentUser.login);
    currentUser.rank = ESTVData.getRank(currentUser.login);
  }

  function renderAuthUI() {
    const slot = document.getElementById('navAuth');
    if (!slot) return;

    if (currentUser) {
      const pointsText = ESTVData.getPoints(currentUser.login).toLocaleString('pt-PT');
      slot.innerHTML = `
        <span class="nav-points-chip" id="navPointsChip"><i class="fas fa-coins"></i> <span id="navPointsValue">${pointsText}</span></span>
        <div class="nav-user" id="navUserToggle">
          <img src="${currentUser.avatar || 'https://static-cdn.jtvnw.net/user-default-pictures-uv/de130ab0-def7-11e9-b668-784f43822e80-profile_image-70x70.png'}" alt="${currentUser.displayName}" class="nav-user-avatar">
          <span class="nav-user-name">${currentUser.displayName}${currentUser.isAdmin ? ' <span class="nav-admin-tag">ADMIN</span>' : ''}</span>
          <i class="fas fa-chevron-down nav-user-caret"></i>
          <div class="nav-user-menu" id="navUserMenu">
            ${DEV_MODE ? '<button id="navDevPointsBtn" class="nav-user-dev-points" title="Só aparece em Modo de Teste"><i class="fas fa-flask"></i> +500 pontos (teste)</button>' : ''}
            <button id="navLogoutBtn" class="nav-user-logout"><i class="fas fa-arrow-right-from-bracket"></i> Sair</button>
          </div>
        </div>
      `;
      const toggle = document.getElementById('navUserToggle');
      const menu = document.getElementById('navUserMenu');
      toggle.addEventListener('click', () => menu.classList.toggle('open'));
      document.getElementById('navLogoutBtn').addEventListener('click', logout);
      if (DEV_MODE) {
        const devPointsBtn = document.getElementById('navDevPointsBtn');
        if (devPointsBtn) devPointsBtn.addEventListener('click', () => simulateWatch(500));
      }
    } else {
      slot.innerHTML = `
        <div class="nav-auth-buttons">
          <button class="nav-login-btn" id="navLoginBtn">
            <i class="fab fa-twitch"></i> Entrar com Twitch
          </button>
          ${DEV_MODE ? '<button class="nav-dev-btn" id="navDevLoginBtn" title="Login simulado para testes"><i class="fas fa-flask"></i> Modo de Teste</button>' : ''}
        </div>
      `;
      document.getElementById('navLoginBtn').addEventListener('click', login);
      if (DEV_MODE) {
        document.getElementById('navDevLoginBtn').addEventListener('click', devLogin);
      }
    }
  }

  // Atualiza só o número de pontos mostrado na barra superior (o chip ao
  // lado da conta) — chamado sempre que renderPlayerStats() corre, mesmo
  // em páginas que não têm o cartão #playerStats (só a ranking.html tem).
  function updateNavPointsChip() {
    if (!currentUser) return;
    const el = document.getElementById('navPointsValue');
    if (el) el.textContent = ESTVData.getPoints(currentUser.login).toLocaleString('pt-PT');
  }

  function renderPlayerStats() {
    updateNavPointsChip();
    const card = document.getElementById('playerStats');
    if (!card) return;
    const section = card.closest('.player-stats-section');

    if (!currentUser) {
      card.innerHTML = '';
      if (section) section.style.display = 'none';
      return;
    }

    if (section) section.style.display = '';
    refreshCurrentUserStats();

    const pointsText = currentUser.points != null ? currentUser.points.toLocaleString('pt-PT') : '--';
    const rankText = currentUser.rank != null ? '#' + currentUser.rank : '--';

    card.innerHTML = `
      <div class="player-stats-avatar">
        <img src="${currentUser.avatar || 'https://static-cdn.jtvnw.net/user-default-pictures-uv/de130ab0-def7-11e9-b668-784f43822e80-profile_image-70x70.png'}" alt="${currentUser.displayName}">
      </div>
      <div class="player-stats-info">
        <span class="player-stats-name">${currentUser.displayName}</span>
        <div class="player-stats-metrics">
          <div class="player-stats-metric">
            <span class="player-stats-value">${pointsText}</span>
            <span class="player-stats-label"><i class="fas fa-coins"></i> Pontos</span>
          </div>
          <div class="player-stats-metric">
            <span class="player-stats-value">${rankText}</span>
            <span class="player-stats-label"><i class="fas fa-ranking-star"></i> Ranking</span>
          </div>
        </div>
      </div>
      <button class="player-stats-refresh" id="playerStatsRefresh" title="Atualizar">
        <i class="fas fa-rotate-right"></i>
      </button>
    `;

    const refreshBtn = document.getElementById('playerStatsRefresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        refreshBtn.classList.add('spinning');
        refreshCurrentUserStats();
        renderPlayerStats();
        setTimeout(() => refreshBtn.classList.remove('spinning'), 300);
      });
    }
  }

  async function renderLeaderboard() {
    const list = document.getElementById('rankingList');
    if (!list) return;
    if (!currentUser) {
      list.innerHTML = '';
      return;
    }

    // Em modo real, mostra o ranking a sério do StreamElements; se essa
    // chamada falhar ou o modo remoto estiver desligado, usa o ranking
    // local (só reflete quem já visitou este site/browser).
    let top = isRemoteMode() ? await ESTVData.fetchRemoteLeaderboard(20) : null;
    if (!top) top = ESTVData.getLeaderboard(20);

    if (!top || top.length === 0) {
      list.innerHTML = `
        <div class="ranking-error">
          <p>Ainda ninguém tem pontos. Assiste às lives e faz os teus palpites para apareceres aqui!</p>
        </div>
      `;
      return;
    }

    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    list.innerHTML = top
      .map((entry) => {
        const isMe = currentUser && entry.login === currentUser.login;
        return `
          <div class="ranking-row${isMe ? ' ranking-row-me' : ''}">
            <span class="ranking-position">${medals[entry.rank] || '#' + entry.rank}</span>
            <span class="ranking-username">${entry.displayName || entry.login}${isMe ? ' <span class="ranking-you-tag">(tu)</span>' : ''}</span>
            <span class="ranking-points">${entry.points.toLocaleString('pt-PT')} <i class="fas fa-coins"></i></span>
          </div>
        `;
      })
      .join('');
  }

  function applyGates() {
    const isLoggedIn = !!currentUser;
    document.querySelectorAll('[data-gate]').forEach((el) => {
      el.classList.toggle('gate-unlocked', isLoggedIn);
    });
    document.querySelectorAll('.gate-login-btn').forEach((btn) => {
      btn.onclick = login;
    });
    // Em Modo de Teste (sem app Twitch real configurada ainda), mostra
    // também um link para o login simulado dentro de cada ecrã de
    // acesso restrito — sem isto, quem clicasse em "Entrar com Twitch"
    // cairia no fluxo OAuth real (que ainda não está configurado) e
    // ficava sem forma de testar o site.
    if (DEV_MODE) {
      document.querySelectorAll('.gate-login-btn').forEach((btn) => {
        if (btn.dataset.devLinkAdded) return;
        btn.dataset.devLinkAdded = 'true';
        const devLink = document.createElement('button');
        devLink.type = 'button';
        devLink.className = 'gate-dev-link';
        devLink.innerHTML = '<i class="fas fa-flask"></i> Ainda estou a testar — usar Modo de Teste';
        devLink.addEventListener('click', devLogin);
        btn.insertAdjacentElement('afterend', devLink);
      });
    }
    updateAdminOnlyElements();
  }

  // Mostra/esconde qualquer elemento com a classe "admin-only" consoante
  // a conta com sessão iniciada está (ou não) em CONFIG.ADMIN_LOGINS.
  function updateAdminOnlyElements() {
    const admin = !!(currentUser && currentUser.isAdmin);
    document.querySelectorAll('.admin-only').forEach((el) => {
      el.classList.toggle('hidden', !admin);
    });
  }

  // --- Pontos por assistir (simulação) ---
  // Enquanto o utilizador estiver com sessão iniciada E a live estiver
  // marcada como "ao vivo" (window.ESTV_STREAM_LIVE, definido em script.js),
  // atribui 1 ponto por minuto. Isto é só uma simulação para testarmos o
  // fluxo — numa versão de produção isto seria feito por um bot/serviço
  // externo ligado à Twitch, não pelo browser de cada pessoa.
  function startWatchTimer() {
    stopWatchTimer();
    watchTimer = setInterval(() => {
      if (!currentUser) return;

      if (isRemoteMode()) {
        // Em modo real, quem atribui pontos por assistir é o próprio
        // StreamElements (o bot dele já conta o tempo de visualização a
        // sério) — aqui só vamos buscar o saldo atualizado, nunca
        // inventamos pontos a partir do browser.
        ESTVData.fetchRemotePoints(currentUser.login).then((pts) => {
          if (pts !== null) {
            ESTVData.setPointsAbsolute(currentUser.login, pts);
            refreshCurrentUserStats();
            renderPlayerStats();
          }
        });
      } else if (window.ESTV_STREAM_LIVE) {
        // Modo local/teste: continua a simular pontos por assistir.
        ESTVData.awardWatchPoints(currentUser.login, 1);
        refreshCurrentUserStats();
        renderPlayerStats();
      }
    }, 60000);
  }

  function stopWatchTimer() {
    if (watchTimer) {
      clearInterval(watchTimer);
      watchTimer = null;
    }
  }

  // Botão de teste (só em DEV_MODE) para simular pontos de watch-time
  // sem teres de esperar 10 minutos com a live ligada.
  function simulateWatch(minutes) {
    if (!currentUser) return;
    ESTVData.awardWatchPoints(currentUser.login, minutes);
    refreshCurrentUserStats();
    renderPlayerStats();
    if (typeof renderLeaderboard === 'function') renderLeaderboard();
    // avisa a página atual (apostas.js/cartas.js/penaltis.js/...) para
    // atualizar o saldo de pontos que mostra na sua própria interface
    if (typeof onAuthChange === 'function') onAuthChange();
  }

  async function init() {
    // 1. Sessão de teste (dev) guardada?
    const devUserRaw = localStorage.getItem(DEV_USER_KEY);
    if (devUserRaw) {
      try {
        const devUser = JSON.parse(devUserRaw);
        applyLoggedInUser(devUser.login, devUser.displayName, devUser.avatar);
      } catch (e) {
        localStorage.removeItem(DEV_USER_KEY);
      }
    }

    // 2. Se acabámos de voltar da Twitch com um token no URL
    const tokenFromHash = parseTokenFromHash();
    if (tokenFromHash) {
      cleanUrlHash();
      const validation = await validateToken(tokenFromHash);
      if (validation) {
        localStorage.setItem(TOKEN_KEY, tokenFromHash);
        localStorage.setItem(LOGIN_KEY, validation.login || '');
        const profile = await fetchUserProfile(tokenFromHash, validation.login);
        if (profile) localStorage.setItem(AVATAR_KEY, profile.avatar || '');
        await syncRemotePointsIfEnabled(validation.login);
      }

      const returnTo = sessionStorage.getItem(RETURN_KEY);
      sessionStorage.removeItem(RETURN_KEY);
      if (returnTo && returnTo !== window.location.pathname + window.location.search) {
        window.location.href = returnTo;
        return;
      }
    }

    // 3. Sessão Twitch real guardada?
    if (!currentUser) {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        const validation = await validateToken(storedToken);
        if (validation) {
          const profile = await fetchUserProfile(storedToken, validation.login);
          await syncRemotePointsIfEnabled(validation.login);
          applyLoggedInUser(
            validation.login,
            (profile && profile.displayName) || validation.login,
            (profile && profile.avatar) || localStorage.getItem(AVATAR_KEY) || ''
          );
        } else {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(LOGIN_KEY);
          localStorage.removeItem(AVATAR_KEY);
        }
      }
    }

    renderAuthUI();
    renderPlayerStats();
    applyGates();
    if (currentUser) startWatchTimer();
  }

  document.addEventListener('DOMContentLoaded', () => {
    init().then(() => {
      renderLeaderboard();
      const refreshBtn = document.getElementById('rankingRefresh');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          refreshBtn.classList.add('spinning');
          renderLeaderboard();
          setTimeout(() => refreshBtn.classList.remove('spinning'), 300);
        });
      }
      if (typeof onAuthChange === 'function') onAuthChange();
    });
  });

  return {
    login,
    devLogin,
    logout,
    isLoggedIn: () => !!currentUser,
    getUser: () => currentUser,
    isAdmin: () => !!(currentUser && currentUser.isAdmin),
    simulateWatch,
    renderLeaderboard,
    renderPlayerStats,
    DEV_MODE,
  };
})();
