(() => {
  "use strict";
  const BF = window.BingoFest;
  const { escapeHtml, formatDate, statusLabel, prizeLabel, renderBingoCard, unionDrawn } = BF.utils;

  async function render() {
    const app = document.getElementById("app");
    app.innerHTML = '<section class="screen screen-loading"><div class="spinner"></div><p>Carregando histórico…</p></section>';
    const { data, error } = await BF.supabase
      .from("cards")
      .select("id,card_code,numbers,won_prize,created_at,rounds(id,name,status,drawn_numbers,prizes,created_at)")
      .eq("user_id", BF.state.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    app.innerHTML = `<section class="screen">
      <div class="page-heading"><h1>Meu Histórico</h1><p>Todas as suas cartelas, da mais recente para a mais antiga.</p></div>
      <div class="card-grid">${(data || []).map(card => {
        const round = card.rounds;
        const allDrawn = unionDrawn(round);
        return `<article class="card history-item" data-card-id="${card.id}" tabindex="0">
          <div class="round-card-header">
            <div><h3>${escapeHtml(round?.name || "Rodada")}</h3><p class="meta">${escapeHtml(card.card_code)}<br>${formatDate(card.created_at)}</p></div>
            <span class="status-badge status-${round?.status}">${statusLabel(round?.status)}</span>
          </div>
          <p><strong>${card.won_prize ? prizeLabel(card.won_prize) : "Não premiada"}</strong></p>
          <div class="history-detail" hidden>
            ${renderBingoCard(card.numbers, allDrawn, {})}
            <p class="meta" style="text-align:center">Verde: número sorteado em pelo menos um dos quatro sorteios.</p>
          </div>
        </article>`;
      }).join("") || '<div class="empty-state">Você ainda não possui cartelas.</div>'}</div>
    </section>`;

    app.querySelectorAll(".history-item").forEach(item => {
      const toggle = () => {
        const detail = item.querySelector(".history-detail");
        detail.hidden = !detail.hidden;
      };
      item.addEventListener("click", toggle);
      item.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); toggle(); } });
    });
  }

  BF.history = { render };
})();
