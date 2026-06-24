// js/comunidade.js

(function () {
    'use strict';

    const POINTS = {
        post: 8,
        resposta: 4,
        curtida: 1
    };

    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let posts = [];
    let respostas = [];
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

    function firstLetter(value) {
        return String(value || 'U').trim().charAt(0).toUpperCase();
    }

    function formatDate(value) {
        if (!value) return '';

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return '';

        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function categoryLabel(value) {
        const labels = {
            geral: 'Geral',
            cidade: 'Cidade',
            comercio: 'Comércio',
            eventos: 'Eventos',
            servicos: 'Serviços',
            alertas: 'Alertas',
            duvidas: 'Dúvidas',
            oportunidades: 'Oportunidades'
        };

        return labels[value] || 'Geral';
    }

    function categoryIcon(value) {
        const icons = {
            geral: 'fa-layer-group',
            cidade: 'fa-city',
            comercio: 'fa-store',
            eventos: 'fa-calendar-days',
            servicos: 'fa-screwdriver-wrench',
            alertas: 'fa-triangle-exclamation',
            duvidas: 'fa-circle-question',
            oportunidades: 'fa-briefcase'
        };

        return icons[value] || 'fa-layer-group';
    }

    function getRedirectUrl() {
        return `login.html?redirect=${encodeURIComponent('comunidade.html')}`;
    }

    function toast(message, type = 'success') {
        let el = document.getElementById('communityToast');

        if (!el) {
            el = document.createElement('div');
            el.id = 'communityToast';
            el.className = 'community-toast';
            document.body.appendChild(el);
        }

        el.className = `community-toast show ${type}`;
        el.textContent = message;

        setTimeout(() => {
            el.classList.remove('show');
        }, 3000);
    }

    async function loadSession() {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
            console.warn('[COMUNIDADE] Sessão:', error);
            currentUser = null;
            return;
        }

        currentUser = data?.session?.user || null;

        if (!currentUser) return;

        const { data: profile, error: profileError } = await supabase
            .from('usuarios')
            .select('id, nome, email, foto_url, cidade, pontos, nivel, status')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (profileError) {
            console.warn('[COMUNIDADE] Perfil:', profileError);
            currentProfile = null;
            return;
        }

        currentProfile = profile || null;
    }

    async function registerPoints(tipoInteracao, pontos, metadata = {}) {
        if (!currentUser) return;

        try {
            const { error } = await supabase.rpc('registrar_interacao_usuario', {
                p_tipo_interacao: tipoInteracao,
                p_tipo_conteudo: 'perfil',
                p_conteudo_id: currentUser.id,
                p_pontos: pontos,
                p_metadata: {
                    origem: 'comunidade',
                    url: window.location.href,
                    ...metadata
                }
            });

            if (error) throw error;

        } catch (error) {
            console.warn('[COMUNIDADE] Pontos não registrados:', error);
        }
    }

    function avatarHTML(item, className = 'community-avatar') {
        if (item.usuario_foto_url) {
            return `
                <img
                    src="${escapeHTML(item.usuario_foto_url)}"
                    alt="${escapeHTML(item.usuario_nome || 'Usuário')}"
                    class="${className}"
                    loading="lazy"
                >
            `;
        }

        return `
            <div class="${className}-placeholder">
                ${escapeHTML(firstLetter(item.usuario_nome))}
            </div>
        `;
    }

    function renderComposer() {
        const root = document.getElementById('communityComposer');

        if (!root) return;

        if (!currentUser) {
            root.innerHTML = `
                <div class="community-composer">
                    <h2>Participe da comunidade</h2>

                    <p style="color:#64748b;line-height:1.7;margin-top:0;">
                        Entre para publicar no mural, responder outros usuários e acumular pontos.
                    </p>

                    <a href="${getRedirectUrl()}" class="community-submit" style="text-decoration:none;">
                        <i class="fas fa-right-to-bracket"></i>
                        Entrar para participar
                    </a>
                </div>
            `;
            return;
        }

        root.innerHTML = `
            <form id="communityPostForm" class="community-composer">
                <h2>Publicar no mural</h2>

                <div class="community-form-grid">
                    <input
                        id="postTitle"
                        class="community-input"
                        type="text"
                        maxlength="120"
                        placeholder="Título opcional da publicação"
                    >

                    <select id="postCategory" class="community-select">
                        <option value="geral">Geral</option>
                        <option value="cidade">Cidade</option>
                        <option value="comercio">Comércio</option>
                        <option value="eventos">Eventos</option>
                        <option value="servicos">Serviços</option>
                        <option value="alertas">Alertas</option>
                        <option value="duvidas">Dúvidas</option>
                        <option value="oportunidades">Oportunidades</option>
                    </select>

                    <input
                        id="postCity"
                        class="community-input"
                        type="text"
                        maxlength="80"
                        placeholder="Cidade ou bairro"
                        value="${escapeHTML(currentProfile?.cidade || '')}"
                    >

                    <textarea
                        id="postContent"
                        class="community-textarea"
                        maxlength="1600"
                        placeholder="Compartilhe uma informação útil, dúvida, alerta, oportunidade ou assunto da região..."
                        required
                    ></textarea>

                    <button id="postSubmitBtn" class="community-submit" type="submit">
                        <i class="fas fa-paper-plane"></i>
                        Publicar no mural
                    </button>
                </div>
            </form>
        `;

        document.getElementById('communityPostForm')?.addEventListener('submit', createPost);
    }

    function renderStats() {
        const root = document.getElementById('communityStats');

        if (!root) return;

        const totalPosts = posts.length;
        const totalRespostas = respostas.length;
        const totalCurtidas = posts.reduce((acc, item) => acc + Number(item.total_curtidas || 0), 0) +
            respostas.reduce((acc, item) => acc + Number(item.total_curtidas || 0), 0);
        const totalUsuarios = new Set([
            ...posts.map((item) => item.usuario_id),
            ...respostas.map((item) => item.usuario_id)
        ]).size;

        root.innerHTML = `
            <div class="community-stats">
                <div class="community-stat-card">
                    <i class="fas fa-message"></i>
                    <strong>${totalPosts}</strong>
                    <span>Publicações</span>
                </div>

                <div class="community-stat-card">
                    <i class="fas fa-reply"></i>
                    <strong>${totalRespostas}</strong>
                    <span>Respostas</span>
                </div>

                <div class="community-stat-card">
                    <i class="fas fa-heart"></i>
                    <strong>${totalCurtidas}</strong>
                    <span>Curtidas</span>
                </div>

                <div class="community-stat-card">
                    <i class="fas fa-users"></i>
                    <strong>${totalUsuarios}</strong>
                    <span>Participantes</span>
                </div>
            </div>
        `;
    }

    function getFilteredPosts() {
        if (filtroAtual === 'todos') return posts;

        return posts.filter((item) => item.categoria === filtroAtual);
    }

    function repliesByPost(postId) {
        return respostas.filter((item) => item.post_id === postId);
    }

    function renderReply(reply) {
        const isOwner = currentUser && currentUser.id === reply.usuario_id;

        return `
            <article class="community-reply">
                <div class="community-reply-author">
                    <strong>${escapeHTML(reply.usuario_nome || 'Usuário')}</strong>
                    <span>${escapeHTML(formatDate(reply.created_at))}</span>
                </div>

                <div class="community-reply-content">
                    ${escapeHTML(reply.conteudo)}
                </div>

                <div class="community-post-footer">
                    <button class="community-action" type="button" data-like-reply="${escapeHTML(reply.id)}">
                        <i class="far fa-heart"></i>
                        Curtir
                        <strong>${Number(reply.total_curtidas || 0)}</strong>
                    </button>

                    ${
                        isOwner
                            ? `
                                <button class="community-action" type="button" data-delete-reply="${escapeHTML(reply.id)}">
                                    <i class="fas fa-trash"></i>
                                    Remover
                                </button>
                            `
                            : ''
                    }
                </div>
            </article>
        `;
    }

    function renderPost(post) {
        const replies = repliesByPost(post.id);
        const isOwner = currentUser && currentUser.id === post.usuario_id;

        return `
            <article class="community-post" data-post-id="${escapeHTML(post.id)}">
                <div class="community-post-header">
                    ${avatarHTML(post)}

                    <div class="community-author">
                        <strong>${escapeHTML(post.usuario_nome || 'Usuário')}</strong>
                        <span>${escapeHTML(formatDate(post.created_at))}</span>

                        ${
                            post.usuario_nivel
                                ? `
                                    <div class="community-level">
                                        <i class="fas fa-trophy"></i>
                                        ${escapeHTML(post.usuario_nivel)}
                                    </div>
                                `
                                : ''
                        }
                    </div>
                </div>

                <div class="community-post-body">
                    <div class="community-category">
                        <i class="fas ${categoryIcon(post.categoria)}"></i>
                        ${escapeHTML(categoryLabel(post.categoria))}
                        ${
                            post.cidade
                                ? ` • ${escapeHTML(post.cidade)}`
                                : ''
                        }
                    </div>

                    ${
                        post.titulo
                            ? `
                                <h2 class="community-post-title">
                                    ${escapeHTML(post.titulo)}
                                </h2>
                            `
                            : ''
                    }

                    <div class="community-post-content">
                        ${escapeHTML(post.conteudo)}
                    </div>

                    <div class="community-post-footer">
                        <button class="community-action" type="button" data-like-post="${escapeHTML(post.id)}">
                            <i class="far fa-heart"></i>
                            Curtir
                            <strong>${Number(post.total_curtidas || 0)}</strong>
                        </button>

                        <button class="community-action" type="button" data-reply-post="${escapeHTML(post.id)}">
                            <i class="fas fa-reply"></i>
                            Responder
                            <strong>${Number(post.total_respostas || 0)}</strong>
                        </button>

                        ${
                            isOwner
                                ? `
                                    <button class="community-action" type="button" data-delete-post="${escapeHTML(post.id)}">
                                        <i class="fas fa-trash"></i>
                                        Remover
                                    </button>
                                `
                                : ''
                        }
                    </div>

                    <div id="replyComposer-${escapeHTML(post.id)}"></div>
                </div>

                ${
                    replies.length
                        ? `
                            <div class="community-replies">
                                ${replies.map(renderReply).join('')}
                            </div>
                        `
                        : ''
                }
            </article>
        `;
    }

    function renderFeed() {
        renderStats();

        const root = document.getElementById('communityFeed');

        if (!root) return;

        const filtered = getFilteredPosts();

        if (!filtered.length) {
            root.innerHTML = `
                <div class="community-empty">
                    <i class="far fa-comments"></i>
                    <h2>Nenhuma publicação encontrada</h2>
                    <p>Publique algo ou altere o filtro da comunidade.</p>
                </div>
            `;
            return;
        }

        root.innerHTML = `
            <div class="community-feed">
                ${filtered.map(renderPost).join('')}
            </div>
        `;

        bindPostActions();
    }

    function renderReplyComposer(postId) {
        if (!currentUser) {
            window.location.href = getRedirectUrl();
            return;
        }

        const root = document.getElementById(`replyComposer-${postId}`);

        if (!root) return;

        root.innerHTML = root.innerHTML.trim()
            ? ''
            : `
                <form class="community-reply-form" data-post-id="${escapeHTML(postId)}" style="margin-top:18px;">
                    <textarea
                        class="community-textarea"
                        maxlength="1000"
                        placeholder="Escreva uma resposta..."
                        required
                    ></textarea>

                    <button class="community-submit" type="submit" style="margin-top:12px;">
                        <i class="fas fa-paper-plane"></i>
                        Responder
                    </button>
                </form>
            `;

        root.querySelector('.community-reply-form')?.addEventListener('submit', createReply);
    }

    async function createPost(event) {
        event.preventDefault();

        if (!currentUser) {
            window.location.href = getRedirectUrl();
            return;
        }

        const title = String(document.getElementById('postTitle')?.value || '').trim();
        const category = String(document.getElementById('postCategory')?.value || 'geral').trim();
        const city = String(document.getElementById('postCity')?.value || '').trim();
        const content = String(document.getElementById('postContent')?.value || '').trim();
        const button = document.getElementById('postSubmitBtn');

        if (!content) {
            toast('Escreva o conteúdo da publicação.', 'error');
            return;
        }

        if (content.length > 1600) {
            toast('Publicação muito longa. Limite de 1600 caracteres.', 'error');
            return;
        }

        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publicando...';
        }

        try {
            const { error } = await supabase
                .from('comunidade_posts')
                .insert({
                    usuario_id: currentUser.id,
                    cidade: city || currentProfile?.cidade || null,
                    categoria: category || 'geral',
                    titulo: title || null,
                    conteudo: content,
                    status: 'publicado'
                });

            if (error) throw error;

            await registerPoints('comentario', POINTS.post, {
                tipo: 'post_comunidade'
            });

            toast(`Publicado no mural! +${POINTS.post} pontos`);

            event.target.reset();

            if (currentProfile?.cidade) {
                const cityInput = document.getElementById('postCity');
                if (cityInput) cityInput.value = currentProfile.cidade;
            }

            await loadAll();

        } catch (error) {
            console.error('[COMUNIDADE] Criar post:', error);
            toast(error.message || 'Erro ao publicar.', 'error');
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-paper-plane"></i> Publicar no mural';
            }
        }
    }

    async function createReply(event) {
        event.preventDefault();

        if (!currentUser) {
            window.location.href = getRedirectUrl();
            return;
        }

        const form = event.target;
        const postId = form.dataset.postId;
        const textarea = form.querySelector('textarea');
        const button = form.querySelector('button');
        const content = String(textarea?.value || '').trim();

        if (!content) {
            toast('Escreva uma resposta.', 'error');
            return;
        }

        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        }

        try {
            const { error } = await supabase
                .from('comunidade_respostas')
                .insert({
                    post_id: postId,
                    usuario_id: currentUser.id,
                    conteudo: content,
                    status: 'publicado'
                });

            if (error) throw error;

            await registerPoints('comentario', POINTS.resposta, {
                tipo: 'resposta_comunidade',
                post_id: postId
            });

            toast(`Resposta publicada! +${POINTS.resposta} pontos`);

            await loadAll();

        } catch (error) {
            console.error('[COMUNIDADE] Resposta:', error);
            toast(error.message || 'Erro ao responder.', 'error');
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-paper-plane"></i> Responder';
            }
        }
    }

    async function toggleLikePost(postId) {
        if (!currentUser) {
            window.location.href = getRedirectUrl();
            return;
        }

        const { data: existing, error: findError } = await supabase
            .from('comunidade_curtidas')
            .select('id')
            .eq('usuario_id', currentUser.id)
            .eq('alvo_tipo', 'post')
            .eq('post_id', postId)
            .maybeSingle();

        if (findError) throw findError;

        if (existing) {
            const { error } = await supabase
                .from('comunidade_curtidas')
                .delete()
                .eq('id', existing.id)
                .eq('usuario_id', currentUser.id);

            if (error) throw error;

            toast('Curtida removida.');
        } else {
            const { error } = await supabase
                .from('comunidade_curtidas')
                .insert({
                    usuario_id: currentUser.id,
                    alvo_tipo: 'post',
                    post_id: postId
                });

            if (error) throw error;

            await registerPoints('curtida', POINTS.curtida, {
                tipo: 'curtida_post_comunidade',
                post_id: postId
            });

            toast(`Post curtido! +${POINTS.curtida} ponto`);
        }

        await loadAll();
    }

    async function toggleLikeReply(replyId) {
        if (!currentUser) {
            window.location.href = getRedirectUrl();
            return;
        }

        const { data: existing, error: findError } = await supabase
            .from('comunidade_curtidas')
            .select('id')
            .eq('usuario_id', currentUser.id)
            .eq('alvo_tipo', 'resposta')
            .eq('resposta_id', replyId)
            .maybeSingle();

        if (findError) throw findError;

        if (existing) {
            const { error } = await supabase
                .from('comunidade_curtidas')
                .delete()
                .eq('id', existing.id)
                .eq('usuario_id', currentUser.id);

            if (error) throw error;

            toast('Curtida removida.');
        } else {
            const { error } = await supabase
                .from('comunidade_curtidas')
                .insert({
                    usuario_id: currentUser.id,
                    alvo_tipo: 'resposta',
                    resposta_id: replyId
                });

            if (error) throw error;

            await registerPoints('curtida', POINTS.curtida, {
                tipo: 'curtida_resposta_comunidade',
                resposta_id: replyId
            });

            toast(`Resposta curtida! +${POINTS.curtida} ponto`);
        }

        await loadAll();
    }

    async function deletePost(postId) {
        if (!currentUser) return;

        if (!confirm('Remover esta publicação da comunidade?')) return;

        const { error } = await supabase
            .from('comunidade_posts')
            .delete()
            .eq('id', postId)
            .eq('usuario_id', currentUser.id);

        if (error) throw error;

        toast('Publicação removida.');
        await loadAll();
    }

    async function deleteReply(replyId) {
        if (!currentUser) return;

        if (!confirm('Remover esta resposta?')) return;

        const { error } = await supabase
            .from('comunidade_respostas')
            .delete()
            .eq('id', replyId)
            .eq('usuario_id', currentUser.id);

        if (error) throw error;

        toast('Resposta removida.');
        await loadAll();
    }

    function bindPostActions() {
        document.querySelectorAll('[data-reply-post]').forEach((button) => {
            button.addEventListener('click', () => {
                renderReplyComposer(button.dataset.replyPost);
            });
        });

        document.querySelectorAll('[data-like-post]').forEach((button) => {
            button.addEventListener('click', async () => {
                button.disabled = true;

                try {
                    await toggleLikePost(button.dataset.likePost);
                } catch (error) {
                    console.error('[COMUNIDADE] Curtir post:', error);
                    toast(error.message || 'Erro ao curtir post.', 'error');
                } finally {
                    button.disabled = false;
                }
            });
        });

        document.querySelectorAll('[data-like-reply]').forEach((button) => {
            button.addEventListener('click', async () => {
                button.disabled = true;

                try {
                    await toggleLikeReply(button.dataset.likeReply);
                } catch (error) {
                    console.error('[COMUNIDADE] Curtir resposta:', error);
                    toast(error.message || 'Erro ao curtir resposta.', 'error');
                } finally {
                    button.disabled = false;
                }
            });
        });

        document.querySelectorAll('[data-delete-post]').forEach((button) => {
            button.addEventListener('click', async () => {
                try {
                    await deletePost(button.dataset.deletePost);
                } catch (error) {
                    console.error('[COMUNIDADE] Remover post:', error);
                    toast(error.message || 'Erro ao remover publicação.', 'error');
                }
            });
        });

        document.querySelectorAll('[data-delete-reply]').forEach((button) => {
            button.addEventListener('click', async () => {
                try {
                    await deleteReply(button.dataset.deleteReply);
                } catch (error) {
                    console.error('[COMUNIDADE] Remover resposta:', error);
                    toast(error.message || 'Erro ao remover resposta.', 'error');
                }
            });
        });
    }

    function bindFilters() {
        document.querySelectorAll('.community-filter').forEach((button) => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.community-filter').forEach((item) => {
                    item.classList.remove('active');
                });

                button.classList.add('active');

                filtroAtual = button.dataset.filter || 'todos';

                renderFeed();
            });
        });
    }

    async function loadPosts() {
        const { data, error } = await supabase
            .from('v_comunidade_posts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        posts = data || [];
    }

    async function loadRespostas() {
        const postIds = posts.map((item) => item.id);

        if (!postIds.length) {
            respostas = [];
            return;
        }

        const { data, error } = await supabase
            .from('v_comunidade_respostas')
            .select('*')
            .in('post_id', postIds)
            .order('created_at', { ascending: true });

        if (error) throw error;

        respostas = data || [];
    }

    async function loadAll() {
        await loadPosts();
        await loadRespostas();

        renderFeed();
    }

    function subscribeRealtime() {
        supabase
            .channel('comunidade-feed')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'comunidade_posts'
                },
                () => loadAll()
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'comunidade_respostas'
                },
                () => loadAll()
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'comunidade_curtidas'
                },
                () => loadAll()
            )
            .subscribe();
    }

    async function initialize() {
        supabase = getClient();

        if (!supabase) {
            document.getElementById('communityFeed').innerHTML = `
                <div class="community-empty">
                    <i class="fas fa-triangle-exclamation"></i>
                    <h2>Supabase não encontrado</h2>
                    <p>Verifique o arquivo js/supabase-config.js.</p>
                </div>
            `;
            return;
        }

        bindFilters();

        try {
            await loadSession();

            renderComposer();

            await loadAll();

            subscribeRealtime();

        } catch (error) {
            console.error('[COMUNIDADE]', error);

            document.getElementById('communityFeed').innerHTML = `
                <div class="community-empty">
                    <i class="fas fa-triangle-exclamation"></i>
                    <h2>Não foi possível carregar a comunidade</h2>
                    <p>${escapeHTML(error.message || 'Erro inesperado.')}</p>
                </div>
            `;
        }
    }

    document.addEventListener('DOMContentLoaded', initialize);
})();