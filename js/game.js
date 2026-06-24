(() => {
  "use strict";
  const BF = window.BingoFest;
  const {
    escapeHtml, prizeLabel, renderBingoCard, renderDrawnNumbers, speakNumber,
    getPrizeCard, getPrizeMarks, navigate, toast, showModal, celebrate
  } = BF.utils;

  let channel = null;
  let round = null;
  let card = null;
  let announcedPrize = null;
  let lastSpokenNumber = null;
  let markingNumber = null;

  function cleanup() {
    if (channel && BF.supabase) BF.supabase.removeChannel(channel);
    channel = null;
    round = null;
    card = null;
    announcedPrize = null;
    lastSpokenNumber = null;
    markingNumber = null;
    window.speechSynthesis?.cancel();
  }

  function currentPrizeEntry() {
    return (round?.prizes || []).find(item => Number(item.prize_number) === Number(round.current_prize));
  }

  function currentNumbers() {
    return getPrizeCard(card, round.current_prize);
  }

  function currentMarks() {
    return getPrizeMarks(card, round.current_prize);
  }

  function alreadyWonCurrentPrize() {
    return (card?.won_prizes || []).map(Number).includes(Number(round.current_prize));
  }

  function bindCardEvents() {
    document.querySelectorAll("[data-card-number]").forEach(button => {
      button.addEventListener("click", () => markNumber(Number(button.dataset.cardNumber), button.dataset.drawn === "true"));
    });
  }

  function renderGame() {
    const app = document.getElementById("app");
    const drawn = round.drawn_numbers || [];
    const latest = drawn.at(-1);
    const marks = currentMarks();
    const locked = alreadyWonCurrentPrize();

    app.innerHTML = `<section class="screen">
      <div class="page-heading">
        <h1>${escapeHtml(round.name)}</h1>
        <p>Os números não são marcados automaticamente. Clique na sua cartela quando a bola for sorteada.</p>
      </div>
      <div class="prize-banner">Sorteio atual<strong>${prizeLabel(round.current_prize)}</strong></div>
      <div class="manual-play-help">
        <strong>${locked ? "Prêmio conquistado!" : "Sua vez de jogar"}</strong>
        <span>${locked ? "Aguarde a próxima cartela." : "Números sorteados ficam destacados. Clique neles para marcar."}</span>
      </div>
      <div class="game-layout" style="margin-top:18px">
        <div class="card">
          ${renderBingoCard(currentNumbers(), drawn, {
            code: `${card.card_code}-P${round.current_prize}`,
            manual: true,
            markedNumbers: marks,
            locked
          })}
          <p class="manual-mark-count">Marcados: <strong>${marks.length}</strong> número(s)</p>
        </div>
        <div class="card draw-panel">
          <h2>Números sorteados</h2>
          ${latest ? `<div class="last-ball" aria-label="Último número sorteado: ${latest}">${latest}</div>` : '<div class="empty-state" style="margin-bottom:16px">Aguardando o primeiro número.</div>'}
          ${renderDrawnNumbers(drawn)}
        </div>
      </div>
    </section>`;

    bindCardEvents();
  }

  async function markNumber(number, wasDrawn) {
    if (markingNumber !== null || alreadyWonCurrentPrize()) return;
    if (!wasDrawn) {
      toast(`O número ${number} ainda não foi sorteado.`, "error");
      return;
    }
    if (currentMarks().includes(number)) {
      toast(`O número ${number} já está marcado.`);
      return;
    }

    markingNumber = number;
    const button = document.querySelector(`[data-card-number="${number}"]`);
    button?.classList.add("marking");
    if (button) button.disabled = true;

    try {
      const { data, error } = await BF.supabase.rpc("mark_card_number", {
        p_round_id: round.id,
        p_card_id: card.id,
        p_number: number
      });
      if (error) throw error;

      if (data?.card) card = data.card;
      renderGame();

      if (data?.won) {
        toast(`Bingo! Você conquistou ${prizeLabel(round.current_prize)}.`, "success", 7000);
        celebrate();
      } else {
        toast(`Número ${number} marcado.`, "success", 1800);
      }
    } catch (error) {
      const migrationMissing = String(error.message || "").includes("mark_card_number");
      toast(migrationMissing
        ? "A atualização do banco ainda não foi aplicada. Execute supabase/migration-manual-marking.sql."
        : (error.message || "Não foi possível marcar o número."), "error", 7000);
      renderGame();
    } finally {
      markingNumber = null;
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
      body: `<p><strong>${names}</strong></p><p>Empates ainda podem ser confirmados até a troca do sorteio.</p>`,
      autoCloseMs: window.BINGO_FEST_CONFIG.winnerPauseMs
    });
    celebrate();
  }

  function announceNewCard(prizeNumber) {
    showModal({
      title: "Nova cartela liberada",
      body: `<p>Os números foram renovados para <strong>${prizeLabel(prizeNumber)}</strong>.</p><p>Marque novamente apenas os números sorteados neste novo prêmio.</p>`,
      actions: '<button class="button button-primary" type="button" data-close-new-card>Começar</button>'
    });
    document.querySelector("[data-close-new-card]")?.addEventListener("click", () => {
      document.getElementById("modal-root").innerHTML = "";
    });
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
      renderGame();
      announceNewCard(round.current_prize);
      return;
    }

    if ((round.drawn_numbers || []).length > previousLength && latest !== lastSpokenNumber) {
      lastSpokenNumber = latest;
      speakNumber(latest);
    }

    renderGame();
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
    announceWinner();

    channel = BF.supabase.channel(`round-${roundId}-game`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rounds", filter: `id=eq.${roundId}` }, payload => applyRoundUpdate(payload.new))
      .subscribe();

    return cleanup;
  }

  BF.game = { render, cleanup };
})();
