// ===================================================================
// ESTV — Configuração de ligação ao backend real
// ===================================================================
//
// Liga o site aos pontos "a sério", guardados no StreamElements através
// da nossa API no Vercel, em vez de ficarem só no localStorage do browser.
// ===================================================================

const ESTV_CONFIG = {
  API_BASE_URL: 'https://estv-api-delta.vercel.app',
  REMOTE_POINTS: true,
};
