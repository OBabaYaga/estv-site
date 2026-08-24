// ===================================================================
// ESTV — Cartas Colecionáveis
// Os viewers gastam pontos para abrir cartas de jogadores (raridade
// aleatória) e vão preenchendo a sua coleção pessoal.
// ===================================================================

(function () {
  const RARITY_ORDER = ['comum', 'rara', 'epica', 'lendaria'];

  function currentUser() {
    return typeof TwitchAuth !== 'undefined' ? TwitchAuth.getUser() : null;
  }

  function cardIconHtml(card) {
    const icons = { GR: 'fa-hand-fist', DC: 'fa-shield-halved', DE: 'fa-shield-halved', DD: 'fa-shield-halved', MDC: 'fa-futbol', MC: 'fa-futbol', EXT: 'fa-bolt', AV: 'fa-futbol' };
    return `<i class="fas ${icons[card.posicao] || 'fa-futbol'}"></i>`;
  }

  function formatValor(valor) {
    if (valor == null) return '';
    return valor >= 1000 ? `${(valor / 1000).toLocaleString('pt-PT', { maximumFractionDigits: 1 })} mM €` : `${valor} M €`;
  }

  function buildCardFace(card, rarityCfg, quantidade) {
    const r = rarityCfg[card.raridade];
    // Tenta a caricatura do jogador (assets/<id>.png); se ainda não
    // existir para este jogador, cai automaticamente para o ícone genérico.
    return `
      <div class="player-card player-card-${card.raridade}" style="--rarity-cor: ${r.cor}">
        <div class="player-card-top">
          <span class="player-card-rarity">${r.label}</span>
          <span class="player-card-pais">${card.pais}</span>
        </div>
        <div class="player-card-icon">
          <img src="assets/${card.id}.png" alt="" class="player-card-photo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <span class="player-card-fallback">${cardIconHtml(card)}</span>
        </div>
        <div class="player-card-nome">${card.nome}</div>
        <div class="player-card-clube">${card.clube}</div>
        <div class="player-card-posicao">${card.posicao}</div>
        ${card.valor != null ? `<div class="player-card-valor">${formatValor(card.valor)}</div>` : ''}
        ${quantidade > 1 ? `<span class="player-card-qty">x${quantidade}</span>` : ''}
      </div>
    `;
  }

  function buildLockedFace(card, rarityCfg) {
    const r = rarityCfg[card.raridade];
    return `
      <div class="player-card player-card-locked" style="--rarity-cor: ${r.cor}">
        <div class="player-card-top">
          <span class="player-card-rarity">${r.label}</span>
        </div>
        <div class="player-card-icon"><i class="fas fa-question"></i></div>
        <div class="player-card-nome">???</div>
      </div>
    `;
  }

  function renderPontos() {
    const user = currentUser();
    const el = document.getElementById('pontosAtuais');
    if (el) el.textContent = user ? ESTVData.getPoints(user.login).toLocaleString('pt-PT') : '0';
    const custoEl = document.getElementById('custoCartaTexto');
    if (custoEl) custoEl.textContent = ESTVData.getCustoAbrirCarta();
  }

  function renderRarityLegend() {
    const wrap = document.getElementById('rarityLegend');
    if (!wrap) return;
    const rarityCfg = ESTVData.getRarityConfig();
    wrap.innerHTML = RARITY_ORDER.map((key) => {
      const r = rarityCfg[key];
      return `<span class="rarity-chip" style="--rarity-cor: ${r.cor}"><span class="rarity-dot"></span>${r.label}</span>`;
    }).join('');
  }

  function renderCollectionGrid() {
    const grid = document.getElementById('collectionGrid');
    const progress = document.getElementById('collectionProgress');
    if (!grid) return;
    const user = currentUser();
    const catalog = ESTVData.getCardCatalog().sort((a, b) => RARITY_ORDER.indexOf(a.raridade) - RARITY_ORDER.indexOf(b.raridade));
    const rarityCfg = ESTVData.getRarityConfig();
    const collection = user ? ESTVData.getUserCollection(user.login) : {};

    grid.innerHTML = catalog
      .map((card) => {
        const qty = collection[card.id] || 0;
        return qty > 0 ? buildCardFace(card, rarityCfg, qty) : buildLockedFace(card, rarityCfg);
      })
      .join('');

    if (progress) {
      const stats = user ? ESTVData.getCollectionStats(user.login) : { unicasObtidas: 0, totalCatalogo: catalog.length };
      progress.textContent = `${stats.unicasObtidas}/${stats.totalCatalogo} cartas descobertas`;
    }
  }

  // ---------------------------------------------------------------
  // Abertura de carta — sequência interativa estilo "pack opening"
  // (pacote a brilhar → toque para abrir → explosão de luz → carta)
  // ---------------------------------------------------------------
  let envelopeClickHandler = null;

  function showCardFace(carta, novaCarta, quantidade) {
    const flip = document.getElementById('cardRevealFlip');
    const front = document.getElementById('cardRevealFront');
    if (!flip || !front) return;

    const rarityCfg = ESTVData.getRarityConfig();
    front.innerHTML =
      buildCardFace(carta, rarityCfg, quantidade) +
      `<p class="card-reveal-status">${novaCarta ? '✨ Carta nova para a tua coleção!' : `Já tinhas esta carta — agora tens ${quantidade}.`}</p>`;

    flip.classList.remove('flipped');
    requestAnimationFrame(() => {
      setTimeout(() => flip.classList.add('flipped'), 120);
    });
  }

  function spawnConfetti() {
    const layer = document.getElementById('confettiLayer');
    if (!layer) return;
    layer.innerHTML = '';
    const colors = ['#f0b429', '#ffdd7a', '#fff3c4', '#4f6bef', '#ffffff'];
    for (let i = 0; i < 46; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      piece.style.setProperty('--x', Math.round(Math.random() * 640 - 320) + 'px');
      piece.style.setProperty('--rot', Math.round(Math.random() * 720 - 360) + 'deg');
      piece.style.setProperty('--delay', (Math.random() * 0.25).toFixed(2) + 's');
      piece.style.setProperty('--fall', (1.1 + Math.random() * 0.8).toFixed(2) + 's');
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      layer.appendChild(piece);
    }
    setTimeout(() => {
      layer.innerHTML = '';
    }, 2200);
  }

  function triggerBurst(raridade) {
    const overlay = document.getElementById('cardRevealOverlay');
    const flash = document.getElementById('packFlash');
    const burst = document.getElementById('packBurst');
    if (flash) {
      flash.classList.remove('play');
      void flash.offsetWidth;
      flash.classList.add('play');
    }
    if (burst) {
      burst.classList.remove('play');
      void burst.offsetWidth;
      burst.classList.add('play');
    }
    if (overlay && (raridade === 'epica' || raridade === 'lendaria')) {
      overlay.classList.remove('shake');
      void overlay.offsetWidth;
      overlay.classList.add('shake');
      setTimeout(() => overlay.classList.remove('shake'), 420);
    }
    if (raridade === 'lendaria') spawnConfetti();
  }

  // Mostra o pacote a brilhar (cor consoante a raridade já sorteada) e só
  // revela a carta quando a pessoa lhe toca — dá suspense antes do resultado.
  function playPackSequence(resultado) {
    const overlay = document.getElementById('cardRevealOverlay');
    const envelope = document.getElementById('packEnvelope');
    const cardBox = document.getElementById('cardBox');
    if (!overlay || !envelope || !cardBox) {
      // sem suporte à animação (ex: página antiga em cache) — mostra logo a carta
      showCardFace(resultado.carta, resultado.novaCarta, resultado.quantidade);
      return;
    }

    const rarityCfg = ESTVData.getRarityConfig();
    const r = rarityCfg[resultado.carta.raridade];

    overlay.classList.remove('hidden');
    envelope.classList.remove('hidden');
    envelope.classList.remove('pack-glow-comum', 'pack-glow-rara', 'pack-glow-epica', 'pack-glow-lendaria', 'opened');
    envelope.style.setProperty('--rarity-cor', r.cor);
    envelope.classList.add('pack-glow-' + resultado.carta.raridade);
    cardBox.classList.add('hidden');

    if (envelopeClickHandler) envelope.removeEventListener('click', envelopeClickHandler);
    envelopeClickHandler = () => {
      envelope.removeEventListener('click', envelopeClickHandler);
      envelope.classList.add('opened');
      triggerBurst(resultado.carta.raridade);
      setTimeout(() => {
        envelope.classList.add('hidden');
        cardBox.classList.remove('hidden');
        showCardFace(resultado.carta, resultado.novaCarta, resultado.quantidade);
        renderPontos();
        renderCollectionGrid();
        if (typeof TwitchAuth !== 'undefined') TwitchAuth.renderPlayerStats();
      }, 480);
    };
    envelope.addEventListener('click', envelopeClickHandler);
  }

  function hideReveal() {
    const overlay = document.getElementById('cardRevealOverlay');
    const envelope = document.getElementById('packEnvelope');
    if (envelope && envelopeClickHandler) envelope.removeEventListener('click', envelopeClickHandler);
    if (overlay) overlay.classList.add('hidden');
  }

  function abrirCarta() {
    const user = currentUser();
    if (!user) return;
    const resultado = ESTVData.openPack(user.login);
    if (!resultado.sucesso) {
      alert(resultado.erro);
      return;
    }
    playPackSequence(resultado);
  }

  function renderAll() {
    renderPontos();
    renderRarityLegend();
    renderCollectionGrid();
  }

  // Chamado pelo twitch-auth.js sempre que o estado de login muda
  window.onAuthChange = renderAll;

  document.addEventListener('DOMContentLoaded', () => {
    renderAll();
    const abrirBtn = document.getElementById('abrirCartaBtn');
    if (abrirBtn) abrirBtn.addEventListener('click', abrirCarta);
    const closeBtn = document.getElementById('cardRevealCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', hideReveal);
    const overlay = document.getElementById('cardRevealOverlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        const cardBox = document.getElementById('cardBox');
        // só fecha ao clicar fora depois de a carta já estar revelada —
        // durante a fase do pacote, o clique é para o abrir, não para sair
        if (e.target === overlay && cardBox && !cardBox.classList.contains('hidden')) {
          hideReveal();
        }
      });
    }
  });
})();
