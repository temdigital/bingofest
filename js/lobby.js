(() => {
  "use strict";
  const BF = window.BingoFest;
  const {
    escapeHtml, formatDate, statusLabel, prizeLabel, wonPrizesLabel,
    navigate, toast, setBusy, celebrate, renderBingoCard,
    getPrizeCard, getPrizeMarks, normalizeObject
  } = BF.utils;

  function roundCard(round) {
    const action = round.status === "waiting"
      ? `<button class="button button-primary participate-button" data-round-id="${round.id}">Participar</button>`
      : (["finished", "cancelled"].includes(round.status)
        ? `<a class="button" href="#/result?round=${round.id}">Ver resultado</a>`
        : '<span class="meta">Entradas encerradas</span>');
    return `<article class="card round-card">
      <div class="round-card-header">
        <div><h3>${escapeHtml(round.name)}</h3><div class="meta">Criada em ${formatDate(round.created_at)}</div></div>
        <span class="status-badge status-${round.status}">${statusLabel(round.status)}</span>
      </div>
      <div class="button-row">${action}</div>
    </article>`;
  }

  async function render() {
    const app = document.getElementById("app");
    app.innerHTML = '<section class="screen screen-loading"><div class="spinner"></div><p>Buscando rodadas…</p></section>';
    const { data, error } = await BF.supabase.from("rounds").select("id,name,status,current_prize,created_at,started_at,finished_at").order("created_at", { ascending: false });
    if (error) throw error;

    const groups = [["waiting", "Em espera"], ["active", "Em andamento"], ["finished", "Encerradas"], ["cancelled", "Canceladas"]];
    app.innerHTML = `<section class="screen">
      <div class="page-heading"><h1>Rodadas</h1><p>Escolha uma rodada disponível ou consulte os resultados.</p></div>
      ${groups.map(([status, title]) => {
        const items = (data || []).filter(item => item.status === status);
        return `<div class="section-title"><h2>${title}</h2><span class="status-badge status-${status}">${items.length}</span></div>
          <div class="card-grid">${items.length ? items.map(roundCard).join("") : '<div class="empty-state">Nenhuma rodada nesta situação.</div>'}</div>`;
      }).join("")}
    </section>`;

    app.querySelectorAll(".participate-button").forEach(button => {
      button.addEventListener("click", async () => {
        setBusy(button, true, "Gerando 4 cartelas…");
        try {
          const { data: card, error: joinError } = await BF.supabase.rpc("join_round", { p_round_id: button.dataset.roundId });
          if (joinError) throw joinError;
          sessionStorage.setItem("bingoFestAudioEnabled", "true");
          toast(`Cartelas ${card.card_code} preparadas.`, "success");
          navigate(`/waiting-room?round=${button.dataset.roundId}`);
        } catch (error) {
          toast(error.message || "Não foi possível participar.", "error");
          setBusy(button, false);
        }
      });
    });
  }

  function prizeDrawnNumbers(round, prizeNumber) {
    const prize = (round?.prizes || []).find(item => Number(item.prize_number) === Number(prizeNumber));
    if (prize?.drawn_numbers) return prize.drawn_numbers;
    return Number(round?.current_prize) === Number(prizeNumber) ? (round?.drawn_numbers || []) : [];
  }

  function renderResultCards(card, round) {
    const prizeCards = normalizeObject(card.prize_cards);
    const prizeNumbers = Object.keys(prizeCards).length ? [1, 2, 3, 4] : [1];
    return prizeNumbers.map(prizeNumber => `<section class="result-prize-card">
      <h4>${prizeLabel(prizeNumber)}</h4>
      ${renderBingoCard(getPrizeCard(card, prizeNumber), prizeDrawnNumbers(round, prizeNumber), {
        code: `${card.card_code}-P${prizeNumber}`,
        manual: true,
        markedNumbers: getPrizeMarks(card, prizeNumber),
        locked: true
      })}
    </section>`).join("");
  }

  async function renderResult(roundId) {
    const app = document.getElementById("app");
    app.innerHTML = '<section class="screen screen-loading"><div class="spinner"></div><p>Carregando resultado…</p></section>';
    const { data, error } = await BF.supabase.rpc("get_round_results", { p_round_id: roundId });
    if (error) throw error;
    const round = data?.round;
    const winners = data?.winners || [];
    const cards = data?.cards || [];
    if (winners.some(item => item.user_id === BF.state.user.id)) celebrate();

    app.innerHTML = `<section class="screen">
      <div class="page-heading"><h1>Resultado</h1><p>${escapeHtml(round?.name || "Rodada")}</p></div>
      <div class="card">
        <div class="round-card-header"><h2>Ganhadores</h2><span class="status-badge status-${round?.status}">${statusLabel(round?.status)}</span></div>
        <div class="winner-list">${winners.length ? winners.map(winner => `<div class="winner-item${winner.user_id === BF.state.user.id ? " mine" : ""}">
          <strong>${escapeHtml(winner.name)}${winner.user_id === BF.state.user.id ? " — você" : ""}</strong>
          <span>${prizeLabel(winner.prize_number || winner.won_prize)}</span><br><small>${escapeHtml(winner.card_code)}</small>
        </div>`).join("") : '<div class="empty-state">Esta rodada não registrou ganhadores.</div>'}</div>
      </div>
      <div class="section-title"><h2>Cartelas da rodada</h2><span>${cards.length}</span></div>
      <div class="card-grid">${cards.map(card => {
        const wonPrizes = card.won_prizes?.length ? card.won_prizes : (card.won_prize ? [card.won_prize] : []);
        return `<article class="card">
          <h3>${escapeHtml(card.name)}</h3>
          <p class="meta">${escapeHtml(card.card_code)} · ${wonPrizesLabel(wonPrizes)}</p>
          <details class="result-card-details">
            <summary>Ver as quatro cartelas</summary>
            ${renderResultCards(card, round)}
          </details>
        </article>`;
      }).join("") || '<div class="empty-state">Nenhuma cartela registrada.</div>'}</div>
      <div class="button-row" style="margin-top:18px"><a class="button" href="#/lobby">Voltar ao Lobby</a></div>
    </section>`;
  }

  BF.lobby = { render, renderResult };
})();
