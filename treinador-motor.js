// ===================================================================
// ESTV Treinador — motor do jogo (tipo Elifoot / Brasfoot)
// ===================================================================
// O MESMO ficheiro corre no browser (modo Carreira) e no servidor
// (Liga ESTV e Desafios). Por isso não mexe em DOM nem em rede.
// Uma cópia vive em estv-api/lib/treinador/motor.js — se mudares
// aqui, copia para lá também (os testes da API comparam os dois).
//
// Peças principais:
//   criarMundo(semente)          -> 40 clubes (nomes alterados), 4 divisões
//   prepararJornada(mundo)       -> jogos da jornada, prontos a correr
//   passo(mundo, jogo, rng)      -> simula 1 minuto de um jogo
//   concluirJornada(mundo, jogos)-> tabelas, finanças, evolução, mercado,
//                                   IA, despedimentos e fim de época
//   jogarJornada(mundo)          -> as três coisas de seguida (servidor)
//   jogoAmigavel(a, b, semente)  -> um jogo entre duas equipas soltas
// ===================================================================
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.TreinadorMotor = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSAO = 2;

  // ---------------------------------------------------------------
  // Aleatório com semente (mulberry32): o estado é um número, guarda-se
  // no mundo e assim um jogo gravado a meio continua igual.
  // ---------------------------------------------------------------
  function criarRng(estado) {
    let s = estado >>> 0;
    const r = function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      r,
      int: (a, b) => a + Math.floor(r() * (b - a + 1)),
      pick: (arr) => arr[Math.floor(r() * arr.length)],
      chance: (p) => r() < p,
      normal: (m, d) => {
        const u = Math.max(1e-9, r());
        const v = r();
        return m + d * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      },
      peso: (itens, pesos) => {
        let tot = 0;
        for (const p of pesos) tot += p;
        let x = r() * tot;
        for (let i = 0; i < itens.length; i++) {
          x -= pesos[i];
          if (x <= 0) return itens[i];
        }
        return itens[itens.length - 1];
      },
      estado: () => s,
    };
  }
  function rngDoMundo(m) {
    const rng = criarRng(m.s);
    return {
      rng,
      guardar: () => {
        m.s = rng.estado();
      },
    };
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ---------------------------------------------------------------
  // Clubes (nomes alterados, como o Elifoot faz) e níveis
  // [nome, curto, cor1, cor2, lugares, nível de força]
  // ---------------------------------------------------------------
  const CLUBES = [
    // 1.ª divisão
    ['SL Benfiqa', 'BEN', '#e3002b', '#ffffff', 64000, 76],
    ['FC Portu', 'POR', '#0046ad', '#ffffff', 50000, 76],
    ['Esporting CL', 'SCP', '#008a4c', '#ffffff', 50000, 75],
    ['SC Bragga', 'BRA', '#d6001c', '#ffffff', 30000, 69],
    ['Vitórya SC', 'VSC', '#ffffff', '#111111', 30000, 65],
    ['Famalicam', 'FAM', '#1d4f9c', '#ffffff', 5300, 62],
    ['Gil Vicentte', 'GIL', '#c8102e', '#1d4f9c', 12000, 61],
    ['Rio Avve', 'RAV', '#00843d', '#ffffff', 9000, 60],
    ['Moreirensse', 'MOR', '#00843d', '#ffffff', 6000, 59],
    ['Estorill Praya', 'EST', '#ffd100', '#1d4f9c', 8000, 59],
    // 2.ª divisão
    ['Casa Pya', 'CPI', '#111111', '#ffffff', 6000, 56],
    ['Santa Klara', 'STC', '#d6001c', '#ffffff', 12500, 56],
    ['Arouka', 'ARO', '#ffd100', '#1d4f9c', 5000, 55],
    ['Boavistta', 'BOA', '#111111', '#ffffff', 28000, 55],
    ['CD Nacionall', 'NAC', '#111111', '#ffffff', 5500, 54],
    ['Estrela Amadorra', 'AMA', '#d6001c', '#00843d', 9000, 54],
    ['AVS Futebool', 'AVS', '#c8102e', '#ffffff', 7000, 53],
    ['Tondella', 'TON', '#00843d', '#ffd100', 5000, 52],
    ['Alvercka', 'ALV', '#d6001c', '#ffffff', 7000, 52],
    ['Os Belenensses', 'BEL', '#1d63c4', '#ffffff', 19000, 51],
    // 3.ª divisão
    ['Académyca', 'ACA', '#111111', '#ffffff', 30000, 48],
    ['Marítymo', 'MAR', '#00843d', '#d6001c', 10000, 48],
    ['Leixõens', 'LEI', '#d6001c', '#ffffff', 9000, 47],
    ['Chavess', 'CHA', '#1d4f9c', '#ffffff', 8000, 47],
    ['Portimonensse', 'PTM', '#111111', '#ffffff', 9000, 46],
    ['Vizzela', 'VIZ', '#1d63c4', '#ffffff', 6000, 46],
    ['Penafyel', 'PEN', '#d6001c', '#111111', 5000, 45],
    ['Feirensse', 'FEI', '#1d4f9c', '#ffffff', 5000, 45],
    ['UD Oliveirensse', 'OLI', '#1d4f9c', '#111111', 4000, 44],
    ['Torrensse', 'TOR', '#1d4f9c', '#ffffff', 4000, 44],
    // 4.ª divisão
    ['Farensse', 'FAR', '#111111', '#ffffff', 7000, 41],
    ['União de Leirya', 'ULE', '#1d4f9c', '#ffffff', 23000, 41],
    ['Beira-Marr', 'BMA', '#ffd100', '#111111', 30000, 40],
    ['Olhanensse', 'OLH', '#d6001c', '#111111', 5000, 40],
    ['Varzym', 'VAR', '#111111', '#ffffff', 7000, 39],
    ['Trofensse', 'TRO', '#1d4f9c', '#ffffff', 5000, 39],
    ['Lusitânya Lourosa', 'LUS', '#ffd100', '#d6001c', 3500, 38],
    ['Esporting Covylhã', 'COV', '#00843d', '#ffffff', 3000, 37],
    ['Amorra FC', 'AMO', '#1d4f9c', '#ffffff', 2500, 37],
    ['Atlétyco CP', 'ATL', '#1d63c4', '#ffd100', 3000, 36],
  ];
  // Espanha, Itália e Inglaterra: 2 divisões de 10 (nomes alterados)
  const CLUBES_ES = [
    ['Real Madrida', 'RMA', '#ffffff', '#febe10', 81000, 82],
    ['FC Barcelonna', 'BAR', '#a50044', '#004d98', 99000, 82],
    ['Atlético Madrill', 'ATM', '#cb3524', '#ffffff', 70000, 79],
    ['Athletic Bilbau', 'ATH', '#ee2523', '#ffffff', 53000, 72],
    ['Real Sociedadd', 'RSO', '#0067b1', '#ffffff', 39000, 71],
    ['Villarreall', 'VIL', '#ffe667', '#005187', 23000, 71],
    ['Real Bétys', 'BET', '#00954c', '#ffffff', 60000, 70],
    ['Sevilha FC', 'SEV', '#ffffff', '#d4001f', 43000, 69],
    ['Valência CF', 'VAL', '#ffffff', '#ee3524', 49000, 67],
    ['Celtta Vigo', 'CEL', '#8ac3ee', '#ffffff', 29000, 66],
    ['Gyrona FC', 'GIR', '#cd2534', '#ffffff', 14000, 62],
    ['Osassuna', 'OSA', '#d91a21', '#0a346f', 23000, 61],
    ['Getaffe', 'GET', '#005999', '#ffffff', 17000, 60],
    ['RCD Mallorka', 'MLL', '#e20613', '#111111', 23000, 60],
    ['Rayo Vallecanno', 'RAY', '#ffffff', '#e53027', 14000, 59],
    ['Espanyoll', 'ESP', '#007fc8', '#ffffff', 40000, 59],
    ['Deportivo Alavéss', 'ALA', '#0d47a1', '#ffffff', 19000, 58],
    ['UD Las Palmass', 'LPA', '#ffe400', '#0055a4', 32000, 57],
    ['CD Leganéss', 'LEG', '#ffffff', '#1e4fa3', 12000, 56],
    ['Real Valladollid', 'VLL', '#5f259f', '#ffffff', 26000, 55],
  ];
  const CLUBES_IT = [
    ['Internazionalle', 'INT', '#0068a8', '#111111', 75000, 82],
    ['Juventuss', 'JUV', '#ffffff', '#111111', 41000, 80],
    ['AC Millan', 'MIL', '#fb090b', '#111111', 75000, 79],
    ['SSC Nápolis', 'NAP', '#12a0d7', '#ffffff', 54000, 79],
    ['Atalantta', 'ATA', '#1e71b8', '#111111', 24000, 76],
    ['AS Romma', 'ROM', '#8e1f2f', '#f0bc42', 70000, 75],
    ['SS Lazzio', 'LAZ', '#87d8f7', '#ffffff', 70000, 74],
    ['Fiorentinna', 'FIO', '#482e92', '#ffffff', 43000, 72],
    ['Bolonha FC', 'BOL', '#a21c26', '#1a2f48', 36000, 71],
    ['Torinno FC', 'TRN', '#8a1e03', '#ffffff', 28000, 67],
    ['Udinesse', 'UDI', '#ffffff', '#111111', 25000, 63],
    ['Génova CFC', 'GEN', '#ad1919', '#1a2f48', 36000, 62],
    ['Comma 1907', 'COM', '#003a70', '#ffffff', 13000, 62],
    ['Cagliarri', 'CAG', '#ac0e1d', '#002350', 16000, 60],
    ['Parmma', 'PAR', '#ffd200', '#1a3c8c', 22000, 59],
    ['US Lecci', 'LEC', '#ffd700', '#d0021b', 31000, 59],
    ['Empolli', 'EMP', '#0057a8', '#ffffff', 16000, 58],
    ['Hellas Veronna', 'VER', '#ffd700', '#00285e', 31000, 58],
    ['Sassuollo', 'SAS', '#00a752', '#111111', 21000, 57],
    ['Sampdorya', 'SAM', '#1b4f9c', '#ffffff', 33000, 56],
  ];
  const CLUBES_EN = [
    ['Manchester Cityy', 'MCI', '#6cabdd', '#ffffff', 53000, 84],
    ['Liverpoool', 'LIV', '#c8102e', '#ffffff', 61000, 83],
    ['Arsenall', 'ARS', '#ef0107', '#ffffff', 60000, 83],
    ['Chelsy FC', 'CHE', '#034694', '#ffffff', 40000, 79],
    ['Manchester Unitedd', 'MUN', '#da291c', '#111111', 74000, 77],
    ['Tottenhamm', 'TOT', '#ffffff', '#132257', 62000, 76],
    ['Newcastel', 'NEW', '#241f20', '#ffffff', 52000, 76],
    ['Aston Villla', 'AVL', '#670e36', '#95bfe5', 42000, 76],
    ['Brightonn', 'BHA', '#0057b8', '#ffffff', 31000, 72],
    ['West Hamm', 'WHU', '#7a263a', '#1bb1e7', 62000, 70],
    ['Crystall Palace', 'CRY', '#1b458f', '#c4122e', 25000, 69],
    ['Nottingham Forrest', 'NFO', '#dd0000', '#ffffff', 30000, 69],
    ['Bornemouth', 'BOU', '#da291c', '#111111', 11000, 69],
    ['Evertonn', 'EVE', '#003399', '#ffffff', 52000, 68],
    ['Fullham', 'FUL', '#ffffff', '#111111', 29000, 68],
    ['Brentforde', 'BRE', '#e30613', '#ffffff', 17000, 67],
    ['Wolverhamptonn', 'WOL', '#fdb913', '#231f20', 31000, 66],
    ['Leeds Unitted', 'LEE', '#ffffff', '#1d428a', 37000, 64],
    ['Burnlei', 'BUR', '#6c1d45', '#99d6ea', 21000, 63],
    ['Sunderlandd', 'SUN', '#eb172b', '#ffffff', 49000, 63],
  ];
  // ec = multiplicador do dinheiro (bilhetes, patrocínios, prémios)
  const PAISES = {
    PT: { nome: 'Portugal', band: '🇵🇹', clubes: CLUBES, ec: 1, divs: ['1.ª Divisão', '2.ª Divisão', '3.ª Divisão', '4.ª Divisão'] },
    ES: { nome: 'Espanha', band: '🇪🇸', clubes: CLUBES_ES, ec: 1.7, divs: ['1.ª Divisão espanhola', '2.ª Divisão espanhola'] },
    IT: { nome: 'Itália', band: '🇮🇹', clubes: CLUBES_IT, ec: 1.6, divs: ['1.ª Divisão italiana', '2.ª Divisão italiana'] },
    EN: { nome: 'Inglaterra', band: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', clubes: CLUBES_EN, ec: 2.6, divs: ['1.ª Divisão inglesa', '2.ª Divisão inglesa'] },
  };
  const NOMES_DIV = PAISES.PT.divs;
  const POR_DIV = 10;
  // nome e economia de uma divisão (índice global em m.divs)
  function infoDiv(m, d) {
    return (m.dinfo && m.dinfo[d]) || { p: 'PT', n: d };
  }
  function nomeDiv(m, d) {
    const i = infoDiv(m, d);
    return (PAISES[i.p] || PAISES.PT).divs[i.n] || 'Divisão';
  }
  function econ(m, d) {
    const i = infoDiv(m, d);
    const base = DIV[Math.min(3, i.n)];
    const k = (PAISES[i.p] || PAISES.PT).ec;
    return {
      publico: base.publico * (k > 1 ? 1.6 : 1),
      bilhete: Math.round(base.bilhete * (k > 1 ? 1 + (k - 1) * 0.6 : 1)),
      patrocinio: Math.round(base.patrocinio * k),
      credito: Math.round(base.credito * k),
      premio: Math.round(base.premio * k),
      dinheiro: Math.round(base.dinheiro * k),
    };
  }
  function divsDoPais(m, pais) {
    return (m.dinfo || []).map((x, d) => ({ d, n: x.n, p: x.p })).filter((x) => x.p === pais).sort((a, b) => a.n - b.n).map((x) => x.d);
  }

  // valores por divisão: público base, bilhete de referência, patrocínio por
  // jornada, limite de empréstimo, prémio de campeão
  const DIV = [
    { publico: 21000, bilhete: 20, patrocinio: 120000, credito: 6000000, premio: 5000000, dinheiro: 7000000 },
    { publico: 8000, bilhete: 12, patrocinio: 70000, credito: 2500000, premio: 2000000, dinheiro: 2500000 },
    { publico: 3500, bilhete: 8, patrocinio: 50000, credito: 1200000, premio: 1000000, dinheiro: 1200000 },
    { publico: 1400, bilhete: 5, patrocinio: 36000, credito: 600000, premio: 500000, dinheiro: 600000 },
  ];
  const PREMIO_TACA = 1500000;
  const PREMIO_ARTILHEIRO = 500000;
  const CUSTO_LUGARES = 350000; // por cada 1.000 lugares
  const MAX_LUGARES = 70000;
  const JURO = 0.012; // por jornada
  const MAX_PLANTEL = 26;
  const MIN_PLANTEL = 16;
  const MAX_SUBS = 3;

  // ---------------------------------------------------------------
  // Nomes dos jogadores (inventados)
  // ---------------------------------------------------------------
  const N = {
    PT: {
      p: 'João Rui Pedro Tiago Diogo Bruno André Rafael Gonçalo Miguel Hugo Nuno Ricardo Paulo Fábio Vítor Luís Tomás Rodrigo Francisco Duarte Martim Simão Gustavo Daniel Filipe Sérgio Hélder Marco Carlos Jorge Fernando Rúben Leonel Renato Henrique Ivo Valter Samuel Leandro Afonso Dinis Lourenço Salvador Vasco Bernardo Telmo Joel Flávio Cristiano'.split(' '),
      a: 'Silva Santos Ferreira Pereira Oliveira Costa Rodrigues Martins Jesus Sousa Fernandes Gonçalves Gomes Lopes Marques Alves Almeida Ribeiro Pinto Carvalho Teixeira Moreira Correia Mendes Nunes Soares Vieira Monteiro Cardoso Rocha Raposo Neves Coelho Cruz Cunha Pires Ramos Reis Simões Antunes Matos Fonseca Machado Araújo Barbosa Tavares Lourenço Castro Figueiredo Azevedo Freitas Abreu Brito Batista Borges Magalhães Moura Pacheco Valente Sequeira Quintela Barros Faria Leite Esteves Carneiro'.split(' '),
    },
    BR: {
      p: 'Thiago Gabriel Lucas Matheus Felipe Vinícius Guilherme Leonardo Caio Igor Wellington Everton Rodrigo Diego Danilo Renan Júnior Wesley Luan Maicon Douglas Anderson Jefferson Robson Willian Kaique Yuri Ramon Breno Talles'.split(' '),
      a: 'Souza Lima Barbosa Ribeiro Carvalho Teixeira Moraes Nascimento Araújo Rocha Dias Andrade Cavalcanti Miranda Freitas Batista Cardoso Medeiros Bezerra Tavares Paixão Vasconcelos'.split(' '),
      alcunha: 'Thiaguinho Paulinho Juninho Neném Dudu Pepeu Tchê Cafu Gabigol Biro Zezinho Fabinho Marquinhos Ronaldão Didi Kaká Léo Pedrinho Toninho Serginho Bruninho Wendel Jairzinho'.split(' '),
    },
    ES: {
      p: 'Pablo Javier Álvaro Sergio Iker Rubén Adrián Hugo Marcos Alberto Raúl Íñigo Unai Dani Borja'.split(' '),
      a: 'García Martínez López Sánchez Romero Navarro Torres Domínguez Gil Vázquez Ramírez Serrano Molina Ortega Delgado Castillo'.split(' '),
    },
    AR: {
      p: 'Facundo Agustín Matías Nicolás Lautaro Franco Gonzalo Joaquín Tomás Ezequiel Maximiliano'.split(' '),
      a: 'Fernández González Rodríguez Benítez Acosta Medina Herrera Aguirre Giménez Sosa Ledesma Paredes'.split(' '),
    },
    CV: {
      p: 'Kevin Jair Garry Stopira Nuno Ryan Willy Dylan Bebé Lisandro'.split(' '),
      a: 'Tavares Semedo Fortes Monteiro Lopes Varela Brito Furtado Andrade Spencer Mendes'.split(' '),
    },
    AO: {
      p: 'Gelson Manucho Mateus Djalma Fredy Ary Show Kialonda Bastos Zito'.split(' '),
      a: 'Dala Quiala Manuel Campos Cabral Kaluyituka Nzola Buta Mabululu'.split(' '),
    },
    FR: {
      p: 'Kylian Théo Lucas Hugo Mathis Enzo Rayan Yanis Adrien Maxime'.split(' '),
      a: 'Dubois Moreau Laurent Lefèvre Girard Bonnet Mercier Fontaine Chevalier Rousseau'.split(' '),
    },
    SN: {
      p: 'Moussa Ibrahima Cheikh Mamadou Ousmane Idrissa Pape Abdou'.split(' '),
      a: 'Diallo Ndiaye Sarr Diop Fall Cissé Gueye Faye Koné Traoré'.split(' '),
    },
    UY: {
      p: 'Sebastián Rodrigo Federico Mathías Diego Bruno Martín Gastón'.split(' '),
      a: 'Cabrera Píriz Olivera Muslera Cáceres Laxalt Bentancur Ugarte'.split(' '),
    },
    RS: {
      p: 'Nikola Marko Luka Stefan Dušan Filip Aleksandar'.split(' '),
      a: 'Petrović Jovanović Nikolić Marković Đorđević Stanković Ilić Pavlović'.split(' '),
    },
  };
  N.IT = {
    p: 'Marco Luca Alessandro Lorenzo Matteo Davide Federico Andrea Riccardo Simone Nicolò Gianluca Stefano Francesco Giorgio Daniele Paolo Fabio Mattia Tommaso'.split(' '),
    a: 'Rossi Russo Ferrari Esposito Bianchi Romano Colombo Ricci Marino Greco Bruno Gallo Conti De Luca Mancini Costa Giordano Rizzo Lombardi Moretti Barbieri Fontana Santoro Mariani Rinaldi Caruso Ferrara Galli Martini Leone'.split(' '),
  };
  N.EN = {
    p: 'Harry Jack Oliver George Charlie Jacob Thomas James Joshua William Callum Mason Kyle Declan Jordan Reece Marcus Phil Ben Luke Aaron Jamie Conor Ollie'.split(' '),
    a: 'Smith Jones Taylor Brown Williams Wilson Johnson Davies Robinson Wright Thompson Evans Walker White Roberts Green Hall Wood Jackson Clarke Hughes Edwards Turner Hill Ward Morris Cooper Barnes Shaw Palmer'.split(' '),
  };
  const NACS = ['PT', 'BR', 'ES', 'AR', 'CV', 'AO', 'FR', 'SN', 'UY', 'RS', 'IT', 'EN'];
  const PESOS_NAC = [70, 11, 3, 3, 3, 3, 2, 2, 2, 1, 1, 1];
  const PESOS_PAIS = {
    PT: PESOS_NAC,
    ES: [3, 6, 62, 6, 1, 1, 5, 3, 3, 2, 3, 3],
    IT: [3, 7, 3, 7, 1, 1, 6, 4, 3, 4, 58, 3],
    EN: [4, 6, 5, 4, 1, 1, 7, 6, 2, 2, 2, 60],
  };

  function gerarNome(rng, nac) {
    const L = N[nac] || N.PT;
    if (nac === 'BR' && L.alcunha && rng.chance(0.4)) return rng.pick(L.alcunha);
    const p = rng.pick(L.p);
    const a = rng.pick(L.a);
    return rng.chance(0.5) ? p + ' ' + a : p.charAt(0) + '. ' + a;
  }

  // ---------------------------------------------------------------
  // Características (Brasfoot) e comportamento (Elifoot)
  // ---------------------------------------------------------------
  const CARACT = {
    fin: 'Finalização', cab: 'Cabeceio', cru: 'Cruzamento', dri: 'Drible', vel: 'Velocidade',
    arm: 'Armação', pas: 'Passe', des: 'Desarme', mar: 'Marcação', res: 'Resistência',
    ref: 'Reflexo', col: 'Colocação', sai: 'Saída do gol', dpe: 'Defesa de penálti',
  };
  const CAR_POS = {
    G: [['ref', 'col', 'sai', 'dpe'], [4, 4, 3, 2]],
    D: [['des', 'mar', 'cab', 'vel', 'cru', 'pas', 'res'], [5, 5, 3, 2, 2, 1, 2]],
    M: [['pas', 'arm', 'des', 'res', 'dri', 'cru', 'fin', 'vel', 'mar'], [5, 4, 3, 3, 3, 2, 2, 2, 2]],
    A: [['fin', 'cab', 'dri', 'vel', 'res', 'arm', 'cru'], [6, 4, 4, 4, 1, 1, 1]],
  };
  const COMPORTAMENTO = ['Sarrafeiro', 'Caceteiro', 'Caneleiro', 'Cavalheiro', 'Cordeirinho', 'Fair Play'];
  const AMARELO_POR_COMP = [0.62, 0.5, 0.4, 0.3, 0.22, 0.12];
  const VERMELHO_POR_COMP = [0.03, 0.02, 0.012, 0.007, 0.004, 0.002];
  const FALTA_POR_COMP = [1.6, 1.35, 1.15, 1, 0.85, 0.65];

  const FORMACOES = {
    '4-4-2': [4, 4, 2], '4-3-3': [4, 3, 3], '4-5-1': [4, 5, 1], '4-2-4': [4, 2, 4],
    '3-5-2': [3, 5, 2], '3-4-3': [3, 4, 3], '3-3-4': [3, 3, 4],
    '5-3-2': [5, 3, 2], '5-4-1': [5, 4, 1], '5-2-3': [5, 2, 3],
  };
  const ESTILOS = { eq: 'Equilibrado', at: 'Ataque total', ca: 'Contra-ataque' };
  const MARCACOES = { n: 'Normal', f: 'Forte', mf: 'Muito forte' };
  const FOCOS = { meio: 'Pelo meio', alas: 'Pelas alas' };

  function posicoesDa(form) {
    const f = FORMACOES[form] || FORMACOES['4-4-2'];
    const out = ['G'];
    for (let i = 0; i < f[0]; i++) out.push('D');
    for (let i = 0; i < f[1]; i++) out.push('M');
    for (let i = 0; i < f[2]; i++) out.push('A');
    return out;
  }

  // ---------------------------------------------------------------
  // Valor de mercado e salário
  // ---------------------------------------------------------------
  function valor(j) {
    const f = Math.max(1, j.f);
    const ageF = j.i <= 21 ? 1.35 : j.i <= 24 ? 1.2 : j.i <= 28 ? 1 : j.i <= 31 ? 0.8 : j.i <= 33 ? 0.55 : 0.35;
    const v = 40 * Math.pow(f, 2.6) * ageF * (j.c ? 1.4 : 1) * (0.85 + j.cp * 0.05);
    return Math.max(5000, Math.round(v / 1000) * 1000);
  }
  function salarioDe(j) {
    return Math.max(300, Math.round((valor(j) * 0.0028) / 100) * 100);
  }

  // ---------------------------------------------------------------
  // Criação de jogadores e do mundo
  // ---------------------------------------------------------------
  function novoJogador(m, rng, pos, nivel, idade, extra) {
    const id = 'j' + m.prox++;
    const nac = rng.peso(NACS, PESOS_PAIS[(extra && extra.pais) || 'PT'] || PESOS_NAC);
    const [lista, pesos] = CAR_POS[pos];
    const ca = [];
    const nCar = rng.chance(0.15) ? 1 : 2;
    while (ca.length < nCar) {
      const k = rng.peso(lista, pesos);
      if (!ca.includes(k)) ca.push(k);
    }
    const craque = (pos === 'A' || pos === 'M') && rng.chance(extra && extra.craque != null ? extra.craque : 0.12);
    let f = rng.normal(nivel, 6.5) + (craque ? 6 : 0);
    if (pos === 'G') f += 1;
    const j = {
      id,
      n: gerarNome(rng, nac),
      p: pos,
      f: Math.round(clamp(f, 1, 97) * 10) / 10,
      i: idade || clamp(Math.round(rng.normal(26, 4.2)), 17, 36),
      nac,
      c: craque ? 1 : 0,
      cp: rng.peso([0, 1, 2, 3, 4, 5], [5, 12, 20, 33, 20, 10]),
      ca,
      cl: null,
      gol: 0, // golos na época
      jg: 0, // jogos na época
      golT: 0, // golos na carreira
      am: 0, // amarelos acumulados
      cas: 0, // jogos de castigo
      les: 0, // jornadas lesionado
    };
    j.sal = salarioDe(j);
    m.jog[id] = j;
    return j;
  }

  function criarMundo(semente, opcoes) {
    const m = {
      v: VERSAO,
      s: (semente >>> 0) || 1,
      prox: 1,
      epoca: 1,
      ano: 2026,
      passo: 0, // índice em m.cal
      clubes: {},
      jog: {},
      paises: [],
      divs: [],
      dinfo: [],
      tab: {},
      fix: [],
      cal: [],
      tacas: {},
      mercado: { leiloes: [], livres: [] },
      noticias: [],
      historia: [],
      ultimos: null,
      treinadores: {},
      opc: Object.assign({ multi: false }, opcoes || {}),
    };
    const { rng, guardar } = rngDoMundo(m);
    const lista = ((opcoes && opcoes.paises) || ['PT']).filter((p) => PAISES[p]);
    if (!lista.length) lista.push('PT');
    m.paises = lista;
    for (const pais of lista) {
      const P0 = PAISES[pais];
      P0.divs.forEach((_, n) => {
        m.divs.push([]);
        m.dinfo.push({ p: pais, n });
      });
    }
    const todos = [];
    for (const pais of lista) PAISES[pais].clubes.forEach((c, idx) => todos.push({ c, pais, n: Math.floor(idx / POR_DIV) }));
    todos.forEach(({ c, pais, n }) => {
      const div = m.dinfo.findIndex((x) => x.p === pais && x.n === n);
      const id = c[1];
      const ec = econ(m, div);
      const cl = {
        id,
        n: c[0],
        c: c[1],
        cor: [c[2], c[3]],
        pais,
        div,
        nivel: c[5],
        lug: pais !== 'PT' ? c[4] : Math.min(c[4], n === 0 ? c[4] : n === 1 ? 15000 : n === 2 ? 8000 : 5000),
        obras: 0,
        bil: ec.bilhete,
        din: Math.round(ec.dinheiro * (c[5] >= 70 ? 2.5 : 1)),
        emp: 0,
        mor: 10,
        pl: [],
        tat: { f: '4-4-2', e: 'eq', m: 'n', foco: 'meio' },
        xi: null,
        hum: null,
        sem: 0, // jogos seguidos sem ganhar
      };
      m.clubes[id] = cl;
      m.divs[div].push(id);
      const plano = [['G', 3], ['D', 8], ['M', 7], ['A', 5]];
      for (const [pos, n] of plano) {
        for (let k = 0; k < n; k++) {
          const j = novoJogador(m, rng, pos, c[5], null, { pais });
          j.cl = id;
          cl.pl.push(j.id);
        }
      }
    });
    for (let k = 0; k < 14; k++) {
      const j = novoJogador(m, rng, rng.peso(['G', 'D', 'M', 'A'], [1, 3, 3, 3]), rng.int(25, 40));
      m.mercado.livres.push(j.id);
    }
    novaEpoca(m, rng);
    guardar();
    return m;
  }

  // ---------------------------------------------------------------
  // Carreiras antigas (versão 1, só Portugal) passam para a versão 2
  // ---------------------------------------------------------------
  function migrar(m) {
    if (!m || m.v === VERSAO) return m;
    if (m.v === 1) {
      m.paises = ['PT'];
      m.dinfo = m.divs.map((_, n) => ({ p: 'PT', n }));
      for (const id in m.clubes) m.clubes[id].pais = 'PT';
      const t = m.taca || { vivos: [], isentos: [], ronda: 0, jogos: [] };
      const feitas = t.ronda || 0;
      let vivos = t.vivos || [];
      let isentos = t.isentos || [];
      if (feitas >= 1 && isentos.length) {
        vivos = vivos.concat(isentos);
        isentos = [];
      }
      m.tacas = { PT: { pais: 'PT', vivos, isentos, pre: true, inicio: 0, feitas, campeao: t.campeao || null, finalista: t.finalista || null, jogos: (t.jogos || []).map((j) => Object.assign({ rn: RONDAS_TACA[j.r] }, j)) } };
      delete m.taca;
      for (const h of m.historia || []) if (!h.tacas) h.tacas = { PT: h.taca || null };
      if (m.ultimos && m.ultimos.jogos) for (const j of m.ultimos.jogos) if (j.tp === 'T') { j.pa = 'PT'; j.rn = RONDAS_TACA[j.r]; }
      m.v = 2;
    }
    return m;
  }

  // ---------------------------------------------------------------
  // Calendário: 18 jornadas de liga (2 voltas) + 6 rondas da Taça
  // ---------------------------------------------------------------
  function calendarioLiga(ids, rng) {
    const t = ids.slice();
    for (let i = t.length - 1; i > 0; i--) {
      const k = Math.floor(rng.r() * (i + 1));
      [t[i], t[k]] = [t[k], t[i]];
    }
    const n = t.length;
    const voltas = [];
    const arr = t.slice();
    for (let r = 0; r < n - 1; r++) {
      const jogos = [];
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i];
        const b = arr[n - 1 - i];
        jogos.push(r % 2 === 0 ? [a, b] : [b, a]);
      }
      voltas.push(jogos);
      arr.splice(1, 0, arr.pop());
    }
    return voltas.concat(voltas.map((js) => js.map(([a, b]) => [b, a])));
  }

  const RONDAS_TACA = ['Pré-eliminatória', '16 avos', 'Oitavos', 'Quartos', 'Meias-finais', 'Final'];
  function nomeRonda(tc) {
    if (tc.pre && tc.feitas === 0) return 'Pré-eliminatória';
    const n = tc.vivos.length;
    return n <= 2 ? 'Final' : n <= 4 ? 'Meias-finais' : n <= 8 ? 'Quartos' : n <= 16 ? 'Oitavos' : '16 avos';
  }

  function novaEpoca(m, rng) {
    m.fix = m.divs.map((ids) => calendarioLiga(ids, rng));
    m.tab = {};
    for (const ids of m.divs) for (const id of ids) m.tab[id] = { j: 0, v: 0, e: 0, d: 0, gm: 0, gs: 0, p: 0, forma: '' };
    // L1 L2 T0 L3 L4 L5 T1 L6 L7 L8 T2 L9 L10 L11 T3 L12 L13 L14 T4 L15 L16 L17 T5 L18
    const cal = [];
    let t = 0;
    for (let r = 0; r < 18; r++) {
      cal.push({ t: 'L', r });
      if ((r === 1 || r === 4 || r === 7 || r === 10 || r === 13 || r === 16) && t < 6) cal.push({ t: 'T', r: t++ });
    }
    m.cal = cal;
    m.passo = 0;
    // Taça de cada país: se não forem potência de 2, os das divisões mais
    // baixas jogam uma pré-eliminatória. A final calha sempre na última ronda.
    m.tacas = {};
    for (const pais of m.paises || ['PT']) {
      const ordem = divsDoPais(m, pais).map((d) => m.divs[d].slice().sort(() => rng.r() - 0.5));
      const todos = [].concat(...ordem);
      const N = todos.length;
      let P = 1;
      while (P * 2 <= N) P *= 2;
      const nPre = P === N ? 0 : 2 * (N - P);
      const pre = nPre ? todos.slice(N - nPre) : [];
      const isentos = nPre ? todos.slice(0, N - nPre) : [];
      const rondas = (nPre ? 1 : 0) + Math.round(Math.log2(P));
      m.tacas[pais] = { pais, vivos: nPre ? pre : todos, isentos, pre: !!nPre, inicio: Math.max(0, 6 - rondas), feitas: 0, campeao: null, finalista: null, jogos: [] };
    }
    for (const id in m.jog) {
      const j = m.jog[id];
      j.gol = 0;
      j.jg = 0;
    }
  }

  function jogosDoPasso(m, rng) {
    const p = m.cal[m.passo];
    if (!p) return [];
    if (p.t === 'L') {
      const out = [];
      m.fix.forEach((voltas, div) => {
        for (const [h, a] of voltas[p.r]) out.push({ h, a, tipo: 'L', div, neutro: false });
      });
      return out;
    }
    // Taças: sorteio da ronda em cada país
    const out = [];
    for (const pais in m.tacas) {
      const tc = m.tacas[pais];
      if (tc.campeao || p.r < tc.inicio) continue;
      const vivos = tc.vivos.slice();
      for (let i = vivos.length - 1; i > 0; i--) {
        const k = Math.floor(rng.r() * (i + 1));
        [vivos[i], vivos[k]] = [vivos[k], vivos[i]];
      }
      const nome = nomeRonda(tc);
      for (let i = 0; i + 1 < vivos.length; i += 2) {
        out.push({ h: vivos[i], a: vivos[i + 1], tipo: 'T', ronda: p.r, pais, rn: nome, neutro: vivos.length === 2 });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------
  // Escalação automática (IA e "melhor equipa")
  // ---------------------------------------------------------------
  function disponivel(j) {
    return j && j.les <= 0 && j.cas <= 0;
  }
  const MULT_POS = {
    G: { G: 1, D: 0.3, M: 0.25, A: 0.2 },
    D: { G: 0.25, D: 1, M: 0.8, A: 0.6 },
    M: { G: 0.2, D: 0.8, M: 1, A: 0.82 },
    A: { G: 0.15, D: 0.6, M: 0.82, A: 1 },
  };
  function melhorOnze(m, clube, form) {
    const pos = posicoesDa(form);
    const livres = clube.pl.map((id) => m.jog[id]).filter(disponivel);
    const usados = new Set();
    const xi = new Array(pos.length).fill(null);
    // primeiro quem joga na posição natural, depois improvisa
    for (const passo of [true, false]) {
      for (let s = 0; s < pos.length; s++) {
        if (xi[s]) continue;
        let best = null;
        let bv = -1;
        for (const j of livres) {
          if (usados.has(j.id)) continue;
          if (passo && j.p !== pos[s]) continue;
          const v = j.f * MULT_POS[j.p][pos[s]];
          if (v > bv) {
            bv = v;
            best = j;
          }
        }
        if (best) {
          xi[s] = best.id;
          usados.add(best.id);
        }
      }
    }
    const banco = livres
      .filter((j) => !usados.has(j.id))
      .sort((a, b) => b.f - a.f)
      .slice(0, 7)
      .map((j) => j.id);
    return { xi, banco };
  }
  function forcaOnze(m, xi, form) {
    const pos = posicoesDa(form);
    let s = 0;
    xi.forEach((id, k) => {
      const j = id && m.jog[id];
      if (j) s += j.f * MULT_POS[j.p][pos[k]];
    });
    return s;
  }
  // A IA escolhe a formação: em casa mais atacante, fora mais defensiva
  function escolhaIA(m, clube, emCasa, rng) {
    const opcoes = emCasa ? ['4-3-3', '4-4-2', '3-4-3', '4-2-4', '3-5-2'] : ['4-4-2', '4-5-1', '5-3-2', '4-3-3', '5-4-1'];
    let best = null;
    for (const f of opcoes) {
      const { xi, banco } = melhorOnze(m, clube, f);
      const v = forcaOnze(m, xi, f) * (1 + rng.r() * 0.04);
      if (!best || v > best.v) best = { f, xi, banco, v };
    }
    const estilo = emCasa ? (rng.chance(0.3) ? 'at' : 'eq') : rng.chance(0.35) ? 'ca' : 'eq';
    return { tat: { f: best.f, e: estilo, m: rng.chance(0.2) ? 'f' : 'n', foco: rng.chance(0.5) ? 'meio' : 'alas' }, xi: best.xi, banco: best.banco };
  }
  // Escalação de um humano: usa a que ele guardou e tapa buracos
  function escalacaoHumana(m, clube) {
    const tat = Object.assign({ f: '4-4-2', e: 'eq', m: 'n', foco: 'meio' }, clube.tat || {});
    if (!FORMACOES[tat.f]) tat.f = '4-4-2';
    const pos = posicoesDa(tat.f);
    const meus = new Set(clube.pl);
    let xi = Array.isArray(clube.xi) ? clube.xi.slice(0, pos.length) : [];
    while (xi.length < pos.length) xi.push(null);
    const vistos = new Set();
    xi = xi.map((id) => {
      if (!id || !meus.has(id) || vistos.has(id) || !disponivel(m.jog[id])) return null;
      vistos.add(id);
      return id;
    });
    if (xi.some((x) => !x)) {
      const auto = melhorOnze(m, clube, tat.f);
      for (let s = 0; s < xi.length; s++) {
        if (xi[s]) continue;
        // o melhor disponível que ainda não está no onze
        let best = null;
        let bv = -1;
        for (const id of clube.pl) {
          const j = m.jog[id];
          if (!disponivel(j) || vistos.has(id)) continue;
          const v = j.f * MULT_POS[j.p][pos[s]];
          if (v > bv) {
            bv = v;
            best = id;
          }
        }
        if (best) {
          xi[s] = best;
          vistos.add(best);
        }
      }
      void auto;
    }
    const banco = (Array.isArray(clube.banco) ? clube.banco : [])
      .filter((id) => meus.has(id) && !vistos.has(id) && disponivel(m.jog[id]))
      .slice(0, 7);
    if (banco.length < 7) {
      for (const id of clube.pl.slice().sort((a, b) => m.jog[b].f - m.jog[a].f)) {
        if (banco.length >= 7) break;
        if (!vistos.has(id) && !banco.includes(id) && disponivel(m.jog[id])) banco.push(id);
      }
    }
    return { tat, xi, banco };
  }

  // ---------------------------------------------------------------
  // MOTOR DO JOGO — minuto a minuto
  // ---------------------------------------------------------------
  function criarJogo(m, info, escH, escA) {
    const lado = (id, esc) => ({
      id,
      tat: Object.assign({}, esc.tat),
      pos: posicoesDa(esc.tat.f),
      xi: esc.xi.slice(),
      banco: esc.banco.slice(),
      subs: 0,
      sairam: [],
      jogaram: esc.xi.filter(Boolean),
      lesoes: [],
      travao: 1,
      fora: [], // expulsos
      am: {},
    });
    return {
      tipo: info.tipo,
      div: info.div,
      ronda: info.ronda,
      pais: info.pais,
      rn: info.rn,
      neutro: !!info.neutro,
      h: lado(info.h, escH),
      a: lado(info.a, escA),
      min: 0,
      extra: 0,
      gh: 0,
      ga: 0,
      ev: [],
      fim: false,
      pen: null,
    };
  }

  function efJog(m, j, posSlot, min, ladoObj) {
    let ef = j.f * MULT_POS[j.p][posSlot];
    if (ladoObj.lesoes.includes(j.id)) ef *= 0.6;
    if (min > 60) ef *= 1 - (min - 60) * (j.ca.includes('res') ? 0.0008 : 0.0022);
    return ef;
  }

  function setores(m, jogo, ld) {
    const L = jogo[ld];
    const cl = m.clubes[L.id];
    const mor = 0.9 + (cl ? cl.mor : 10) * 0.01;
    const casa = !jogo.neutro && ld === 'h' ? 1.06 : 1;
    let nPT = 0;
    let G = 0;
    let D = 0;
    let M = 0;
    let A = 0;
    let n = 0;
    let carM = 0;
    let cru = 0;
    L.xi.forEach((id, k) => {
      if (!id) return;
      const j = m.jog[id];
      const ef = efJog(m, j, L.pos[k], jogo.min, L);
      n++;
      if (j.nac === 'PT') nPT++;
      const p = L.pos[k];
      if (p === 'G') G += ef * (j.ca.includes('ref') ? 1.08 : 1) * (j.ca.includes('col') ? 1.05 : 1);
      else if (p === 'D') D += ef;
      else if (p === 'M') {
        M += ef;
        if (j.ca.includes('pas') || j.ca.includes('arm')) carM += 0.06 * ef;
      } else A += ef;
      if (j.ca.includes('cru')) cru++;
    });
    const nac = 1 + nPT * 0.005;
    const k = mor * casa * nac;
    const s = {
      G: Math.max(5, G) * k,
      D: (D + M * 0.35) * k,
      M: (M + carM + (D + A) * 0.18) * k,
      A: (A + M * 0.35) * k,
      cru,
      n,
    };
    const e = L.tat.e;
    if (e === 'at') {
      s.A *= 1.15;
      s.D *= 0.85;
    } else if (e === 'ca') {
      s.D *= 1.1;
      s.M *= 0.88;
    }
    return s;
  }

  function escolherPeso(m, L, pesos, rng, foco) {
    const ids = [];
    const ps = [];
    L.xi.forEach((id, k) => {
      if (!id) return;
      const j = m.jog[id];
      let w = pesos[L.pos[k]] * Math.max(1, j.f);
      if (foco === 'alas' && (j.ca.includes('cru') || j.ca.includes('vel'))) w *= 1.3;
      if (foco === 'cab' && j.ca.includes('cab')) w *= 2.2;
      if (w > 0) {
        ids.push(id);
        ps.push(w);
      }
    });
    return ids.length ? m.jog[rng.peso(ids, ps)] : null;
  }
  function slotDe(L, id) {
    return L.pos[L.xi.indexOf(id)] || 'M';
  }
  function goleiro(m, L) {
    const k = L.pos.indexOf('G');
    const id = L.xi[k];
    if (id) return m.jog[id];
    // sem guarda-redes (expulso sem trocas): joga quem estiver
    const outro = L.xi.find(Boolean);
    return outro ? m.jog[outro] : null;
  }

  function registar(jogo, ev) {
    jogo.ev.push(ev);
  }

  function golo(m, jogo, atk, marcador, tipo, rng) {
    const L = jogo[atk];
    if (atk === 'h') jogo.gh++;
    else jogo.ga++;
    marcador.gol = (marcador.gol || 0) + 1;
    marcador.golT = (marcador.golT || 0) + 1;
    L.travao *= 0.86;
    const dif = Math.abs(jogo.gh - jogo.ga);
    if (dif >= 3) L.travao *= 0.85;
    registar(jogo, { m: jogo.min, t: 'g', l: atk, j: marcador.id, k: tipo || '' });
    void rng;
  }

  function oportunidade(m, jogo, atk, rng) {
    const def = atk === 'h' ? 'a' : 'h';
    const LA = jogo[atk];
    const LD = jogo[def];
    const foco = LA.tat.foco;
    const atacante = escolherPeso(m, LA, { G: 0, D: 0.35, M: 1.4, A: 3 }, rng, foco);
    const defensor = escolherPeso(m, LD, { G: 0, D: 3, M: 1.2, A: 0.2 }, rng);
    if (!atacante) return;
    const gr = goleiro(m, LD);
    const r = rng.r();
    if (r < 0.2) {
      const r2 = rng.r();
      if (r2 < 0.07) {
        // penálti
        const cands = LA.xi.filter(Boolean).map((id) => m.jog[id]);
        cands.sort((a, b) => b.c * 30 + (b.ca.includes('fin') ? 10 : 0) + b.f - (a.c * 30 + (a.ca.includes('fin') ? 10 : 0) + a.f));
        const batedor = cands[0];
        let p = 0.75 + (batedor.c ? 0.08 : 0) + (batedor.ca.includes('fin') ? 0.04 : 0);
        if (gr && gr.ca.includes('dpe')) p -= 0.14;
        registar(jogo, { m: jogo.min, t: 'pen', l: atk, j: batedor.id });
        if (rng.chance(p)) golo(m, jogo, atk, batedor, 'pen', rng);
        else registar(jogo, { m: jogo.min, t: 'pf', l: atk, j: batedor.id });
        if (defensor) cartaoFalta(m, jogo, def, defensor, rng, 0.6);
        return;
      }
      if (r2 < 0.55) {
        // canto: cabeceamento
        const cab = escolherPeso(m, LA, { G: 0, D: 1, M: 0.6, A: 1.5 }, rng, 'cab');
        const pc = cab && cab.ca.includes('cab') ? 0.07 : 0.035;
        if (cab && rng.chance(pc * (gr && gr.ca.includes('sai') ? 0.75 : 1))) golo(m, jogo, atk, cab, 'cab', rng);
        return;
      }
      return;
    }
    // duelo atacante vs defensor
    let fa = efJog(m, atacante, slotDe(LA, atacante.id), jogo.min, LA);
    if (atacante.ca.includes('dri')) fa *= 1.12;
    if (atacante.ca.includes('vel')) fa *= LA.tat.e === 'ca' ? 1.14 : 1.07;
    if (atacante.c) fa *= 1.1;
    let fd = defensor ? efJog(m, defensor, slotDe(LD, defensor.id), jogo.min, LD) : 5;
    if (defensor && defensor.ca.includes('des')) fd *= 1.12;
    if (defensor && defensor.ca.includes('mar')) fd *= 1.08;
    if (defensor && foco === 'alas' && defensor.ca.includes('cab')) fd *= 1.06;
    const pw = Math.pow(fa, 1.4) / (Math.pow(fa, 1.4) + Math.pow(fd, 1.4));
    if (!rng.chance(pw)) {
      if (defensor && rng.chance(0.18)) cartaoFalta(m, jogo, def, defensor, rng, 1);
      return;
    }
    // remate
    const gk = gr ? efJog(m, gr, 'G', jogo.min, LD) * (gr.ca.includes('ref') ? 1.08 : 1) : 5;
    let pg = 0.34 * Math.pow((2 * fa) / (fa + gk * 1.05), 0.9);
    if (atacante.c) pg *= 1.25;
    if (atacante.ca.includes('fin')) pg *= 1.18;
    if (LA.tat.e === 'ca') pg *= 1.12;
    if (foco === 'alas' && atacante.ca.includes('cab')) pg *= 1.1;
    if (slotDe(LA, atacante.id) === 'D') pg *= 0.7;
    if (rng.chance(clamp(pg, 0.03, 0.75))) {
      golo(m, jogo, atk, atacante, '', rng);
      return;
    }
    const r3 = rng.r();
    const tipo = r3 < 0.45 ? 'def' : r3 < 0.52 ? (rng.chance(0.5) ? 'pos' : 'bar') : r3 < 0.8 ? 'lad' : 'cim';
    if (tipo === 'pos' || tipo === 'bar' || (tipo === 'def' && rng.chance(0.25))) {
      registar(jogo, { m: jogo.min, t: tipo, l: atk, j: atacante.id });
    }
  }

  function cartaoFalta(m, jogo, ld, j, rng, mult) {
    const L = jogo[ld];
    if (!L.xi.includes(j.id)) return;
    const cp = j.cp;
    const marc = L.tat.m === 'mf' ? 1.45 : L.tat.m === 'f' ? 1.2 : 1;
    if (rng.chance(VERMELHO_POR_COMP[cp] * marc * mult)) {
      expulsar(jogo, ld, j, 'v');
      return;
    }
    if (rng.chance(AMARELO_POR_COMP[cp] * marc * mult)) {
      L.am[j.id] = (L.am[j.id] || 0) + 1;
      if (L.am[j.id] >= 2) expulsar(jogo, ld, j, 'va');
      else registar(jogo, { m: jogo.min, t: 'am', l: ld, j: j.id });
    }
  }
  function expulsar(jogo, ld, j, tipo) {
    const L = jogo[ld];
    const k = L.xi.indexOf(j.id);
    if (k < 0) return;
    L.xi[k] = null;
    L.fora.push(j.id);
    registar(jogo, { m: jogo.min, t: tipo === 'va' ? 'va' : 'vm', l: ld, j: j.id });
  }

  // substituição (humano pela interface, ou IA automática)
  function substituir(m, jogo, ld, saiId, entraId) {
    const L = jogo[ld];
    if (jogo.fim || L.subs >= MAX_SUBS) return false;
    const k = L.xi.indexOf(saiId);
    const b = L.banco.indexOf(entraId);
    if (k < 0 || b < 0) return false;
    L.xi[k] = entraId;
    L.banco.splice(b, 1);
    L.subs++;
    L.sairam.push(saiId);
    if (!L.jogaram.includes(entraId)) L.jogaram.push(entraId);
    registar(jogo, { m: jogo.min, t: 's', l: ld, j: entraId, j2: saiId });
    return true;
  }
  function mudarTatica(jogo, ld, tat) {
    const L = jogo[ld];
    if (tat.e && ESTILOS[tat.e]) L.tat.e = tat.e;
    if (tat.m && MARCACOES[tat.m]) L.tat.m = tat.m;
    if (tat.foco && FOCOS[tat.foco]) L.tat.foco = tat.foco;
  }

  function iaSubs(m, jogo, ld, rng) {
    const L = jogo[ld];
    if (L.subs >= MAX_SUBS || !L.banco.length) return;
    // lesionados primeiro
    for (const id of L.lesoes) {
      const k = L.xi.indexOf(id);
      if (k < 0 || L.subs >= MAX_SUBS) continue;
      const pos = L.pos[k];
      const melhor = L.banco
        .map((b) => m.jog[b])
        .sort((a, b) => b.f * MULT_POS[b.p][pos] - a.f * MULT_POS[a.p][pos])[0];
      if (melhor) substituir(m, jogo, ld, id, melhor.id);
    }
    if (jogo.min >= 58 && jogo.min <= 80 && L.subs < MAX_SUBS && rng.chance(0.06)) {
      const meu = ld === 'h' ? jogo.gh - jogo.ga : jogo.ga - jogo.gh;
      const bancoJ = L.banco.map((b) => m.jog[b]);
      if (meu < 0) {
        // a perder: tira um defesa/médio, mete um avançado
        const sai = L.xi.map((id, k) => (id && (L.pos[k] === 'D' || L.pos[k] === 'M') ? m.jog[id] : null)).filter(Boolean).sort((a, b) => a.f - b.f)[0];
        const entra = bancoJ.filter((j) => j.p === 'A' || j.p === 'M').sort((a, b) => b.f - a.f)[0];
        if (sai && entra) substituir(m, jogo, ld, sai.id, entra.id);
      } else {
        // troca o mais cansado/fraco por alguém da mesma posição
        const cand = L.xi.map((id, k) => (id && L.pos[k] !== 'G' ? { j: m.jog[id], pos: L.pos[k] } : null)).filter(Boolean);
        if (!cand.length) return;
        const alvo = rng.pick(cand);
        const entra = bancoJ.filter((j) => j.p === alvo.pos).sort((a, b) => b.f - a.f)[0];
        if (entra && entra.f >= alvo.j.f - 6) substituir(m, jogo, ld, alvo.j.id, entra.id);
      }
    }
  }

  function passo(m, jogo, rng, humanos) {
    if (jogo.fim) return;
    jogo.min++;
    if (jogo.min === 46) registar(jogo, { m: 45, t: 'int' });
    const sh = setores(m, jogo, 'h');
    const sa = setores(m, jogo, 'a');
    let ph = Math.pow(sh.M, 1.3) / (Math.pow(sh.M, 1.3) + Math.pow(sa.M, 1.3));
    if (jogo.h.tat.e === 'ca') ph *= 0.9;
    if (jogo.a.tat.e === 'ca') ph = 1 - (1 - ph) * 0.9;
    jogo.posse = (jogo.posse || 0) + ph;
    const atk = rng.r() < ph ? 'h' : 'a';
    const def = atk === 'h' ? 'a' : 'h';
    const SA = atk === 'h' ? sh : sa;
    const SD = atk === 'h' ? sa : sh;
    let p = 0.17 * Math.pow(clamp(SA.A / Math.max(1, SD.D) / 0.62, 0.3, 2.6), 0.75) * jogo[atk].travao;
    const md = jogo[def].tat.m;
    if (md === 'f') p *= 0.93;
    if (md === 'mf') p *= 0.82;
    if (jogo[atk].tat.foco === 'alas') p *= 1 + Math.min(4, SA.cru) * 0.025;
    if (rng.chance(p)) oportunidade(m, jogo, atk, rng);
    // faltas para cartão (as das jogadas já estão na oportunidade)
    for (const ld of ['h', 'a']) {
      const L = jogo[ld];
      const mm = L.tat.m === 'mf' ? 2.2 : L.tat.m === 'f' ? 1.45 : 1;
      if (rng.chance(0.026 * mm)) {
        const ids = L.xi.filter(Boolean);
        if (ids.length) {
          const pesos = ids.map((id) => FALTA_POR_COMP[m.jog[id].cp] * (slotDe(L, id) === 'G' ? 0.1 : 1));
          cartaoFalta(m, jogo, ld, m.jog[rng.peso(ids, pesos)], rng, 1);
        }
      }
      // lesões
      if (rng.chance(0.0011)) {
        const ids = L.xi.filter((id) => id && !L.lesoes.includes(id));
        if (ids.length) {
          const id = rng.pick(ids);
          L.lesoes.push(id);
          registar(jogo, { m: jogo.min, t: 'les', l: ld, j: id });
        }
      }
      if (!(humanos && humanos.includes(L.id))) iaSubs(m, jogo, ld, rng);
    }
    if (jogo.min === 90) jogo.extra = rng.int(1, 4);
    if (jogo.min >= 90 + jogo.extra) {
      jogo.fim = true;
      if (jogo.tipo === 'T' && jogo.gh === jogo.ga) penaltis(m, jogo, rng);
    }
  }

  function penaltis(m, jogo, rng) {
    const conv = (ld) => {
      const L = jogo[ld];
      const outro = jogo[ld === 'h' ? 'a' : 'h'];
      const gr = goleiro(m, outro);
      const batedores = L.xi.filter(Boolean).map((id) => m.jog[id]).sort((a, b) => b.c - a.c || b.f - a.f);
      return (k) => {
        const b = batedores[k % batedores.length];
        let p = 0.74 + (b.c ? 0.08 : 0) + (b.ca.includes('fin') ? 0.04 : 0) - (gr && gr.ca.includes('dpe') ? 0.12 : 0);
        return rng.chance(p);
      };
    };
    const ch = conv('h');
    const ca = conv('a');
    let ph = 0;
    let pa = 0;
    let k = 0;
    for (; k < 5; k++) {
      if (ch(k)) ph++;
      if (ca(k)) pa++;
    }
    while (ph === pa && k < 30) {
      if (ch(k)) ph++;
      if (ca(k)) pa++;
      k++;
    }
    if (ph === pa) ph++;
    jogo.pen = [ph, pa];
    registar(jogo, { m: 120, t: 'gp', l: ph > pa ? 'h' : 'a', x: ph + '-' + pa });
  }

  function vencedor(jogo) {
    if (jogo.gh !== jogo.ga) return jogo.gh > jogo.ga ? jogo.h.id : jogo.a.id;
    if (jogo.pen) return jogo.pen[0] > jogo.pen[1] ? jogo.h.id : jogo.a.id;
    return null;
  }

  // ---------------------------------------------------------------
  // Jornada: preparar -> (passos) -> concluir
  // ---------------------------------------------------------------
  function humanosDe(m) {
    return Object.values(m.clubes)
      .filter((c) => c.hum)
      .map((c) => c.id);
  }

  function prepararJornada(m) {
    const { rng, guardar } = rngDoMundo(m);
    const lista = jogosDoPasso(m, rng);
    const jogos = lista.map((info) => {
      const ch = m.clubes[info.h];
      const ca = m.clubes[info.a];
      const eh = ch.hum && !ch.auto ? escalacaoHumana(m, ch) : escolhaIA(m, ch, !info.neutro, rng);
      const ea = ca.hum && !ca.auto ? escalacaoHumana(m, ca) : escolhaIA(m, ca, false, rng);
      return criarJogo(m, info, eh, ea);
    });
    guardar();
    return jogos;
  }

  function correrJogos(m, jogos, humanos) {
    const { rng, guardar } = rngDoMundo(m);
    for (const jg of jogos) while (!jg.fim) passo(m, jg, rng, humanos || []);
    guardar();
  }

  function noticia(m, txt, clube) {
    m.noticias.unshift({ e: m.epoca, p: m.passo, txt, cl: clube || null });
    if (m.noticias.length > 80) m.noticias.length = 80;
  }

  function treinadorDe(m, login) {
    if (!m.treinadores[login]) m.treinadores[login] = { pts: 0, v: 0, e: 0, d: 0, titulos: [], hist: [], ofertas: [] };
    return m.treinadores[login];
  }

  function concluirJornada(m, jogos) {
    const { rng, guardar } = rngDoMundo(m);
    const p = m.cal[m.passo];
    const resumo = { epoca: m.epoca, passo: m.passo, t: p.t, r: p.r, jogos: [] };

    for (const jg of jogos) {
      const ch = m.clubes[jg.h.id];
      const ca = m.clubes[jg.a.id];
      // tabela
      if (jg.tipo === 'L') {
        const th = m.tab[ch.id];
        const ta = m.tab[ca.id];
        th.j++;
        ta.j++;
        th.gm += jg.gh;
        th.gs += jg.ga;
        ta.gm += jg.ga;
        ta.gs += jg.gh;
        if (jg.gh > jg.ga) {
          th.v++;
          th.p += 3;
          ta.d++;
          th.forma = ('V' + th.forma).slice(0, 5);
          ta.forma = ('D' + ta.forma).slice(0, 5);
        } else if (jg.gh < jg.ga) {
          ta.v++;
          ta.p += 3;
          th.d++;
          th.forma = ('D' + th.forma).slice(0, 5);
          ta.forma = ('V' + ta.forma).slice(0, 5);
        } else {
          th.e++;
          ta.e++;
          th.p++;
          ta.p++;
          th.forma = ('E' + th.forma).slice(0, 5);
          ta.forma = ('E' + ta.forma).slice(0, 5);
        }
      }
      const venc = vencedor(jg);
      // moral e série
      for (const [cl, casa] of [[ch, true], [ca, false]]) {
        if (venc === cl.id) {
          cl.mor = clamp(cl.mor + (casa ? 2 : 3), 0, 20);
          cl.sem = 0;
        } else if (venc === null) {
          cl.mor = clamp(cl.mor + (casa ? 0 : 1), 0, 20);
          cl.sem++;
        } else {
          cl.mor = clamp(cl.mor - (casa ? 3 : 2), 0, 20);
          cl.sem++;
        }
        if (cl.hum) {
          const t = treinadorDe(m, cl.hum);
          if (venc === cl.id) {
            t.v++;
            t.pts += casa ? 2 : 3;
          } else if (venc === null) {
            t.e++;
            t.pts += 1;
          } else t.d++;
        }
      }
      // bilheteira (casa); na Taça divide-se
      const forcaMedia = (cl) => {
        const top = cl.pl.map((id) => m.jog[id].f).sort((a, b) => b - a).slice(0, 14);
        return top.reduce((s, x) => s + x, 0) / Math.max(1, top.length);
      };
      const fm = (forcaMedia(ch) + forcaMedia(ca)) / 2;
      const dv = econ(m, ch.div);
      const membros = m.divs[ch.div] || [ch.id];
      const ref = membros.reduce((s, id) => s + (m.clubes[id].nivel || 50), 0) / membros.length;
      const fatorPreco = Math.pow(dv.bilhete / Math.max(1, ch.bil), 1.25);
      let publico = dv.publico * Math.pow(fm / ref, 1.6) * (0.75 + ch.mor / 40) * fatorPreco * (jg.tipo === 'T' ? 1 + (jg.neutro ? 0.8 : 0.1) : 1);
      publico = Math.round(clamp(publico * (0.9 + rng.r() * 0.2), 200, ch.lug));
      const receita = publico * ch.bil;
      if (jg.tipo === 'T' && !jg.neutro) {
        ch.din += Math.round(receita / 2);
        ca.din += Math.round(receita / 2);
      } else if (jg.tipo === 'T') {
        ch.din += Math.round(receita / 2);
        ca.din += Math.round(receita / 2);
      } else ch.din += receita;
      ch.ultPublico = publico;
      ch.ultReceita = receita;

      // castigos, lesões e jogos
      for (const L of [jg.h, jg.a]) {
        const cl = m.clubes[L.id];
        for (const id of cl.pl) {
          const j = m.jog[id];
          if (j.cas > 0 && !L.jogaram.includes(id)) j.cas--;
        }
        for (const id of L.jogaram) {
          const j = m.jog[id];
          if (!j) continue;
          j.jg++;
        }
        for (const id in L.am) {
          const j = m.jog[id];
          if (!j || L.fora.includes(id)) continue;
          j.am += L.am[id];
          if (j.am >= 3) {
            j.am = 0;
            j.cas = 1;
          }
        }
        for (const id of L.fora) {
          const j = m.jog[id];
          if (j) j.cas = 1 + (rng.chance(0.3) ? 1 : 0) + (j.cp <= 1 && rng.chance(0.3) ? 1 : 0);
        }
        for (const id of L.lesoes) {
          const j = m.jog[id];
          if (j) {
            j.les = rng.int(1, 6);
            if (j.les >= 5) j.f = Math.max(1, j.f - rng.int(1, 3));
          }
        }
        // evolução (Elifoot: aproxima-se da média da equipa)
        const media = cl.pl.map((id) => m.jog[id].f).sort((a, b) => b - a).slice(0, 14).reduce((s, x) => s + x, 0) / 14;
        for (const id of cl.pl) {
          const j = m.jog[id];
          const jogou = L.jogaram.includes(id);
          const idade = j.i <= 20 ? 0.32 : j.i <= 23 ? 0.2 : j.i <= 28 ? 0.06 : j.i <= 31 ? -0.04 : -0.2;
          let d = (media - j.f) * (jogou ? 0.012 : 0.004) + idade * (jogou ? 1 : 0.5) + (rng.r() - 0.5) * (jogou ? 0.5 : 0.2);
          if (j.les > 0) d = Math.min(d, 0);
          j.f = Math.round(clamp(j.f + d, 1, 99) * 10) / 10;
        }
      }
      if (jg.tipo === 'T') {
        const perdedor = venc === ch.id ? ca.id : ch.id;
        const tc = m.tacas[jg.pais];
        if (tc) tc.jogos.push({ r: jg.ronda, rn: jg.rn, h: ch.id, a: ca.id, gh: jg.gh, ga: jg.ga, pen: jg.pen, x: perdedor });
      }
      resumo.jogos.push({
        tp: jg.tipo,
        dv: jg.div,
        r: jg.ronda,
        pa: jg.pais,
        rn: jg.rn,
        h: ch.id,
        a: ca.id,
        gh: jg.gh,
        ga: jg.ga,
        pen: jg.pen,
        ps: Math.round(((jg.posse || 45) / Math.max(1, jg.min)) * 100),
        pub: ch.ultPublico,
        ev: jg.ev,
      });
    }
    // Taças: os vencedores passam; depois da pré-eliminatória juntam-se os isentos
    if (p.t === 'T') {
      for (const pais in m.tacas) {
        const tc = m.tacas[pais];
        const meus = jogos.filter((j) => j.pais === pais);
        if (!meus.length) continue;
        const vencedores = meus.map(vencedor);
        tc.vivos = vencedores.concat(tc.isentos || []);
        tc.isentos = [];
        tc.feitas++;
        if (vencedores.length === 1) {
          const fin = meus[0];
          tc.campeao = vencedores[0];
          tc.finalista = fin.h.id === vencedores[0] ? fin.a.id : fin.h.id;
          const c = m.clubes[tc.campeao];
          const premio = Math.round(PREMIO_TACA * (PAISES[pais] || PAISES.PT).ec);
          c.din += premio;
          m.clubes[tc.finalista].din += Math.round(premio / 3);
          noticia(m, '🏆 ' + c.n + ' ganha a Taça' + (m.paises.length > 1 ? ' de ' + PAISES[pais].nome : '') + '!', c.id);
          if (c.hum) {
            const t = treinadorDe(m, c.hum);
            t.pts += 15;
            t.titulos.push({ e: m.epoca, ano: m.ano, t: 'Taça' + (m.paises.length > 1 ? ' de ' + PAISES[pais].nome : ''), cl: c.n });
          }
        }
      }
    }

    // finanças da jornada (todos os clubes)
    for (const id in m.clubes) {
      const c = m.clubes[id];
      const sal = c.pl.reduce((s, jid) => s + m.jog[jid].sal, 0);
      const pat = p.t === 'L' ? econ(m, c.div).patrocinio : 0;
      const juros = Math.round(c.emp * JURO);
      c.din += pat - (p.t === 'L' ? sal : 0) - juros;
      c.ultFin = { sal: p.t === 'L' ? sal : 0, pat, juros };
      if (c.obras > 0) {
        c.lug = Math.min(MAX_LUGARES, c.lug + c.obras);
        noticia(m, '🏗️ ' + c.n + ': obras concluídas, o estádio tem agora ' + c.lug.toLocaleString('pt-PT') + ' lugares.', c.id);
        c.obras = 0;
      }
      if (c.din < 0) c.mor = clamp(c.mor - 1, 0, 20);
      // a IA paga dívidas e pede crédito se precisar
      if (!c.hum) {
        const cred = econ(m, c.div).credito;
        if (c.din < -cred * 0.2 && c.emp < cred) {
          const x = Math.min(cred - c.emp, -c.din + 200000);
          c.emp += x;
          c.din += x;
        } else if (c.emp > 0 && c.din > c.emp * 1.5) {
          c.din -= c.emp;
          c.emp = 0;
        }
      }
    }
    // lesões diminuem por jornada
    for (const id in m.jog) {
      const j = m.jog[id];
      if (j.les > 0) j.les--;
    }

    resolverLeiloes(m, rng);
    iaMercado(m, rng);
    verificarDespedimentos(m, rng);

    m.ultimos = resumo;
    m.passo++;
    if (m.passo >= m.cal.length) fimDeEpoca(m, rng);
    guardar();
    return resumo;
  }

  function jogarJornada(m) {
    const jogos = prepararJornada(m);
    correrJogos(m, jogos, []);
    return concluirJornada(m, jogos);
  }

  // ---------------------------------------------------------------
  // Classificação
  // ---------------------------------------------------------------
  function classificacao(m, div) {
    return m.divs[div]
      .map((id) => Object.assign({ id }, m.tab[id]))
      .sort((a, b) => b.p - a.p || b.gm - b.gs - (a.gm - a.gs) || b.gm - a.gm || a.id.localeCompare(b.id));
  }
  function artilheiros(m, n) {
    return Object.values(m.jog)
      .filter((j) => j.gol > 0 && j.cl)
      .sort((a, b) => b.gol - a.gol || b.f - a.f)
      .slice(0, n || 10);
  }

  // ---------------------------------------------------------------
  // Mercado: leilões, compra direta, livres, vendas
  // ---------------------------------------------------------------
  function porLeilao(m, jid, base, quem) {
    const j = m.jog[jid];
    if (!j || !j.cl) return { erro: 'Jogador inválido.' };
    if (m.mercado.leiloes.some((l) => l.j === jid)) return { erro: 'Já está em leilão.' };
    const cl = m.clubes[j.cl];
    if (cl.pl.length - m.mercado.leiloes.filter((l) => l.de === cl.id).length <= MIN_PLANTEL) return { erro: 'O plantel tem de ficar com pelo menos ' + MIN_PLANTEL + ' jogadores.' };
    const v = valor(j);
    const b = Math.max(Math.round(v * 0.5), Math.round(Number(base) || v * 0.8));
    m.mercado.leiloes.push({ j: jid, de: cl.id, base: b, lances: {}, desde: m.passo + '|' + m.epoca });
    if (quem) noticia(m, '🔨 ' + cl.n + ' pôs ' + j.n + ' em leilão (base ' + fmtEur(b) + ').', cl.id);
    return { ok: true, base: b };
  }
  function licitar(m, clubeId, jid, montante) {
    const l = m.mercado.leiloes.find((x) => x.j === jid);
    if (!l) return { erro: 'Esse leilão já acabou.' };
    if (l.de === clubeId) return { erro: 'Não podes licitar no teu próprio jogador.' };
    const c = m.clubes[clubeId];
    const v = Math.round(Number(montante) || 0);
    if (v < l.base) return { erro: 'O lance mínimo é ' + fmtEur(l.base) + '.' };
    if (v > c.din + econ(m, c.div).credito - c.emp) return { erro: 'Não tens dinheiro (nem crédito) para esse lance.' };
    if (c.pl.length >= MAX_PLANTEL) return { erro: 'O teu plantel está cheio (' + MAX_PLANTEL + ').' };
    l.lances[clubeId] = v;
    return { ok: true };
  }
  function transferir(m, jid, para, preco, de) {
    const j = m.jog[jid];
    const cd = de ? m.clubes[de] : null;
    const cp = m.clubes[para];
    if (cd) {
      cd.pl = cd.pl.filter((x) => x !== jid);
      cd.din += preco;
      if (Array.isArray(cd.xi)) cd.xi = cd.xi.map((x) => (x === jid ? null : x));
      if (Array.isArray(cd.banco)) cd.banco = cd.banco.filter((x) => x !== jid);
    } else {
      m.mercado.livres = m.mercado.livres.filter((x) => x !== jid);
    }
    cp.pl.push(jid);
    cp.din -= preco;
    j.cl = para;
    j.am = 0;
    j.sal = salarioDe(j);
    m.mercado.leiloes = m.mercado.leiloes.filter((l) => l.j !== jid);
  }
  function resolverLeiloes(m, rng) {
    const fim = [];
    for (const l of m.mercado.leiloes) {
      const j = m.jog[l.j];
      if (!j || j.cl !== l.de) {
        fim.push(l);
        continue;
      }
      // a IA também licita
      for (const id in m.clubes) {
        const c = m.clubes[id];
        if (c.hum || c.id === l.de || c.pl.length >= MAX_PLANTEL - 1) continue;
        const mesmos = c.pl.map((x) => m.jog[x]).filter((x) => x.p === j.p).sort((a, b) => b.f - a.f);
        const ref = mesmos[Math.min(1, mesmos.length - 1)];
        if (ref && j.f < ref.f + 1) continue;
        const oferta = Math.round(valor(j) * (0.8 + rng.r() * 0.45));
        if (oferta >= l.base && c.din > oferta * 1.2 && rng.chance(0.35)) l.lances[c.id] = Math.max(l.lances[c.id] || 0, oferta);
      }
      let best = null;
      for (const cid in l.lances) {
        const v = l.lances[cid];
        const c = m.clubes[cid];
        if (!c || c.pl.length >= MAX_PLANTEL) continue;
        if (v > c.din + econ(m, c.div).credito - c.emp) continue;
        if (!best || v > best.v) best = { cid, v };
      }
      if (best) {
        const comprador = m.clubes[best.cid];
        if (comprador.din < best.v) {
          const falta = best.v - comprador.din;
          comprador.emp += falta;
          comprador.din += falta;
        }
        transferir(m, l.j, best.cid, best.v, l.de);
        noticia(m, '💰 ' + j.n + ' (' + m.clubes[l.de].n + ') vendido em leilão ao ' + comprador.n + ' por ' + fmtEur(best.v) + '.', best.cid);
        if (m.clubes[l.de].hum) noticia(m, '💰 Vendeste ' + j.n + ' por ' + fmtEur(best.v) + '.', l.de);
      } else if (m.clubes[l.de].hum) {
        noticia(m, '🔨 Ninguém licitou em ' + j.n + '. Continua no plantel.', l.de);
      }
      fim.push(l);
    }
    m.mercado.leiloes = m.mercado.leiloes.filter((l) => !fim.includes(l));
  }
  function precoPedido(m, j) {
    const cl = j.cl && m.clubes[j.cl];
    if (!cl) return Math.round(valor(j) * 0.15);
    const ord = cl.pl.map((x) => m.jog[x]).filter((x) => x.p === j.p).sort((a, b) => b.f - a.f);
    const titular = ord.indexOf(j) < (j.p === 'G' ? 1 : j.p === 'A' ? 2 : 4);
    return Math.round((valor(j) * (1.3 + (titular ? 0.35 : 0))) / 1000) * 1000;
  }
  function comprarDireto(m, clubeId, jid) {
    const j = m.jog[jid];
    const c = m.clubes[clubeId];
    if (!j || !c) return { erro: 'Jogador inválido.' };
    if (j.cl === clubeId) return { erro: 'Já é teu.' };
    if (c.pl.length >= MAX_PLANTEL) return { erro: 'O teu plantel está cheio (' + MAX_PLANTEL + ').' };
    if (j.cl) {
      const vend = m.clubes[j.cl];
      if (vend.hum) return { erro: 'Esse jogador é de outro treinador. Só o podes comprar se ele o puser em leilão.' };
      if (vend.pl.length <= MIN_PLANTEL + 2) return { erro: 'O ' + vend.n + ' não quer ficar com tão poucos jogadores.' };
    }
    const preco = j.cl ? precoPedido(m, j) : 0;
    if (preco > c.din) return { erro: 'Precisas de ' + fmtEur(preco) + ' (tens ' + fmtEur(c.din) + ').' };
    const de = j.cl;
    transferir(m, jid, clubeId, preco, de);
    noticia(m, '✍️ ' + c.n + (de ? ' compra ' + j.n + ' ao ' + m.clubes[de].n + ' por ' + fmtEur(preco) : ' contrata ' + j.n + ' (livre)') + '.', clubeId);
    return { ok: true, preco };
  }
  function venderJa(m, clubeId, jid, rng) {
    const j = m.jog[jid];
    const c = m.clubes[clubeId];
    if (!j || j.cl !== clubeId) return { erro: 'Jogador inválido.' };
    if (c.pl.length <= MIN_PLANTEL) return { erro: 'O plantel tem de ficar com pelo menos ' + MIN_PLANTEL + ' jogadores.' };
    const preco = Math.round((valor(j) * 0.65) / 1000) * 1000;
    const destinos = Object.values(m.clubes).filter((x) => !x.hum && x.pl.length < MAX_PLANTEL && x.id !== clubeId);
    const dest = destinos.length ? destinos[Math.floor((rng ? rng.r() : Math.random()) * destinos.length)] : null;
    if (dest) {
      transferir(m, jid, dest.id, 0, clubeId);
      dest.din -= preco;
      c.din += preco;
    } else {
      c.pl = c.pl.filter((x) => x !== jid);
      c.din += preco;
      j.cl = null;
      m.mercado.livres.push(jid);
    }
    noticia(m, '💸 ' + c.n + ' vende ' + j.n + (dest ? ' ao ' + dest.n : '') + ' por ' + fmtEur(preco) + '.', clubeId);
    return { ok: true, preco };
  }
  function dispensar(m, clubeId, jid) {
    const j = m.jog[jid];
    const c = m.clubes[clubeId];
    if (!j || j.cl !== clubeId) return { erro: 'Jogador inválido.' };
    if (c.pl.length <= MIN_PLANTEL) return { erro: 'O plantel tem de ficar com pelo menos ' + MIN_PLANTEL + ' jogadores.' };
    c.pl = c.pl.filter((x) => x !== jid);
    if (Array.isArray(c.xi)) c.xi = c.xi.map((x) => (x === jid ? null : x));
    j.cl = null;
    m.mercado.livres.push(jid);
    m.mercado.leiloes = m.mercado.leiloes.filter((l) => l.j !== jid);
    noticia(m, '👋 ' + c.n + ' dispensa ' + j.n + '.', clubeId);
    return { ok: true };
  }

  function iaMercado(m, rng) {
    for (const id in m.clubes) {
      const c = m.clubes[id];
      if (c.hum) continue;
      // põe jogadores em leilão de vez em quando
      if (c.pl.length > 20 && rng.chance(0.18)) {
        const ord = c.pl.map((x) => m.jog[x]).sort((a, b) => a.f - b.f);
        const alvo = rng.chance(0.75) ? ord[rng.int(0, 3)] : ord[rng.int(4, ord.length - 1)];
        if (alvo && !m.mercado.leiloes.some((l) => l.j === alvo.id)) porLeilao(m, alvo.id, Math.round(valor(alvo) * (0.7 + rng.r() * 0.3)));
      }
      // se faltar gente, contrata livres
      while (c.pl.length < 18 && m.mercado.livres.length) {
        const melhor = m.mercado.livres.map((x) => m.jog[x]).sort((a, b) => b.f - a.f)[0];
        transferir(m, melhor.id, c.id, 0, null);
      }
      while (c.pl.length < 18) {
        const j = novoJogador(m, rng, rng.peso(['G', 'D', 'M', 'A'], [1, 3, 3, 3]), c.nivel - 8, rng.int(18, 30), { pais: c.pais });
        j.cl = c.id;
        c.pl.push(j.id);
      }
      // garante 2 guarda-redes
      const grs = c.pl.filter((x) => m.jog[x].p === 'G').length;
      if (grs < 2) {
        const j = novoJogador(m, rng, 'G', c.nivel - 5, rng.int(19, 32), { pais: c.pais });
        j.cl = c.id;
        c.pl.push(j.id);
      }
    }
    // livres novos aparecem
    if (m.mercado.livres.length < 10 && rng.chance(0.3)) {
      const j = novoJogador(m, rng, rng.peso(['G', 'D', 'M', 'A'], [1, 3, 3, 3]), rng.int(24, 42), rng.int(22, 34));
      m.mercado.livres.push(j.id);
    }
    if (m.mercado.livres.length > 24) m.mercado.livres = m.mercado.livres.slice(-24);
  }

  // ---------------------------------------------------------------
  // Finanças do clube (ações do treinador)
  // ---------------------------------------------------------------
  function ampliarEstadio(m, clubeId, milhares) {
    const c = m.clubes[clubeId];
    const n = clamp(Math.round(Number(milhares) || 1), 1, 20);
    if (c.lug + c.obras + n * 1000 > MAX_LUGARES) return { erro: 'O estádio não pode passar de ' + MAX_LUGARES.toLocaleString('pt-PT') + ' lugares.' };
    const custo = n * CUSTO_LUGARES;
    if (custo > c.din) return { erro: 'As obras custam ' + fmtEur(custo) + ' e tens ' + fmtEur(c.din) + '.' };
    c.din -= custo;
    c.obras += n * 1000;
    return { ok: true, custo };
  }
  function definirBilhete(m, clubeId, preco) {
    const c = m.clubes[clubeId];
    c.bil = clamp(Math.round(Number(preco) || econ(m, c.div).bilhete), 1, 250);
    return { ok: true, bil: c.bil };
  }
  function emprestimo(m, clubeId, montante) {
    const c = m.clubes[clubeId];
    const v = Math.round(Number(montante) || 0);
    if (v > 0) {
      const lim = econ(m, c.div).credito - c.emp;
      if (v > lim) return { erro: 'O banco só te empresta mais ' + fmtEur(Math.max(0, lim)) + '.' };
      c.emp += v;
      c.din += v;
    } else if (v < 0) {
      const pagar = Math.min(-v, c.emp);
      if (pagar > c.din) return { erro: 'Não tens dinheiro para pagar isso.' };
      c.emp -= pagar;
      c.din -= pagar;
    }
    return { ok: true, emp: c.emp };
  }

  // ---------------------------------------------------------------
  // Despedimentos e convites (carreira do treinador)
  // ---------------------------------------------------------------
  function verificarDespedimentos(m, rng) {
    const p = m.cal[m.passo];
    for (const id in m.clubes) {
      const c = m.clubes[id];
      if (!c.hum) continue;
      const cls = classificacao(m, c.div);
      const lugar = cls.findIndex((x) => x.id === c.id);
      const divida = c.din < -econ(m, c.div).credito * 0.6;
      const mau = c.sem >= 8 && lugar >= POR_DIV - 2 && m.tab[c.id].j >= 8;
      if (divida || mau) {
        const login = c.hum;
        const t = treinadorDe(m, login);
        t.hist.push({ e: m.epoca, ano: m.ano, cl: c.n, div: c.div, fim: 'despedido' });
        noticia(m, '🚪 ' + login + ' foi despedido do ' + c.n + (divida ? ' (dívidas a mais).' : ' (maus resultados).'), c.id);
        c.hum = null;
        c.xi = null;
        c.banco = null;
        t.clube = null;
        t.despedido = true;
        const inf = infoDiv(m, c.div);
        const maxN = PAISES[inf.p].divs.length - 1;
        t.ofertas = ofertasPara(m, inf.p, Math.min(maxN, inf.n + (rng.chance(0.5) ? 1 : 0)), 3, rng, c.id);
      }
    }
    void p;
  }
  // convites: clubes sem treinador humano de um país/divisão (nível 0 = 1.ª)
  function ofertasPara(m, pais, nivel, n, rng, excluir, outrosPaises) {
    const nivelDe = (c) => infoDiv(m, c.div).n;
    const livres = Object.values(m.clubes).filter((c) => !c.hum && c.id !== excluir);
    let lista = livres.filter((c) => (outrosPaises ? c.pais !== pais && nivelDe(c) === 0 : c.pais === pais && nivelDe(c) === nivel));
    if (lista.length < n && !outrosPaises) lista = lista.concat(livres.filter((c) => c.pais === pais && nivelDe(c) > nivel));
    lista = lista.slice();
    for (let i = lista.length - 1; i > 0; i--) {
      const k = Math.floor(rng.r() * (i + 1));
      [lista[i], lista[k]] = [lista[k], lista[i]];
    }
    return lista.slice(0, n).map((c) => c.id);
  }
  function assumirClube(m, login, clubeId) {
    const c = m.clubes[clubeId];
    if (!c) return { erro: 'Clube inválido.' };
    if (c.hum && c.hum !== login) return { erro: 'Esse clube já tem treinador.' };
    for (const id in m.clubes) if (m.clubes[id].hum === login) {
      const velho = m.clubes[id];
      velho.hum = null;
      velho.xi = null;
      velho.banco = null;
    }
    c.hum = login;
    c.auto = false;
    c.xi = null;
    c.banco = null;
    c.mor = Math.max(c.mor, 10);
    const t = treinadorDe(m, login);
    t.clube = clubeId;
    t.despedido = false;
    t.ofertas = [];
    t.desde = { e: m.epoca, ano: m.ano };
    noticia(m, '🤝 ' + login + ' é o novo treinador do ' + c.n + '.', c.id);
    return { ok: true };
  }

  // ---------------------------------------------------------------
  // Fim de época: prémios, subidas/descidas, idades, juniores
  // ---------------------------------------------------------------
  function fimDeEpoca(m, rng) {
    const tacasCamp = {};
    for (const pais in m.tacas) tacasCamp[pais] = m.tacas[pais].campeao;
    const resumo = { epoca: m.epoca, ano: m.ano, campeoes: [], sobem: [], descem: [], tacas: tacasCamp, artilheiro: null };
    const art = artilheiros(m, 1)[0];
    if (art) {
      resumo.artilheiro = { n: art.n, cl: art.cl, gol: art.gol };
      m.clubes[art.cl].din += PREMIO_ARTILHEIRO;
      noticia(m, '👟 ' + art.n + ' (' + m.clubes[art.cl].n + ') é o melhor marcador com ' + art.gol + ' golos.', art.cl);
    }
    const tabelas = m.divs.map((_, d) => classificacao(m, d));
    tabelas.forEach((cls, d) => {
      const inf = infoDiv(m, d);
      const ec = econ(m, d);
      const camp = m.clubes[cls[0].id];
      camp.din += ec.premio;
      m.clubes[cls[1].id].din += Math.round(ec.premio / 2);
      resumo.campeoes.push(camp.id);
      noticia(m, '🏆 ' + camp.n + ' é campeão da ' + nomeDiv(m, d) + '!', camp.id);
      cls.forEach((linha, lugar) => {
        const c = m.clubes[linha.id];
        if (!c.hum) return;
        const t = treinadorDe(m, c.hum);
        if (lugar === 0) {
          t.pts += [30, 15, 10, 6][inf.n] || 6;
          t.titulos.push({ e: m.epoca, ano: m.ano, t: 'Campeão ' + nomeDiv(m, d), cl: c.n });
        }
        if (inf.n > 0 && lugar < 2) t.pts += 5;
        t.hist.push({ e: m.epoca, ano: m.ano, cl: c.n, div: d, dn: nomeDiv(m, d), lugar: lugar + 1 });
        // convites: quem acaba nos 2 primeiros recebe propostas de cima;
        // o campeão da 1.ª pode ser chamado por clubes de outros países
        if (lugar < 2 && inf.n > 0) t.ofertas = ofertasPara(m, inf.p, inf.n - 1, 2, rng, c.id);
        else if (lugar === 0 && inf.n === 0 && m.paises.length > 1) t.ofertas = ofertasPara(m, inf.p, 0, 2, rng, c.id, true);
        else if (lugar === 0) t.ofertas = [];
      });
    });
    // subidas e descidas (2) dentro de cada país
    const novas = m.divs.map((ids) => ids.slice());
    for (const pais of m.paises) {
      const ds = divsDoPais(m, pais);
      for (let k = 0; k + 1 < ds.length; k++) {
        const d = ds[k];
        const d2 = ds[k + 1];
        const desce = tabelas[d].slice(-2).map((x) => x.id);
        const sobe = tabelas[d2].slice(0, 2).map((x) => x.id);
        novas[d] = novas[d].filter((id) => !desce.includes(id)).concat(sobe);
        novas[d2] = novas[d2].filter((id) => !sobe.includes(id)).concat(desce);
        resumo.sobem.push(...sobe);
        resumo.descem.push(...desce);
        for (const id of sobe) noticia(m, '⬆️ ' + m.clubes[id].n + ' sobe à ' + nomeDiv(m, d) + '.', id);
        for (const id of desce) noticia(m, '⬇️ ' + m.clubes[id].n + ' desce à ' + nomeDiv(m, d2) + '.', id);
      }
    }
    m.divs = novas;
    novas.forEach((ids, d) => ids.forEach((id) => (m.clubes[id].div = d)));
    // idades, reformas e juniores
    for (const cid in m.clubes) {
      const c = m.clubes[cid];
      for (const jid of c.pl.slice()) {
        const j = m.jog[jid];
        j.i++;
        if (j.i >= 33) j.f = Math.max(1, Math.round((j.f - rng.int(1, 4)) * 10) / 10);
        j.sal = salarioDe(j);
        j.am = 0;
        const reforma = j.i >= 37 || (j.i >= 35 && rng.chance(0.5)) || (j.i >= 33 && j.f < 25 && rng.chance(0.4));
        if (reforma && c.pl.length > MIN_PLANTEL) {
          c.pl = c.pl.filter((x) => x !== jid);
          if (Array.isArray(c.xi)) c.xi = c.xi.map((x) => (x === jid ? null : x));
          delete m.jog[jid];
          if (c.hum) noticia(m, '👴 ' + j.n + ' terminou a carreira aos ' + j.i + ' anos.', c.id);
        }
      }
      // 2 juniores por época (17-19 anos), às vezes sai um craque
      for (let k = 0; k < 2; k++) {
        if (c.pl.length >= MAX_PLANTEL) break;
        const pos = rng.peso(['G', 'D', 'M', 'A'], [1, 3, 3, 3]);
        const j = novoJogador(m, rng, pos, Math.max(8, c.nivel * 0.55), rng.int(17, 19), { craque: 0.04, pais: c.pais });
        j.cl = c.id;
        c.pl.push(j.id);
        if (c.hum) noticia(m, '🌱 Subiu dos juniores: ' + j.n + ' (' + j.p + ', força ' + Math.round(j.f) + (j.c ? ', craque!' : '') + ').', c.id);
      }
      // a IA mantém o plantel entre 20 e 26
      if (!c.hum) {
        while (c.pl.length > 24) {
          const pior = c.pl.map((x) => m.jog[x]).sort((a, b) => a.f - b.f)[0];
          c.pl = c.pl.filter((x) => x !== pior.id);
          pior.cl = null;
          m.mercado.livres.push(pior.id);
        }
        c.bil = econ(m, c.div).bilhete;
      }
      c.sem = 0;
    }
    // limpa jogadores livres a mais e órfãos
    m.mercado.livres = m.mercado.livres.filter((id) => m.jog[id]).slice(-20);
    m.mercado.leiloes = [];
    const vivos = new Set(m.mercado.livres);
    for (const cid in m.clubes) for (const jid of m.clubes[cid].pl) vivos.add(jid);
    for (const jid in m.jog) if (!vivos.has(jid)) delete m.jog[jid];

    m.historia.unshift(resumo);
    if (m.historia.length > 30) m.historia.length = 30;
    m.epoca++;
    m.ano++;
    m.fimEpoca = resumo;
    novaEpoca(m, rng);
    noticia(m, '📅 Começa a época ' + m.ano + '/' + String(m.ano + 1).slice(2) + '.');
  }

  // ---------------------------------------------------------------
  // Jogo amigável entre duas equipas soltas (Desafios)
  // equipa = { nome, cor, tat:{f,e,m,foco}, xi:[jog...], banco:[jog...], mor }
  // ---------------------------------------------------------------
  function jogoAmigavel(eqA, eqB, semente) {
    const m = { clubes: {}, jog: {}, s: semente >>> 0 || 7 };
    const prep = (eq, id) => {
      const jogs = (eq.xi || []).concat(eq.banco || []);
      jogs.forEach((j, k) => {
        const jid = id + '_' + k;
        m.jog[jid] = Object.assign({ ca: [], cp: 3, c: 0, nac: 'PT', i: 25, p: 'M', f: 30, gol: 0, golT: 0 }, j, { id: jid });
      });
      m.clubes[id] = { id, n: eq.nome, mor: clamp(Number(eq.mor) || 10, 0, 20), pl: Object.keys(m.jog).filter((k) => k.startsWith(id + '_')) };
      const tat = Object.assign({ f: '4-4-2', e: 'eq', m: 'n', foco: 'meio' }, eq.tat || {});
      if (!FORMACOES[tat.f]) tat.f = '4-4-2';
      const nxi = (eq.xi || []).length;
      return {
        tat,
        xi: Array.from({ length: posicoesDa(tat.f).length }, (_, k) => (k < nxi ? id + '_' + k : null)),
        banco: (eq.banco || []).map((_, k) => id + '_' + (nxi + k)),
      };
    };
    const ea = prep(eqA, 'A');
    const eb = prep(eqB, 'B');
    const jogo = criarJogo(m, { h: 'A', a: 'B', tipo: 'T', neutro: true }, ea, eb);
    const { rng, guardar } = rngDoMundo(m);
    while (!jogo.fim) passo(m, jogo, rng, []);
    guardar();
    const nomeDe = (jid) => (m.jog[jid] ? m.jog[jid].n : '?');
    return {
      gh: jogo.gh,
      ga: jogo.ga,
      pen: jogo.pen,
      vencedor: vencedor(jogo) === 'A' ? 'a' : 'b',
      posse: Math.round(((jogo.posse || 45) / Math.max(1, jogo.min)) * 100),
      ev: jogo.ev.map((e) => Object.assign({}, e, { n: e.j ? nomeDe(e.j) : undefined, n2: e.j2 ? nomeDe(e.j2) : undefined })),
    };
  }

  // ---------------------------------------------------------------
  // Utilitários de apresentação
  // ---------------------------------------------------------------
  function fmtEur(v) {
    const n = Math.round(Number(v) || 0);
    const a = Math.abs(n);
    let s;
    if (a >= 1e6) s = (a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace('.', ',').replace(/,?0+$/, '') + ' M€';
    else if (a >= 1e3) s = Math.round(a / 1e3) + ' mil €';
    else s = a + ' €';
    return (n < 0 ? '−' : '') + s;
  }
  function textoEvento(m, ev, nomeClube) {
    const j = ev.j && m.jog[ev.j];
    const nome = (j && j.n) || ev.n || '?';
    switch (ev.t) {
      case 'g':
        return '⚽ GOLO! ' + nome + (ev.k === 'pen' ? ' (penálti)' : ev.k === 'cab' ? ' (de cabeça)' : '');
      case 'pen':
        return '🎯 Penálti para o ' + nomeClube + '!';
      case 'pf':
        return '❌ ' + nome + ' falha o penálti!';
      case 'am':
        return '🟨 Amarelo para ' + nome;
      case 'vm':
        return '🟥 Vermelho direto para ' + nome + '!';
      case 'va':
        return '🟨🟥 Segundo amarelo, ' + nome + ' é expulso!';
      case 'les':
        return '🚑 ' + nome + ' lesionou-se';
      case 's': {
        const j2 = ev.j2 && m.jog[ev.j2];
        return '🔄 Entra ' + nome + ', sai ' + ((j2 && j2.n) || ev.n2 || '?');
      }
      case 'pos':
        return '😱 ' + nome + ' acerta no poste!';
      case 'bar':
        return '😱 ' + nome + ' acerta na barra!';
      case 'def':
        return '🧤 Grande defesa ao remate de ' + nome;
      case 'int':
        return '⏸️ Intervalo';
      case 'gp':
        return '🥅 Penáltis: ' + ev.x;
      default:
        return '';
    }
  }

  return {
    VERSAO,
    CLUBES,
    NOMES_DIV,
    PAISES,
    nomeDiv,
    infoDiv,
    econ,
    divsDoPais,
    nomeRonda,
    migrar,
    DIV,
    FORMACOES,
    ESTILOS,
    MARCACOES,
    FOCOS,
    CARACT,
    COMPORTAMENTO,
    RONDAS_TACA,
    MAX_PLANTEL,
    MIN_PLANTEL,
    MAX_SUBS,
    CUSTO_LUGARES,
    JURO,
    criarRng,
    criarMundo,
    posicoesDa,
    melhorOnze,
    forcaOnze,
    escalacaoHumana,
    prepararJornada,
    correrJogos,
    passo,
    substituir,
    mudarTatica,
    concluirJornada,
    jogarJornada,
    classificacao,
    artilheiros,
    valor,
    salarioDe,
    precoPedido,
    porLeilao,
    licitar,
    comprarDireto,
    venderJa,
    dispensar,
    ampliarEstadio,
    definirBilhete,
    emprestimo,
    assumirClube,
    treinadorDe,
    ofertasPara,
    jogoAmigavel,
    vencedor,
    fmtEur,
    textoEvento,
    rngDoMundo,
  };
});
