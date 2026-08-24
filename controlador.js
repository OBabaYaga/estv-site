// ===================================================================
// ESTV — Painel de Controlo (só para o streamer)
// Criar jornadas, fechar apostas, inserir resultados e resolver
// (pontos atribuídos automaticamente pela ESTVData).
// ===================================================================

(function () {
  let novoJogoCount = 0;

  function isAdmin() {
    return typeof TwitchAuth !== 'undefined' && TwitchAuth.isAdmin();
  }

  function isLoggedIn() {
    return typeof TwitchAuth !== 'undefined' && TwitchAuth.isLoggedIn();
  }

  // ---------------------------------------------------------------
  // Controlo de acesso à página
  // ---------------------------------------------------------------
  function renderAccessState() {
    const blocked = document.getElementById('controladorBloqueado');
    const painel = document.getElementById('controladorPainel');
    if (!blocked || !painel) return;

    if (isAdmin()) {
      blocked.classList.add('hidden');
      painel.classList.remove('hidden');
      renderAll();
    } else {
      blocked.classList.remove('hidden');
      painel.classList.add('hidden');
      const title = blocked.querySelector('.gate-title');
      const text = blocked.querySelector('.gate-text');
      if (isLoggedIn()) {
        if (title) title.textContent = 'Esta conta não tem acesso';
        if (text) text.textContent = 'Entraste com uma conta diferente da do streamer. Sai e entra com a conta certa para gerires as jornadas.';
      } else {
        if (title) title.textContent = 'Acesso restrito';
        if (text) text.textContent = 'Este painel é só para o streamer. Entra com a tua conta Twitch (a mesma do canal ESTV) para gerires as jornadas.';
      }
    }
  }

  // ---------------------------------------------------------------
  // Formulário "Criar Nova Jornada"
  // ---------------------------------------------------------------
  function addJogoRow() {
    novoJogoCount++;
    const wrap = document.getElementById('novaJornadaJogos');
    if (!wrap) return;
    const row = document.createElement('div');
    row.className = 'admin-jogo-row';
    row.dataset.rowId = novoJogoCount;
    row.innerHTML = `
      <input type="text" class="jogo-casa" placeholder="Equipa da casa">
      <span class="admin-jogo-vs">vs</span>
      <input type="text" class="jogo-fora" placeholder="Equipa visitante">
      <input type="text" class="jogo-data" placeholder="Data/hora (opcional)">
      <button type="button" class="admin-jogo-remove" title="Remover jogo"><i class="fas fa-trash"></i></button>
    `;
    row.querySelector('.admin-jogo-remove').addEventListener('click', () => row.remove());
    wrap.appendChild(row);
  }

  function criarJornada() {
    const tituloInput = document.getElementById('novaJornadaTitulo');
    const titulo = tituloInput.value.trim();
    if (!titulo) {
      alert('Escreve um título para a jornada.');
      return;
    }
    const rows = document.querySelectorAll('#novaJornadaJogos .admin-jogo-row');
    if (rows.length === 0) {
      alert('Adiciona pelo menos um jogo.');
      return;
    }
    const jogos = [];
    for (const row of rows) {
      const casa = row.querySelector('.jogo-casa').value.trim();
      const fora = row.querySelector('.jogo-fora').value.trim();
      const data = row.querySelector('.jogo-data').value.trim();
      if (!casa || !fora) {
        alert('Preenche o nome das duas equipas em todos os jogos.');
        return;
      }
      jogos.push({ casa, fora, data });
    }

    ESTVData.createJornada(titulo, jogos);

    tituloInput.value = '';
    document.getElementById('novaJornadaJogos').innerHTML = '';
    novoJogoCount = 0;
    addJogoRow();

    renderAll();
  }

  // ---------------------------------------------------------------
  // Jornada em destaque — a jornada aberta/fechada mais recente,
  // com contagem de palpites por opção em cada jogo (visão rápida
  // para decidires enquanto estás em direto).
  // ---------------------------------------------------------------
  function renderJornadaDestaque() {
    const wrap = document.getElementById('jornadaDestaque');
    if (!wrap) return;

    const jornadas = ESTVData.getJornadas().filter((j) => !j.resolvida);
    if (jornadas.length === 0) {
      wrap.innerHTML = '';
      return;
    }
    const j = jornadas[0]; // mais recente (getJornadas já vem ordenado por criação desc)

    const jogosHtml = j.jogos
      .map((g) => {
        const contagem = { 1: 0, X: 0, 2: 0 };
        Object.values(j.palpites || {}).forEach((picks) => {
          const escolha = picks[g.id];
          if (escolha && contagem[escolha] !== undefined) contagem[escolha]++;
        });
        return `
          <div class="destaque-jogo-row">
            <span class="admin-jogo-nome">${g.casa} <small>vs</small> ${g.fora}</span>
            <div class="destaque-contagem">
              <span title="Palpitaram 1 (Casa)">1: <strong>${contagem['1']}</strong></span>
              <span title="Palpitaram X (Empate)">X: <strong>${contagem['X']}</strong></span>
              <span title="Palpitaram 2 (Fora)">2: <strong>${contagem['2']}</strong></span>
            </div>
          </div>
        `;
      })
      .join('');

    const numPalpites = Object.keys(j.palpites || {}).length;
    const statusTag = j.fechada
      ? '<span class="jornada-tag jornada-tag-fechada">Fechada — pronta para resultados</span>'
      : '<span class="jornada-tag jornada-tag-aberta">Aberta a receber palpites</span>';

    wrap.innerHTML = `
      <div class="destaque-card">
        <div class="destaque-header">
          <h2><i class="fas fa-bolt"></i> ${j.titulo}</h2>
          ${statusTag}
        </div>
        <p class="destaque-meta">${numPalpites} pessoa(s) já apostaram nesta jornada</p>
        <div class="destaque-jogos">${jogosHtml}</div>
        <div class="destaque-actions">
          ${!j.fechada ? `<button class="btn-primary destaque-fechar-btn" data-jornada="${j.id}"><i class="fas fa-lock"></i> Fechar Apostas Agora</button>` : '<span class="destaque-hint">Insere os resultados na lista abaixo e depois resolve a jornada.</span>'}
        </div>
      </div>
    `;

    const fecharBtn = wrap.querySelector('.destaque-fechar-btn');
    if (fecharBtn) {
      fecharBtn.addEventListener('click', () => {
        ESTVData.setFechada(fecharBtn.dataset.jornada, true);
        renderAll();
      });
    }
  }

  // ---------------------------------------------------------------
  // Lista completa de jornadas (todas), com resultados + ações
  // ---------------------------------------------------------------
  function renderJornadasList() {
    const list = document.getElementById('adminJornadasList');
    if (!list) return;
    const jornadas = ESTVData.getJornadas();

    if (jornadas.length === 0) {
      list.innerHTML = '<p class="ranking-loading">Ainda não criaste nenhuma jornada.</p>';
      return;
    }

    list.innerHTML = jornadas
      .map((j) => {
        const jogosHtml = j.jogos
          .map(
            (g) => `
          <div class="admin-jogo-resultado-row">
            <span class="admin-jogo-nome">${g.casa} <small>vs</small> ${g.fora}</span>
            <select class="admin-resultado-select" data-jornada="${j.id}" data-jogo="${g.id}" ${j.resolvida ? 'disabled' : ''}>
              <option value="">Resultado…</option>
              <option value="1" ${g.resultado === '1' ? 'selected' : ''}>1 (Casa)</option>
              <option value="X" ${g.resultado === 'X' ? 'selected' : ''}>X (Empate)</option>
              <option value="2" ${g.resultado === '2' ? 'selected' : ''}>2 (Fora)</option>
            </select>
          </div>
        `
          )
          .join('');

        const numPalpites = Object.keys(j.palpites || {}).length;
        const statusTag = j.resolvida
          ? '<span class="jornada-tag jornada-tag-resolvida">Resolvida</span>'
          : j.fechada
          ? '<span class="jornada-tag jornada-tag-fechada">Fechada</span>'
          : '<span class="jornada-tag jornada-tag-aberta">Aberta</span>';

        return `
          <div class="admin-jornada-card">
            <div class="admin-jornada-header">
              <h4>${j.titulo} ${statusTag}</h4>
              <span class="admin-jornada-meta">${numPalpites} pessoa(s) apostaram</span>
            </div>
            <div class="admin-jogo-resultados">${jogosHtml}</div>
            <div class="admin-jornada-actions">
              ${!j.fechada ? `<button class="btn-secondary admin-fechar-btn" data-jornada="${j.id}"><i class="fas fa-lock"></i> Fechar Apostas</button>` : ''}
              ${j.fechada && !j.resolvida ? `<button class="btn-primary admin-resolver-btn" data-jornada="${j.id}"><i class="fas fa-check-double"></i> Resolver Jornada (dar pontos)</button>` : ''}
              <button class="admin-eliminar-btn" data-jornada="${j.id}" title="Eliminar jornada"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        `;
      })
      .join('');

    list.querySelectorAll('.admin-resultado-select').forEach((sel) => {
      sel.addEventListener('change', () => {
        const { jornada, jogo } = sel.dataset;
        if (sel.value) {
          ESTVData.setResultado(jornada, jogo, sel.value);
        }
      });
    });

    list.querySelectorAll('.admin-fechar-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        ESTVData.setFechada(btn.dataset.jornada, true);
        renderAll();
      });
    });

    list.querySelectorAll('.admin-resolver-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        try {
          const resumo = ESTVData.resolveJornada(btn.dataset.jornada);
          alert(`Jornada resolvida! Pontos atribuídos automaticamente a ${resumo.length} pessoa(s).`);
          renderAll();
          if (typeof TwitchAuth !== 'undefined') TwitchAuth.renderLeaderboard();
        } catch (e) {
          alert(e.message);
        }
      });
    });

    list.querySelectorAll('.admin-eliminar-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (confirm('Eliminar esta jornada? Esta ação não pode ser desfeita.')) {
          ESTVData.deleteJornada(btn.dataset.jornada);
          renderAll();
        }
      });
    });
  }

  function renderAll() {
    if (!isAdmin()) return;
    renderJornadaDestaque();
    renderJornadasList();
  }

  window.onAuthChange = renderAccessState;

  document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('addJogoBtn');
    if (addBtn) addBtn.addEventListener('click', addJogoRow);

    const criarBtn = document.getElementById('criarJornadaBtn');
    if (criarBtn) criarBtn.addEventListener('click', criarJornada);

    const loginBtn = document.getElementById('controladorLoginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        if (typeof TwitchAuth !== 'undefined') TwitchAuth.login();
      });
    }

    if (document.getElementById('novaJornadaJogos')) addJogoRow();

    renderAccessState();
  });
})();
