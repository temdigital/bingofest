(() => {
  "use strict";
  const BF = window.BingoFest;
  const { escapeHtml, renderBingoCard, getPrizeCard, navigate, toast } = BF.utils;
  let channel = null;

  function cleanup() {
    if (channel && BF.supabase) BF.supabase.removeChannel(channel);
    channel = null;
  }

  async function render(roundId) {
    cleanup();
    const app = document.getElementById("app");
    app.innerHTML = '<section class="screen screen-loading"><div class="spinner"></div><p>Preparando sala de espera…</p></section>';
    const [{ data: round, error: roundError }, { data: card, error: cardError }] = await Promise.all([
      BF.supabase.from("rounds").select("*").eq("id", roundId).single(),
      BF.supabase.from("cards").select("*").eq("round_id", roundId).eq("user_id", BF.state.user.id).single()
    ]);
    if (roundError) throw roundError;
    if (cardError) throw cardError;
    if (round.status === "active") return navigate(`/game?round=${roundId}`);
    if (round.status === "cancelled") return navigate("/lobby");

    app.innerHTML = `<section class="screen">
      <div class="page-heading"><h1>Sala de Espera</h1><p>${escapeHtml(round.name)}</p></div>
      <div class="card">
        <div class="waiting-message"><span class="pulse"></span>Aguardando o administrador iniciar a rodada…</div>
        ${renderBingoCard(getPrizeCard(card, 1), [], { code: `${card.card_code}-P1` })}
      </div>
      <div class="card-soft" style="margin-top:16px">
        <strong>Como jogar</strong>
        <p class="meta">Quando uma bola for sorteada, clique no mesmo número da sua cartela para marcá-lo. A cada novo prêmio, você receberá uma cartela com números diferentes.</p>
      </div>
      <p class="meta" style="text-align:center;margin-top:15px">Mantenha esta tela aberta. A entrada no jogo será automática.</p>
    </section>`;

    channel = BF.supabase.channel(`round-${roundId}-waiting`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rounds", filter: `id=eq.${roundId}` }, payload => {
        const updated = payload.new;
        if (updated.status === "active") navigate(`/game?round=${roundId}`);
        if (updated.status === "cancelled") {
          toast("A rodada foi cancelada pelo administrador.", "error");
          navigate("/lobby");
        }
      }).subscribe();

    return cleanup;
  }

  BF.waitingRoom = { render, cleanup };
})();
