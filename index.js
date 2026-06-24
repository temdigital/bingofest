// index.js

(function () {
    'use strict';

    const LIMIT_PUBLICACOES = 6;
    const LIMIT_EVENTOS = 3;
    const LIMIT_PARCEIROS = 6;
    const LIMIT_COMUNIDADE = 4;

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

    function stripHTML(value) {
        const div = document.createElement('div');
        div.innerHTML = String(value || '');
        return div.textContent || div.innerText || '';
    }

    function resumo(value, limite = 130) {
        const text = stripHTML(value).trim();

        if (!text) return '';
        if (text.length <= limite) return text;

        return `${text.slice(0, limite).trim()}...`;
    }

    function formatDate(value) {
        if (!value) return '';

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return '';

        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    function formatDateTime(value) {
        if (!value) return '';

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return '';

        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function hideLoading(id) {
        const el = document.getElementById(id);

        if (el) {
            el.style.display = 'none';
        }
    }

    function showEmpty(root, icon, title, text) {
        if (!root) return;

        root.innerHTML = `
            <div class="empty-state">
                <i class="fas ${escapeHTML(icon)}"></i>
                <h3>${escapeHTML(title)}</h3>
                <p>${escapeHTML(text)}</p>
            </div>
        `;
    }

    function showError(root, message) {
        if (!root) return;

        root.innerHTML = `
            <div class="error-message">
                <i class="fas fa-triangle-exclamation"></i>
                <h3>Não foi possível carregar</h3>
                <p>${escapeHTML(message || 'Erro inesperado.')}</p>
            </div>
        `;
    }

    function cardImage(url, alt, icon) {
        if (url) {
            return `
                <img
                    src="${escapeHTML(url)}"
                    alt="${escapeHTML(alt)}"
                    loading="lazy"
                >
            `;
        }

        return `
            <div class="home-card-placeholder">
                <i class="fas ${escapeHTML(icon)}"></i>
            </div>
        `;
    }

    function renderCard({ link, image, icon, kicker, title, text, meta, cta }) {
        return `
            <article class="home-card">
                <a href="${escapeHTML(link)}" class="home-card-media">
                    ${cardImage(image, title, icon)}
                </a>

                <div class="home-card-body">
                    ${
                        kicker
                            ? `
                                <span class="home-card-kicker">
                                    ${escapeHTML(kicker)}
                                </span>
                            `
                            : ''
                    }

                    <h3>
                        <a href="${escapeHTML(link)}">
                            ${escapeHTML(title)}
                        </a>
                    </h3>

                    ${
                        text
                            ? `<p>${escapeHTML(resumo(text))}</p>`
                            : ''
                    }

                    ${
                        meta
                            ? `
                                <div class="home-card-meta">
                                    ${meta}
                                </div>
                            `
                            : ''
                    }

                    <a href="${escapeHTML(link)}" class="home-card-link">
                        ${escapeHTML(cta)}
                        <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
            </article>
        `;
    }

    async function loadPublicacoes(db) {
        const root = document.getElementById('publicacoesGrid');

        if (!root) return;

        try {
            const { data, error } = await db
                .from('v_publicacoes_publicas')
                .select('*')
                .order('published_at', { ascending: false, nullsFirst: false })
                .order('created_at', { ascending: false })
                .limit(LIMIT_PUBLICACOES);

            if (error) throw error;

            hideLoading('publicacoesLoading');

            if (!data?.length) {
                showEmpty(
                    root,
                    'fa-newspaper',
                    'Nenhuma publicação disponível',
                    'Assim que novas publicações forem cadastradas, elas aparecerão aqui.'
                );
                return;
            }

            root.innerHTML = data.map((item) => {
                const link = item.slug
                    ? `publicacao.html?slug=${encodeURIComponent(item.slug)}`
                    : 'publicacoes.html';

                const date = formatDate(item.published_at || item.created_at);

                return renderCard({
                    link,
                    image: item.imagem_capa_url,
                    icon: 'fa-newspaper',
                    kicker: item.categoria_nome || 'Publicação',
                    title: item.titulo || 'Publicação',
                    text: item.subtitulo || item.conteudo || '',
                    meta: date
                        ? `
                            <span>
                                <i class="fas fa-calendar-alt"></i>
                                ${escapeHTML(date)}
                            </span>
                        `
                        : '',
                    cta: 'Ler publicação'
                });
            }).join('');

        } catch (error) {
            console.error('[INDEX] Publicações:', error);
            hideLoading('publicacoesLoading');
            showError(root, error.message);
        }
    }

    async function loadParceiros(db) {
        const root = document.getElementById('empresasGrid');

        if (!root) return;

        try {
            const { data, error } = await db
                .from('v_negocios_publicos')
                .select('*')
                .order('destaque', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(LIMIT_PARCEIROS);

            if (error) throw error;

            hideLoading('empresasLoading');

            if (!data?.length) {
                showEmpty(
                    root,
                    'fa-store',
                    'Nenhuma empresa parceira disponível',
                    'Assim que empresas parceiras forem cadastradas, elas aparecerão aqui.'
                );
                return;
            }

            root.innerHTML = data.map((item) => {
                const link = item.slug
                    ? `parceiro.html?slug=${encodeURIComponent(item.slug)}`
                    : 'parceiros.html';

                return renderCard({
                    link,
                    image: item.imagem_capa_url || item.imagem_logo_url,
                    icon: 'fa-store',
                    kicker: item.tipo_negocio_nome || item.categoria_principal || 'Parceiro',
                    title: item.nome || 'Empresa Parceira',
                    text: item.descricao || '',
                    meta: `
                        ${
                            item.cidade
                                ? `
                                    <span>
                                        <i class="fas fa-location-dot"></i>
                                        ${escapeHTML(item.cidade)}
                                    </span>
                                `
                                : ''
                        }

                        ${
                            item.verificado
                                ? `
                                    <span>
                                        <i class="fas fa-circle-check"></i>
                                        Verificado
                                    </span>
                                `
                                : ''
                        }
                    `,
                    cta: 'Ver empresa'
                });
            }).join('');

        } catch (error) {
            console.error('[INDEX] Parceiros:', error);
            hideLoading('empresasLoading');
            showError(root, error.message);
        }
    }

    async function loadEventos(db) {
        const root = document.getElementById('eventosGrid');

        if (!root) return;

        try {
            const { data, error } = await db
                .from('v_eventos_publicos')
                .select('*')
                .order('data_inicio', { ascending: true, nullsFirst: false })
                .limit(LIMIT_EVENTOS);

            if (error) throw error;

            hideLoading('eventosLoading');

            if (!data?.length) {
                showEmpty(
                    root,
                    'fa-calendar-days',
                    'Nenhum evento disponível',
                    'Assim que novos eventos forem cadastrados, eles aparecerão aqui.'
                );
                return;
            }

            root.innerHTML = data.map((item) => {
                const link = item.slug
                    ? `evento.html?slug=${encodeURIComponent(item.slug)}`
                    : 'eventos.html';

                return renderCard({
                    link,
                    image: item.imagem_banner_url,
                    icon: 'fa-calendar-days',
                    kicker: item.categoria_nome || 'Evento',
                    title: item.nome || 'Evento',
                    text: item.descricao || '',
                    meta: `
                        ${
                            item.data_inicio
                                ? `
                                    <span>
                                        <i class="fas fa-clock"></i>
                                        ${escapeHTML(formatDateTime(item.data_inicio))}
                                    </span>
                                `
                                : ''
                        }

                        ${
                            item.cidade
                                ? `
                                    <span>
                                        <i class="fas fa-location-dot"></i>
                                        ${escapeHTML(item.cidade)}
                                    </span>
                                `
                                : ''
                        }
                    `,
                    cta: 'Ver evento'
                });
            }).join('');

        } catch (error) {
            console.error('[INDEX] Eventos:', error);
            hideLoading('eventosLoading');
            showError(root, error.message);
        }
    }

    function ensureCommunitySection() {
        let root = document.getElementById('comunidadeHome');

        if (root) return root;

        const main = document.querySelector('main');

        if (!main) return null;

        const section = document.createElement('section');
        section.className = 'home-community-section';
        section.id = 'comunidadeDestaque';

        section.innerHTML = `
            <div class="container">
                <div class="section-header">
                    <span class="section-kicker">
                        <i class="fas fa-users"></i>
                        Comunidade
                    </span>

                    <h2 class="section-title">Comunidade em Destaque</h2>

                    <p>
                        Veja as conversas recentes do mural regional.
                    </p>
                </div>

                <div id="comunidadeHome"></div>

                <div class="section-action">
                    <a href="./comunidade.html" class="btn btn-accent">
                        Entrar na Comunidade
                    </a>
                </div>
            </div>
        `;

        main.appendChild(section);

        return document.getElementById('comunidadeHome');
    }

    async function loadComunidade(db) {
        const root = ensureCommunitySection();

        if (!root) return;

        try {
            const { data, error } = await db
                .from('v_comunidade_posts')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(LIMIT_COMUNIDADE);

            if (error) throw error;

            if (!data?.length) {
                showEmpty(
                    root,
                    'fa-users',
                    'A comunidade está pronta para começar',
                    'Seja o primeiro a publicar no mural da comunidade.'
                );
                return;
            }

            root.innerHTML = data.map((item) => {
                return renderCard({
                    link: 'comunidade.html',
                    image: item.usuario_foto_url,
                    icon: 'fa-users',
                    kicker: item.categoria || 'Comunidade',
                    title: item.titulo || item.usuario_nome || 'Publicação da Comunidade',
                    text: item.conteudo || '',
                    meta: `
                        <span>
                            <i class="fas fa-heart"></i>
                            ${Number(item.total_curtidas || 0)}
                        </span>

                        <span>
                            <i class="fas fa-reply"></i>
                            ${Number(item.total_respostas || 0)}
                        </span>
                    `,
                    cta: 'Participar'
                });
            }).join('');

        } catch (error) {
            console.error('[INDEX] Comunidade:', error);
            showError(root, error.message);
        }
    }

    async function initialize() {
        const db = getClient();

        if (!db) {
            console.warn('[INDEX] Supabase não encontrado.');
            return;
        }

        await Promise.allSettled([
            loadPublicacoes(db),
            loadParceiros(db),
            loadEventos(db),
            loadComunidade(db)
        ]);
    }

    document.addEventListener('DOMContentLoaded', initialize);
})();