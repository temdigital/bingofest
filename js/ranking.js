// js/ranking.js

(function () {
    'use strict';

    let supabase = null;
    let currentUser = null;

    function getClient() {
        return window.supabaseClient || null;
    }

    function escapeHTML(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function firstLetter(value) {
        return String(value || 'U')
            .trim()
            .charAt(0)
            .toUpperCase();
    }

    function formatNumber(value) {
        return Number(value || 0).toLocaleString('pt-BR');
    }

    function levelByPoints(points) {
        points = Number(points || 0);

        if (points >= 5000) {
            return 'Lenda do Entorno';
        }

        if (points >= 2500) {
            return 'Embaixador';
        }

        if (points >= 1000) {
            return 'Especialista';
        }

        if (points >= 500) {
            return 'Colaborador';
        }

        if (points >= 100) {
            return 'Participante';
        }

        return 'Iniciante';
    }

    function renderError(message) {
        const root = document.getElementById('rankingRoot');

        if (!root) return;

        root.innerHTML = `
            <div class="ranking-error">
                <i class="fas fa-triangle-exclamation"></i>

                <h2>
                    Não foi possível carregar o ranking
                </h2>

                <p>
                    ${escapeHTML(message)}
                </p>
            </div>
        `;
    }

    function renderStats(ranking) {
        const root = document.getElementById('rankingStats');

        if (!root) return;

        const totalUsuarios = ranking.length;

        const totalPontos = ranking.reduce(
            (acc, item) => acc + Number(item.pontos || 0),
            0
        );

        const lider = ranking[0];

        root.innerHTML = `
            <div class="ranking-stats-grid">

                <div class="ranking-stat-card">
                    <strong>
                        ${formatNumber(totalUsuarios)}
                    </strong>

                    <span>
                        Participantes
                    </span>
                </div>

                <div class="ranking-stat-card">
                    <strong>
                        ${formatNumber(totalPontos)}
                    </strong>

                    <span>
                        Pontos Acumulados
                    </span>
                </div>

                <div class="ranking-stat-card">
                    <strong>
                        ${formatNumber(lider?.pontos || 0)}
                    </strong>

                    <span>
                        Líder Atual
                    </span>
                </div>

                <div class="ranking-stat-card">
                    <strong>
                        ${currentUser ? '✓' : '—'}
                    </strong>

                    <span>
                        Participando
                    </span>
                </div>

            </div>
        `;
    }

    function avatarHtml(user, size = 'normal') {
        const photo =
            user.avatar_url ||
            user.foto_url ||
            user.imagem_url ||
            '';

        if (photo) {
            return `
                <img
                    src="${escapeHTML(photo)}"
                    alt="${escapeHTML(user.nome || 'Usuário')}"
                    class="${size === 'podium'
                        ? 'podium-avatar'
                        : 'ranking-avatar'}"
                >
            `;
        }

        return `
            <div class="${size === 'podium'
                ? 'podium-avatar-placeholder'
                : 'ranking-avatar-placeholder'}">
                ${escapeHTML(firstLetter(user.nome))}
            </div>
        `;
    }

    function renderPodium(top3) {
        if (top3.length < 3) return '';

        const second = top3[1];
        const first = top3[0];
        const third = top3[2];

        return `
            <div class="ranking-podium">

                <article class="podium-card second">

                    <div class="podium-position">
                        2
                    </div>

                    ${avatarHtml(second, 'podium')}

                    <h2 class="podium-name">
                        ${escapeHTML(second.nome)}
                    </h2>

                    <p class="podium-level">
                        ${escapeHTML(levelByPoints(second.pontos))}
                    </p>

                    <div class="podium-points">
                        <i class="fas fa-star"></i>
                        ${formatNumber(second.pontos)}
                    </div>

                </article>

                <article class="podium-card first">

                    <div class="podium-position">
                        1
                    </div>

                    ${avatarHtml(first, 'podium')}

                    <h2 class="podium-name">
                        ${escapeHTML(first.nome)}
                    </h2>

                    <p class="podium-level">
                        ${escapeHTML(levelByPoints(first.pontos))}
                    </p>

                    <div class="podium-points">
                        <i class="fas fa-crown"></i>
                        ${formatNumber(first.pontos)}
                    </div>

                </article>

                <article class="podium-card third">

                    <div class="podium-position">
                        3
                    </div>

                    ${avatarHtml(third, 'podium')}

                    <h2 class="podium-name">
                        ${escapeHTML(third.nome)}
                    </h2>

                    <p class="podium-level">
                        ${escapeHTML(levelByPoints(third.pontos))}
                    </p>

                    <div class="podium-points">
                        <i class="fas fa-medal"></i>
                        ${formatNumber(third.pontos)}
                    </div>

                </article>

            </div>
        `;
    }

    function renderList(ranking) {
        return `
            <div class="ranking-list">

                ${ranking.map((user, index) => {

                    const position = index + 1;

                    const isCurrentUser =
                        currentUser &&
                        (
                            currentUser.id === user.usuario_id ||
                            currentUser.id === user.id
                        );

                    return `
                        <div
                            class="ranking-row"
                            style="
                                ${
                                    isCurrentUser
                                        ? `
                                            background:
                                            rgba(33,108,57,.05);
                                        `
                                        : ''
                                }
                            "
                        >

                            <div class="ranking-position">
                                ${position}
                            </div>

                            <div class="ranking-user">

                                ${avatarHtml(user)}

                                <div class="ranking-user-info">

                                    <h2>

                                        ${
                                            isCurrentUser
                                                ? `
                                                    ${escapeHTML(user.nome)}
                                                    ⭐
                                                `
                                                : escapeHTML(user.nome)
                                        }

                                    </h2>

                                    <p>
                                        ${escapeHTML(
                                            levelByPoints(user.pontos)
                                        )}
                                    </p>

                                </div>

                            </div>

                            <div class="ranking-score">

                                <strong>
                                    ${formatNumber(user.pontos)}
                                </strong>

                                <span>
                                    pontos
                                </span>

                            </div>

                        </div>
                    `;

                }).join('')}

            </div>
        `;
    }

    function renderRanking(ranking) {
        renderStats(ranking);

        const root = document.getElementById('rankingRoot');

        if (!root) return;

        if (!ranking.length) {
            root.innerHTML = `
                <div class="ranking-empty">

                    <i class="fas fa-trophy"></i>

                    <h2>
                        Ranking ainda vazio
                    </h2>

                    <p>
                        Assim que os usuários começarem
                        a interagir com o portal,
                        o ranking aparecerá aqui.
                    </p>

                </div>
            `;

            return;
        }

        const top3 = ranking.slice(0, 3);

        root.innerHTML = `
            ${top3.length >= 3
                ? renderPodium(top3)
                : ''
            }

            ${renderList(ranking)}
        `;
    }

    async function loadSession() {
        const { data } =
            await supabase.auth.getSession();

        currentUser =
            data?.session?.user || null;
    }

    async function loadRanking() {

        /*
        OPÇÃO 1 (RECOMENDADA)
        VIEW v_ranking_usuarios
        */

        try {

            const { data, error } =
                await supabase
                    .from('v_ranking_usuarios')
                    .select('*')
                    .order('pontos', {
                        ascending: false
                    })
                    .limit(100);

            if (error) throw error;

            renderRanking(data || []);

            return;

        } catch (error) {

            console.warn(
                '[RANKING] View não encontrada:',
                error
            );

        }

        /*
        OPÇÃO 2 (FALLBACK)
        PERFIS
        */

        try {

            const { data, error } =
                await supabase
                    .from('perfis')
                    .select('*')
                    .order('pontos', {
                        ascending: false
                    })
                    .limit(100);

            if (error) throw error;

            renderRanking(data || []);

        } catch (error) {

            console.error(
                '[RANKING]',
                error
            );

            renderError(
                error.message ||
                'Erro ao carregar ranking.'
            );

        }
    }

    async function initialize() {

        supabase = getClient();

        if (!supabase) {

            renderError(
                'Supabase não encontrado.'
            );

            return;
        }

        await loadSession();

        await loadRanking();
    }

    document.addEventListener(
        'DOMContentLoaded',
        initialize
    );

})();