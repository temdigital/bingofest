// js/favoritos.js

(function () {
    'use strict';

    let supabase = null;
    let currentUser = null;
    let favoritos = [];
    let favoritosDetalhados = [];
    let filtroAtual = 'todos';

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

    function resumo(value, limite = 120) {
        const text = stripHTML(value).trim();

        if (!text) return 'Sem descrição disponível.';
        if (text.length <= limite) return text;

        return `${text.slice(0, limite).trim()}...`;
    }

    function formatDate(value) {
        if (!value) return '';

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return '';

        return date.toLocaleDateString('pt-BR');
    }

    function tipoLabel(tipo) {
        const labels = {
            publicacao: 'Publicação',
            evento: 'Evento',
            parceiro: 'Parceiro',
            colunista: 'Colunista'
        };

        return labels[tipo] || tipo;
    }

    function tipoIcon(tipo) {
        const icons = {
            publicacao: 'fa-newspaper',
            evento: 'fa-calendar-alt',
            parceiro: 'fa-store',
            colunista: 'fa-user-pen'
        };

        return icons[tipo] || 'fa-bookmark';
    }

    function linkDoItem(item) {
        if (!item.slug) return '#';

        if (item.tipo_conteudo === 'publicacao') {
            return `publicacao.html?slug=${encodeURIComponent(item.slug)}`;
        }

        if (item.tipo_conteudo === 'evento') {
            return `evento.html?slug=${encodeURIComponent(item.slug)}`;
        }

        if (item.tipo_conteudo === 'parceiro') {
            return `parceiro.html?slug=${encodeURIComponent(item.slug)}`;
        }

        if (item.tipo_conteudo === 'colunista') {
            return `colunista.html?slug=${encodeURIComponent(item.slug)}`;
        }

        return '#';
    }

    function imagemDoItem(item) {
        return item.imagem ||
            item.imagem_capa_url ||
            item.imagem_banner_url ||
            item.imagem_logo_url ||
            item.foto_url ||
            '';
    }

    function tituloDoItem(item) {
        return item.titulo || item.nome || 'Item favoritado';
    }

    function descricaoDoItem(item) {
        return item.subtitulo ||
            item.descricao ||
            item.conteudo ||
            item.bio ||
            item.biografia ||
            '';
    }

    function renderLoginRequired() {
        document.getElementById('favoritosGrid').innerHTML = `
            <div class="favorites-empty">
                <i class="fas fa-lock"></i>
                <h2>Entre para ver seus favoritos</h2>
                <p>Faça login para acessar os conteúdos que você salvou.</p>

                <a href="login.html?redirect=favoritos.html" class="favorites-primary-btn">
                    <i class="fas fa-right-to-bracket"></i>
                    Entrar
                </a>
            </div>
        `;
    }

    function renderError(message) {
        document.getElementById('favoritosGrid').innerHTML = `
            <div class="favorites-empty">
                <i class="fas fa-triangle-exclamation"></i>
                <h2>Não foi possível carregar</h2>
                <p>${escapeHTML(message)}</p>
            </div>
        `;
    }

    function renderEmpty() {
        document.getElementById('favoritosGrid').innerHTML = `
            <div class="favorites-empty">
                <i class="far fa-bookmark"></i>
                <h2>Nenhum favorito ainda</h2>
                <p>Quando você favoritar publicações, eventos, parceiros ou colunistas, eles aparecerão aqui.</p>

                <a href="publicacoes.html" class="favorites-primary-btn">
                    <i class="fas fa-newspaper"></i>
                    Explorar publicações
                </a>
            </div>
        `;
    }

    function renderStats() {
        const root = document.getElementById('favoritosStats');

        if (!root) return;

        const total = favoritosDetalhados.length;

        const countByType = {
            publicacao: favoritosDetalhados.filter((item) => item.tipo_conteudo === 'publicacao').length,
            evento: favoritosDetalhados.filter((item) => item.tipo_conteudo === 'evento').length,
            parceiro: favoritosDetalhados.filter((item) => item.tipo_conteudo === 'parceiro').length,
            colunista: favoritosDetalhados.filter((item) => item.tipo_conteudo === 'colunista').length
        };

        root.innerHTML = `
            <div class="favorites-stats-grid">
                <div class="favorites-stat-card">
                    <strong>${total}</strong>
                    <span>Total</span>
                </div>

                <div class="favorites-stat-card">
                    <strong>${countByType.publicacao}</strong>
                    <span>Publicações</span>
                </div>

                <div class="favorites-stat-card">
                    <strong>${countByType.evento}</strong>
                    <span>Eventos</span>
                </div>

                <div class="favorites-stat-card">
                    <strong>${countByType.parceiro}</strong>
                    <span>Parceiros</span>
                </div>

                <div class="favorites-stat-card">
                    <strong>${countByType.colunista}</strong>
                    <span>Colunistas</span>
                </div>
            </div>
        `;
    }

    function getItemsFiltrados() {
        if (filtroAtual === 'todos') return favoritosDetalhados;

        return favoritosDetalhados.filter((item) => item.tipo_conteudo === filtroAtual);
    }

    function renderFavoritos() {
        renderStats();

        const root = document.getElementById('favoritosGrid');

        if (!root) return;

        const items = getItemsFiltrados();

        if (!favoritosDetalhados.length) {
            renderEmpty();
            return;
        }

        if (!items.length) {
            root.innerHTML = `
                <div class="favorites-empty">
                    <i class="fas ${tipoIcon(filtroAtual)}"></i>
                    <h2>Nenhum favorito nesta categoria</h2>
                    <p>Altere o filtro ou favorite novos conteúdos.</p>
                </div>
            `;
            return;
        }

        root.innerHTML = `
            <div class="favorites-grid">
                ${items.map((item) => {
                    const imagem = imagemDoItem(item);
                    const titulo = tituloDoItem(item);
                    const descricao = resumo(descricaoDoItem(item));
                    const link = linkDoItem(item);
                    const dataFavorito = formatDate(item.favoritado_em);

                    return `
                        <article class="favorite-card">
                            <a href="${escapeHTML(link)}" class="favorite-media">
                                ${
                                    imagem
                                        ? `
                                            <img
                                                src="${escapeHTML(imagem)}"
                                                alt="${escapeHTML(titulo)}"
                                                loading="lazy"
                                            >
                                        `
                                        : `
                                            <div class="favorite-placeholder">
                                                <i class="fas ${tipoIcon(item.tipo_conteudo)}"></i>
                                            </div>
                                        `
                                }
                            </a>

                            <div class="favorite-body">
                                <div class="favorite-type">
                                    <i class="fas ${tipoIcon(item.tipo_conteudo)}"></i>
                                    ${escapeHTML(tipoLabel(item.tipo_conteudo))}
                                </div>

                                <h2>
                                    <a href="${escapeHTML(link)}">
                                        ${escapeHTML(titulo)}
                                    </a>
                                </h2>

                                <p>${escapeHTML(descricao)}</p>

                                <div class="favorite-meta">
                                    ${
                                        dataFavorito
                                            ? `
                                                <span>
                                                    <i class="fas fa-bookmark"></i>
                                                    Favoritado em ${escapeHTML(dataFavorito)}
                                                </span>
                                            `
                                            : ''
                                    }
                                </div>

                                <div class="favorite-actions">
                                    <a href="${escapeHTML(link)}" class="favorite-btn">
                                        <i class="fas fa-eye"></i>
                                        Ver
                                    </a>

                                    <button
                                        class="favorite-btn danger"
                                        type="button"
                                        data-remove-favorite="${escapeHTML(item.favorito_id)}"
                                    >
                                        <i class="fas fa-trash"></i>
                                        Remover
                                    </button>
                                </div>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        `;

        bindRemoveButtons();
    }

    async function removeFavorito(favoritoId) {
        if (!favoritoId) return;

        const confirmed = confirm('Remover este item dos seus favoritos?');

        if (!confirmed) return;

        try {
            const { error } = await supabase
                .from('user_favoritos')
                .delete()
                .eq('id', favoritoId)
                .eq('usuario_id', currentUser.id);

            if (error) throw error;

            favoritosDetalhados = favoritosDetalhados.filter((item) => item.favorito_id !== favoritoId);
            favoritos = favoritos.filter((item) => item.id !== favoritoId);

            renderFavoritos();

        } catch (error) {
            console.error('[FAVORITOS] remover:', error);
            alert(error.message || 'Não foi possível remover o favorito.');
        }
    }

    function bindRemoveButtons() {
        document.querySelectorAll('[data-remove-favorite]').forEach((button) => {
            button.addEventListener('click', () => {
                removeFavorito(button.dataset.removeFavorite);
            });
        });
    }

    function bindFilters() {
        document.querySelectorAll('.favorite-filter').forEach((button) => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.favorite-filter').forEach((btn) => {
                    btn.classList.remove('active');
                });

                button.classList.add('active');

                filtroAtual = button.dataset.filter || 'todos';

                renderFavoritos();
            });
        });
    }

    async function carregarPublicacoes(ids) {
        if (!ids.length) return [];

        const { data, error } = await supabase
            .from('v_publicacoes_publicas')
            .select('*')
            .in('id', ids);

        if (error) {
            console.warn('[FAVORITOS] publicações:', error);
            return [];
        }

        return data || [];
    }

    async function carregarEventos(ids) {
        if (!ids.length) return [];

        const { data, error } = await supabase
            .from('v_eventos_publicos')
            .select('*')
            .in('id', ids);

        if (error) {
            console.warn('[FAVORITOS] eventos:', error);
            return [];
        }

        return data || [];
    }

    async function carregarParceiros(ids) {
        if (!ids.length) return [];

        const { data, error } = await supabase
            .from('v_negocios_publicos')
            .select('*')
            .in('id', ids);

        if (error) {
            console.warn('[FAVORITOS] parceiros:', error);
            return [];
        }

        return data || [];
    }

    async function carregarColunistas(ids) {
        if (!ids.length) return [];

        try {
            const { data, error } = await supabase
                .from('v_colunistas_publicos')
                .select('*')
                .in('id', ids);

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.warn('[FAVORITOS] v_colunistas_publicos indisponível, tentando tabela colunistas:', error);

            const { data, error: tableError } = await supabase
                .from('colunistas')
                .select('*')
                .in('id', ids);

            if (tableError) {
                console.warn('[FAVORITOS] colunistas:', tableError);
                return [];
            }

            return data || [];
        }
    }

    function mergeDetalhes(tipo, favoritosTipo, detalhes) {
        return favoritosTipo.map((fav) => {
            const detalhe = detalhes.find((item) => item.id === fav.conteudo_id);

            if (!detalhe) {
                return {
                    favorito_id: fav.id,
                    tipo_conteudo: tipo,
                    conteudo_id: fav.conteudo_id,
                    titulo: 'Conteúdo indisponível',
                    descricao: 'Este item pode ter sido removido ou despublicado.',
                    slug: '',
                    favoritado_em: fav.created_at
                };
            }

            return {
                ...detalhe,
                favorito_id: fav.id,
                tipo_conteudo: tipo,
                conteudo_id: fav.conteudo_id,
                favoritado_em: fav.created_at
            };
        });
    }

    async function carregarDetalhes() {
        const porTipo = {
            publicacao: favoritos.filter((item) => item.tipo_conteudo === 'publicacao'),
            evento: favoritos.filter((item) => item.tipo_conteudo === 'evento'),
            parceiro: favoritos.filter((item) => item.tipo_conteudo === 'parceiro'),
            colunista: favoritos.filter((item) => item.tipo_conteudo === 'colunista')
        };

        const [
            publicacoes,
            eventos,
            parceiros,
            colunistas
        ] = await Promise.all([
            carregarPublicacoes(porTipo.publicacao.map((item) => item.conteudo_id)),
            carregarEventos(porTipo.evento.map((item) => item.conteudo_id)),
            carregarParceiros(porTipo.parceiro.map((item) => item.conteudo_id)),
            carregarColunistas(porTipo.colunista.map((item) => item.conteudo_id))
        ]);

        favoritosDetalhados = [
            ...mergeDetalhes('publicacao', porTipo.publicacao, publicacoes),
            ...mergeDetalhes('evento', porTipo.evento, eventos),
            ...mergeDetalhes('parceiro', porTipo.parceiro, parceiros),
            ...mergeDetalhes('colunista', porTipo.colunista, colunistas)
        ].sort((a, b) => new Date(b.favoritado_em || 0) - new Date(a.favoritado_em || 0));
    }

    async function loadFavoritos() {
        const { data, error } = await supabase
            .from('user_favoritos')
            .select('*')
            .eq('usuario_id', currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        favoritos = data || [];

        await carregarDetalhes();

        renderFavoritos();
    }

    async function initialize() {
        supabase = getClient();

        if (!supabase) {
            renderError('Supabase não encontrado.');
            return;
        }

        bindFilters();

        try {
            const { data, error } = await supabase.auth.getSession();

            if (error) throw error;

            currentUser = data?.session?.user || null;

            if (!currentUser) {
                renderLoginRequired();
                return;
            }

            await loadFavoritos();

        } catch (error) {
            console.error('[FAVORITOS]', error);
            renderError(error.message || 'Erro ao carregar favoritos.');
        }
    }

    document.addEventListener('DOMContentLoaded', initialize);
})();