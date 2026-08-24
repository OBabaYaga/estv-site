// ===================================================================
// ESTV — Camada de dados (pontos + apostas 1x2)
// ===================================================================
//
// MODO ATUAL: tudo guardado em localStorage (só funciona no browser de
// cada pessoa — bom para testar sozinho, mas os palpites e o ranking
// NÃO são partilhados entre viewers diferentes).
//
// PARA PRODUÇÃO: substituir as funções loadDB()/saveDB() por chamadas a
// uma base de dados partilhada (ex: Firebase Firestore). Todas as outras
// funções deste ficheiro (ensureUser, addPoints, createJornada, etc.)
// podem manter exatamente a mesma assinatura — só é preciso trocar a
// forma como os dados são lidos/escritos.
// ===================================================================

const ESTVData = (function () {
  const DB_KEY = 'estv_db_v1';
  const PONTOS_POR_ACERTO = 10;
  const MULTIPLICADOR_JORNADA_PERFEITA = 3;

  // ---------------------------------------------------------------
  // Cartas Colecionáveis — catálogo fixo de jogadores + raridades.
  // (Sem fotos reais — cada carta usa um ícone + bandeira + cores da
  // raridade, para não dependermos de imagens com direitos de autor.)
  // ---------------------------------------------------------------
  const CUSTO_ABRIR_CARTA = 100;

  const RARITY_CONFIG = {
    comum: { label: 'Comum', peso: 55, cor: '#94a3b8' },
    rara: { label: 'Rara', peso: 28, cor: '#3b82f6' },
    epica: { label: 'Épica', peso: 13, cor: '#a855f7' },
    lendaria: { label: 'Lendária', peso: 4, cor: '#f0b429' },
  };

  const CARD_CATALOG = [
    // --- Lendária (Top 1-25 por valor de mercado) ---
    { id: 'victorfroholdt', nome: 'Victor Froholdt', clube: 'FC Porto', pais: '🇩🇰', posicao: 'MC', raridade: 'lendaria', valor: 50 }, // #1
    { id: 'samuaghehowa', nome: 'Samu Aghehowa', clube: 'FC Porto', pais: '🇪🇸', posicao: 'AV', raridade: 'lendaria', valor: 45 }, // #2
    { id: 'andreasschjelderup', nome: 'Andreas Schjelderup', clube: 'Benfica', pais: '🇳🇴', posicao: 'EXT', raridade: 'lendaria', valor: 40 }, // #3
    { id: 'goncaloinacio', nome: 'Gonçalo Inácio', clube: 'Sporting CP', pais: '🇵🇹', posicao: 'DC', raridade: 'lendaria', valor: 40 }, // #4
    { id: 'maxiaraujo', nome: 'Maxi Araújo', clube: 'Sporting CP', pais: '🇺🇾', posicao: 'DE', raridade: 'lendaria', valor: 40 }, // #5
    { id: 'diogocosta', nome: 'Diogo Costa', clube: 'FC Porto', pais: '🇵🇹', posicao: 'GR', raridade: 'lendaria', valor: 40 }, // #6
    { id: 'jakubkiwior', nome: 'Jakub Kiwior', clube: 'FC Porto', pais: '🇵🇱', posicao: 'DC', raridade: 'lendaria', valor: 35 }, // #7
    { id: 'alanvarela', nome: 'Alan Varela', clube: 'FC Porto', pais: '🇦🇷', posicao: 'MDC', raridade: 'lendaria', valor: 32 }, // #8
    { id: 'tomasaraujo', nome: 'Tomás Araújo', clube: 'Benfica', pais: '🇵🇹', posicao: 'DC', raridade: 'lendaria', valor: 30 }, // #9
    { id: 'luissuarez', nome: 'Luís Suárez', clube: 'Sporting CP', pais: '🇪🇸', posicao: 'AV', raridade: 'lendaria', valor: 30 }, // #10
    { id: 'rodrigozalazar', nome: 'Rodrigo Zalazar', clube: 'Sporting CP', pais: '🇺🇾', posicao: 'MC', raridade: 'lendaria', valor: 30 }, // #11
    { id: 'gabriveiga', nome: 'Gabri Veiga', clube: 'FC Porto', pais: '🇪🇸', posicao: 'MC', raridade: 'lendaria', valor: 30 }, // #12
    { id: 'vangelispavlidis', nome: 'Vangelis Pavlidis', clube: 'Benfica', pais: '🇬🇷', posicao: 'AV', raridade: 'lendaria', valor: 28 }, // #13
    { id: 'zenodebast', nome: 'Zeno Debast', clube: 'Sporting CP', pais: '🇧🇪', posicao: 'DC', raridade: 'lendaria', valor: 28 }, // #14
    { id: 'anatoliytrubin', nome: 'Anatoliy Trubin', clube: 'Benfica', pais: '🇺🇦', posicao: 'GR', raridade: 'lendaria', valor: 25 }, // #15
    { id: 'georgiysudakov', nome: 'Georgiy Sudakov', clube: 'Benfica', pais: '🇺🇦', posicao: 'MC', raridade: 'lendaria', valor: 25 }, // #16
    { id: 'richardrios', nome: 'Richard Ríos', clube: 'Benfica', pais: '🇨🇴', posicao: 'MDC', raridade: 'lendaria', valor: 25 }, // #17
    { id: 'pedrogoncalves', nome: 'Pedro Gonçalves', clube: 'Sporting CP', pais: '🇵🇹', posicao: 'EXT', raridade: 'lendaria', valor: 25 }, // #18
    { id: 'genycatamo', nome: 'Geny Catamo', clube: 'Sporting CP', pais: '🇲🇿', posicao: 'EXT', raridade: 'lendaria', valor: 25 }, // #19
    { id: 'oskarpietuszewski', nome: 'Oskar Pietuszewski', clube: 'FC Porto', pais: '🇵🇱', posicao: 'EXT', raridade: 'lendaria', valor: 25 }, // #20
    { id: 'williamgomes', nome: 'William Gomes', clube: 'FC Porto', pais: '🇧🇷', posicao: 'EXT', raridade: 'lendaria', valor: 25 }, // #21
    { id: 'gianlucaprestianni', nome: 'Gianluca Prestianni', clube: 'Benfica', pais: '🇦🇷', posicao: 'EXT', raridade: 'lendaria', valor: 20 }, // #22
    { id: 'sergialtimira', nome: 'Sergi Altimira', clube: 'Sporting CP', pais: '🇪🇸', posicao: 'MDC', raridade: 'lendaria', valor: 20 }, // #23
    { id: 'issadoumbia', nome: 'Issa Doumbia', clube: 'Sporting CP', pais: '🇨🇮', posicao: 'MC', raridade: 'lendaria', valor: 20 }, // #24
    { id: 'borjasainz', nome: 'Borja Sainz', clube: 'FC Porto', pais: '🇪🇸', posicao: 'EXT', raridade: 'lendaria', valor: 20 }, // #25
    // --- Épica (Top 26-50) ---
    { id: 'leandrobarreiro', nome: 'Leandro Barreiro', clube: 'Benfica', pais: '🇱🇺', posicao: 'MC', raridade: 'epica', valor: 18 }, // #26
    { id: 'alessandrocircati', nome: 'Alessandro Circati', clube: 'Benfica', pais: '🇦🇺', posicao: 'DC', raridade: 'epica', valor: 18 }, // #27
    { id: 'albertocosta', nome: 'Alberto Costa', clube: 'FC Porto', pais: '🇵🇹', posicao: 'DD', raridade: 'epica', valor: 18 }, // #28
    { id: 'jakubkaminski', nome: 'Jakub Kamiński', clube: 'Benfica', pais: '🇵🇱', posicao: 'EXT', raridade: 'epica', valor: 17 }, // #29
    { id: 'eduardoquaresma', nome: 'Eduardo Quaresma', clube: 'Sporting CP', pais: '🇵🇹', posicao: 'DC', raridade: 'epica', valor: 17 }, // #30
    { id: 'pepe', nome: 'Pepê', clube: 'FC Porto', pais: '🇧🇷', posicao: 'EXT', raridade: 'epica', valor: 17 }, // #31
    { id: 'fotisioannidis', nome: 'Fotis Ioannidis', clube: 'Sporting CP', pais: '🇬🇷', posicao: 'AV', raridade: 'epica', valor: 16 }, // #32
    { id: 'fredrikaursnes', nome: 'Fredrik Aursnes', clube: 'Benfica', pais: '🇳🇴', posicao: 'MC', raridade: 'epica', valor: 15 }, // #33
    { id: 'dodilukebakio', nome: 'Dodi Lukébakio', clube: 'Benfica', pais: '🇨🇩', posicao: 'EXT', raridade: 'epica', valor: 15 }, // #34
    { id: 'jhonduran', nome: 'Jhon Durán', clube: 'Benfica', pais: '🇨🇴', posicao: 'AV', raridade: 'epica', valor: 15 }, // #35
    { id: 'pauvictor', nome: 'Pau Víctor', clube: 'Sp. Braga', pais: '🇪🇸', posicao: 'AV', raridade: 'epica', valor: 15 }, // #36
    { id: 'ivanfresneda', nome: 'Iván Fresneda', clube: 'Sporting CP', pais: '🇪🇸', posicao: 'DD', raridade: 'epica', valor: 15 }, // #37
    { id: 'joaosimoes', nome: 'João Simões', clube: 'Sporting CP', pais: '🇵🇹', posicao: 'MC', raridade: 'epica', valor: 15 }, // #38
    { id: 'samueldahl', nome: 'Samuel Dahl', clube: 'Benfica', pais: '🇸🇪', posicao: 'DE', raridade: 'epica', valor: 13 }, // #39
    { id: 'enzobarrenechea', nome: 'Enzo Barrenechea', clube: 'Benfica', pais: '🇦🇷', posicao: 'MDC', raridade: 'epica', valor: 12 }, // #40
    { id: 'danielbraganca', nome: 'Daniel Bragança', clube: 'Sporting CP', pais: '🇵🇹', posicao: 'MC', raridade: 'epica', valor: 12 }, // #41
    { id: 'luisguilherme', nome: 'Luís Guilherme', clube: 'Sporting CP', pais: '🇧🇷', posicao: 'EXT', raridade: 'epica', valor: 12 }, // #42
    { id: 'ibrahimaba', nome: 'Ibrahima Ba', clube: 'Sporting CP', pais: '🇬🇼', posicao: 'DC', raridade: 'epica', valor: 12 }, // #43
    { id: 'yanisbegraoui', nome: 'Yanis Begraoui', clube: 'Estoril Praia', pais: '🇫🇷', posicao: 'AV', raridade: 'epica', valor: 12 }, // #44
    { id: 'nehuenperez', nome: 'Nehuén Pérez', clube: 'FC Porto', pais: '🇦🇷', posicao: 'DC', raridade: 'epica', valor: 12 }, // #45
    { id: 'martimfernandes', nome: 'Martim Fernandes', clube: 'FC Porto', pais: '🇵🇹', posicao: 'DD', raridade: 'epica', valor: 12 }, // #46
    { id: 'janbednarek', nome: 'Jan Bednarek', clube: 'FC Porto', pais: '🇵🇱', posicao: 'DC', raridade: 'epica', valor: 11 }, // #47
    { id: 'mathiasdeamorim', nome: 'Mathias de Amorim', clube: 'Casa Pia', pais: '🇫🇷', posicao: 'MC', raridade: 'epica', valor: 10 }, // #48
    { id: 'gustaflagerbielke', nome: 'Gustaf Lagerbielke', clube: 'Sp. Braga', pais: '🇸🇪', posicao: 'DC', raridade: 'epica', valor: 10 }, // #49
    { id: 'victorgomez', nome: 'Víctor Gómez', clube: 'Sp. Braga', pais: '🇪🇸', posicao: 'DD', raridade: 'epica', valor: 10 }, // #50
    // --- Rara (Top 51-75) ---
    { id: 'nestoryirankunda', nome: 'Nestory Irankunda', clube: 'Sporting CP', pais: '🇦🇺', posicao: 'EXT', raridade: 'rara', valor: 10 }, // #51
    { id: 'mariodorgeles', nome: 'Mario Dorgeles', clube: 'Sp. Braga', pais: '🇨🇮', posicao: 'EXT', raridade: 'rara', valor: 10 }, // #52
    { id: 'ricardohorta', nome: 'Ricardo Horta', clube: 'Sp. Braga', pais: '🇵🇹', posicao: 'EXT', raridade: 'rara', valor: 9 }, // #53
    { id: 'brightarreymbi', nome: 'Bright Arrey-Mbi', clube: 'Sp. Braga', pais: '🇩🇪', posicao: 'DC', raridade: 'rara', valor: 9 }, // #54
    { id: 'gorby', nome: 'Gorby', clube: 'Sp. Braga', pais: '🇫🇷', posicao: 'MC', raridade: 'rara', valor: 9 }, // #55
    { id: 'franciscomoura', nome: 'Francisco Moura', clube: 'FC Porto', pais: '🇵🇹', posicao: 'DE', raridade: 'rara', valor: 9 }, // #56
    { id: 'georgiosvagiannidis', nome: 'Georgios Vagiannidis', clube: 'Sporting CP', pais: '🇬🇷', posicao: 'DD', raridade: 'rara', valor: 8 }, // #57
    { id: 'demiregetiknaz', nome: 'Demir Ege Tıknaz', clube: 'Sp. Braga', pais: '🇹🇷', posicao: 'MDC', raridade: 'rara', valor: 8 }, // #58
    { id: 'oumarcamara', nome: 'Oumar Camara', clube: 'Vitória SC', pais: '🇫🇷', posicao: 'EXT', raridade: 'rara', valor: 8 }, // #59
    { id: 'pablorosario', nome: 'Pablo Rosario', clube: 'FC Porto', pais: '🇳🇱', posicao: 'MDC', raridade: 'rara', valor: 8 }, // #60
    { id: 'alexanderbah', nome: 'Alexander Bah', clube: 'Benfica', pais: '🇩🇰', posicao: 'DD', raridade: 'rara', valor: 7 }, // #61
    { id: 'manusilva', nome: 'Manu Silva', clube: 'Benfica', pais: '🇵🇹', posicao: 'MDC', raridade: 'rara', valor: 7 }, // #62
    { id: 'gabrielsilva', nome: 'Gabriel Silva', clube: 'Sp. Braga', pais: '🇧🇷', posicao: 'EXT', raridade: 'rara', valor: 7 }, // #63
    { id: 'ruisilva', nome: 'Rui Silva', clube: 'Sporting CP', pais: '🇵🇹', posicao: 'GR', raridade: 'rara', valor: 7 }, // #64
    { id: 'bastienmeupiyou', nome: 'Bastien Meupiyou', clube: 'Gil Vicente', pais: '🇫🇷', posicao: 'DC', raridade: 'rara', valor: 7 }, // #65
    { id: 'silasandersen', nome: 'Silas Andersen', clube: 'Sporting CP', pais: '🇩🇰', posicao: 'MDC', raridade: 'rara', valor: 7 }, // #66
    { id: 'gabrimartinez', nome: 'Gabri Martínez', clube: 'Sp. Braga', pais: '🇪🇸', posicao: 'EXT', raridade: 'rara', valor: 7 }, // #67
    { id: 'jovanmilosevic', nome: 'Jovan Milosevic', clube: 'Rio Ave', pais: '🇷🇸', posicao: 'AV', raridade: 'rara', valor: 7 }, // #68
    { id: 'inbeomhwang', nome: 'In-beom Hwang', clube: 'FC Porto', pais: '🇰🇷', posicao: 'MDC', raridade: 'rara', valor: 7 }, // #69
    { id: 'sikouniakate', nome: 'Sikou Niakaté', clube: 'Sp. Braga', pais: '🇫🇷', posicao: 'DC', raridade: 'rara', valor: 6 }, // #70
    { id: 'diogotravassos', nome: 'Diogo Travassos', clube: 'Sp. Braga', pais: '🇵🇹', posicao: 'DD', raridade: 'rara', valor: 6 }, // #71
    { id: 'leonardolelo', nome: 'Leonardo Lelo', clube: 'Sp. Braga', pais: '🇵🇹', posicao: 'DE', raridade: 'rara', valor: 6 }, // #72
    { id: 'stepheneustaquio', nome: 'Stephen Eustaquio', clube: 'FC Porto', pais: '🇨🇦', posicao: 'MC', raridade: 'rara', valor: 6 }, // #73
    { id: 'cezarymiszta', nome: 'Cezary Miszta', clube: 'Moreirense', pais: '🇵🇱', posicao: 'GR', raridade: 'rara', valor: 5 }, // #74
    { id: 'bernardo', nome: 'Bernardo', clube: 'Sp. Braga', pais: '🇧🇷', posicao: 'GR', raridade: 'rara', valor: 5 }, // #75
    // --- Comum (Top 76-100) ---
    { id: 'diegorodrigues', nome: 'Diego Rodrigues', clube: 'Famalicão', pais: '🇨🇲', posicao: 'MC', raridade: 'comum', valor: 5 }, // #76
    { id: 'denizgul', nome: 'Deniz Gül', clube: 'FC Porto', pais: '🇸🇪', posicao: 'AV', raridade: 'comum', valor: 5 }, // #77
    { id: 'rafikguitane', nome: 'Rafik Guitane', clube: 'Rio Ave', pais: '🇫🇷', posicao: 'EXT', raridade: 'comum', valor: 5 }, // #78
    { id: 'taichifukui', nome: 'Taichi Fukui', clube: 'Casa Pia', pais: '🇯🇵', posicao: 'MC', raridade: 'comum', valor: 5 }, // #79
    { id: 'sorriso', nome: 'Sorriso', clube: 'Vitória SC', pais: '🇧🇷', posicao: 'EXT', raridade: 'comum', valor: 5 }, // #80
    { id: 'leorealpe', nome: 'Léo Realpe', clube: 'Vitória SC', pais: '🇨🇴', posicao: 'DC', raridade: 'comum', valor: 5 }, // #81
    { id: 'rodrigopinheiro', nome: 'Rodrigo Pinheiro', clube: 'Vitória SC', pais: '🇵🇹', posicao: 'DD', raridade: 'comum', valor: 5 }, // #82
    { id: 'anisiocabral', nome: 'Anísio Cabral', clube: 'Benfica', pais: '🇨🇻', posicao: 'AV', raridade: 'comum', valor: 5 }, // #83
    { id: 'danielbanjaqui', nome: 'Daniel Banjaqui', clube: 'Benfica', pais: '🇨🇻', posicao: 'DD', raridade: 'comum', valor: 5 }, // #84
    { id: 'tomvandelooi', nome: 'Tom van de Looi', clube: 'Vitória SC', pais: '🇳🇱', posicao: 'MDC', raridade: 'comum', valor: 5 }, // #85
    { id: 'lazarcarevic', nome: 'Lazar Carević', clube: 'Vitória SC', pais: '🇵🇹', posicao: 'GR', raridade: 'comum', valor: 5 }, // #86
    { id: 'chissumba', nome: 'Chissumba', clube: 'Estoril Praia', pais: '🇦🇴', posicao: 'DE', raridade: 'comum', valor: 5 }, // #87
    { id: 'chiquinho', nome: 'Chiquinho', clube: 'Estoril Praia', pais: '🇵🇹', posicao: 'EXT', raridade: 'comum', valor: 5 }, // #88
    { id: 'joaocarvalho', nome: 'João Carvalho', clube: 'Farense', pais: '🇵🇹', posicao: 'MC', raridade: 'comum', valor: 5 }, // #89
    { id: 'jordanholsgrove', nome: 'Jordan Holsgrove', clube: 'Farense', pais: '🇬🇧', posicao: 'MDC', raridade: 'comum', valor: 5 }, // #90
    { id: 'andreasntoi', nome: 'Andreas Ntoi', clube: 'Farense', pais: '🇬🇷', posicao: 'DC', raridade: 'comum', valor: 5 }, // #91
    { id: 'vitorcarvalho', nome: 'Vítor Carvalho', clube: 'Sp. Braga', pais: '🇧🇷', posicao: 'DC', raridade: 'comum', valor: 4 }, // #92
    { id: 'frannavarro', nome: 'Fran Navarro', clube: 'Sp. Braga', pais: '🇪🇸', posicao: 'AV', raridade: 'comum', valor: 4 }, // #93
    { id: 'jonaswind', nome: 'Jonas Wind', clube: 'Sp. Braga', pais: '🇩🇰', posicao: 'AV', raridade: 'comum', valor: 4 }, // #94
    { id: 'benimukendi', nome: 'Beni Mukendi', clube: 'Vitória SC', pais: '🇦🇴', posicao: 'MC', raridade: 'comum', valor: 4 }, // #95
    { id: 'goncalonogueira', nome: 'Gonçalo Nogueira', clube: 'Vitória SC', pais: '🇵🇹', posicao: 'MC', raridade: 'comum', valor: 4 }, // #96
    { id: 'gustavosilva', nome: 'Gustavo Silva', clube: 'Vitória SC', pais: '🇧🇷', posicao: 'EXT', raridade: 'comum', valor: 4 }, // #97
    { id: 'figueiredo', nome: 'Figueiredo', clube: 'Nacional', pais: '🇧🇷', posicao: 'EXT', raridade: 'comum', valor: 4 }, // #98
    { id: 'clementlenglet', nome: 'Clément Lenglet', clube: 'Benfica', pais: '🇫🇷', posicao: 'DC', raridade: 'comum', valor: 4 }, // #99
    { id: 'marvinelimbi', nome: 'Marvin Elimbi', clube: 'Gil Vicente', pais: '🇫🇷', posicao: 'DC', raridade: 'comum', valor: 4 }, // #100
  ];

  function loadDB() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn('[ESTVData] erro a ler DB, a criar nova', e);
    }
    return { users: {}, jornadas: [] };
  }

  function saveDB(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------------------------------------------------------------
  // Utilizadores / pontos
  // ---------------------------------------------------------------
  function ensureUser(login, displayName, avatar) {
    if (!login) return null;
    const db = loadDB();
    login = login.toLowerCase();
    if (!db.users[login]) {
      db.users[login] = { login, displayName: displayName || login, avatar: avatar || '', points: 0 };
    } else {
      db.users[login].displayName = displayName || db.users[login].displayName;
      db.users[login].avatar = avatar || db.users[login].avatar;
    }
    saveDB(db);
    return db.users[login];
  }

  function getUser(login) {
    if (!login) return null;
    const db = loadDB();
    return db.users[login.toLowerCase()] || null;
  }

  function getPoints(login) {
    const u = getUser(login);
    return u ? u.points : 0;
  }

  function addPoints(login, delta) {
    if (!login) return;
    const db = loadDB();
    login = login.toLowerCase();
    if (!db.users[login]) db.users[login] = { login, displayName: login, avatar: '', points: 0 };
    db.users[login].points = Math.max(0, Math.round((db.users[login].points || 0) + delta));
    saveDB(db);
    syncPointsDeltaRemote(login, delta);
    return db.users[login].points;
  }

  // Substitui o saldo local por um valor absoluto (usado depois de ler o
  // saldo real do backend — nunca dispara sincronização, só atualiza o
  // cache local para a interface mostrar o valor certo).
  function setPointsAbsolute(login, value) {
    if (!login) return;
    const db = loadDB();
    login = login.toLowerCase();
    if (!db.users[login]) db.users[login] = { login, displayName: login, avatar: '', points: 0 };
    db.users[login].points = Math.max(0, Math.round(value));
    saveDB(db);
    return db.users[login].points;
  }

  // ---------------------------------------------------------------
  // Sincronização com o backend real (login real + StreamElements)
  // ---------------------------------------------------------------
  // Só entra em ação quando ESTV_CONFIG.REMOTE_POINTS = true (ver
  // estv-config.js) — enquanto isso, o site continua 100% em modo
  // local, exatamente como antes desta funcionalidade existir.
  function isRemoteEnabled() {
    return !!(
      typeof ESTV_CONFIG !== 'undefined' &&
      ESTV_CONFIG.REMOTE_POINTS &&
      ESTV_CONFIG.API_BASE_URL
    );
  }

  // Envia a variação de pontos para o backend (que por sua vez ajusta o
  // saldo real no StreamElements). "Fire-and-forget": não bloqueia nem
  // atrasa a interface — se falhar (sem rede, sessão expirada, etc.), o
  // valor local já foi atualizado na mesma, e o próximo refresh de
  // pontos corrige a diferença.
  //
  // Usa sempre o token Twitch guardado no browser de quem está a fazer
  // o pedido — por isso só serve para ações sobre o PRÓPRIO saldo
  // (apostar, abrir cartas, bater um penálti). O parâmetro "login" é só
  // para clareza/registo, o backend ignora qualquer utilizador que não
  // seja o dono do token.
  function syncPointsDeltaRemote(login, delta) {
    if (!isRemoteEnabled()) return;
    const token = localStorage.getItem('estv_twitch_token');
    if (!token) return; // sem sessão Twitch real, não há como autenticar o pedido
    fetch(ESTV_CONFIG.API_BASE_URL + '/api/points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ amount: delta }),
      keepalive: true,
    }).catch(() => {});
  }

  // Variante usada só pelo Painel de Controlo (admin) para distribuir
  // pontos a OUTRA pessoa — por exemplo, ao resolver uma jornada de
  // apostas e pagar a vários viewers de uma vez. O backend só honra o
  // "username" aqui se o token pertencer a uma conta admin (ver
  // ADMIN_LOGINS no backend); para qualquer outra pessoa isto teria
  // exatamente o mesmo efeito que syncPointsDeltaRemote (mexe só no
  // próprio saldo do token).
  function syncPointsDeltaRemoteFor(targetLogin, delta) {
    if (!isRemoteEnabled()) return;
    const token = localStorage.getItem('estv_twitch_token');
    if (!token) return;
    fetch(ESTV_CONFIG.API_BASE_URL + '/api/points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ amount: delta, username: targetLogin }),
      keepalive: true,
    }).catch(() => {});
  }

  // Lê o saldo real e atual de alguém diretamente do backend (sem tocar
  // no cache local). Devolve null se o modo remoto estiver desligado ou
  // se o pedido falhar.
  async function fetchRemotePoints(login) {
    if (!isRemoteEnabled() || !login) return null;
    try {
      const res = await fetch(ESTV_CONFIG.API_BASE_URL + '/api/points?username=' + encodeURIComponent(login));
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data.points === 'number' ? data.points : null;
    } catch (e) {
      return null;
    }
  }

  // Ranking real (StreamElements), para a página de Ranking. Devolve
  // null se o modo remoto estiver desligado ou se o pedido falhar — a
  // página deve nesse caso continuar a usar getLeaderboard() local.
  async function fetchRemoteLeaderboard(limit) {
    if (!isRemoteEnabled()) return null;
    try {
      const res = await fetch(ESTV_CONFIG.API_BASE_URL + '/api/points/top?limit=' + encodeURIComponent(limit || 20));
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data.top) ? data.top : null;
    } catch (e) {
      return null;
    }
  }

  function getLeaderboard(limit) {
    const db = loadDB();
    return Object.values(db.users)
      .sort((a, b) => b.points - a.points)
      .slice(0, limit || 20)
      .map((u, idx) => ({ rank: idx + 1, login: u.login, displayName: u.displayName, avatar: u.avatar, points: u.points }));
  }

  function getRank(login) {
    if (!login) return null;
    const board = getLeaderboard(999999);
    const idx = board.findIndex((u) => u.login === login.toLowerCase());
    return idx === -1 ? null : idx + 1;
  }

  function getTotalPointsDistributed() {
    const db = loadDB();
    return Object.values(db.users).reduce((sum, u) => sum + (u.points || 0), 0);
  }

  // ---------------------------------------------------------------
  // Watch-time (pontos por assistir) — SIMULAÇÃO PARA TESTES
  // ---------------------------------------------------------------
  // Em produção isto seria substituído por uma integração real (bot de
  // chat da Twitch, StreamElements Loyalty, ou EventSub) que atribui
  // pontos automaticamente enquanto a pessoa está a assistir à live.
  function awardWatchPoints(login, amount) {
    return addPoints(login, amount);
  }

  // ---------------------------------------------------------------
  // Jornadas / Apostas 1x2
  // ---------------------------------------------------------------
  // Tal como os pontos, isto usa a mesma bandeira REMOTE_POINTS: com
  // ela desligada continua tudo a funcionar só no teu browser (bom para
  // testar sozinho, "Modo de Teste"); com ela ligada (e API_BASE_URL
  // configurado), as jornadas passam a ficar guardadas no backend
  // partilhado (ver estv-api), e é isso que faz os palpites aparecerem
  // e poderem ser feitos por QUALQUER pessoa que visite o site, não só
  // por quem os criou.

  // Ao fim deste tempo desde a criação, uma jornada fecha sozinha, mesmo
  // que ninguém clique em "Fechar Apostas" — em modo remoto, o backend
  // (estv-api) é que aplica esta regra a sério; isto aqui só replica a
  // mesma regra para o "Modo de Teste" local, para os dois se
  // comportarem da mesma forma.
  const PRAZO_APOSTAS_MS = 24 * 60 * 60 * 1000; // 24 horas

  function estaJornadaExpirada(jornada) {
    return Date.now() >= jornada.criadaEm + PRAZO_APOSTAS_MS;
  }

  function comPrazoLocal(jornada) {
    return Object.assign({}, jornada, {
      fechada: jornada.fechada || estaJornadaExpirada(jornada),
      fechaAutomaticamenteEm: jornada.criadaEm + PRAZO_APOSTAS_MS,
    });
  }

  function authHeaders() {
    const token = localStorage.getItem('estv_twitch_token');
    return token ? { Authorization: 'Bearer ' + token } : {};
  }

  async function apiRequest(method, path, body) {
    const res = await fetch(ESTV_CONFIG.API_BASE_URL + path, {
      method: method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      // resposta sem corpo JSON — segue com data = null
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || `O pedido falhou (${res.status}).`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // --- Versões locais (localStorage) — usadas com REMOTE_POINTS=false ---

  function getJornadasLocal() {
    return loadDB()
      .jornadas.sort((a, b) => b.criadaEm - a.criadaEm)
      .map(comPrazoLocal);
  }

  function createJornadaLocal(titulo, jogos) {
    const db = loadDB();
    const jornada = {
      id: uid(),
      titulo: titulo,
      criadaEm: Date.now(),
      fechada: false,
      resolvida: false,
      jogos: jogos.map((j) => ({ id: uid(), casa: j.casa, fora: j.fora, data: j.data || '', resultado: null })),
      palpites: {},
    };
    db.jornadas.push(jornada);
    saveDB(db);
    return comPrazoLocal(jornada);
  }

  function deleteJornadaLocal(id) {
    const db = loadDB();
    db.jornadas = db.jornadas.filter((j) => j.id !== id);
    saveDB(db);
  }

  function setFechadaLocal(id, fechada) {
    const db = loadDB();
    const j = db.jornadas.find((x) => x.id === id);
    if (!j) return;
    // Não deixa reabrir uma jornada cujas 24 horas já passaram.
    if (!fechada && estaJornadaExpirada(j)) {
      throw new Error('Já passaram 24 horas desde a criação desta jornada — não é possível reabrir as apostas.');
    }
    j.fechada = !!fechada;
    saveDB(db);
  }

  function submitPickLocal(jornadaId, login, jogoId, escolha) {
    if (!login || !['1', 'X', '2'].includes(escolha)) return false;
    const db = loadDB();
    const j = db.jornadas.find((x) => x.id === jornadaId);
    if (!j || j.fechada || j.resolvida || estaJornadaExpirada(j)) return false;
    login = login.toLowerCase();
    if (!j.palpites[login]) j.palpites[login] = {};
    j.palpites[login][jogoId] = escolha;
    saveDB(db);
    return true;
  }

  function setResultadoLocal(jornadaId, jogoId, resultado) {
    if (!['1', 'X', '2'].includes(resultado)) return false;
    const db = loadDB();
    const j = db.jornadas.find((x) => x.id === jornadaId);
    if (!j) return false;
    const jogo = j.jogos.find((g) => g.id === jogoId);
    if (!jogo) return false;
    jogo.resultado = resultado;
    saveDB(db);
    return true;
  }

  // Calcula e atribui pontos a todos os utilizadores que palpitaram
  // nesta jornada: +10 por jogo acertado; se acertar TODOS os jogos da
  // jornada, o total dessa jornada é multiplicado por 3.
  function resolveJornadaLocal(jornadaId) {
    const db = loadDB();
    const j = db.jornadas.find((x) => x.id === jornadaId);
    if (!j) return null;
    if (j.jogos.some((g) => !g.resultado)) {
      throw new Error('Todos os jogos precisam de ter um resultado antes de resolver a jornada.');
    }

    const resumo = []; // [{ login, acertos, totalJogos, pontosGanhos }]

    Object.keys(j.palpites).forEach((login) => {
      const picks = j.palpites[login];
      let acertos = 0;
      j.jogos.forEach((g) => {
        if (picks[g.id] && picks[g.id] === g.resultado) acertos++;
      });
      const totalJogos = j.jogos.length;
      let pontosGanhos = acertos * PONTOS_POR_ACERTO;
      const jornadaPerfeita = totalJogos > 0 && acertos === totalJogos;
      if (jornadaPerfeita) pontosGanhos *= MULTIPLICADOR_JORNADA_PERFEITA;

      if (!db.users[login]) db.users[login] = { login, displayName: login, avatar: '', points: 0 };
      db.users[login].points = Math.max(0, Math.round(db.users[login].points + pontosGanhos));
      if (pontosGanhos !== 0) syncPointsDeltaRemoteFor(login, pontosGanhos);

      resumo.push({ login, acertos, totalJogos, pontosGanhos, jornadaPerfeita });
    });

    j.resolvida = true;
    j.fechada = true;
    j.resumo = resumo;
    saveDB(db);
    return resumo;
  }

  // --- API pública — usa o backend partilhado quando o modo remoto
  // está ligado, senão cai automaticamente para as versões locais ---

  // Devolve sempre um array (nunca lança erro) — se o pedido remoto
  // falhar, devolve [] em vez de rebentar a página toda.
  async function getJornadas() {
    if (!isRemoteEnabled()) return getJornadasLocal();
    try {
      const data = await apiRequest('GET', '/api/jornadas');
      const jornadas = data && Array.isArray(data.jornadas) ? data.jornadas : [];
      return jornadas.sort((a, b) => b.criadaEm - a.criadaEm);
    } catch (e) {
      console.error('[ESTVData] falha ao carregar jornadas remotas', e);
      return [];
    }
  }

  // Os palpites de alguém numa jornada — recebe a jornada JÁ CARREGADA
  // (por exemplo, um item devolvido por getJornadas()), não faz nenhum
  // pedido novo à rede.
  function getUserPicks(jornada, login) {
    if (!jornada || !login) return {};
    return (jornada.palpites || {})[login.toLowerCase()] || {};
  }

  async function createJornada(titulo, jogos) {
    if (!isRemoteEnabled()) return createJornadaLocal(titulo, jogos);
    const data = await apiRequest('POST', '/api/jornadas', { titulo: titulo, jogos: jogos });
    return data.jornada;
  }

  async function deleteJornada(id) {
    if (!isRemoteEnabled()) return deleteJornadaLocal(id);
    await apiRequest('DELETE', '/api/jornadas?id=' + encodeURIComponent(id));
  }

  async function setFechada(id, fechada) {
    if (!isRemoteEnabled()) return setFechadaLocal(id, fechada);
    await apiRequest('POST', '/api/jornadas/fechar', { id: id, fechada: fechada });
  }

  // Devolve true/false em vez de lançar erro — os botões de palpite
  // usam isto para saber se devem voltar a desenhar-se com a escolha
  // marcada, sem terem de lidar com try/catch.
  async function submitPick(jornadaId, login, jogoId, escolha) {
    if (!isRemoteEnabled()) return submitPickLocal(jornadaId, login, jogoId, escolha);
    try {
      await apiRequest('POST', '/api/jornadas/palpite', { jornadaId: jornadaId, jogoId: jogoId, escolha: escolha });
      return true;
    } catch (e) {
      console.error('[ESTVData] falha ao registar palpite remoto', e);
      return false;
    }
  }

  async function setResultado(jornadaId, jogoId, resultado) {
    if (!isRemoteEnabled()) return setResultadoLocal(jornadaId, jogoId, resultado);
    await apiRequest('POST', '/api/jornadas/resultado', { jornadaId: jornadaId, jogoId: jogoId, resultado: resultado });
    return true;
  }

  async function resolveJornada(jornadaId) {
    if (!isRemoteEnabled()) return resolveJornadaLocal(jornadaId);
    const data = await apiRequest('POST', '/api/jornadas/resolver', { jornadaId: jornadaId });
    return data.resumo;
  }

  function isJogoLocked(jornada, login) {
    return jornada.fechada || jornada.resolvida;
  }

  // ---------------------------------------------------------------
  // Cartas Colecionáveis
  // ---------------------------------------------------------------
  function getCardCatalog() {
    return CARD_CATALOG.map((c) => Object.assign({}, c));
  }

  function getRarityConfig() {
    return JSON.parse(JSON.stringify(RARITY_CONFIG));
  }

  function getCustoAbrirCarta() {
    return CUSTO_ABRIR_CARTA;
  }

  function getUserCollection(login) {
    if (!login) return {};
    const u = getUser(login);
    return (u && u.cartas) || {};
  }

  function getCollectionStats(login) {
    const collection = getUserCollection(login);
    const unicasObtidas = Object.keys(collection).length;
    const totalCartas = Object.values(collection).reduce((s, n) => s + n, 0);
    return { totalCatalogo: CARD_CATALOG.length, unicasObtidas, totalCartas };
  }

  function sortearCarta() {
    const pesoTotal = Object.values(RARITY_CONFIG).reduce((s, r) => s + r.peso, 0);
    let alvo = Math.random() * pesoTotal;
    let raridadeEscolhida = null;
    for (const key of Object.keys(RARITY_CONFIG)) {
      alvo -= RARITY_CONFIG[key].peso;
      if (alvo <= 0) {
        raridadeEscolhida = key;
        break;
      }
    }
    if (!raridadeEscolhida) raridadeEscolhida = 'comum';

    const candidatas = CARD_CATALOG.filter((c) => c.raridade === raridadeEscolhida);
    const pool = candidatas.length ? candidatas : CARD_CATALOG;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Gasta CUSTO_ABRIR_CARTA pontos e atribui uma carta aleatória
  // (com peso por raridade) à coleção do utilizador.
  function openPack(login) {
    if (!login) return { sucesso: false, erro: 'É preciso ter sessão iniciada.' };
    const db = loadDB();
    login = login.toLowerCase();
    const user = db.users[login];
    if (!user) return { sucesso: false, erro: 'Utilizador não encontrado.' };
    if ((user.points || 0) < CUSTO_ABRIR_CARTA) {
      return { sucesso: false, erro: 'Pontos insuficientes para abrir uma carta.' };
    }

    const carta = sortearCarta();
    if (!user.cartas) user.cartas = {};
    const novaCarta = !user.cartas[carta.id];
    user.cartas[carta.id] = (user.cartas[carta.id] || 0) + 1;
    user.points = Math.max(0, Math.round(user.points - CUSTO_ABRIR_CARTA));
    syncPointsDeltaRemote(login, -CUSTO_ABRIR_CARTA);
    saveDB(db);

    return {
      sucesso: true,
      carta: carta,
      novaCarta: novaCarta,
      quantidade: user.cartas[carta.id],
      pontosRestantes: user.points,
    };
  }

  // ---------------------------------------------------------------
  // Jogo de Penáltis — aposta fictícia de pontos (10 a 20) por
  // marcação. Acerta o golo e ganha o dobro da aposta (ex: aposta 20,
  // ganha 40); falha e perde a aposta. A cor da camisola é só estética
  // (escolha do jogador que vai bater), não afeta a probabilidade.
  // ---------------------------------------------------------------
  const PENALTI_APOSTA_MIN = 10;
  const PENALTI_APOSTA_MAX = 20;
  const PENALTI_LIMITE_POR_HORA = 10;
  const PENALTI_PROBABILIDADE_GOLO = 0.5;
  const PENALTI_JANELA_MS = 60 * 60 * 1000; // 1 hora

  function getPenaltiConfig() {
    return {
      apostaMin: PENALTI_APOSTA_MIN,
      apostaMax: PENALTI_APOSTA_MAX,
      limitePorHora: PENALTI_LIMITE_POR_HORA,
    };
  }

  // Remove marcações desta janela de tempo já fora da última hora e
  // devolve as que ainda contam, para saber quantas jogadas restam.
  function jogadasRecentes(user, agora) {
    const historico = Array.isArray(user.penaltisTimestamps) ? user.penaltisTimestamps : [];
    return historico.filter((t) => agora - t < PENALTI_JANELA_MS);
  }

  // Quantos penáltis já jogados na última hora e quando liberta a próxima vaga.
  function getPenaltiStatus(login) {
    const u = getUser(login);
    const agora = Date.now();
    if (!u) {
      return { jogadasNaHora: 0, restantes: PENALTI_LIMITE_POR_HORA, proximaEmMs: 0 };
    }
    const recentes = jogadasRecentes(u, agora).sort((a, b) => a - b);
    const restantes = Math.max(0, PENALTI_LIMITE_POR_HORA - recentes.length);
    const proximaEmMs = restantes > 0 ? 0 : Math.max(0, PENALTI_JANELA_MS - (agora - recentes[0]));
    return { jogadasNaHora: recentes.length, restantes, proximaEmMs };
  }

  // Bate o penálti: valida aposta e limite horário, sorteia o resultado
  // e atualiza os pontos. corCamisola é só guardado para a animação.
  function chutarPenalti(login, aposta, corCamisola) {
    if (!login) return { sucesso: false, erro: 'É preciso ter sessão iniciada.' };
    aposta = Math.round(Number(aposta));
    if (!Number.isFinite(aposta) || aposta < PENALTI_APOSTA_MIN || aposta > PENALTI_APOSTA_MAX) {
      return { sucesso: false, erro: `A aposta tem de ser entre ${PENALTI_APOSTA_MIN} e ${PENALTI_APOSTA_MAX} pontos.` };
    }

    const db = loadDB();
    login = login.toLowerCase();
    const user = db.users[login];
    if (!user) return { sucesso: false, erro: 'Utilizador não encontrado.' };
    if ((user.points || 0) < aposta) {
      return { sucesso: false, erro: 'Pontos insuficientes para essa aposta.' };
    }

    const agora = Date.now();
    const recentes = jogadasRecentes(user, agora);
    if (recentes.length >= PENALTI_LIMITE_POR_HORA) {
      return { sucesso: false, erro: `Limite de ${PENALTI_LIMITE_POR_HORA} penáltis por hora atingido. Tenta novamente daqui a pouco.` };
    }

    const golo = Math.random() < PENALTI_PROBABILIDADE_GOLO;
    const delta = golo ? aposta : -aposta;
    user.points = Math.max(0, Math.round(user.points + delta));
    syncPointsDeltaRemote(login, delta);
    recentes.push(agora);
    user.penaltisTimestamps = recentes;
    saveDB(db);

    return {
      sucesso: true,
      golo: golo,
      aposta: aposta,
      corCamisola: corCamisola,
      pontosRestantes: user.points,
      statusPenaltis: getPenaltiStatus(login),
    };
  }

  return {
    PONTOS_POR_ACERTO,
    MULTIPLICADOR_JORNADA_PERFEITA,
    ensureUser,
    getUser,
    getPoints,
    addPoints,
    setPointsAbsolute,
    isRemoteEnabled,
    fetchRemotePoints,
    fetchRemoteLeaderboard,
    getLeaderboard,
    getRank,
    getTotalPointsDistributed,
    awardWatchPoints,
    getJornadas,
    createJornada,
    deleteJornada,
    setFechada,
    submitPick,
    getUserPicks,
    setResultado,
    resolveJornada,
    getCardCatalog,
    getRarityConfig,
    getCustoAbrirCarta,
    getUserCollection,
    getCollectionStats,
    openPack,
    getPenaltiConfig,
    getPenaltiStatus,
    chutarPenalti,
  };
})();
