(() => {
  "use strict";
  const BF = window.BingoFest = window.BingoFest || {};

  function isConfigured() {
    const cfg = window.BINGO_FEST_CONFIG || {};
    return Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && !cfg.supabaseUrl.includes("YOUR_") && !cfg.supabaseAnonKey.includes("YOUR_"));
  }

  function initClient() {
    if (!isConfigured()) return null;
    if (!window.supabase?.createClient) throw new Error("SDK do Supabase não foi carregado.");
    if (!BF.supabase) {
      BF.supabase = window.supabase.createClient(window.BINGO_FEST_CONFIG.supabaseUrl, window.BINGO_FEST_CONFIG.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    }
    return BF.supabase;
  }

  async function loadProfile(userId) {
    const client = initClient();
    if (!client || !userId) return null;
    const { data, error } = await client.from("profiles").select("id,name,role,created_at").eq("id", userId).single();
    if (error) throw error;
    return data;
  }

  async function refreshSession() {
    const client = initClient();
    if (!client) {
      BF.state.session = null;
      BF.state.user = null;
      BF.state.profile = null;
      return null;
    }
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    BF.state.session = session;
    BF.state.user = session?.user || null;
    BF.state.profile = session?.user ? await loadProfile(session.user.id) : null;
    return session;
  }

  async function signIn(email, password) {
    const client = initClient();
    if (!client) throw new Error("Configure o Supabase antes de entrar.");
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    BF.state.session = data.session;
    BF.state.user = data.user;
    BF.state.profile = await loadProfile(data.user.id);
    return data;
  }

  async function signUp(name, email, password) {
    const client = initClient();
    if (!client) throw new Error("Configure o Supabase antes de cadastrar.");
    const cleanName = name.trim();
    if (cleanName.length < 2) throw new Error("Informe um nome com pelo menos 2 caracteres.");
    if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: cleanName } }
    });
    if (error) throw error;
    if (data.session) {
      BF.state.session = data.session;
      BF.state.user = data.user;
      BF.state.profile = await loadProfile(data.user.id);
    }
    return data;
  }

  async function signOut() {
    if (BF.supabase) await BF.supabase.auth.signOut();
    BF.state.session = null;
    BF.state.user = null;
    BF.state.profile = null;
  }

  function watchAuth() {
    const client = initClient();
    if (!client) return;
    client.auth.onAuthStateChange(async (_event, session) => {
      BF.state.session = session;
      BF.state.user = session?.user || null;
      try {
        BF.state.profile = session?.user ? await loadProfile(session.user.id) : null;
      } catch (error) {
        console.error(error);
      }
      BF.app?.updateChrome?.();
    });
  }

  BF.auth = { isConfigured, initClient, loadProfile, refreshSession, signIn, signUp, signOut, watchAuth };
})();
