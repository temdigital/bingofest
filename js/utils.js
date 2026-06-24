(() => {
  "use strict";

  const BF = window.BingoFest = window.BingoFest || {};
  BF.state = BF.state || { session: null, user: null, profile: null, routeCleanup: null };

  const prizeLabels = Object.freeze({
    1: "1ª Quina",
    2: "2ª Quina",
    3: "3ª Quina",
    4: "Cartela Cheia"
  });

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function parseRoute() {
    const raw = location.hash || "#/";
    const [pathPart, queryPart = ""] = raw.slice(1).split("?");
    return { path: pathPart || "/", query: new URLSearchParams(queryPart) };
  }

  function navigate(path) {
    const next = path.startsWith("#") ? path : `#${path}`;
    if (location.hash === next) {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
      return;
    }
    location.hash = next;
  }

  function formatDate(value, withTime = true) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      ...(withTime ? { timeStyle: "short" } : {})
    }).format(date);
  }

  function statusLabel(status) {
    return ({ waiting: "Em espera", active: "Em andamento", finished: "Encerrada", cancelled: "Cancelada" })[status] || status;
  }

  function prizeLabel(prize) {
    return prizeLabels[Number(prize)] || "Não premiada";
  }

  function wonPrizesLabel(prizes = []) {
    const list = Array.isArray(prizes) ? prizes.map(Number).filter(Boolean) : [];
    return list.length ? list.map(prizeLabel).join(" · ") : "Não premiada";
  }

  function toast(message, type = "info", duration = 4200) {
    const region = document.getElementById("toast-region");
    if (!region) return;
    const item = document.createElement("div");
    item.className = `toast ${type}`;
    item.textContent = message;
    region.append(item);
    window.setTimeout(() => item.remove(), duration);
  }

  function setBusy(button, busy, busyText = "Processando…") {
    if (!button) return;
    if (busy) {
      button.dataset.originalText = button.textContent;
      button.textContent = busyText;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  }

  function randomUnique(min, max, amount) {
    const pool = Array.from({ length: max - min + 1 }, (_, index) => min + index);
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, amount);
  }

  function generateCard() {
    const B = randomUnique(1, 15, 5);
    const I = randomUnique(16, 30, 5);
    const N = randomUnique(31, 45, 4);
    const G = randomUnique(46, 60, 5);
    const O = randomUnique(61, 75, 5);
    return [
      [B[0], I[0], N[0], G[0], O[0]],
      [B[1], I[1], N[1], G[1], O[1]],
      [B[2], I[2], "CURINGA", G[2], O[2]],
      [B[3], I[3], N[2], G[3], O[3]],
      [B[4], I[4], N[3], G[4], O[4]]
    ];
  }

  function normalizeMatrix(numbers) {
    if (Array.isArray(numbers)) return numbers;
    if (typeof numbers === "string") {
      try { return JSON.parse(numbers); } catch { return []; }
    }
    return [];
  }

  function normalizeObject(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }
    return {};
  }

  function getPrizeCard(card, prizeNumber) {
    const prizeCards = normalizeObject(card?.prize_cards);
    return normalizeMatrix(prizeCards[String(prizeNumber)] || card?.numbers || []);
  }

  function getPrizeMarks(card, prizeNumber) {
    const markedNumbers = normalizeObject(card?.marked_numbers);
    const values = markedNumbers[String(prizeNumber)];
    return Array.isArray(values) ? values.map(Number).filter(Number.isFinite) : [];
  }

  function hasWin(numbers, markedNumbers, prizeNumber) {
    const matrix = normalizeMatrix(numbers);
    const marked = new Set((markedNumbers || []).map(Number));
    const hit = (value) => value === "CURINGA" || marked.has(Number(value));
    if (Number(prizeNumber) === 4) return matrix.flat().every(hit);
    const lines = [];
    for (let row = 0; row < 5; row += 1) lines.push(matrix[row]);
    for (let col = 0; col < 5; col += 1) lines.push(matrix.map(row => row[col]));
    lines.push(matrix.map((row, index) => row[index]));
    lines.push(matrix.map((row, index) => row[4 - index]));
    return lines.some(line => line.every(hit));
  }

  function renderBingoCard(numbers, drawnNumbers = [], options = {}) {
    const matrix = normalizeMatrix(numbers);
    const drawn = new Set((drawnNumbers || []).map(Number));
    const marked = new Set((options.markedNumbers || []).map(Number));
    const manual = options.manual === true;
    const locked = options.locked === true;

    const cells = matrix.flatMap(row => row).map(value => {
      const joker = value === "CURINGA";
      const number = Number(value);
      const isDrawn = !joker && drawn.has(number);
      const isMarked = joker || (manual ? marked.has(number) : isDrawn);
      const isAvailable = manual && isDrawn && !isMarked && !locked;
      const className = [
        "bingo-cell",
        joker ? "joker" : "",
        isMarked ? "marked" : "",
        isAvailable ? "available" : "",
        manual && !joker ? "interactive" : ""
      ].filter(Boolean).join(" ");

      if (manual && !joker) {
        const state = isMarked ? "marcado" : (isDrawn ? "sorteado, clique para marcar" : "ainda não sorteado");
        return `<button type="button" class="${className}" data-card-number="${number}" data-drawn="${String(isDrawn)}" ${locked ? "disabled" : ""} aria-label="Número ${number}, ${state}">${number}</button>`;
      }

      return `<div class="${className}" ${joker ? 'aria-label="Coringa, marcado automaticamente"' : `aria-label="Número ${number}${isMarked ? ", marcado" : ""}"`}>
        ${joker ? '<img src="assets/images/rei-oficial.png" alt="Família REI — Coringa">' : escapeHtml(value)}
      </div>`;
    }).join("");

    return `<div class="bingo-card-wrap">
      ${options.code ? `<p class="card-code">Cartela: <strong>${escapeHtml(options.code)}</strong></p>` : ""}
      <div class="bingo-header" aria-hidden="true"><span>B</span><span>I</span><span>N</span><span>G</span><span>O</span></div>
      <div class="bingo-grid" role="grid" aria-label="Cartela de bingo">${cells}</div>
    </div>`;
  }

  function renderDrawnNumbers(numbers = []) {
    if (!numbers.length) return '<div class="empty-state">Nenhum número sorteado neste prêmio.</div>';
    const latest = numbers[numbers.length - 1];
    return `<div class="drawn-grid">${numbers.map(number => `<span class="drawn-number${number === latest ? " latest" : ""}">${number}</span>`).join("")}</div>`;
  }

  function speakNumber(number) {
    if (!window.BINGO_FEST_CONFIG?.speechEnabled || !window.speechSynthesis || document.hidden) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`Bingo Fest, número ${number}`);
    utterance.lang = "pt-BR";
    const voice = window.speechSynthesis.getVoices().find(item => item.lang?.toLowerCase().startsWith("pt-br"));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

  function celebrate() {
    if (typeof window.confetti !== "function") return;
    const end = Date.now() + 1800;
    const timer = window.setInterval(() => {
      window.confetti({ particleCount: 45, spread: 75, origin: { x: Math.random(), y: Math.random() * .35 } });
      if (Date.now() >= end) window.clearInterval(timer);
    }, 260);
  }

  function showModal({ title, body, actions = "", autoCloseMs = 0 }) {
    const root = document.getElementById("modal-root");
    if (!root) return () => {};
    root.innerHTML = `<div class="modal-backdrop" role="presentation">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">${escapeHtml(title)}</h2>
        <div>${body}</div>
        ${actions ? `<div class="button-row" style="justify-content:center;margin-top:18px">${actions}</div>` : ""}
      </section>
    </div>`;
    const close = () => { root.innerHTML = ""; };
    if (autoCloseMs > 0) window.setTimeout(close, autoCloseMs);
    return close;
  }

  function unionDrawn(round) {
    const values = new Set(round?.drawn_numbers || []);
    (round?.prizes || []).forEach(prize => (prize.drawn_numbers || []).forEach(number => values.add(Number(number))));
    return [...values].sort((a, b) => a - b);
  }

  BF.utils = {
    escapeHtml, parseRoute, navigate, formatDate, statusLabel, prizeLabel, wonPrizesLabel, toast, setBusy,
    generateCard, normalizeMatrix, normalizeObject, getPrizeCard, getPrizeMarks, hasWin, renderBingoCard,
    renderDrawnNumbers, speakNumber, celebrate, showModal, unionDrawn
  };
})();
