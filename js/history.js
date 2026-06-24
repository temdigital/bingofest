(() => {
  "use strict";
  const BF = window.BingoFest;
  const {
    escapeHtml, formatDate, statusLabel, wonPrizesLabel,
    renderBingoCard, getPrizeCard, getPrizeMarks, normalizeObject
  } = BF.utils;

  function prizeDrawnNumbers(round, prizeNumber) {
    const prize = (round?.prizes || []).find(item => Number(item.prize_number) === Number(prizeNumber));
    if (prize?.drawn_numbers) return prize.drawn_numbers;
    return Number(round?.current_prize) === Number(prizeNumber) ? (round?.drawn_numbers || []) : [];
  }

  function renderCardHistory(card, round) {
    const prizeCards = normalizeObject(card.prize_cards);
    const prizeNumbers = Object.keys(prizeCards).length ? [1, 2, 3, 4] : [1];
    return prizeNumbers.map(prizeNumber => `<section class="history-prize-card">
      <h4>${BF.utils.prizeLabel(prizeNumber)}</h4>
      ${renderBingoCard(getPrizeCard(card, prizeNumber), prizeDrawnNumbers(round, prizeNumber), {
        code: `${card.card_code}-P${prizeNumber}`,
        manual: true,
        markedNumbers: getPrizeMarks(card, prizeNumber),
        locked: true
      })}
    </section>`).join("");
  }

  async function render() {
    const app = document.getElementById("app");
    app.innerHTML = '<section class="screen screen-loading"><div class="spinner"></div><p>Carregando histórico…</p></section>';
    const { data, error } = await BF.supabase
      .from("cards")
      .select("*,rounds(*)")
      .eq("user_id", BF.state.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    app.innerHTML = `<section class="screen">
      <div class="page-heading"><h1>Meu Histórico</h1><p>Veja as cartelas e as marcações feitas em cada prêmio.</p></div>
      <div class="card-grid">${(data || []).map(card => {
        const round = card.rounds;
        const wonPrizes = card.won_prizes?.length ? card.won_prizes : (card.won_prize ? [card.won_prize] : []);
        return `<article class="card history-item" data-card-id="${card.id}" tabindex="0">
          <div class="round-card-header">
            <div><h3>${escapeHtml(round?.name || "Rodada")}</h3><p class="meta">${escapeHtml(card.card_code)}<br>${formatDate(card.created_at)}</p></div>
            <span class="status-badge status-${round?.status}">${statusLabel(round?.status)}</span>
          </div>
          <p><strong>${wonPrizesLabel(wonPrizes)}</strong></p>
          <div class="history-detail" hidden>
            ${renderCardHistory(card, round)}
            <p class="meta" style="text-align:center">Verde: número que você marcou. Contorno amarelo: sorteado e não marcado.</p>
          </div>
        </article>`;
      }).join("") || '<div class="empty-state">Você ainda não possui cartelas.</div>'}</div>
    </section>`;

    app.querySelectorAll(".history-item").forEach(item => {
      const toggle = event => {
        if (event?.target?.closest("button")) return;
        const detail = item.querySelector(".history-detail");
        detail.hidden = !detail.hidden;
      };
      item.addEventListener("click", toggle);
      item.addEventListener("keydown", event => {
        if (["Enter", " "].includes(event.key)) {
          event.preventDefault();
          toggle(event);
        }
      });
    });
  }

  BF.history = { render };
})();
