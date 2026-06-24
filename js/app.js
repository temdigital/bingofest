(() => {
  "use strict";
  const BF = window.BingoFest;
  const { escapeHtml, parseRoute, navigate, toast, setBusy } = BF.utils;
  const publicRoutes = new Set(["/", "/login", "/register"]);

  function renderHome() {
    document.getElementById("app").innerHTML = `<section class="hero">
      <div class="hero-card">
        <img class="hero-logo" src="assets/images/rei-oficial.png" alt="Família REI Personalizações">

        <div class="hero-heading">
          <span class="hero-kicker">Bingo online de 75 bolas</span>
          <h1>Bingo Fest</h1>
          <p>Uma celebração em tempo real para jogar, torcer e compartilhar bons momentos.</p>
        </div>

        <blockquote class="luck-message">
          <p>Na tradição chinesa, o vermelho representa alegria e prosperidade, e o número 8 é associado à boa fortuna. Que cada número chamado traga esperança, encontros felizes e muitos motivos para celebrar.</p>
          <footer class="luck-signature">Família REI <span aria-hidden="true">&#128081;</span></footer>
        </blockquote>

        <div class="hero-actions">
          <button class="button button-yellow" type="button" data-route="/login">Entrar</button>
          <button class="button button-primary" type="button" data-route="/register">Cadastrar</button>
        </div>
      </div>
    </section>`;
  }

  function renderConfigWarning() {
    document.getElementById("app").innerHTML = `<section class="screen"><div class="card config-warning"><h1>Configuração necessária</h1><p>O código foi instalado, mas precisa das credenciais públicas do projeto Supabase.</p><code>js/config.js</code><p>Preencha a URL e a chave pública do projeto. Nunca coloque uma chave administrativa no navegador.</p><button class="button" type="button" data-route="/">Voltar</button></div></section>`;
  }

  function renderAuth(mode) {
    const login = mode === "login";
    document.getElementById("app").innerHTML = `<section class="screen auth-screen"><div class="card form-card"><div class="page-heading"><h1>${login ? "Entrar" : "Cadastrar"}</h1><p>${login ? "Acesse sua conta para participar." : "Crie sua conta com e-mail e senha."}</p></div>
      <form id="auth-form">
        ${login ? "" : '<div class="form-group"><label for="name">Nome</label><input id="name" class="form-control" autocomplete="name" minlength="2" maxlength="80" required></div>'}
        <div class="form-group"><label for="email">E-mail</label><input id="email" class="form-control" type="email" autocomplete="email" required></div>
        <div class="form-group"><label for="password">Senha</label><input id="password" class="form-control" type="password" autocomplete="${login ? "current-password" : "new-password"}" minlength="6" required><div class="form-help">Mínimo de 6 caracteres.</div></div>
        <button class="button button-primary button-block" type="submit">${login ? "Entrar" : "Criar conta"}</button>
      </form>
      <div class="auth-links">${login ? 'Não tem conta? <button class="route-link" type="button" data-route="/register">Cadastre-se</button>' : 'Já tem conta? <button class="route-link" type="button" data-route="/login">Entre</button>'}</div>
      <div class="auth-back"><button class="route-link" type="button" data-route="/">Voltar à tela inicial</button></div>
    </div></section>`;

    document.getElementById("auth-form").addEventListener("submit", async event => {
      event.preventDefault();
      const button = event.currentTarget.querySelector("button[type='submit']");
      setBusy(button, true, login ? "Entrando…" : "Cadastrando…");
      try {
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        if (login) {
          await BF.auth.signIn(email, password);
          navigate(BF.state.profile?.role === "admin" ? "/admin" : "/lobby");
        } else {
          const result = await BF.auth.signUp(document.getElementById("name").value, email, password);
          if (result.session) navigate("/lobby");
          else {
            toast("Cadastro criado. Confirme seu e-mail para entrar.", "success", 7000);
            navigate("/login");
          }
        }
      } catch (error) {
        toast(error.message || "Não foi possível autenticar.", "error");
        setBusy(button, false);
      }
    });
  }

  function updateChrome() {
    const authenticated = Boolean(BF.state.user);
    const route = parseRoute();
    const showChrome = authenticated && !publicRoutes.has(route.path);
    const header = document.getElementById("app-header");
    const navigation = document.getElementById("bottom-nav");
    const adminLink = document.getElementById("admin-nav-link");

    header.hidden = !showChrome;
    navigation.hidden = !showChrome;
    header.setAttribute("aria-hidden", String(!showChrome));
    navigation.setAttribute("aria-hidden", String(!showChrome));
    document.getElementById("header-user-name").textContent = BF.state.profile?.name || BF.state.user?.email || "";
    adminLink.hidden = BF.state.profile?.role !== "admin";

    document.querySelectorAll("[data-nav]").forEach(link => {
      link.classList.toggle("active", route.path.includes(link.dataset.nav));
    });
  }

  async function route() {
    try {
      if (typeof BF.state.routeCleanup === "function") BF.state.routeCleanup();
      BF.state.routeCleanup = null;
      const { path, query } = parseRoute();

      if (!BF.auth.isConfigured() && path !== "/") {
        renderConfigWarning();
        updateChrome();
        return;
      }

      const authenticated = Boolean(BF.state.user);
      if (!publicRoutes.has(path) && !authenticated) return navigate("/login");
      if (authenticated && ["/login", "/register", "/"].includes(path)) {
        return navigate(BF.state.profile?.role === "admin" ? "/admin" : "/lobby");
      }
      if (path === "/admin" && BF.state.profile?.role !== "admin") return navigate("/lobby");
      if (path === "/lobby" && BF.state.profile?.role === "admin") return navigate("/admin");

      switch (path) {
        case "/": renderHome(); break;
        case "/login": renderAuth("login"); break;
        case "/register": renderAuth("register"); break;
        case "/lobby": await BF.lobby.render(); break;
        case "/waiting-room": BF.state.routeCleanup = await BF.waitingRoom.render(query.get("round")); break;
        case "/game": BF.state.routeCleanup = await BF.game.render(query.get("round")); break;
        case "/result": await BF.lobby.renderResult(query.get("round")); break;
        case "/history": await BF.history.render(); break;
        case "/admin": BF.state.routeCleanup = await BF.admin.render(); break;
        default: navigate(authenticated ? "/lobby" : "/");
      }

      updateChrome();
      document.getElementById("app")?.focus({ preventScroll: true });
    } catch (error) {
      console.error(error);
      document.getElementById("app").innerHTML = `<section class="screen"><div class="card"><h1>Não foi possível carregar esta tela</h1><p>${escapeHtml(error.message || "Erro inesperado")}</p><button class="button" type="button" data-route="/lobby">Voltar ao Lobby</button></div></section>`;
      toast(error.message || "Erro inesperado.", "error");
      updateChrome();
    }
  }

  async function init() {
    if (BF.auth.isConfigured()) {
      BF.auth.initClient();
      await BF.auth.refreshSession();
      BF.auth.watchAuth();
    }

    document.addEventListener("click", event => {
      const trigger = event.target.closest("[data-route]");
      if (!trigger) return;
      event.preventDefault();
      navigate(trigger.dataset.route);
    });

    document.getElementById("logout-button").addEventListener("click", async () => {
      await BF.auth.signOut();
      updateChrome();
      navigate("/");
    });

    window.addEventListener("hashchange", route);
    await route();
  }

  BF.app = { init, route, updateChrome };
  window.addEventListener("DOMContentLoaded", init);
})();
