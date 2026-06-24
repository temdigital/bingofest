/*
 * Configure estes dois valores após criar o projeto no Supabase.
 * Nunca use a service_role key no navegador.
 */
window.BINGO_FEST_CONFIG = Object.freeze({
  supabaseUrl: "YOUR_SUPABASE_URL",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
  autoDrawIntervalMs: 5000,
  winnerPauseMs: 6000,
  speechEnabled: true
});
