// ===================================================================
// ESTV — Apostas 1x2 (vista dos viewers: palpites + histórico)
// A gestão de jornadas (criar, fechar, resultados) está no
// Painel de Controlo (controlador.html), só acessível ao streamer.
// ===================================================================

(function () {
  function currentUser() {
    return typeof TwitchAuth !== 'undefined' ? TwitchAuth.getUser() : null;
  }

  // "25/08, 14:32" — usado para mostrar até quando é que uma jornada
  // ainda aceita palpites (fecha sozinha 24h depois de ser criada).
  function formatPrazo(timestampMs) {
    if (!timestampMs) return '';
    return new Date(timestampMs).toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ---------------------------------------------------------------
  // Jornadas abertas (vista do viewer)
  // ---------------------------------------------------------------
  async function renderJornadasAbertas() {
    const wrap = document.getElementById('jornadasAbertas');
    if (!wrap) return;
    wrap.innerHTML = '<p class="ranking-loading">A carregar jornadas…</p>';
    const user = currentUser();
    const jornadas = (await ESTVData.getJornadas()).filter((j) => !j.resolvida);

    if (jornadas.length === 0) {
      wrap.innerHTML = '<p class="ranking-loading">Ainda não há nenhuma jornada aberta. Volta mais tarde!</p>';
      return;
    }

    wrap.innerHTML = jornadas
      .map((j) => {
        const picks = user ? ESTVData.getUserPicks(j, user.login) : {};
        const locked = j.fechada;

        const jogosHtml = j.jogos
          .map((g) => {
            const meuPalpite = picks[g.id] || null;
            const opcoes = ['1', 'X', '2'];
            const botoes = opcoes
              .map((op) => {
                const label = op === '1' ? '1 · Casa' : op === 'X' ? 'X · Empate' : '2 · Fora';
                const selected = meuPalpite === op ? ' pick-selected' : '';
                return `<button type="button" class="pick-btn${selected}" data-jornada="${j.id}" data-jogo="${g.id}" data-escolha="${op}" ${locked ? 'disabled' : ''}>${label}</button>`;
              })
              .join('');
            return `
              <div class="jogo-card">
                <div class="jogo-teams">${g.casa} <span class="jogo-vs">vs</span> ${g.fora}</div>
                ${g.data ? `<div class="jogo-data">${g.data}</div>` : ''}
                <div class="jogo-picks">${botoes}</div>
              </div>
            `;
          })
          .join('');

        return `
          <div class="jornada-card">
            <div class="jornada-card-header">
              <h3>${j.titulo}</h3>
              ${locked ? '<span class="jornada-tag jornada-tag-fechada">Apostas Fechadas — aguarda resultados</span>' : '<span class="jornada-tag jornada-tag-aberta">Aberta para palpites</span>'}
            </div>
            ${
              !locked && j.fechaAutomaticamenteEm
                ? `<div class="jornada-prazo"><i class="fas fa-clock"></i>As apostas fecham automaticamente às ${formatPrazo(j.fechaAutomaticamenteEm)} (24h após a criação da jornada)</div>`
                : ''
            }
            <div class="jogos-grid">${jogosHtml}</div>
          </div>
        `;
      })
      .join('');

    wrap.querySelectorAll('.pick-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const u = currentUser();
        if (!u) return;
        btn.disabled = true;
        const { jornada, jogo, escolha } = btn.dataset;
        const ok = await ESTVData.submitPick(jornada, u.login, jogo, escolha);
        if (ok) {
          renderJornadasAbertas();
        } else {
          btn.disabled = false;
          alert('Não foi possível registar o palpite. Verifica a tua ligação e tenta novamente.');
        }
      });
    });
  }

  // ---------------------------------------------------------------
  // Histórico de jornadas resolvidas
  // ---------------------------------------------------------------
  async function renderJornadasHistorico() {
    const wrap = document.getElementById('jornadasHistorico');
    if (!wrap) return;
    wrap.innerHTML = '<p class="ranking-loading">A carregar histórico…</p>';
    const user = currentUser();
    const jornadas = (await ESTVData.getJornadas()).filter((j) => j.resolvida);

    if (jornadas.length === 0) {
      wrap.innerHTML = '<p class="ranking-loading">Ainda não há jornadas resolvidas.</p>';
      return;
    }

    wrap.innerHTML = jornadas
      .map((j) => {
        const jogosHtml = j.jogos
          .map((g) => {
            const meuPalpite = user ? (j.palpites[user.login] || {})[g.id] : null;
            const acertou = meuPalpite && meuPalpite === g.resultado;
            return `
              <div class="jogo-card jogo-card-resolvido">
                <div class="jogo-teams">${g.casa} <span class="jogo-vs">vs</span> ${g.fora}</div>
                <div class="jogo-resultado-final">Resultado: <strong>${g.resultado}</strong></div>
                ${meuPalpite ? `<div class="jogo-meu-palpite ${acertou ? 'acertou' : 'errou'}">O teu palpite: ${meuPalpite} ${acertou ? '✓' : '✗'}</div>` : '<div class="jogo-meu-palpite">Não apostaste neste jogo</div>'}
              </div>
            `;
          })
          .join('');

        const meuResumo = user && j.resumo ? j.resumo.find((r) => r.login === user.login) : null;

        return `
          <div class="jornada-card jornada-card-historico">
            <div class="jornada-card-header">
              <h3>${j.titulo}</h3>
              <span class="jornada-tag jornada-tag-resolvida">Resolvida</span>
            </div>
            ${
              meuResumo
                ? `<div class="jornada-resumo ${meuResumo.jornadaPerfeita ? 'jornada-perfeita' : ''}">
                    Acertaste ${meuResumo.acertos}/${meuResumo.totalJogos} jogos — <strong>+${meuResumo.pontosGanhos} pontos</strong>
                    ${meuResumo.jornadaPerfeita ? ' 🎉 Jornada perfeita, pontos triplicados!' : ''}
                  </div>`
                : '<div class="jornada-resumo">Não participaste nesta jornada.</div>'
            }
            <div class="jogos-grid">${jogosHtml}</div>
          </div>
        `;
      })
      .join('');
  }

  function renderAll() {
    renderJornadasAbertas();
    renderJornadasHistorico();
  }
  // (as duas correm em paralelo — cada uma trata do seu próprio "a
  // carregar", não é preciso esperar por nenhuma delas aqui.)

  // Chamado pelo twitch-auth.js sempre que o estado de login muda
  window.onAuthChange = renderAll;

  document.addEventListener('DOMContentLoaded', () => {
    renderAll();
    // Volta a desenhar de vez em quando para as jornadas passarem
    // sozinhas de "Aberta" a "Apostas Fechadas" assim que baterem as 24h,
    // mesmo que a pessoa deixe esta página aberta sem a recarregar.
    setInterval(renderAll, 60 * 1000);
  });
})();
