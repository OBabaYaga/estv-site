// ===================================================================
// ESTV — Jogo dos Penáltis
// Os viewers apostam pontos (10 a 20) e batem um penálti: acertam e
// ganham o dobro da aposta, falham e perdem a aposta. A cor da
// camisola escolhida é só estética, não afeta a probabilidade.
// ===================================================================

(function () {
  // Zonas alvo dentro da baliza (posição em % dentro de .penalti-goal).
  // As mesmas zonas servem para saber para onde a bola vai e para onde
  // o guarda-redes se atira.
  const ZONAS = [
    { x: 16, y: 26 }, // canto superior esquerdo
    { x: 50, y: 14 }, // topo centro
    { x: 84, y: 26 }, // canto superior direito
    { x: 16, y: 72 }, // canto inferior esquerdo
    { x: 50, y: 84 }, // baixo centro
    { x: 84, y: 72 }, // canto inferior direito
  ];

  let apostaAtual = 10;
  let corSelecionada = 'azul';
  let aBaterPenalti = false;
  const historico = [];
  let limiteIntervalId = null;

  // ---------------------------------------------------------------
  // Figuras humanas em SVG (estilo "pictograma desportivo") — sem
  // fotos reais nem ícones genéricos, para o batedor e o guarda-redes
  // parecerem mesmo pessoas em movimento. A camisola do batedor usa
  // var(--jersey-color), definida pela classe jersey-azul/verde/vermelho
  // no elemento pai (#penaltiPlayer).
  // ---------------------------------------------------------------
  const SVG_JOGADOR_A_CORRER = `
    <svg viewBox="0 0 120 180">
      <g transform="translate(47,42) rotate(-35)">
        <rect x="-5" y="0" width="10" height="26" rx="5" fill="#d9a066"/>
        <g transform="translate(0,26) rotate(30)"><rect x="-4.5" y="0" width="9" height="24" rx="4.5" fill="#d9a066"/></g>
      </g>
      <g transform="translate(73,42) rotate(55)">
        <rect x="-5" y="0" width="10" height="26" rx="5" fill="#d9a066"/>
        <g transform="translate(0,26) rotate(-20)"><rect x="-4.5" y="0" width="9" height="24" rx="4.5" fill="#d9a066"/></g>
      </g>
      <rect x="45" y="36" width="30" height="48" rx="14" fill="var(--jersey-color)" transform="rotate(-6 60 60)"/>
      <rect x="45" y="78" width="30" height="24" rx="8" fill="#1a1a1a"/>
      <g transform="translate(52,88) rotate(-70)">
        <rect x="-6.5" y="0" width="13" height="28" rx="6" fill="#d9a066"/>
        <g transform="translate(0,28) rotate(75)">
          <rect x="-5.5" y="0" width="11" height="24" rx="5" fill="#d9a066"/>
          <rect x="-6" y="22" width="12" height="8" rx="3" fill="#111"/>
        </g>
      </g>
      <g transform="translate(68,88) rotate(30)">
        <rect x="-6.5" y="0" width="13" height="30" rx="6" fill="#d9a066"/>
        <g transform="translate(0,30) rotate(-15)">
          <rect x="-5.5" y="0" width="11" height="24" rx="5" fill="#d9a066"/>
          <rect x="-6" y="22" width="12" height="8" rx="3" fill="#111"/>
        </g>
      </g>
      <circle cx="60" cy="20" r="13" fill="#d9a066"/>
      <path d="M 47 15 Q 60 2 73 15 Q 73 8 60 6 Q 47 8 47 15 Z" fill="#2b1a10"/>
    </svg>`;

  const SVG_JOGADOR_A_CHUTAR = `
    <svg viewBox="0 0 120 180">
      <g transform="translate(42,42) rotate(-100)">
        <rect x="-5" y="0" width="10" height="24" rx="5" fill="#d9a066"/>
        <g transform="translate(0,24) rotate(15)"><rect x="-4.5" y="0" width="9" height="22" rx="4.5" fill="#d9a066"/></g>
      </g>
      <g transform="translate(76,42) rotate(95)">
        <rect x="-5" y="0" width="10" height="24" rx="5" fill="#d9a066"/>
        <g transform="translate(0,24) rotate(-10)"><rect x="-4.5" y="0" width="9" height="22" rx="4.5" fill="#d9a066"/></g>
      </g>
      <rect x="45" y="34" width="30" height="48" rx="14" fill="var(--jersey-color)" transform="rotate(12 60 58)"/>
      <rect x="45" y="76" width="30" height="24" rx="8" fill="#1a1a1a" transform="rotate(6 60 88)"/>
      <g transform="translate(54,92) rotate(15)">
        <rect x="-6.5" y="0" width="13" height="30" rx="6" fill="#d9a066"/>
        <g transform="translate(0,30) rotate(5)">
          <rect x="-5.5" y="0" width="11" height="26" rx="5" fill="#d9a066"/>
          <rect x="-6" y="24" width="12" height="8" rx="3" fill="#111"/>
        </g>
      </g>
      <g transform="translate(68,90) rotate(-75)">
        <rect x="-6.5" y="0" width="13" height="30" rx="6" fill="#d9a066"/>
        <g transform="translate(0,30) rotate(20)">
          <rect x="-5.5" y="0" width="11" height="26" rx="5" fill="#d9a066"/>
          <rect x="-6" y="24" width="13" height="9" rx="3" fill="#111"/>
        </g>
      </g>
      <circle cx="64" cy="18" r="13" fill="#d9a066" transform="rotate(8 60 58)"/>
      <path d="M 51 13 Q 64 0 77 13 Q 77 6 64 4 Q 51 6 51 13 Z" fill="#2b1a10" transform="rotate(8 60 58)"/>
    </svg>`;

  const SVG_GUARDA_REDES_PRONTO = `
    <svg viewBox="0 0 120 180">
      <g transform="translate(40,44) rotate(-60)">
        <rect x="-5.5" y="0" width="11" height="24" rx="5.5" fill="#f0b429"/>
        <g transform="translate(0,24) rotate(50)"><rect x="-5" y="0" width="10" height="20" rx="5" fill="#f0b429"/><circle cx="0" cy="22" r="7" fill="#fff"/></g>
      </g>
      <g transform="translate(80,44) rotate(60)">
        <rect x="-5.5" y="0" width="11" height="24" rx="5.5" fill="#f0b429"/>
        <g transform="translate(0,24) rotate(-50)"><rect x="-5" y="0" width="10" height="20" rx="5" fill="#f0b429"/><circle cx="0" cy="22" r="7" fill="#fff"/></g>
      </g>
      <rect x="43" y="40" width="34" height="46" rx="14" fill="#f0b429"/>
      <rect x="44" y="82" width="32" height="24" rx="8" fill="#101010"/>
      <g transform="translate(52,104) rotate(-14)">
        <rect x="-6.5" y="0" width="13" height="26" rx="6" fill="#d9a066"/>
        <g transform="translate(0,26) rotate(10)"><rect x="-5.5" y="0" width="11" height="22" rx="5" fill="#d9a066"/><rect x="-6" y="20" width="12" height="8" rx="3" fill="#111"/></g>
      </g>
      <g transform="translate(68,104) rotate(14)">
        <rect x="-6.5" y="0" width="13" height="26" rx="6" fill="#d9a066"/>
        <g transform="translate(0,26) rotate(-10)"><rect x="-5.5" y="0" width="11" height="22" rx="5" fill="#d9a066"/><rect x="-6" y="20" width="12" height="8" rx="3" fill="#111"/></g>
      </g>
      <circle cx="60" cy="22" r="13" fill="#d9a066"/>
      <path d="M 47 17 Q 60 4 73 17 Q 73 10 60 8 Q 47 10 47 17 Z" fill="#2b1a10"/>
    </svg>`;

  const SVG_GUARDA_REDES_SALTO = `
    <svg viewBox="0 0 120 180">
      <g transform="translate(44,38) rotate(-135)">
        <rect x="-5.5" y="0" width="11" height="38" rx="5.5" fill="#f0b429"/><circle cx="0" cy="40" r="7" fill="#fff"/>
      </g>
      <g transform="translate(76,38) rotate(135)">
        <rect x="-5.5" y="0" width="11" height="38" rx="5.5" fill="#f0b429"/><circle cx="0" cy="40" r="7" fill="#fff"/>
      </g>
      <rect x="43" y="30" width="34" height="52" rx="14" fill="#f0b429"/>
      <rect x="44" y="76" width="32" height="24" rx="8" fill="#101010"/>
      <g transform="translate(52,98) rotate(8)">
        <rect x="-6.5" y="0" width="13" height="28" rx="6" fill="#d9a066"/>
        <g transform="translate(0,28) rotate(-6)"><rect x="-5.5" y="0" width="11" height="24" rx="5" fill="#d9a066"/><rect x="-6" y="22" width="12" height="8" rx="3" fill="#111"/></g>
      </g>
      <g transform="translate(68,98) rotate(-8)">
        <rect x="-6.5" y="0" width="13" height="28" rx="6" fill="#d9a066"/>
        <g transform="translate(0,28) rotate(6)"><rect x="-5.5" y="0" width="11" height="24" rx="5" fill="#d9a066"/><rect x="-6" y="22" width="12" height="8" rx="3" fill="#111"/></g>
      </g>
      <circle cx="60" cy="16" r="13" fill="#d9a066"/>
      <path d="M 47 11 Q 60 -2 73 11 Q 73 4 60 2 Q 47 4 47 11 Z" fill="#2b1a10"/>
    </svg>`;

  const SVG_GUARDA_REDES_VOO = `
    <svg viewBox="0 0 200 140">
      <circle cx="20" cy="46" r="13" fill="#d9a066"/>
      <path d="M 15 34 Q 4 46 15 58 Q 22 58 20 46 Q 22 34 15 34 Z" fill="#2b1a10"/>
      <rect x="30" y="33" width="58" height="26" rx="13" fill="#f0b429" transform="rotate(-6 30 46)"/>
      <g transform="translate(76,54) rotate(70)">
        <rect x="0" y="-5.5" width="24" height="11" rx="5.5" fill="#f0b429"/><circle cx="26" cy="0" r="7" fill="#fff"/>
      </g>
      <g transform="translate(38,56) rotate(150)">
        <rect x="0" y="-6.5" width="26" height="13" rx="6" fill="#d9a066"/>
        <g transform="translate(26,0) rotate(-35)"><rect x="0" y="-5.5" width="23" height="11" rx="5" fill="#d9a066"/><rect x="19" y="-6" width="9" height="12" rx="3" fill="#111"/></g>
      </g>
      <g transform="translate(34,50) rotate(165)">
        <rect x="0" y="-6.5" width="26" height="13" rx="6" fill="#d9a066"/>
        <g transform="translate(26,0) rotate(-20)"><rect x="0" y="-5.5" width="23" height="11" rx="5" fill="#d9a066"/><rect x="19" y="-6" width="9" height="12" rx="3" fill="#111"/></g>
      </g>
      <g transform="translate(84,38) rotate(-12)">
        <rect x="0" y="-5.5" width="36" height="11" rx="5.5" fill="#f0b429"/><circle cx="38" cy="0" r="8" fill="#fff"/>
      </g>
    </svg>`;

  function currentUser() {
    return typeof TwitchAuth !== 'undefined' ? TwitchAuth.getUser() : null;
  }

  function clamp(valor, min, max) {
    return Math.min(max, Math.max(min, valor));
  }

  function formatMs(ms) {
    const totalSeg = Math.ceil(ms / 1000);
    const min = Math.floor(totalSeg / 60);
    const seg = totalSeg % 60;
    return min > 0 ? `${min}m ${seg}s` : `${seg}s`;
  }

  // ---------------------------------------------------------------
  // Render de estado (pontos, aposta, limite por hora)
  // ---------------------------------------------------------------
  function renderPontos() {
    const user = currentUser();
    const el = document.getElementById('pontosAtuais');
    if (el) el.textContent = user ? ESTVData.getPoints(user.login).toLocaleString('pt-PT') : '0';
  }

  function renderConfig() {
    const cfg = ESTVData.getPenaltiConfig();
    const minEl = document.getElementById('apostaMinTexto');
    const maxEl = document.getElementById('apostaMaxTexto');
    if (minEl) minEl.textContent = cfg.apostaMin;
    if (maxEl) maxEl.textContent = cfg.apostaMax;
    apostaAtual = clamp(apostaAtual, cfg.apostaMin, cfg.apostaMax);
    const valorEl = document.getElementById('apostaValor');
    if (valorEl) valorEl.textContent = apostaAtual;
  }

  function renderLimite() {
    const user = currentUser();
    const limiteEl = document.getElementById('limiteTexto');
    const baterBtn = document.getElementById('baterBtn');
    if (!limiteEl || !baterBtn) return;

    if (limiteIntervalId) {
      clearInterval(limiteIntervalId);
      limiteIntervalId = null;
    }

    if (!user) {
      limiteEl.textContent = '';
      return;
    }

    const status = ESTVData.getPenaltiStatus(user.login);
    if (status.restantes > 0) {
      limiteEl.textContent = `Restam ${status.restantes} penáltis nesta hora.`;
      if (!aBaterPenalti) baterBtn.disabled = false;
    } else {
      const atualizaTexto = () => {
        const s = ESTVData.getPenaltiStatus(user.login);
        if (s.restantes > 0) {
          limiteEl.textContent = `Restam ${s.restantes} penáltis nesta hora.`;
          baterBtn.disabled = aBaterPenalti;
          if (limiteIntervalId) {
            clearInterval(limiteIntervalId);
            limiteIntervalId = null;
          }
        } else {
          limiteEl.textContent = `Limite atingido — próximo penálti em ${formatMs(s.proximaEmMs)}.`;
        }
      };
      atualizaTexto();
      baterBtn.disabled = true;
      limiteIntervalId = setInterval(atualizaTexto, 1000);
    }
  }

  function renderHistorico() {
    const wrap = document.getElementById('penaltiHistorico');
    if (!wrap) return;
    if (historico.length === 0) {
      wrap.innerHTML = '<p class="ranking-loading">Ainda não bateste nenhum penálti nesta sessão.</p>';
      return;
    }
    wrap.innerHTML = historico
      .slice(0, 8)
      .map((h) => {
        const sinal = h.golo ? '+' : '-';
        return `
          <div class="penalti-historico-item ${h.golo ? 'golo' : 'falhou'}">
            <span class="penalti-historico-icon"><i class="fas ${h.golo ? 'fa-circle-check' : 'fa-circle-xmark'}"></i></span>
            <span class="jersey-dot jersey-${h.corCamisola}"></span>
            <span class="penalti-historico-texto">${h.golo ? 'Golo!' : 'Defesa'}</span>
            <span class="penalti-historico-pontos">${sinal}${h.aposta} pontos</span>
          </div>
        `;
      })
      .join('');
  }

  function renderAll() {
    renderConfig();
    renderPontos();
    renderLimite();
    renderHistorico();
  }

  // ---------------------------------------------------------------
  // Controlo de aposta e escolha da camisola
  // ---------------------------------------------------------------
  function ajustarAposta(delta) {
    const cfg = ESTVData.getPenaltiConfig();
    apostaAtual = clamp(apostaAtual + delta, cfg.apostaMin, cfg.apostaMax);
    const valorEl = document.getElementById('apostaValor');
    if (valorEl) valorEl.textContent = apostaAtual;
  }

  function selecionarCamisola(cor) {
    corSelecionada = cor;
    document.querySelectorAll('.jersey-option').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.cor === cor);
    });
    const player = document.getElementById('penaltiPlayer');
    if (player) {
      player.classList.remove('jersey-azul', 'jersey-verde', 'jersey-vermelho');
      player.classList.add('jersey-' + cor);
    }
  }

  // ---------------------------------------------------------------
  // Animação: corrida → chuto → bola + defesa → resultado
  // ---------------------------------------------------------------
  function resetStage() {
    const ball = document.getElementById('penaltiBall');
    const keeper = document.getElementById('penaltiKeeper');
    const player = document.getElementById('penaltiPlayer');
    const result = document.getElementById('penaltiResult');
    if (ball) {
      ball.style.transition = 'none';
      ball.style.left = '50%';
      ball.style.top = '92%';
      ball.style.opacity = '0';
      void ball.offsetWidth;
      ball.style.transition = '';
    }
    if (keeper) {
      keeper.style.transition = 'none';
      keeper.style.left = '50%';
      keeper.style.top = '48%';
      keeper.classList.remove('diving', 'flip');
      keeper.innerHTML = SVG_GUARDA_REDES_PRONTO;
      void keeper.offsetWidth;
      keeper.style.transition = '';
    }
    if (player) {
      player.classList.remove('running', 'kicking');
      player.innerHTML = SVG_JOGADOR_A_CORRER;
    }
    if (result) {
      result.classList.add('hidden');
      result.classList.remove('golo', 'falhou');
    }
  }

  function jogarAnimacao(golo, onDone) {
    const ball = document.getElementById('penaltiBall');
    const keeper = document.getElementById('penaltiKeeper');
    const player = document.getElementById('penaltiPlayer');

    const zonaBola = ZONAS[Math.floor(Math.random() * ZONAS.length)];
    let zonaGuarda = zonaBola;
    if (golo) {
      // O guarda-redes atira-se para outra zona — a bola entra.
      const outras = ZONAS.filter((z) => z !== zonaBola);
      zonaGuarda = outras[Math.floor(Math.random() * outras.length)];
    }

    if (player) player.classList.add('running');

    setTimeout(() => {
      if (player) {
        player.classList.remove('running');
        player.classList.add('kicking');
        player.innerHTML = SVG_JOGADOR_A_CHUTAR;
      }
      if (ball) {
        ball.style.opacity = '1';
      }
      if (keeper) {
        keeper.classList.add('diving');
        keeper.classList.remove('flip');
        if (zonaGuarda.x <= 20) {
          keeper.innerHTML = SVG_GUARDA_REDES_VOO;
          keeper.classList.add('flip');
        } else if (zonaGuarda.x >= 80) {
          keeper.innerHTML = SVG_GUARDA_REDES_VOO;
        } else {
          keeper.innerHTML = SVG_GUARDA_REDES_SALTO;
        }
      }

      // pequeno atraso para o "pontapé" acontecer antes da bola voar
      setTimeout(() => {
        if (ball) {
          ball.style.left = zonaBola.x + '%';
          ball.style.top = zonaBola.y + '%';
        }
        if (keeper) {
          keeper.style.left = zonaGuarda.x + '%';
          keeper.style.top = Math.max(35, Math.min(55, zonaGuarda.y)) + '%';
        }

        setTimeout(() => {
          onDone();
        }, 480);
      }, 90);
    }, 380);
  }

  function mostrarResultado(resultado) {
    const result = document.getElementById('penaltiResult');
    const texto = document.getElementById('penaltiResultTexto');
    const pontos = document.getElementById('penaltiResultPontos');
    const stage = document.getElementById('penaltiStage');
    if (!result || !texto || !pontos) return;

    result.classList.remove('hidden', 'golo', 'falhou');
    result.classList.add(resultado.golo ? 'golo' : 'falhou');
    texto.textContent = resultado.golo ? 'GOLO!' : 'DEFESA!';
    pontos.textContent = resultado.golo ? `+${resultado.aposta} pontos` : `-${resultado.aposta} pontos`;

    if (stage && !resultado.golo) {
      stage.classList.remove('stage-shake');
      void stage.offsetWidth;
      stage.classList.add('stage-shake');
    }
  }

  function baterPenalti() {
    if (aBaterPenalti) return;
    const user = currentUser();
    if (!user) return;

    const resultado = ESTVData.chutarPenalti(user.login, apostaAtual, corSelecionada);
    if (!resultado.sucesso) {
      alert(resultado.erro);
      renderLimite();
      return;
    }

    aBaterPenalti = true;
    const baterBtn = document.getElementById('baterBtn');
    if (baterBtn) baterBtn.disabled = true;
    resetStage();

    jogarAnimacao(resultado.golo, () => {
      mostrarResultado(resultado);
      renderPontos();
      renderLimite();
      if (typeof TwitchAuth !== 'undefined') TwitchAuth.renderPlayerStats();

      historico.unshift(resultado);
      renderHistorico();

      setTimeout(() => {
        resetStage();
        aBaterPenalti = false;
        renderLimite();
      }, 2000);
    });
  }

  // Chamado pelo twitch-auth.js sempre que o estado de login muda
  window.onAuthChange = renderAll;

  document.addEventListener('DOMContentLoaded', () => {
    renderAll();
    resetStage();
    selecionarCamisola('azul');

    const menosBtn = document.getElementById('apostaMenosBtn');
    const maisBtn = document.getElementById('apostaMaisBtn');
    if (menosBtn) menosBtn.addEventListener('click', () => ajustarAposta(-1));
    if (maisBtn) maisBtn.addEventListener('click', () => ajustarAposta(1));

    const jerseyPicker = document.getElementById('jerseyPicker');
    if (jerseyPicker) {
      jerseyPicker.querySelectorAll('.jersey-option').forEach((btn) => {
        btn.addEventListener('click', () => selecionarCamisola(btn.dataset.cor));
      });
    }

    const baterBtn = document.getElementById('baterBtn');
    if (baterBtn) baterBtn.addEventListener('click', baterPenalti);
  });
})();
