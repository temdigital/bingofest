/*
 * Configuração pública do Bingo Fest.
 * Nunca use a service_role key no navegador.
 */
(() => {
  if (!document.querySelector('link[data-bingo-fixes]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/fixes.css?v=20260624-2';
    link.dataset.bingoFixes = 'true';
    document.head.append(link);
  }
})();

window.BINGO_FEST_CONFIG = Object.freeze({
  supabaseUrl: "https://xxcywisrjfgxxfwcsovj.supabase.co",
  supabaseAnonKey: "sb_publishable_Ut43Axzyxc9yqL33CDA5iA_wSQ0tMUN",
  autoDrawIntervalMs: 5000,
  winnerPauseMs: 6000,
  speechEnabled: true
});
