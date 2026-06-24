// admin/js/admin-comentarios.js

(function () {
    'use strict';

    let supabase = null;
    let posts = [];
    let respostas = [];
    let usuariosMap = new Map();
    let filtroStatus = 'todos';
    let filtroTipo = 'todos';
    let termoBusca = '';

    function getClient() {
        return window.supabaseClient || window.AdminCore?.getClient?.() || null;
    }

    function escapeHTML(value) {
        if (window.AdminCore?.escapeHTML) return AdminCore.escapeHTML(value);
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function normalize(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function isAdmin() {
        if (typeof AdminCore?.isAdmin === 'function') return AdminCore.isAdmin();
        return (AdminCore?.state?.currentRoles || []).includes('admin');
    }

    function formatDate(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function statusLabel(status) {
        const labels = {
            publicado: 'Publicado',
            pendente: 'Pendente',
            oculto: 'Oculto',
            removido: 'Removido'
        };
        return labels[normalize(status)] || status || '-';
    }

    function categoriaLabel(categoria) {
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
        return labels[normalize(categoria)] || categoria || 'Geral';
    }

    function resumo(value, limit = 220) {
        const text = String(value || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (text.length <= limit) return text;
        return `${text.slice(0, limit).trim()}...`;
    }

    function getRoot() {
        return (
            document.getElementById('adminComentariosRoot') ||
            document.getElementById('comentariosRoot') ||
            document.getElementById('adminContent') ||
            document.querySelector('[data-admin-section="comentarios"]') ||
            document.querySelector('main')
        );
    }

    function getUserName(usuarioId) {
        return usuariosMap.get(usuarioId)?.nome || usuariosMap.get(usuarioId)?.email || 'Usuário';
    }

    function getUserCity(usuarioId) {
        return usuariosMap.get(usuarioId)?.cidade || '';
    }

    function getItensFiltrados() {
        let itens = [
            ...posts.map((item) => ({ ...item, tipo_item: 'post' })),
            ...respostas.map((item) => ({ ...item, tipo_item: 'resposta' }))
        ];

        if (filtroTipo !== 'todos') {
            itens = itens.filter((item) => item.tipo_item === filtroTipo);
        }

        if (filtroStatus !== 'todos') {
            itens = itens.filter((item) => normalize(item.status) === filtroStatus);
        }

        if (termoBusca) {
            const termo = normalize(termoBusca);
            itens = itens.filter((item) => {
                return (
                    normalize(item.titulo).includes(termo) ||
                    normalize(item.conteudo).includes(termo) ||
                    normalize(item.usuario_nome).includes(termo) ||
                    normalize(item.cidade).includes(termo) ||
                    normalize(item.usuario_cidade).includes(termo) ||
                    normalize(item.categoria).includes(termo)
                );
            });
        }

        return itens.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    function renderStats() {
        const todos = [...posts, ...respostas];
        const totalPosts = posts.length;
        const totalRespostas = respostas.length;
        const publicados = todos.filter((item) => normalize(item.status) === 'publicado').length;
        const pendentes = todos.filter((item) => normalize(item.status) === 'pendente').length;
        const ocultos = todos.filter((item) => normalize(item.status) === 'oculto').length;
        const removidos = todos.filter((item) => normalize(item.status) === 'removido').length;

        return `
            <div class="admin-comments-stats">
                <button type="button" class="admin-stat-card" data-fast-filter="todos">
                    <strong>${totalPosts}</strong><span>Posts</span>
                </button>
                <button type="button" class="admin-stat-card" data-fast-filter="tipo:resposta">
                    <strong>${totalRespostas}</strong><span>Respostas</span>
                </button>
                <button type="button" class="admin-stat-card" data-fast-filter="publicado">
                    <strong>${publicados}</strong><span>Publicados</span>
                </button>
                <button type="button" class="admin-stat-card" data-fast-filter="pendente">
                    <strong>${pendentes}</strong><span>Pendentes</span>
                </button>
                <button type="button" class="admin-stat-card" data-fast-filter="oculto">
                    <strong>${ocultos}</strong><span>Ocultos</span>
                </button>
                <button type="button" class="admin-stat-card" data-fast-filter="removido">
                    <strong>${removidos}</strong><span>Removidos</span>
                </button>
            </div>
        `;
    }

    function renderFilters() {
        return `
            <div class="admin-comments-filters">
                <div class="admin-filter-group">
                    <label for="comentariosBusca">Buscar</label>
                    <input id="comentariosBusca" type="search" placeholder="Buscar por usuário, cidade ou conteúdo..." value="${escapeHTML(termoBusca)}">
                </div>
                <div class="admin-filter-group">
                    <label for="comentariosTipo">Tipo</label>
                    <select id="comentariosTipo">
                        <option value="todos" ${filtroTipo === 'todos' ? 'selected' : ''}>Todos</option>
                        <option value="post" ${filtroTipo === 'post' ? 'selected' : ''}>Posts</option>
                        <option value="resposta" ${filtroTipo === 'resposta' ? 'selected' : ''}>Respostas</option>
                    </select>
                </div>
                <div class="admin-filter-group">
                    <label for="comentariosStatus">Status</label>
                    <select id="comentariosStatus">
                        <option value="todos" ${filtroStatus === 'todos' ? 'selected' : ''}>Todos</option>
                        <option value="publicado" ${filtroStatus === 'publicado' ? 'selected' : ''}>Publicado</option>
                        <option value="pendente" ${filtroStatus === 'pendente' ? 'selected' : ''}>Pendente</option>
                        <option value="oculto" ${filtroStatus === 'oculto' ? 'selected' : ''}>Oculto</option>
                        <option value="removido" ${filtroStatus === 'removido' ? 'selected' : ''}>Removido</option>
                    </select>
                </div>
                <button id="comentariosAtualizar" type="button" class="admin-refresh-btn">
                    <i class="fas fa-rotate"></i> Atualizar
                </button>
            </div>
        `;
    }

    function renderStatusBadge(status) {
        const normalized = normalize(status || 'pendente');
        return `<span class="admin-comment-status status-${escapeHTML(normalized)}">${escapeHTML(statusLabel(normalized))}</span>`;
    }

    function renderStatusActions(item) {
        const table = item.tipo_item === 'post' ? 'comunidade_posts' : 'comunidade_respostas';
        const status = normalize(item.status || 'pendente');

        return `
            <div class="admin-comment-actions">
                <button type="button" class="primary" data-edit-item data-table="${table}" data-id="${escapeHTML(item.id)}">
                    <i class="fas fa-pen"></i> Editar
                </button>

                ${status !== 'publicado' ? `
                    <button type="button" class="success" data-update-status data-table="${table}" data-id="${escapeHTML(item.id)}" data-status="publicado">
                        <i class="fas fa-eye"></i> ${status === 'oculto' ? 'Reexibir' : 'Publicar'}
                    </button>
                ` : ''}

                ${status !== 'oculto' ? `
                    <button type="button" class="warning" data-update-status data-table="${table}" data-id="${escapeHTML(item.id)}" data-status="oculto">
                        <i class="fas fa-eye-slash"></i> Ocultar
                    </button>
                ` : `
                    <button type="button" class="success" data-update-status data-table="${table}" data-id="${escapeHTML(item.id)}" data-status="publicado">
                        <i class="fas fa-eye"></i> Reexibir
                    </button>
                `}

                <button type="button" class="danger" data-delete-item data-table="${table}" data-id="${escapeHTML(item.id)}">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </div>
        `;
    }

    function renderItem(item) {
        const isPost = item.tipo_item === 'post';
        const titulo = isPost ? item.titulo || 'Publicação sem título' : 'Resposta no mural';
        const local = item.cidade || item.usuario_cidade || '';
        const parentPost = !isPost ? posts.find((post) => post.id === item.post_id) : null;

        return `
            <article class="admin-comment-card">
                <div class="admin-comment-main">
                    <div class="admin-comment-icon ${isPost ? 'post' : 'resposta'}">
                        <i class="fas ${isPost ? 'fa-message' : 'fa-reply'}"></i>
                    </div>
                    <div class="admin-comment-content">
                        <div class="admin-comment-head">
                            <div>
                                <span class="admin-comment-type">${isPost ? 'Post da Comunidade' : 'Resposta'}</span>
                                <h3>${escapeHTML(titulo)}</h3>
                                ${parentPost ? `<small>Em resposta a: ${escapeHTML(parentPost.titulo || resumo(parentPost.conteudo, 70))}</small>` : ''}
                            </div>
                            ${renderStatusBadge(item.status)}
                        </div>
                        <p>${escapeHTML(resumo(item.conteudo, 260))}</p>
                        <div class="admin-comment-meta">
                            <span><i class="fas fa-user"></i>${escapeHTML(item.usuario_nome || 'Usuário')}</span>
                            ${isPost ? `<span><i class="fas fa-tag"></i>${escapeHTML(categoriaLabel(item.categoria))}</span>` : ''}
                            ${local ? `<span><i class="fas fa-location-dot"></i>${escapeHTML(local)}</span>` : ''}
                            <span><i class="fas fa-calendar"></i>${escapeHTML(formatDate(item.created_at))}</span>
                            <span><i class="fas fa-heart"></i>${Number(item.total_curtidas || 0)} curtidas</span>
                            ${isPost ? `<span><i class="fas fa-reply"></i>${Number(item.total_respostas || 0)} respostas</span>` : ''}
                        </div>
                        ${renderStatusActions(item)}
                    </div>
                </div>
            </article>
        `;
    }

    function renderList() {
        const list = document.getElementById('adminComentariosLista');
        if (!list) return;

        const itens = getItensFiltrados();
        if (!itens.length) {
            list.innerHTML = `
                <div class="admin-empty-state">
                    <i class="far fa-comments"></i>
                    <h3>Nenhum item encontrado</h3>
                    <p>Altere os filtros ou aguarde novas publicações na comunidade.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = itens.map(renderItem).join('');
        bindItemButtons();
    }

    function render() {
        const root = getRoot();
        if (!root) return;

        if (!isAdmin()) {
            root.innerHTML = `
                <section class="admin-comments-page">
                    <div class="admin-empty-state">
                        <i class="fas fa-lock"></i>
                        <h3>Acesso restrito</h3>
                        <p>Somente administradores podem moderar a comunidade.</p>
                    </div>
                </section>
            `;
            return;
        }

        root.innerHTML = `
            <section class="admin-comments-page">
                <div class="admin-page-header">
                    <div>
                        <span class="admin-kicker"><i class="fas fa-comments"></i> Moderação</span>
                        <h1>Comunidade e Interações</h1>
                        <p>Gerencie posts e respostas do mural da comunidade, incluindo itens ocultos.</p>
                    </div>
                </div>
                ${renderStats()}
                ${renderFilters()}
                <div id="adminComentariosLista" class="admin-comments-list"></div>
            </section>
        `;

        bindFilters();
        renderList();
    }

    function bindFilters() {
        document.getElementById('comentariosBusca')?.addEventListener('input', (event) => {
            termoBusca = event.target.value.trim();
            renderList();
        });

        document.getElementById('comentariosTipo')?.addEventListener('change', (event) => {
            filtroTipo = event.target.value;
            renderList();
        });

        document.getElementById('comentariosStatus')?.addEventListener('change', (event) => {
            filtroStatus = event.target.value;
            renderList();
        });

        document.getElementById('comentariosAtualizar')?.addEventListener('click', async () => {
            await loadAll();
            AdminUI.renderToast('Lista atualizada.');
        });

        document.querySelectorAll('[data-fast-filter]').forEach((button) => {
            button.addEventListener('click', () => {
                const value = button.dataset.fastFilter;
                if (value === 'todos') {
                    filtroStatus = 'todos';
                    filtroTipo = 'todos';
                } else if (value === 'tipo:resposta') {
                    filtroTipo = 'resposta';
                    filtroStatus = 'todos';
                } else {
                    filtroStatus = value;
                    filtroTipo = 'todos';
                }
                const statusSelect = document.getElementById('comentariosStatus');
                const tipoSelect = document.getElementById('comentariosTipo');
                if (statusSelect) statusSelect.value = filtroStatus;
                if (tipoSelect) tipoSelect.value = filtroTipo;
                renderList();
            });
        });
    }

    function bindItemButtons() {
        document.querySelectorAll('[data-update-status]').forEach((button) => {
            button.addEventListener('click', async () => {
                const table = button.dataset.table;
                const id = button.dataset.id;
                const status = button.dataset.status;
                if (!confirm(`Confirmar alteração para "${statusLabel(status)}"?`)) return;
                button.disabled = true;
                try {
                    await updateStatus(table, id, status);
                    AdminUI.renderToast(`Status alterado para ${statusLabel(status)}.`);
                    await loadAll({ keepFilters: true });
                } catch (error) {
                    console.error('[ADMIN COMENTÁRIOS] Status:', error);
                    AdminUI.renderToast(error.message || 'Erro ao atualizar status.', 'error');
                } finally {
                    button.disabled = false;
                }
            });
        });

        document.querySelectorAll('[data-delete-item]').forEach((button) => {
            button.addEventListener('click', async () => {
                const table = button.dataset.table;
                const id = button.dataset.id;
                if (!confirm('Excluir definitivamente este item da comunidade?')) return;
                button.disabled = true;
                try {
                    await deleteItem(table, id);
                    AdminUI.renderToast('Item excluído definitivamente.');
                    await loadAll({ keepFilters: true });
                } catch (error) {
                    console.error('[ADMIN COMENTÁRIOS] Excluir:', error);
                    AdminUI.renderToast(error.message || 'Erro ao excluir item.', 'error');
                } finally {
                    button.disabled = false;
                }
            });
        });

        document.querySelectorAll('[data-edit-item]').forEach((button) => {
            button.addEventListener('click', () => openEditModal(button.dataset.table, button.dataset.id));
        });
    }

    async function updateStatus(table, id, status) {
        const { error } = await supabase
            .from(table)
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    }

    async function deleteItem(table, id) {
        if (table === 'comunidade_posts') {
            await supabase.from('comunidade_curtidas').delete().eq('post_id', id);
            await supabase.from('comunidade_respostas').delete().eq('post_id', id);
        } else {
            await supabase.from('comunidade_curtidas').delete().eq('resposta_id', id);
        }
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) throw error;
    }

    function openEditModal(table, id) {
        const isPost = table === 'comunidade_posts';
        const item = isPost
            ? posts.find((post) => post.id === id)
            : respostas.find((resposta) => resposta.id === id);

        if (!item) {
            AdminUI.renderToast('Item não encontrado.', 'error');
            return;
        }

        AdminUI.createModal({
            id: 'comentarioModal',
            formId: 'comentarioForm',
            title: isPost ? 'Editar post da comunidade' : 'Editar resposta da comunidade',
            subtitle: 'A alteração será refletida imediatamente no mural público se o item estiver publicado.',
            submitLabel: 'Salvar alteração',
            body: `
                <div class="admin-form-grid two">
                    ${isPost ? `
                        <div class="admin-form-group full">
                            <label>Título</label>
                            <input id="comentarioTitulo" value="${escapeHTML(item.titulo || '')}" maxlength="140">
                        </div>
                        <div class="admin-form-group">
                            <label>Categoria</label>
                            <select id="comentarioCategoria">
                                ${['geral','cidade','comercio','eventos','servicos','alertas','duvidas','oportunidades'].map((cat) => `
                                    <option value="${cat}" ${normalize(item.categoria || 'geral') === cat ? 'selected' : ''}>${categoriaLabel(cat)}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div class="admin-form-group">
                            <label>Cidade</label>
                            <input id="comentarioCidade" value="${escapeHTML(item.cidade || '')}" maxlength="120">
                        </div>
                    ` : ''}
                    <div class="admin-form-group full">
                        <label>Conteúdo</label>
                        <textarea id="comentarioConteudo" rows="8" maxlength="3000" required>${escapeHTML(item.conteudo || '')}</textarea>
                    </div>
                    <div class="admin-form-group">
                        <label>Status</label>
                        <select id="comentarioStatusModal">
                            ${['publicado','pendente','oculto','removido'].map((status) => `
                                <option value="${status}" ${normalize(item.status || 'publicado') === status ? 'selected' : ''}>${statusLabel(status)}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
            `,
            onSubmit: async () => saveEdit(table, id)
        });
    }

    async function saveEdit(table, id) {
        const payload = {
            conteudo: document.getElementById('comentarioConteudo')?.value?.trim() || '',
            status: document.getElementById('comentarioStatusModal')?.value || 'publicado',
            updated_at: new Date().toISOString()
        };

        if (!payload.conteudo) {
            AdminUI.renderToast('Informe o conteúdo.', 'error');
            return;
        }

        if (table === 'comunidade_posts') {
            payload.titulo = document.getElementById('comentarioTitulo')?.value?.trim() || null;
            payload.categoria = document.getElementById('comentarioCategoria')?.value || 'geral';
            payload.cidade = document.getElementById('comentarioCidade')?.value?.trim() || null;
        }

        const { error } = await supabase.from(table).update(payload).eq('id', id);
        if (error) throw error;

        AdminUI.closeModal('comentarioModal');
        AdminUI.renderToast('Item atualizado.');
        await loadAll({ keepFilters: true });
    }

    async function loadUsuarios(items) {
        const ids = [...new Set(items.map((item) => item.usuario_id).filter(Boolean))];
        usuariosMap = new Map();
        if (!ids.length) return;

        const { data, error } = await supabase
            .from('usuarios')
            .select('id, nome, email, cidade')
            .in('id', ids);

        if (error) {
            console.warn('[ADMIN COMENTÁRIOS] Usuários:', error);
            return;
        }

        (data || []).forEach((usuario) => usuariosMap.set(usuario.id, usuario));
    }

    async function loadCurtidas() {
        const all = [...posts, ...respostas];
        const postIds = posts.map((item) => item.id);
        const respostaIds = respostas.map((item) => item.id);

        all.forEach((item) => { item.total_curtidas = 0; });

        try {
            if (postIds.length) {
                const { data } = await supabase
                    .from('comunidade_curtidas')
                    .select('post_id')
                    .in('post_id', postIds);

                (data || []).forEach((curtida) => {
                    const post = posts.find((item) => item.id === curtida.post_id);
                    if (post) post.total_curtidas = Number(post.total_curtidas || 0) + 1;
                });
            }

            if (respostaIds.length) {
                const { data } = await supabase
                    .from('comunidade_curtidas')
                    .select('resposta_id')
                    .in('resposta_id', respostaIds);

                (data || []).forEach((curtida) => {
                    const resposta = respostas.find((item) => item.id === curtida.resposta_id);
                    if (resposta) resposta.total_curtidas = Number(resposta.total_curtidas || 0) + 1;
                });
            }
        } catch (error) {
            console.warn('[ADMIN COMENTÁRIOS] Curtidas:', error);
        }
    }

    async function loadPosts() {
        const { data, error } = await supabase
            .from('comunidade_posts')
            .select('id, usuario_id, cidade, categoria, titulo, conteudo, status, created_at, updated_at')
            .order('created_at', { ascending: false })
            .limit(500);

        if (error) throw error;
        posts = (data || []).map((item) => ({
            ...item,
            usuario_nome: getUserName(item.usuario_id),
            usuario_cidade: getUserCity(item.usuario_id),
            total_respostas: 0,
            total_curtidas: 0
        }));
    }

    async function loadRespostas() {
        const { data, error } = await supabase
            .from('comunidade_respostas')
            .select('id, post_id, usuario_id, conteudo, status, created_at, updated_at')
            .order('created_at', { ascending: false })
            .limit(800);

        if (error) throw error;
        respostas = (data || []).map((item) => ({
            ...item,
            usuario_nome: getUserName(item.usuario_id),
            usuario_cidade: getUserCity(item.usuario_id),
            total_curtidas: 0
        }));

        const countMap = new Map();
        respostas.forEach((resposta) => {
            if (normalize(resposta.status) !== 'removido') {
                countMap.set(resposta.post_id, Number(countMap.get(resposta.post_id) || 0) + 1);
            }
        });

        posts = posts.map((post) => ({
            ...post,
            total_respostas: Number(countMap.get(post.id) || 0)
        }));
    }

    async function loadAll(options = {}) {
        const root = getRoot();
        if (root) {
            root.innerHTML = `
                <section class="admin-comments-page">
                    <div class="admin-loading-state">
                        <i class="fas fa-spinner fa-spin"></i>
                        <h2>Carregando moderação...</h2>
                    </div>
                </section>
            `;
        }

        const { data: rawPosts, error: postsError } = await supabase
            .from('comunidade_posts')
            .select('id, usuario_id, cidade, categoria, titulo, conteudo, status, created_at, updated_at')
            .order('created_at', { ascending: false })
            .limit(500);

        if (postsError) throw postsError;

        const { data: rawRespostas, error: respostasError } = await supabase
            .from('comunidade_respostas')
            .select('id, post_id, usuario_id, conteudo, status, created_at, updated_at')
            .order('created_at', { ascending: false })
            .limit(800);

        if (respostasError) throw respostasError;

        await loadUsuarios([...(rawPosts || []), ...(rawRespostas || [])]);

        posts = (rawPosts || []).map((item) => ({
            ...item,
            usuario_nome: getUserName(item.usuario_id),
            usuario_cidade: getUserCity(item.usuario_id),
            total_respostas: 0,
            total_curtidas: 0
        }));

        respostas = (rawRespostas || []).map((item) => ({
            ...item,
            usuario_nome: getUserName(item.usuario_id),
            usuario_cidade: getUserCity(item.usuario_id),
            total_curtidas: 0
        }));

        const countMap = new Map();
        respostas.forEach((resposta) => {
            if (normalize(resposta.status) !== 'removido') {
                countMap.set(resposta.post_id, Number(countMap.get(resposta.post_id) || 0) + 1);
            }
        });
        posts = posts.map((post) => ({ ...post, total_respostas: Number(countMap.get(post.id) || 0) }));

        await loadCurtidas();
        render();

        if (options.keepFilters) {
            const statusSelect = document.getElementById('comentariosStatus');
            const tipoSelect = document.getElementById('comentariosTipo');
            if (statusSelect) statusSelect.value = filtroStatus;
            if (tipoSelect) tipoSelect.value = filtroTipo;
            renderList();
        }
    }

    async function init() {
        AdminUI.setPage('comentarios');
        supabase = getClient();

        if (!supabase) {
            AdminUI.renderError('Supabase não encontrado.');
            return;
        }

        try {
            await loadAll();
        } catch (error) {
            console.error('[ADMIN COMENTÁRIOS]', error);
            const root = getRoot();
            if (root) {
                root.innerHTML = `
                    <section class="admin-comments-page">
                        <div class="admin-empty-state">
                            <i class="fas fa-triangle-exclamation"></i>
                            <h3>Erro ao carregar moderação</h3>
                            <p>${escapeHTML(error.message || 'Erro inesperado.')}</p>
                        </div>
                    </section>
                `;
            }
        }
    }

    window.AdminComentarios = {
        init,
        reload: loadAll
    };

    document.addEventListener('DOMContentLoaded', () => {
        const shouldAutoInit =
            document.getElementById('adminComentariosRoot') ||
            document.body.dataset.page === 'admin-comentarios';

        if (shouldAutoInit) init();
    });
})();
