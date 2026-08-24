// ===================================================================
// ESTV — Configuração de ligação ao backend real
// ===================================================================
//
// Isto controla se o site usa pontos "a sério" (guardados no
// StreamElements, via a nossa pequena API) ou continua em modo local
// (guardado só no browser — o que já tínhamos, bom para testar).
//
// PASSOS PARA ATIVAR (depois de o backend estar publicado no Vercel):
// 1. Muda API_BASE_URL abaixo para o URL da API (ex: "https://api.estv.pt").
// 2. Muda REMOTE_POINTS para true.
// Não precisas de mexer em mais nenhum ficheiro — todo o resto do site
// já sabe usar esta configuração automaticamente.
//
// Enquanto REMOTE_POINTS for false, nada muda: o site continua a
// funcionar exatamente como até agora (pontos locais + Modo de Teste).
// ===================================================================

const ESTV_CONFIG = {
  API_BASE_URL: 'https://estv-api-delta.vercel.app',
  REMOTE_POINTS: true,
};
