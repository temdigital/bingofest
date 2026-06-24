(() => {
  "use strict";
  const BF = window.BingoFest;
  const { escapeHtml, prizeLabel, renderBingoCard, renderDrawnNumbers, speakNumber, hasWin, navigate, toast, showModal, celebrate } = BF.utils;
  let channel = null;
  let round = null;
  let card = null;
  let announcedPrize = null;
  let lastSpokenNumber = null;
  let claiming = false;

  function cleanup() {
    if (channel && BF.supabase) BF.supabase.removeChannel(channel);
    channel = null;
    round = null;
    card = null;
    announcedPrize = null;
    lastSpokenNumber = null;
    claiming = false;
    window.speechSynthesis?.cancel();
  }

  function currentPrizeEntry() {
    return (round?.prizes || []).find(item => Number(item.prize_number) === Number(round.current_prize));
  }

  function renderGame() {
    const app = document.getElementById("app");
    const drawn = round.drawn_numbers || [];
    const latest = drawn.at(-1);
    app.innerHTML = `<section class="screen">
      <div class="page-heading"><h1>${escapeHtml(round.name)}</h1><p>Sua cartela é privada durante a partida.</p></div>
      <div class="prize-banner">Sorteio atual<strong>${prizeLabel(round.current_prize)}</strong></div>
      <div class="game-layout" style="margin-top:18px">
        <div class="card">${renderBingoCard(card.numbers, drawn, { code: card.card_code })}</div>
        <div class="card draw-panel">
          <h2>Números sorteados</h2>
          ${latest ? `<div class="last-ball" aria-label="Último número sorteado: ${latest}">${latest}</div>` : '<div class="empty-state" style="margin-bottom:16px">Aguardando o primeiro número.</div>'}
          ${renderDrawnNumbers(drawn)}
        </div>
      </div>
    </section>`;
  }

  async function tryClaim() {
    if (claiming || card.won_prize || currentPrizeEntry()) return;
    if (!hasWin(card.numbers, round.drawn_numbers, round.current_prize)) return;
    claiming = true;
    try {
      const { data, error } = await BF.supabase.rpc("claim_win", { p_round_id: round.id, p_card_id: card.id });
      if (error) throw error;
      if (data?.success) {
        card.won_prize = Number(round.current_prize);
        toast(`Bingo! Você conquistou ${prizeLabel(round.current_prize)}.`, "success");
      }
    } catch (error) {
      console.warn("Validação de vitória:", error.message);
    } finally {
      claiming = false;
    }
  }

  function announceWinner() {
    const prize = currentPrizeEntry();
    if (!prize || announcedPrize === Number(prize.prize_number)) return;
    announcedPrize = Number(prize.prize_number);
    const winners = prize.winners || [];
    const names = winners.map(item => escapeHtml(item.name)).join(", ") || "Ganhador confirmado";
    showModal({
      title: `Bingo! ${prizeLabel(prize.prize_number)}`,
      body: `<p><strong>${names}</strong></p><p>O próximo sorteio começará após a pausa.</p>`,
      autoCloseMs: window.BINGO_FEST_CONFIG.winnerPauseMs
    });
    celebrate();
  }

  async function applyRoundUpdate(updated) {
    const previousPrize = Number(round.current_prize);
    const previousLength = (round.drawn_numbers || []).length;
    round = updated;

    if (round.status === "cancelled") {
      toast("A rodada foi cancelada.", "error");
      return navigate("/lobby");
    }
    if (round.status === "finished") return navigate(`/result?round=${round.id}`);

    const latest = (round.drawn_numbers || []).at(-1);
    if (Number(round.current_prize) !== previousPrize) {
      announcedPrize = null;
      lastSpokenNumber = null;
    } else if ((round.drawn_numbers || []).length > previousLength && latest !== lastSpokenNumber) {
      lastSpokenNumber = latest;
      speakNumber(latest);
    }
    renderGame();
    await tryClaim();
    announceWinner();
  }

  async function render(roundId) {
    cleanup();
    const app = document.getElementById("app");
    app.innerHTML = '<section class="screen screen-loading"><div class="spinner"></div><p>Entrando no jogo…</p></section>';
    const [{ data: roundData, error: roundError }, { data: cardData, error: cardError }] = await Promise.all([
      BF.supabase.from("rounds").select("*").eq("id", roundId).single(),
      BF.supabase.from("cards").select("*").eq("round_id", roundId).eq("user_id", BF.state.user.id).single()
    ]);
    if (roundError) throw roundError;
    if (cardError) throw cardError;
    round = roundData;
    card = cardData;
    if (round.status === "waiting") return navigate(`/waiting-room?round=${roundId}`);
    if (round.status === "finished") return navigate(`/result?round=${roundId}`);
    if (round.status === "cancelled") return navigate("/lobby");

    renderGame();
    await tryClaim();
    announceWinner();

    channel = BF.supabase.channel(`round-${roundId}-game`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rounds", filter: `id=eq.${roundId}` }, payload => applyRoundUpdate(payload.new))
      .subscribe();

    return cleanup;
  }

  BF.game = { render, cleanup };
})();
