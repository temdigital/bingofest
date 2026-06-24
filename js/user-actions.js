// js/user-actions.js

(function () {
    'use strict';

    const POINTS = {
        curtida: 2,
        favorito: 4,
        compartilhamento: 3
    };

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

    function getCurrentRedirect() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        return `${currentPage}${window.location.search || ''}`;
    }

    function requireLogin() {
        window.location.href = `login.html?redirect=${encodeURIComponent(getCurrentRedirect())}`;
    }

    function toast(message, type = 'success') {
        let el = document.getElementById('userActionsToast');

        if (!el) {
            el = document.createElement('div');
            el.id = 'userActionsToast';
            el.className = 'user-actions-toast';
            document.body.appendChild(el);
        }

        el.className = `user-actions-toast show ${type}`;
        el.textContent = message;

        setTimeout(() => {
            el.classList.remove('show');
        }, 2800);
    }

    async function loadSession() {
        supabase = getClient();

        if (!supabase) return null;

        const { data, error } = await supabase.auth.getSession();

        if (error) {
            console.warn('[USER ACTIONS] Sessão não carregada:', error);
            return null;
        }

        currentUser = data?.session?.user || null;

        return currentUser;
    }

    async function getState(tipoConteudo, conteudoId) {
        if (!currentUser) {
            return {
                liked: false,
                favorited: false
            };
        }

        const [curtidaResult, favoritoResult] = await Promise.all([
            supabase
                .from('user_curtidas')
                .select('id')
                .eq('usuario_id', currentUser.id)
                .eq('tipo_conteudo', tipoConteudo)
                .eq('conteudo_id', conteudoId)
                .maybeSingle(),

            supabase
                .from('user_favoritos')
                .select('id')
                .eq('usuario_id', currentUser.id)
                .eq('tipo_conteudo', tipoConteudo)
                .eq('conteudo_id', conteudoId)
                .maybeSingle()
        ]);

        if (curtidaResult.error) throw curtidaResult.error;
        if (favoritoResult.error) throw favoritoResult.error;

        return {
            liked: Boolean(curtidaResult.data),
            favorited: Boolean(favoritoResult.data)
        };
    }

    async function getCounters(tipoConteudo, conteudoId) {
        const { data, error } = await supabase
            .from('v_contadores_interacoes')
            .select('total_curtidas, total_favoritos')
            .eq('tipo_conteudo', tipoConteudo)
            .eq('conteudo_id', conteudoId)
            .maybeSingle();

        if (error) {
            console.warn('[USER ACTIONS] Contadores não carregados:', error);

            return {
                likes: 0,
                favorites: 0
            };
        }

        return {
            likes: Number(data?.total_curtidas || 0),
            favorites: Number(data?.total_favoritos || 0)
        };
    }

    async function registerInteraction(tipoInteracao, tipoConteudo, conteudoId, pontos) {
        if (!currentUser) return;

        const { error } = await supabase.rpc('registrar_interacao_usuario', {
            p_tipo_interacao: tipoInteracao,
            p_tipo_conteudo: tipoConteudo,
            p_conteudo_id: conteudoId,
            p_pontos: pontos,
            p_metadata: {
                url: window.location.href,
                origem: 'portal_publico'
            }
        });

        if (error) {
            console.warn('[USER ACTIONS] Interação não registrada:', error);
        }
    }

    function updateButton(button, active, activeIcon, inactiveIcon, activeLabel, inactiveLabel) {
        button.classList.toggle('active', active);

        const icon = button.querySelector('i');
        const label = button.querySelector('span');

        if (icon) icon.className = active ? activeIcon : inactiveIcon;
        if (label) label.textContent = active ? activeLabel : inactiveLabel;
    }

    async function refresh(config) {
        try {
            const state = await getState(config.tipoConteudo, config.conteudoId);
            const counters = await getCounters(config.tipoConteudo, config.conteudoId);

            const likeButton = document.querySelector('[data-user-action="like"]');
            const favoriteButton = document.querySelector('[data-user-action="favorite"]');
            const likesCounter = document.querySelector('[data-user-counter="likes"]');
            const favoritesCounter = document.querySelector('[data-user-counter="favorites"]');

            if (likeButton) {
                updateButton(
                    likeButton,
                    state.liked,
                    'fas fa-heart',
                    'far fa-heart',
                    'Curtido',
                    'Curtir'
                );
            }

            if (favoriteButton) {
                updateButton(
                    favoriteButton,
                    state.favorited,
                    'fas fa-bookmark',
                    'far fa-bookmark',
                    'Favoritado',
                    'Favoritar'
                );
            }

            if (likesCounter) {
                likesCounter.textContent = counters.likes;
            }

            if (favoritesCounter) {
                favoritesCounter.textContent = counters.favorites;
            }

        } catch (error) {
            console.error('[USER ACTIONS] Refresh:', error);
            toast(error.message || 'Erro ao carregar interações.', 'error');
        }
    }

    async function toggleLike(config) {
        if (!currentUser) {
            requireLogin();
            return;
        }

        const button = document.querySelector('[data-user-action="like"]');

        if (!button) return;

        button.disabled = true;

        try {
            const state = await getState(config.tipoConteudo, config.conteudoId);

            if (state.liked) {
                const { error } = await supabase
                    .from('user_curtidas')
                    .delete()
                    .eq('usuario_id', currentUser.id)
                    .eq('tipo_conteudo', config.tipoConteudo)
                    .eq('conteudo_id', config.conteudoId);

                if (error) throw error;

                toast('Curtida removida.');
            } else {
                const { error } = await supabase
                    .from('user_curtidas')
                    .insert({
                        usuario_id: currentUser.id,
                        tipo_conteudo: config.tipoConteudo,
                        conteudo_id: config.conteudoId
                    });

                if (error) throw error;

                await registerInteraction(
                    'curtida',
                    config.tipoConteudo,
                    config.conteudoId,
                    POINTS.curtida
                );

                toast(`Curtido! +${POINTS.curtida} pontos`);
            }

            await refresh(config);

        } catch (error) {
            console.error('[USER ACTIONS] Curtida:', error);
            toast(error.message || 'Erro ao curtir.', 'error');
        } finally {
            button.disabled = false;
        }
    }

    async function toggleFavorite(config) {
        if (!currentUser) {
            requireLogin();
            return;
        }

        const button = document.querySelector('[data-user-action="favorite"]');

        if (!button) return;

        button.disabled = true;

        try {
            const state = await getState(config.tipoConteudo, config.conteudoId);

            if (state.favorited) {
                const { error } = await supabase
                    .from('user_favoritos')
                    .delete()
                    .eq('usuario_id', currentUser.id)
                    .eq('tipo_conteudo', config.tipoConteudo)
                    .eq('conteudo_id', config.conteudoId);

                if (error) throw error;

                toast('Removido dos favoritos.');
            } else {
                const { error } = await supabase
                    .from('user_favoritos')
                    .insert({
                        usuario_id: currentUser.id,
                        tipo_conteudo: config.tipoConteudo,
                        conteudo_id: config.conteudoId
                    });

                if (error) throw error;

                await registerInteraction(
                    'favorito',
                    config.tipoConteudo,
                    config.conteudoId,
                    POINTS.favorito
                );

                toast(`Adicionado aos favoritos! +${POINTS.favorito} pontos`);
            }

            await refresh(config);

        } catch (error) {
            console.error('[USER ACTIONS] Favorito:', error);
            toast(error.message || 'Erro ao favoritar.', 'error');
        } finally {
            button.disabled = false;
        }
    }

    async function shareWhatsApp(config) {
        const title = config.titulo || document.title;
        const text = config.texto
            ? `${title}\n\n${config.texto}\n\n${window.location.href}`
            : `${title}\n\n${window.location.href}`;

        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

        if (currentUser) {
            await registerInteraction(
                'compartilhamento',
                config.tipoConteudo,
                config.conteudoId,
                POINTS.compartilhamento
            );

            toast(`Compartilhamento registrado! +${POINTS.compartilhamento} pontos`);
        }
    }

    function render(config) {
        const root = document.getElementById(config.rootId || 'userActionsRoot');

        if (!root || !config.conteudoId || !config.tipoConteudo) return;

        root.innerHTML = `
            <div class="user-actions-box">
                <button class="user-action-btn" type="button" data-user-action="like">
                    <i class="far fa-heart"></i>
                    <span>Curtir</span>
                    <strong data-user-counter="likes">0</strong>
                </button>

                <button class="user-action-btn" type="button" data-user-action="favorite">
                    <i class="far fa-bookmark"></i>
                    <span>Favoritar</span>
                    <strong data-user-counter="favorites">0</strong>
                </button>

                <button class="user-action-btn" type="button" data-user-action="share-whatsapp">
                    <i class="fab fa-whatsapp"></i>
                    <span>Compartilhar</span>
                </button>
            </div>

            ${
                !currentUser
                    ? `
                        <p class="user-actions-login-hint">
                            Entre para curtir, favoritar e acumular pontos.
                            <a href="${escapeHTML(`login.html?redirect=${encodeURIComponent(getCurrentRedirect())}`)}">
                                Fazer login
                            </a>
                        </p>
                    `
                    : ''
            }
        `;

        root
            .querySelector('[data-user-action="like"]')
            ?.addEventListener('click', () => toggleLike(config));

        root
            .querySelector('[data-user-action="favorite"]')
            ?.addEventListener('click', () => toggleFavorite(config));

        root
            .querySelector('[data-user-action="share-whatsapp"]')
            ?.addEventListener('click', () => shareWhatsApp(config));
    }

    async function init(config) {
        if (!config || !config.tipoConteudo || !config.conteudoId) {
            console.warn('[USER ACTIONS] Configuração inválida.');
            return;
        }

        supabase = getClient();

        if (!supabase) {
            console.warn('[USER ACTIONS] Supabase não encontrado.');
            return;
        }

        await loadSession();

        render(config);
        await refresh(config);
    }

    window.UserActions = {
        init,
        refresh
    };
})();