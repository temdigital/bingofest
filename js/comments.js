// js/comments.js

(function () {
    'use strict';

    const POINTS_COMMENT = 6;
    const POINTS_COMMENT_LIKE = 1;

    let supabase = null;
    let currentUser = null;
    let config = null;
    let comments = [];

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
        const page = window.location.pathname.split('/').pop() || 'index.html';
        return `${page}${window.location.search || ''}${window.location.hash || ''}`;
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

    function firstLetter(value) {
        return String(value || 'U').trim().charAt(0).toUpperCase();
    }

    function toast(message, type = 'success') {
        let el = document.getElementById('commentsToast');

        if (!el) {
            el = document.createElement('div');
            el.id = 'commentsToast';
            el.className = 'comments-toast';
            document.body.appendChild(el);
        }

        el.className = `comments-toast show ${type}`;
        el.textContent = message;

        setTimeout(() => {
            el.classList.remove('show');
        }, 3000);
    }

    async function loadSession() {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
            console.warn('[COMMENTS] Sessão:', error);
            currentUser = null;
            return;
        }

        currentUser = data?.session?.user || null;
    }

    async function registerPoints(tipoInteracao, pontos, metadata = {}) {
        if (!currentUser || !supabase) return;

        try {
            const { error } = await supabase.rpc('registrar_interacao_usuario', {
                p_tipo_interacao: tipoInteracao,
                p_tipo_conteudo: config.tipoConteudo,
                p_conteudo_id: config.conteudoId,
                p_pontos: pontos,
                p_metadata: {
                    origem: 'comentarios',
                    url: window.location.href,
                    ...metadata
                }
            });

            if (error) throw error;

        } catch (error) {
            console.warn('[COMMENTS] Pontos não registrados:', error);
        }
    }

    function renderLoginBox() {
        return `
            <div class="comments-login-box">
                <i class="fas fa-lock"></i>
                <div>
                    <strong>Entre para comentar</strong>
                    <p>Faça login para participar da conversa e acumular pontos na comunidade.</p>
                </div>
                <a href="login.html?redirect=${encodeURIComponent(getCurrentRedirect())}">
                    Entrar
                </a>
            </div>
        `;
    }

    function renderForm(parentId = '') {
        if (!currentUser) {
            return parentId ? '' : renderLoginBox();
        }

        return `
            <form class="comment-form" data-parent-id="${escapeHTML(parentId)}">
                <textarea
                    class="comment-input"
                    maxlength="1200"
                    placeholder="${parentId ? 'Escreva uma resposta...' : 'Escreva seu comentário...'}"
                    required
                ></textarea>

                <div class="comment-form-footer">
                    <span>Máximo de 1200 caracteres.</span>

                    <button type="submit">
                        <i class="fas fa-paper-plane"></i>
                        ${parentId ? 'Responder' : 'Comentar'}
                    </button>
                </div>
            </form>
        `;
    }

    function avatarHTML(comment) {
        if (comment.usuario_foto_url) {
            return `
                <img
                    src="${escapeHTML(comment.usuario_foto_url)}"
                    alt="${escapeHTML(comment.usuario_nome)}"
                    class="comment-avatar"
                    loading="lazy"
                >
            `;
        }

        return `
            <div class="comment-avatar-placeholder">
                ${escapeHTML(firstLetter(comment.usuario_nome))}
            </div>
        `;
    }

    function renderComment(comment, replies = []) {
        const isOwner = currentUser && currentUser.id === comment.usuario_id;

        return `
            <article class="comment-card" data-comment-id="${escapeHTML(comment.id)}">
                <div class="comment-main">
                    ${avatarHTML(comment)}

                    <div class="comment-body">
                        <div class="comment-header">
                            <div>
                                <strong>${escapeHTML(comment.usuario_nome || 'Usuário')}</strong>

                                <span>
                                    ${escapeHTML(formatDate(comment.created_at))}
                                </span>
                            </div>

                            ${
                                comment.usuario_nivel
                                    ? `
                                        <span class="comment-level">
                                            <i class="fas fa-trophy"></i>
                                            ${escapeHTML(comment.usuario_nivel)}
                                        </span>
                                    `
                                    : ''
                            }
                        </div>

                        <p class="comment-text">
                            ${escapeHTML(comment.conteudo)}
                        </p>

                        <div class="comment-actions">
                            <button type="button" data-comment-like="${escapeHTML(comment.id)}">
                                <i class="far fa-heart"></i>
                                Curtir
                                <strong>${Number(comment.total_curtidas || 0)}</strong>
                            </button>

                            ${
                                currentUser
                                    ? `
                                        <button type="button" data-comment-reply="${escapeHTML(comment.id)}">
                                            <i class="fas fa-reply"></i>
                                            Responder
                                        </button>
                                    `
                                    : ''
                            }

                            ${
                                isOwner
                                    ? `
                                        <button type="button" class="danger" data-comment-delete="${escapeHTML(comment.id)}">
                                            <i class="fas fa-trash"></i>
                                            Remover
                                        </button>
                                    `
                                    : ''
                            }
                        </div>

                        <div class="comment-reply-box" id="replyBox-${escapeHTML(comment.id)}"></div>

                        ${
                            replies.length
                                ? `
                                    <div class="comment-replies">
                                        ${replies.map((reply) => renderComment(reply, [])).join('')}
                                    </div>
                                `
                                : ''
                        }
                    </div>
                </div>
            </article>
        `;
    }

    function buildTree() {
        const parents = comments.filter((item) => !item.comentario_pai_id);
        const children = comments.filter((item) => item.comentario_pai_id);

        return parents.map((parent) => ({
            parent,
            replies: children.filter((child) => child.comentario_pai_id === parent.id)
        }));
    }

    function renderComments() {
        const root = document.getElementById(config.rootId || 'commentsRoot');

        if (!root) return;

        const tree = buildTree();

        root.innerHTML = `
            <section class="comments-section">
                <div class="comments-header">
                    <div>
                        <span class="comments-kicker">
                            <i class="fas fa-comments"></i>
                            Comunidade
                        </span>

                        <h2>Comentários</h2>

                        <p>
                            Participe com respeito. Comentários ofensivos poderão ser removidos.
                        </p>
                    </div>

                    <strong class="comments-count">
                        ${comments.filter((item) => !item.comentario_pai_id).length}
                    </strong>
                </div>

                ${renderForm()}

                <div class="comments-list">
                    ${
                        tree.length
                            ? tree.map((item) => renderComment(item.parent, item.replies)).join('')
                            : `
                                <div class="comments-empty">
                                    <i class="far fa-comment-dots"></i>
                                    <h3>Nenhum comentário ainda</h3>
                                    <p>Seja o primeiro a participar desta conversa.</p>
                                </div>
                            `
                    }
                </div>
            </section>
        `;

        bindForms();
        bindActions();
    }

    async function loadComments() {
        const { data, error } = await supabase
            .from('v_comentarios_publicos')
            .select('*')
            .eq('tipo_conteudo', config.tipoConteudo)
            .eq('conteudo_id', config.conteudoId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        comments = data || [];

        renderComments();
    }

    async function createComment(content, parentId = null) {
        if (!currentUser) {
            window.location.href = `login.html?redirect=${encodeURIComponent(getCurrentRedirect())}`;
            return;
        }

        const clean = String(content || '').trim();

        if (!clean) {
            toast('Escreva um comentário antes de enviar.', 'error');
            return;
        }

        if (clean.length > 1200) {
            toast('Comentário muito longo. Limite de 1200 caracteres.', 'error');
            return;
        }

        const payload = {
            usuario_id: currentUser.id,
            tipo_conteudo: config.tipoConteudo,
            conteudo_id: config.conteudoId,
            comentario_pai_id: parentId || null,
            conteudo: clean,
            status: 'publicado'
        };

        const { error } = await supabase
            .from('comentarios')
            .insert(payload);

        if (error) throw error;

        await registerPoints('comentario', POINTS_COMMENT, {
            comentario_pai_id: parentId || null
        });

        toast(parentId ? 'Resposta publicada! +' + POINTS_COMMENT + ' pontos' : 'Comentário publicado! +' + POINTS_COMMENT + ' pontos');

        await loadComments();
    }

    async function deleteComment(commentId) {
        if (!currentUser) return;

        const confirmed = confirm('Remover este comentário?');

        if (!confirmed) return;

        const { error } = await supabase
            .from('comentarios')
            .delete()
            .eq('id', commentId)
            .eq('usuario_id', currentUser.id);

        if (error) throw error;

        toast('Comentário removido.');
        await loadComments();
    }

    async function toggleCommentLike(commentId) {
        if (!currentUser) {
            window.location.href = `login.html?redirect=${encodeURIComponent(getCurrentRedirect())}`;
            return;
        }

        const { data: existing, error: existingError } = await supabase
            .from('comentarios_curtidas')
            .select('id')
            .eq('comentario_id', commentId)
            .eq('usuario_id', currentUser.id)
            .maybeSingle();

        if (existingError) throw existingError;

        if (existing) {
            const { error } = await supabase
                .from('comentarios_curtidas')
                .delete()
                .eq('id', existing.id)
                .eq('usuario_id', currentUser.id);

            if (error) throw error;

            toast('Curtida removida.');
        } else {
            const { error } = await supabase
                .from('comentarios_curtidas')
                .insert({
                    comentario_id: commentId,
                    usuario_id: currentUser.id
                });

            if (error) throw error;

            await registerPoints('curtida', POINTS_COMMENT_LIKE, {
                comentario_id: commentId,
                alvo: 'comentario'
            });

            toast(`Comentário curtido! +${POINTS_COMMENT_LIKE} ponto`);
        }

        await loadComments();
    }

    function bindForms() {
        document.querySelectorAll('.comment-form').forEach((form) => {
            form.addEventListener('submit', async (event) => {
                event.preventDefault();

                const input = form.querySelector('.comment-input');
                const parentId = form.dataset.parentId || null;
                const button = form.querySelector('button[type="submit"]');

                if (button) {
                    button.disabled = true;
                    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
                }

                try {
                    await createComment(input.value, parentId);
                } catch (error) {
                    console.error('[COMMENTS] Criar:', error);
                    toast(error.message || 'Erro ao publicar comentário.', 'error');
                } finally {
                    if (button) {
                        button.disabled = false;
                        button.innerHTML = parentId
                            ? '<i class="fas fa-paper-plane"></i> Responder'
                            : '<i class="fas fa-paper-plane"></i> Comentar';
                    }
                }
            });
        });
    }

    function bindActions() {
        document.querySelectorAll('[data-comment-reply]').forEach((button) => {
            button.addEventListener('click', () => {
                const commentId = button.dataset.commentReply;
                const box = document.getElementById(`replyBox-${commentId}`);

                if (!box) return;

                box.innerHTML = box.innerHTML.trim()
                    ? ''
                    : renderForm(commentId);

                bindForms();
            });
        });

        document.querySelectorAll('[data-comment-delete]').forEach((button) => {
            button.addEventListener('click', async () => {
                try {
                    await deleteComment(button.dataset.commentDelete);
                } catch (error) {
                    console.error('[COMMENTS] Remover:', error);
                    toast(error.message || 'Erro ao remover comentário.', 'error');
                }
            });
        });

        document.querySelectorAll('[data-comment-like]').forEach((button) => {
            button.addEventListener('click', async () => {
                button.disabled = true;

                try {
                    await toggleCommentLike(button.dataset.commentLike);
                } catch (error) {
                    console.error('[COMMENTS] Curtir:', error);
                    toast(error.message || 'Erro ao curtir comentário.', 'error');
                } finally {
                    button.disabled = false;
                }
            });
        });
    }

    async function init(options) {
        if (!options || !options.tipoConteudo || !options.conteudoId) {
            console.warn('[COMMENTS] Configuração inválida.');
            return;
        }

        config = {
            rootId: 'commentsRoot',
            ...options
        };

        supabase = getClient();

        if (!supabase) {
            console.warn('[COMMENTS] Supabase não encontrado.');
            return;
        }

        await loadSession();

        try {
            await loadComments();
        } catch (error) {
            console.error('[COMMENTS] Carregar:', error);

            const root = document.getElementById(config.rootId);

            if (root) {
                root.innerHTML = `
                    <section class="comments-section">
                        <div class="comments-error">
                            <i class="fas fa-triangle-exclamation"></i>
                            <h2>Não foi possível carregar os comentários</h2>
                            <p>${escapeHTML(error.message || 'Erro inesperado.')}</p>
                        </div>
                    </section>
                `;
            }
        }
    }

    window.Comments = {
        init,
        refresh: loadComments
    };
})();