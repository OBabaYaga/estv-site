// ===================================================================
// ESTV — Configuração de ligação ao backend real
// ===================================================================
//
// Liga o site aos pontos "a sério" (StreamElements) e às Jornadas de
// apostas partilhadas, guardados na nossa API no Vercel, em vez de
// ficarem só no localStorage de cada browser.
// ===================================================================

const ESTV_CONFIG = {
  API_BASE_URL: 'https://estv-api-delta.vercel.app',
  REMOTE_POINTS: true,
};
