// ===================================================================
// ESTV — Apostas 1x2 (vista dos viewers: palpites + histórico)
// A gestão de jornadas (criar, fechar, resultados) está no
// Painel de Controlo (controlador.html), só acessível ao streamer.
// ===================================================================

(function () {
  function currentUser() {
    return typeof TwitchAuth !== 'undefined' ? TwitchAuth.getUser() : null;
  }

  // ---------------------------------------------------------------
  // Jornadas abertas (vista do viewer)
  // ---------------------------------------------------------------
  function renderJornadasAbertas() {
    const wrap = document.getElementById('jornadasAbertas');
    if (!wrap) return;
    const user = currentUser();
    const jornadas = ESTVData.getJornadas().filter((j) => !j.resolvida);

    if (jornadas.length === 0) {
      wrap.innerHTML = '<p class="ranking-loading">Ainda não há nenhuma jornada aberta. Volta mais tarde!</p>';
      return;
    }

    wrap.innerHTML = jornadas
      .map((j) => {
        const picks = user ? ESTVData.getUserPicks(j.id, user.login) : {};
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
            <div class="jogos-grid">${jogosHtml}</div>
          </div>
        `;
      })
      .join('');

    wrap.querySelectorAll('.pick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const u = currentUser();
        if (!u) return;
        const { jornada, jogo, escolha } = btn.dataset;
        const ok = ESTVData.submitPick(jornada, u.login, jogo, escolha);
        if (ok) renderJornadasAbertas();
      });
    });
  }

  // ---------------------------------------------------------------
  // Histórico de jornadas resolvidas
  // ---------------------------------------------------------------
  function renderJornadasHistorico() {
    const wrap = document.getElementById('jornadasHistorico');
    if (!wrap) return;
    const user = currentUser();
    const jornadas = ESTVData.getJornadas().filter((j) => j.resolvida);

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

  // Chamado pelo twitch-auth.js sempre que o estado de login muda
  window.onAuthChange = renderAll;

  document.addEventListener('DOMContentLoaded', () => {
    renderAll();
  });
})();
