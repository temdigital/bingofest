// js/perfil-publico.js

(function () {
    'use strict';

    let supabase = null;

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

    function getSlug() {
        const params = new URLSearchParams(window.location.search);
        return String(params.get('slug') || '').trim();
    }

    function firstLetter(value) {
        return String(value || 'U')
            .trim()
            .charAt(0)
            .toUpperCase();
    }

    function showError(message) {
        const root = document.getElementById('perfilPublicoRoot');

        if (!root) return;

        root.innerHTML = `
            <div class="error-state">
                <i class="fas fa-user-slash"></i>

                <h2>
                    ${escapeHTML(message)}
                </h2>

                <p style="margin-top:15px">
                    O perfil solicitado não está disponível.
                </p>

                <a
                    href="index.html"
                    class="public-login-btn"
                    style="display:inline-flex;margin-top:20px"
                >
                    <i class="fas fa-home"></i>
                    Voltar ao início
                </a>
            </div>
        `;
    }

    function updateSEO(profile) {

        document.title =
            `${profile.nome} | Comunidade Tem no Entorno Sul`;

        const metaDescription =
            document.querySelector(
                'meta[name="description"]'
            );

        if (metaDescription) {

            metaDescription.setAttribute(
                'content',
                (
                    profile.bio ||
                    `${profile.nome} participa da comunidade Tem no Entorno Sul.`
                ).substring(0, 160)
            );
        }
    }

    function renderProfile(profile) {

        updateSEO(profile);

        const avatar =
            profile.foto_url
                ? `
                    <img
                        class="public-profile-avatar"
                        src="${profile.foto_url}"
                        alt="${escapeHTML(profile.nome)}"
                    >
                `
                : `
                    <div class="public-profile-avatar-placeholder">
                        ${firstLetter(profile.nome)}
                    </div>
                `;

        const pontos =
            Number(profile.pontos || 0);

        const badges = [];

        badges.push({
            icon: 'fa-seedling',
            text: 'Novo Membro'
        });

        if (pontos >= 100) {
            badges.push({
                icon: 'fa-award',
                text: 'Participante'
            });
        }

        if (pontos >= 500) {
            badges.push({
                icon: 'fa-medal',
                text: 'Explorador Regional'
            });
        }

        if (pontos >= 1000) {
            badges.push({
                icon: 'fa-crown',
                text: 'Destaque da Comunidade'
            });
        }

        document.getElementById(
            'perfilPublicoRoot'
        ).innerHTML = `
            <div class="public-profile-card">

                <div class="public-profile-cover"></div>

                <div class="public-profile-content">

                    <div class="public-profile-header">

                        ${avatar}

                        <div class="public-profile-info">

                            <h1 class="public-profile-name">
                                ${escapeHTML(profile.nome)}
                            </h1>

                            <div class="public-profile-level">
                                <i class="fas fa-trophy"></i>
                                ${escapeHTML(
                                    profile.nivel ||
                                    'Explorador Regional'
                                )}
                            </div>

                            ${
                                profile.cidade
                                    ? `
                                        <div class="public-profile-city">
                                            <i class="fas fa-location-dot"></i>
                                            ${escapeHTML(profile.cidade)}
                                        </div>
                                    `
                                    : ''
                            }

                            ${
                                profile.bio
                                    ? `
                                        <div class="public-profile-bio">
                                            ${escapeHTML(profile.bio)}
                                        </div>
                                    `
                                    : ''
                            }

                        </div>

                    </div>

                    <div class="public-profile-stats">

                        <div class="public-stat-card">

                            <span class="public-stat-value">
                                ${pontos}
                            </span>

                            <span class="public-stat-label">
                                Pontos
                            </span>

                        </div>

                        <div class="public-stat-card">

                            <span class="public-stat-value">
                                ${badges.length}
                            </span>

                            <span class="public-stat-label">
                                Badges
                            </span>

                        </div>

                        <div class="public-stat-card">

                            <span class="public-stat-value">
                                —
                            </span>

                            <span class="public-stat-label">
                                Ranking
                            </span>

                        </div>

                        <div class="public-stat-card">

                            <span class="public-stat-value">
                                ${escapeHTML(
                                    profile.nivel || 'Nível 1'
                                )}
                            </span>

                            <span class="public-stat-label">
                                Nível
                            </span>

                        </div>

                    </div>

                    <div class="public-badges-section">

                        <h2 class="public-section-title">
                            Conquistas
                        </h2>

                        <div class="public-badges">

                            ${badges.map(badge => `
                                <div class="public-badge">
                                    <i class="fas ${badge.icon}"></i>
                                    ${badge.text}
                                </div>
                            `).join('')}

                        </div>

                    </div>

                    <div class="public-profile-footer">

                        Perfil público da comunidade
                        Tem no Entorno Sul.

                    </div>

                </div>

            </div>
        `;
    }

    async function loadProfile() {

        const slug = getSlug();

        if (!slug) {

            showError(
                'Slug do usuário não informado.'
            );

            return;
        }

        const { data, error } =
            await supabase
                .from('usuarios')
                .select(`
                    nome,
                    slug,
                    foto_url,
                    cidade,
                    bio,
                    pontos,
                    nivel
                `)
                .eq('slug', slug)
                .eq('status', 'ativo')
                .single();

        if (error || !data) {

            console.error(error);

            showError(
                'Usuário não encontrado.'
            );

            return;
        }

        renderProfile(data);
    }

    async function initialize() {

        supabase = getClient();

        if (!supabase) {

            showError(
                'Supabase não encontrado.'
            );

            return;
        }

        try {

            await loadProfile();

        } catch (error) {

            console.error(error);

            showError(
                'Erro ao carregar perfil.'
            );
        }
    }

    document.addEventListener(
        'DOMContentLoaded',
        initialize
    );

})();