// js/publicacoes.js

(function () {
    'use strict';

    let allPublicacoes = [];
    let allCategorias = [];

    function getClient() {
        return window.supabaseClient || window.supabase?.client || null;
    }

    function escapeHTML(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
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

    function renderError(message) {
        document.getElementById('publicationsRoot').innerHTML = `
            <div class="error-state">
                <i class="fas fa-triangle-exclamation"></i>
                <h2>Não foi possível carregar</h2>
                <p>${escapeHTML(message)}</p>
            </div>
        `;
    }

    function renderEmpty(message = 'As publicações aparecerão aqui assim que forem publicadas.') {
        document.getElementById('publicationsRoot').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-newspaper"></i>
                <h2>Nenhuma publicação encontrada</h2>
                <p>${escapeHTML(message)}</p>
            </div>
        `;
    }

    function renderCategorias() {
        const select = document.getElementById('categoriaFilter');

        if (!select) return;

        select.innerHTML = `
            <option value="">Todas as categorias</option>
            ${allCategorias.map((categoria) => `
                <option value="${escapeHTML(categoria.id)}">
                    ${escapeHTML(categoria.nome)}
                </option>
            `).join('')}
        `;
    }

    function sortPublicacoes(items, ordem) {
        const copy = [...items];

        if (ordem === 'antigas') {
            return copy.sort((a, b) => new Date(a.published_at || a.created_at || 0) - new Date(b.published_at || b.created_at || 0));
        }

        if (ordem === 'destaques') {
            return copy.sort((a, b) => {
                if (Boolean(b.destaque) !== Boolean(a.destaque)) {
                    return Number(Boolean(b.destaque)) - Number(Boolean(a.destaque));
                }

                return new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0);
            });
        }

        if (ordem === 'titulo') {
            return copy.sort((a, b) => String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR'));
        }

        return copy.sort((a, b) => new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0));
    }

    function getFilteredPublicacoes() {
        const search = normalizeText(document.getElementById('searchInput')?.value || '');
        const categoriaId = document.getElementById('categoriaFilter')?.value || '';
        const ordem = document.getElementById('ordemFilter')?.value || 'recentes';

        let filtered = allPublicacoes.filter((item) => {
            const matchesCategoria = !categoriaId || item.categoria_id === categoriaId;

            const searchable = normalizeText([
                item.titulo,
                item.subtitulo,
                item.autor_nome,
                item.categoria_nome
            ].join(' '));

            const matchesSearch = !search || searchable.includes(search);

            return matchesCategoria && matchesSearch;
        });

        filtered = sortPublicacoes(filtered, ordem);

        return filtered;
    }

    function renderResultsInfo(total) {
        const info = document.getElementById('resultsInfo');

        if (!info) return;

        if (total === 1) {
            info.textContent = '1 publicação encontrada.';
            return;
        }

        info.textContent = `${total} publicações encontradas.`;
    }

    function renderPublications(publicacoes) {
        const root = document.getElementById('publicationsRoot');

        if (!publicacoes.length) {
            renderResultsInfo(0);
            renderEmpty('Tente limpar os filtros ou buscar por outro termo.');
            return;
        }

        renderResultsInfo(publicacoes.length);

        root.innerHTML = publicacoes.map((item) => {
            const autor = item.autor_nome || 'Tem no Entorno Sul';
            const data = formatDate(item.published_at || item.created_at);
            const href = `publicacao.html?slug=${encodeURIComponent(item.slug)}`;
            const categoria = item.categoria_nome || 'Publicação';

            return `
                <article class="publication-card">
                    ${item.imagem_capa_url ? `
                        <img
                            class="publication-cover"
                            src="${escapeHTML(item.imagem_capa_url)}"
                            alt="${escapeHTML(item.titulo)}"
                        >
                    ` : `
                        <div class="publication-placeholder">
                            <i class="fas fa-newspaper"></i>
                        </div>
                    `}

                    <div class="publication-body">
                        <div class="publication-category">
                            <i class="fas fa-tag"></i>
                            ${escapeHTML(categoria)}
                        </div>

                        <div class="publication-meta">
                            <span>
                                <i class="fas fa-user"></i>
                                ${escapeHTML(autor)}
                            </span>

                            ${data ? `
                                <span>
                                    <i class="fas fa-calendar-alt"></i>
                                    ${escapeHTML(data)}
                                </span>
                            ` : ''}
                        </div>

                        <h2 class="publication-title">${escapeHTML(item.titulo)}</h2>

                        <p class="publication-subtitle">
                            ${escapeHTML(item.subtitulo || 'Leia a publicação completa no Tem no Entorno Sul.')}
                        </p>

                        <a class="publication-link" href="${escapeHTML(href)}">
                            Ler publicação
                            <i class="fas fa-arrow-right"></i>
                        </a>
                    </div>
                </article>
            `;
        }).join('');
    }

    function applyFilters() {
        renderPublications(getFilteredPublicacoes());
    }

    function bindFilters() {
        document.getElementById('searchInput')?.addEventListener('input', applyFilters);
        document.getElementById('categoriaFilter')?.addEventListener('change', applyFilters);
        document.getElementById('ordemFilter')?.addEventListener('change', applyFilters);

        document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
            const searchInput = document.getElementById('searchInput');
            const categoriaFilter = document.getElementById('categoriaFilter');
            const ordemFilter = document.getElementById('ordemFilter');

            if (searchInput) searchInput.value = '';
            if (categoriaFilter) categoriaFilter.value = '';
            if (ordemFilter) ordemFilter.value = 'recentes';

            applyFilters();
        });
    }

    async function loadCategorias(client) {
        const { data, error } = await client
            .from('v_categorias_publicas')
            .select('*')
            .order('nome', { ascending: true });

        if (error) throw error;

        allCategorias = data || [];
        renderCategorias();
    }

    async function loadPublications() {
        const client = getClient();

        if (!client) {
            renderError('Não foi possível conectar ao Supabase.');
            return;
        }

        try {
            await loadCategorias(client);

            const { data, error } = await client
                .from('v_publicacoes_publicas')
                .select('*')
                .order('published_at', { ascending: false, nullsFirst: false })
                .order('created_at', { ascending: false });

            if (error) throw error;

            allPublicacoes = data || [];

            bindFilters();
            applyFilters();

        } catch (error) {
            console.error('[PUBLICAÇÕES]', error);
            renderError(error.message || 'Erro ao carregar publicações.');
        }
    }

    document.addEventListener('DOMContentLoaded', loadPublications);
})();