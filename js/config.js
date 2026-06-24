/*
 * Configuração pública do Bingo Fest.
 * Nunca use a service_role key no navegador.
 */
(() => {
  const styles = [
    ["bingoFixes", "css/fixes.css?v=20260624-2"],
    ["bingoManualGame", "css/manual-game.css?v=20260624-1"]
  ];

  styles.forEach(([datasetKey, href]) => {
    if (document.querySelector(`link[data-${datasetKey.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset[datasetKey] = "true";
    document.head.append(link);
  });
})();

window.BINGO_FEST_CONFIG = Object.freeze({
  supabaseUrl: "https://xxcywisrjfgxxfwcsovj.supabase.co",
  supabaseAnonKey: "sb_publishable_Ut43Axzyxc9yqL33CDA5iA_wSQ0tMUN",
  autoDrawIntervalMs: 5000,
  winnerPauseMs: 6000,
  speechEnabled: true
});
