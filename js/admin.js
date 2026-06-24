(() => {
  "use strict";
  const BF = window.BingoFest;
  const { escapeHtml, formatDate, statusLabel, prizeLabel, renderDrawnNumbers, toast, setBusy, celebrate } = BF.utils;
  let rounds = [], selectedRoundId = null, selectedRound = null, details = null, channel = null, autoTimer = null;
  let autoEnabled = false, autoBusy = false;

  function cleanup() { if (channel && BF.supabase) BF.supabase.removeChannel(channel); channel = null; stopAuto(); }
  function stopAuto() { if (autoTimer) window.clearInterval(autoTimer); autoTimer = null; autoEnabled = false; autoBusy = false; }

  async function loadRounds() {
    const { data, error } = await BF.supabase.from("rounds").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    rounds = data || [];
    if (!selectedRoundId && rounds.length) selectedRoundId = rounds.find(item => ["waiting", "active"].includes(item.status))?.id || rounds[0].id;
    selectedRound = rounds.find(item => item.id === selectedRoundId) || null;
  }

  async function loadDetails() {
    details = null;
    if (!selectedRoundId) return;
    const { data, error } = await BF.supabase.rpc("get_admin_round", { p_round_id: selectedRoundId });
    if (error) throw error;
    details = data;
    selectedRound = data.round;
  }

  function roundListHtml() {
    if (!rounds.length) return '<div class="empty-state">Nenhuma rodada criada.</div>';
    return `<div class="admin-round-list">${rounds.map(item => `<button class="admin-round-button${item.id === selectedRoundId ? " selected" : ""}" data-select-round="${item.id}"><strong>${escapeHtml(item.name)}</strong><br><span class="meta">${statusLabel(item.status)} · ${formatDate(item.created_at)}</span></button>`).join("")}</div>`;
  }

  function controlHtml() {
    if (!selectedRound) return '<div class="empty-state">Crie uma rodada para abrir o controle.</div>';
    const prizeWon = (selectedRound.prizes || []).some(item => Number(item.prize_number) === Number(selectedRound.current_prize));
    const controllable = ["waiting", "active"].includes(selectedRound.status);
    const winners = details?.winners || [], participants = details?.participants || [];
    return `<div><div class="round-card-header"><div><h2>${escapeHtml(selectedRound.name)}</h2><p class="meta">${participants.length} participante(s)</p></div><span class="status-badge status-${selectedRound.status}">${statusLabel(selectedRound.status)}</span></div>
      ${selectedRound.status === "waiting" ? '<button id="start-round" class="button button-primary button-block">Iniciar Rodada</button>' : ""}
      ${selectedRound.status === "active" ? `<div class="prize-banner" style="margin:14px 0">Prêmio atual<strong>${prizeLabel(selectedRound.current_prize)}</strong></div>
        <div class="switch-row"><div><strong>Sorteio automático</strong><div class="meta">Um número a cada 5 segundos</div></div><label class="switch"><input id="auto-toggle" type="checkbox" ${autoEnabled ? "checked" : ""}><span class="switch-slider"></span></label></div>
        <div class="admin-number-controls"><button id="draw-number" class="button button-yellow" ${autoEnabled || prizeWon ? "disabled" : ""}>Sortear Número</button><button id="advance-prize" class="button button-primary" ${prizeWon ? "" : "disabled"}>${Number(selectedRound.current_prize) === 4 ? "Concluir Rodada" : "Próximo Sorteio"}</button></div>
        <h3 style="margin-top:20px">Números do sorteio</h3>${renderDrawnNumbers(selectedRound.drawn_numbers || [])}` : ""}
      <h3 style="margin-top:20px">Ganhadores registrados</h3><div class="winner-list">${winners.length ? winners.map(item => `<div class="winner-item"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.email || "")}</span><br><span>${prizeLabel(item.won_prize)} · ${escapeHtml(item.card_code)}</span></div>`).join("") : '<div class="empty-state">Nenhum ganhador até agora.</div>'}</div>
      ${controllable ? '<div class="button-row" style="margin-top:20px"><button id="cancel-round" class="button button-danger">Cancelar Rodada</button><button id="finish-round" class="button button-warning">Encerrar Rodada</button></div>' : ""}</div>`;
  }

  function renderView() {
    document.getElementById("app").innerHTML = `<section class="screen"><div class="page-heading"><h1>Painel Administrativo</h1><p>Criação e controle centralizado das rodadas.</p></div><div class="admin-layout"><aside>
      <div class="card"><h2>Nova rodada</h2><form id="new-round-form"><div class="form-group"><label for="round-name">Nome</label><input id="round-name" class="form-control" required minlength="3" maxlength="80" placeholder="Ex.: Sexta dos Amigos"></div><button class="button button-primary button-block" type="submit">Criar e abrir controle</button></form></div>
      <div class="card"><h2>Rodadas</h2>${roundListHtml()}</div></aside><section class="card">${controlHtml()}</section></div></section>`;
    bindEvents();
  }

  async function refresh() { await loadRounds(); await loadDetails(); renderView(); subscribeSelected(); }
  function subscribeSelected() {
    if (channel && BF.supabase) BF.supabase.removeChannel(channel); channel = null;
    if (!selectedRoundId) return;
    channel = BF.supabase.channel(`admin-round-${selectedRoundId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "rounds", filter: `id=eq.${selectedRoundId}` }, async payload => {
      const hadPrize = (selectedRound?.prizes || []).length; selectedRound = payload.new;
      if ((selectedRound.prizes || []).length > hadPrize) celebrate();
      await loadRounds(); await loadDetails(); renderView();
    }).subscribe();
  }

  async function drawNumber() {
    if (autoBusy || !selectedRound || selectedRound.status !== "active") return null;
    autoBusy = true;
    try {
      const { data, error } = await BF.supabase.rpc("draw_number", { p_round_id: selectedRound.id });
      if (error) throw error;
      if (data?.winners?.length) { celebrate(); toast(`${prizeLabel(selectedRound.current_prize)} conquistada.`, "success"); }
      return data;
    } catch (error) { toast(error.message || "Falha ao sortear número.", "error"); stopAuto(); return null; }
    finally { autoBusy = false; }
  }

  function startAuto() {
    if (autoTimer || !selectedRound || selectedRound.status !== "active") return;
    autoEnabled = true; renderView();
    autoTimer = window.setInterval(async () => {
      if (autoBusy || !selectedRound || selectedRound.status !== "active") return;
      const prizeWon = (selectedRound.prizes || []).some(item => Number(item.prize_number) === Number(selectedRound.current_prize));
      if (prizeWon) {
        autoBusy = true; window.clearInterval(autoTimer); autoTimer = null;
        window.setTimeout(async () => {
          try { const { error } = await BF.supabase.rpc("advance_prize", { p_round_id: selectedRound.id }); if (error) throw error; autoBusy = false; if (selectedRound.status === "active") startAuto(); }
          catch (error) { autoBusy = false; stopAuto(); toast(error.message, "error"); }
        }, window.BINGO_FEST_CONFIG.winnerPauseMs);
        return;
      }
      await drawNumber();
    }, window.BINGO_FEST_CONFIG.autoDrawIntervalMs);
  }

  function bindEvents() {
    document.querySelectorAll("[data-select-round]").forEach(button => button.addEventListener("click", async () => { stopAuto(); selectedRoundId = button.dataset.selectRound; await loadDetails(); renderView(); subscribeSelected(); }));
    document.getElementById("new-round-form")?.addEventListener("submit", async event => {
      event.preventDefault(); const button = event.currentTarget.querySelector("button"); setBusy(button, true, "Criando…");
      try { const { data, error } = await BF.supabase.rpc("create_round", { p_name: document.getElementById("round-name").value.trim() }); if (error) throw error; selectedRoundId = data.id; toast("Rodada criada. Os jogadores já podem entrar.", "success"); await refresh(); }
      catch (error) { toast(error.message, "error"); setBusy(button, false); }
    });
    document.getElementById("start-round")?.addEventListener("click", async event => { setBusy(event.currentTarget, true, "Iniciando…"); const { error } = await BF.supabase.rpc("start_round", { p_round_id: selectedRound.id }); if (error) toast(error.message, "error"); else toast("Rodada iniciada.", "success"); });
    document.getElementById("draw-number")?.addEventListener("click", drawNumber);
    document.getElementById("auto-toggle")?.addEventListener("change", event => { if (event.currentTarget.checked) startAuto(); else { stopAuto(); renderView(); } });
    document.getElementById("advance-prize")?.addEventListener("click", async event => { setBusy(event.currentTarget, true, "Avançando…"); const { error } = await BF.supabase.rpc("advance_prize", { p_round_id: selectedRound.id }); if (error) { toast(error.message, "error"); setBusy(event.currentTarget, false); } });
    document.getElementById("cancel-round")?.addEventListener("click", async () => { if (!confirm("Cancelar esta rodada? As cartelas serão mantidas no histórico.")) return; stopAuto(); const { error } = await BF.supabase.rpc("cancel_round", { p_round_id: selectedRound.id }); if (error) toast(error.message, "error"); else toast("Rodada cancelada.", "success"); });
    document.getElementById("finish-round")?.addEventListener("click", async () => { if (!confirm("Encerrar a rodada agora?")) return; stopAuto(); const { error } = await BF.supabase.rpc("finish_round", { p_round_id: selectedRound.id }); if (error) toast(error.message, "error"); else toast("Rodada encerrada.", "success"); });
  }

  async function render() { cleanup(); document.getElementById("app").innerHTML = '<section class="screen screen-loading"><div class="spinner"></div><p>Carregando painel…</p></section>'; await loadRounds(); await loadDetails(); renderView(); subscribeSelected(); return cleanup; }
  BF.admin = { render, cleanup };
})();
