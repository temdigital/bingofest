// admin/js/admin-publicacoes.js

(function () {
    'use strict';

    let publicacoesCache = [];
    let currentColunistaId = null;

    const DEFAULT_CATEGORIAS = [
        ['politica', 'Política'],
        ['seguranca', 'Segurança'],
        ['infraestrutura', 'Infraestrutura'],
        ['saude', 'Saúde'],
        ['educacao', 'Educação'],
        ['cultura', 'Cultura'],
        ['esporte', 'Esporte'],
        ['economia', 'Economia'],
        ['comercio', 'Comércio'],
        ['eventos', 'Eventos'],
        ['cidade', 'Cidade'],
        ['oportunidades', 'Oportunidades'],
        ['servicos', 'Serviços'],
        ['turismo', 'Turismo'],
        ['opiniao', 'Opinião'],
        ['outros', 'Outros']
    ];

    function ensureEditor() {
        if (window.AdminEditor) return window.AdminEditor;

        window.AdminEditor = {
            createEditorHTML(id, value) {
                return `
                    <textarea
                        id="${AdminCore.escapeHTML(id)}"
                        rows="14"
                        style="width:100%;min-height:320px;"
                    >${AdminCore.escapeHTML(value || '')}</textarea>
                `;
            },

            initEditor() {
                return null;
            },

            getValue(id) {
                return document.getElementById(id)?.value?.trim() || '';
            }
        };

        return window.AdminEditor;
    }

    function hasRole(roleName) {
        const role = AdminCore.normalize(roleName);

        if (typeof AdminCore.hasRole === 'function') {
            return AdminCore.hasRole(role);
        }

        return (AdminCore.state.currentRoles || []).includes(role);
    }

    function isAdmin() {
        return hasRole('admin') || hasRole('administrador');
    }

    function isColunista() {
        return hasRole('colunista');
    }

    function isComerciante() {
        return hasRole('comerciante');
    }

    async function getCurrentColunistaId() {
        const client = AdminCore.getClient();
        const userId = AdminCore.state.currentUser?.id;

        if (!userId) return null;

        const { data, error } = await client
            .from('colunistas')
            .select('id')
            .eq('usuario_id', userId)
            .maybeSingle();

        if (error) {
            console.warn('[ADMIN PUBLICAÇÕES] colunista do usuário:', error);
            return null;
        }

        return data?.id || null;
    }

    function canAccessModule() {
        return isAdmin() || isColunista();
    }

    function canCreatePublicacao() {
        return isAdmin() || isColunista();
    }

    function canEditPublicacao(publicacao) {
        if (isAdmin()) return true;

        if (isColunista()) {
            return publicacao?.colunista_id === currentColunistaId;
        }

        return false;
    }

    function canDeletePublicacao() {
        return isAdmin();
    }

    function getCategoriaNome(item) {
        return item?.publicacoes_categorias?.[0]?.categorias?.nome || 'Sem categoria';
    }

    function getCategoriaId(item) {
        return item?.publicacoes_categorias?.[0]?.categoria_id || '';
    }

    function getCategoriaPadraoColunista(categorias) {
        return (categorias || []).find((item) => {
            const nome = AdminCore.normalize(item.nome);
            return nome === 'coluna' || nome === 'opiniao' || nome === 'opniao';
        }) || (categorias || [])[0] || null;
    }

    function getAutorNome(item) {
        return item.colunistas?.usuarios?.nome || item.colunistas?.usuarios?.email || 'Colunista';
    }

    function resumo(text, limit = 130) {
        const clean = String(text || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (clean.length <= limit) return clean;

        return `${clean.slice(0, limit).trim()}...`;
    }

    function renderNoPermission(message) {
        AdminUI.setPage('publicacoes');

        AdminUI.setContent(`
            <div class="admin-empty-state empty-state">
                <i class="fas fa-lock"></i>
                <h3>Acesso restrito</h3>
                <p>${AdminCore.escapeHTML(message)}</p>
            </div>
        `);
    }

    function renderCard(item) {
        const previewUrl = item.slug
            ? `../publicacao.html?slug=${encodeURIComponent(item.slug)}`
            : '';

        const categoria = getCategoriaNome(item);
        const autor = getAutorNome(item);

        return `
            <article class="admin-catalog-card">
                <div class="admin-catalog-media">
                    ${
                        item.imagem_capa_url
                            ? `
                                <img
                                    src="${AdminCore.escapeHTML(item.imagem_capa_url)}"
                                    alt="${AdminCore.escapeHTML(item.titulo || 'Publicação')}"
                                    loading="lazy"
                                >
                            `
                            : `
                                <div class="admin-catalog-placeholder">
                                    <i class="fas fa-newspaper"></i>
                                </div>
                            `
                    }
                </div>

                <div class="admin-catalog-body">
                    <div class="admin-catalog-top">
                        <span class="admin-catalog-badge">
                            ${AdminCore.escapeHTML(categoria)}
                        </span>

                        ${AdminUI.statusBadge(item.status)}
                    </div>

                    <h3>${AdminCore.escapeHTML(item.titulo || 'Publicação sem título')}</h3>

                    <p>${AdminCore.escapeHTML(resumo(item.subtitulo || item.conteudo || ''))}</p>

                    <div class="admin-catalog-meta">
                        <span>
                            <i class="fas fa-user-pen"></i>
                            ${AdminCore.escapeHTML(autor)}
                        </span>

                        <span>
                            <i class="fas fa-calendar"></i>
                            ${AdminCore.escapeHTML(AdminCore.formatDate(item.published_at || item.created_at))}
                        </span>

                        <span>
                            <i class="fas fa-star"></i>
                            ${item.destaque ? 'Destaque' : 'Normal'}
                        </span>
                    </div>

                    <div class="admin-catalog-actions">
                        ${
                            previewUrl
                                ? `
                                    <a
                                        class="btn-icon"
                                        href="${AdminCore.escapeHTML(previewUrl)}"
                                        target="_blank"
                                        title="Visualizar publicação"
                                    >
                                        <i class="fas fa-eye"></i>
                                    </a>
                                `
                                : ''
                        }

                        ${
                            canEditPublicacao(item)
                                ? `
                                    <button
                                        class="btn-icon btn-edit-publicacao"
                                        type="button"
                                        title="Editar publicação"
                                        data-id="${AdminCore.escapeHTML(item.id)}"
                                    >
                                        <i class="fas fa-pen"></i>
                                    </button>
                                `
                                : ''
                        }

                        ${
                            canDeletePublicacao()
                                ? `
                                    <button
                                        class="btn-icon btn-delete-publicacao"
                                        type="button"
                                        title="Excluir publicação"
                                        data-id="${AdminCore.escapeHTML(item.id)}"
                                    >
                                        <i class="fas fa-trash"></i>
                                    </button>
                                `
                                : ''
                        }
                    </div>
                </div>
            </article>
        `;
    }

    async function load() {
        AdminUI.setPage('publicacoes');
        AdminUI.renderLoading('Carregando publicações...');

        const client = AdminCore.getClient();

        try {
            ensureEditor();

            if (isComerciante() && !isAdmin()) {
                renderNoPermission('Seu perfil de comerciante não possui acesso ao módulo Publicações.');
                return;
            }

            if (!canAccessModule()) {
                renderNoPermission('Seu perfil não possui acesso ao módulo Publicações.');
                return;
            }

            currentColunistaId = isColunista() && !isAdmin()
                ? await getCurrentColunistaId()
                : null;

            if (isColunista() && !isAdmin() && !currentColunistaId) {
                renderNoPermission('Seu usuário ainda não possui cadastro de colunista vinculado.');
                return;
            }

            let query = client
                .from('publicacoes')
                .select(`
                    id,
                    colunista_id,
                    titulo,
                    subtitulo,
                    conteudo,
                    slug,
                    status,
                    destaque,
                    imagem_capa_url,
                    imagem_capa_path,
                    published_at,
                    created_at,
                    updated_at,
                    colunistas (
                        id,
                        usuarios (
                            nome,
                            email
                        )
                    ),
                    publicacoes_categorias (
                        categoria_id,
                        categorias (
                            id,
                            nome
                        )
                    )
                `)
                .order('created_at', { ascending: false });

            if (isColunista() && !isAdmin()) {
                query = query.eq('colunista_id', currentColunistaId);
            }

            const { data, error } = await query;

            if (error) throw error;

            publicacoesCache = data || [];

            AdminUI.setContent(`
                <div class="section-header">
                    <div>
                        <h3>Publicações</h3>
                        <p>
                            ${
                                isAdmin()
                                    ? 'Crie, edite, categorize, publique, visualize e destaque conteúdos editoriais.'
                                    : 'Gerencie apenas as publicações vinculadas ao seu perfil de colunista.'
                            }
                        </p>
                    </div>

                    ${
                        canCreatePublicacao()
                            ? `
                                <button class="btn-primary" type="button" id="newPublicacaoBtn">
                                    <i class="fas fa-plus"></i>
                                    Nova publicação
                                </button>
                            `
                            : ''
                    }
                </div>

                <div class="permission-card" style="margin-bottom: 18px;">
                    ${
                        isAdmin()
                            ? 'Administrador visualiza e gerencia todas as publicações.'
                            : 'Colunista visualiza e edita apenas suas próprias publicações. Exclusões ficam restritas ao administrador.'
                    }
                </div>

                ${
                    publicacoesCache.length
                        ? `
                            <div class="admin-catalog-grid">
                                ${publicacoesCache.map(renderCard).join('')}
                            </div>
                        `
                        : AdminUI.emptyState('fa-newspaper', 'Nenhuma publicação cadastrada.')
                }
            `);

            bindButtons();

        } catch (error) {
            console.error('[ADMIN PUBLICAÇÕES]', error);
            AdminUI.renderError(error.message || 'Erro ao carregar publicações.');
        }
    }

    function bindButtons() {
        document.getElementById('newPublicacaoBtn')?.addEventListener('click', () => openModal());

        document.querySelectorAll('.btn-edit-publicacao').forEach((button) => {
            button.addEventListener('click', () => openModal(button.dataset.id));
        });

        document.querySelectorAll('.btn-delete-publicacao').forEach((button) => {
            button.addEventListener('click', () => remove(button.dataset.id));
        });
    }

    async function getColunistasForSelect() {
        const client = AdminCore.getClient();

        let query = client
            .from('colunistas')
            .select(`
                id,
                usuario_id,
                usuarios (
                    nome,
                    email,
                    status
                )
            `)
            .order('created_at', { ascending: false });

        if (isColunista() && !isAdmin()) {
            query = query.eq('id', currentColunistaId);
        }

        const { data, error } = await query;

        if (error) throw error;

        return data || [];
    }

    async function ensureDefaultCategorias() {
        const client = AdminCore.getClient();

        try {
            const { data } = await client
                .from('categorias')
                .select('slug');

            const existing = new Set((data || []).map((item) => AdminCore.normalize(item.slug)));
            const missing = DEFAULT_CATEGORIAS
                .filter(([slug]) => !existing.has(slug))
                .map(([slug, nome]) => ({
                    slug,
                    nome,
                    descricao: `Categoria ${nome}`
                }));

            if (missing.length) {
                await client.from('categorias').insert(missing);
            }
        } catch (error) {
            console.warn('[ADMIN PUBLICAÇÕES] categorias padrão:', error);
        }
    }

    async function getCategoriasForSelect() {
        const client = AdminCore.getClient();

        await ensureDefaultCategorias();

        const { data, error } = await client
            .from('categorias')
            .select('id, nome')
            .order('nome', { ascending: true });

        if (error) throw error;

        return data || [];
    }

    async function openModal(publicacaoId = null) {
        ensureEditor();

        const isEditing = Boolean(publicacaoId);

        const publicacao = isEditing
            ? publicacoesCache.find((item) => item.id === publicacaoId)
            : null;

        if (isEditing && !publicacao) {
            AdminUI.renderToast('Publicação não encontrada.', 'error');
            return;
        }

        if (isEditing && !canEditPublicacao(publicacao)) {
            AdminUI.renderToast('Você não possui permissão para editar esta publicação.', 'error');
            return;
        }

        if (!isEditing && !canCreatePublicacao()) {
            AdminUI.renderToast('Você não possui permissão para criar publicações.', 'error');
            return;
        }

        let colunistas = [];
        let categorias = [];

        try {
            [colunistas, categorias] = await Promise.all([
                getColunistasForSelect(),
                getCategoriasForSelect()
            ]);
        } catch (error) {
            console.error('[ADMIN PUBLICAÇÕES] dados auxiliares:', error);
            AdminUI.renderToast('Erro ao carregar dados auxiliares.', 'error');
            return;
        }

        if (!colunistas.length) {
            AdminUI.renderToast('Cadastre um colunista antes de criar publicações.', 'error');
            return;
        }

        const categoriaPadraoColunista = getCategoriaPadraoColunista(categorias);
        const categoriaAtual = getCategoriaId(publicacao) || (isColunista() && !isAdmin() ? categoriaPadraoColunista?.id || '' : '');

        const colunistaOptions = colunistas.map((colunista) => `
            <option
                value="${colunista.id}"
                ${colunista.id === publicacao?.colunista_id ? 'selected' : ''}
            >
                ${AdminCore.escapeHTML(colunista.usuarios?.nome || colunista.usuarios?.email || 'Colunista')}
            </option>
        `).join('');

        const categoriaOptions = categorias.map((categoria) => `
            <option
                value="${categoria.id}"
                ${categoria.id === categoriaAtual ? 'selected' : ''}
            >
                ${AdminCore.escapeHTML(categoria.nome)}
            </option>
        `).join('');

        const previewLink = publicacao?.slug
            ? `../publicacao.html?slug=${encodeURIComponent(publicacao.slug)}`
            : '';

        AdminUI.createModal({
            id: 'publicacaoModal',
            formId: 'publicacaoForm',
            title: isEditing ? 'Editar publicação' : 'Nova publicação',
            subtitle: isEditing ? (publicacao.titulo || '') : 'Preencha os dados editoriais da publicação.',
            submitLabel: 'Salvar publicação',
            body: `
                <div class="admin-form-grid two">
                    ${
                        previewLink
                            ? `
                                <div class="admin-form-group full">
                                    <a class="btn-primary" href="${AdminCore.escapeHTML(previewLink)}" target="_blank">
                                        <i class="fas fa-eye"></i>
                                        Visualizar publicação
                                    </a>
                                </div>
                            `
                            : ''
                    }

                    <div class="admin-form-group full">
                        <label>Colunista</label>
                        <select
                            id="publicacaoColunistaId"
                            required
                            ${isColunista() && !isAdmin() ? 'disabled' : ''}
                        >
                            <option value="">Selecione...</option>
                            ${colunistaOptions}
                        </select>
                        ${isColunista() && !isAdmin() ? '<small>Vinculado automaticamente ao seu perfil de colunista.</small>' : ''}
                    </div>

                    <div class="admin-form-group full">
                        <label>Categoria</label>
                        <select
                            id="publicacaoCategoriaId"
                            required
                            ${isColunista() && !isAdmin() ? 'disabled' : ''}
                        >
                            <option value="">Selecione a categoria...</option>
                            ${categoriaOptions}
                        </select>
                        ${isColunista() && !isAdmin() ? '<small>Categoria editorial definida automaticamente para colunistas.</small>' : ''}
                    </div>

                    <div class="admin-form-group full">
                        <label>Imagem de capa</label>
                        <input type="file" id="publicacaoImagemCapa" accept="image/*">

                        <div id="publicacaoImagemPreview">
                            ${AdminStorage.existingImagePreview(publicacao?.imagem_capa_url)}
                        </div>
                    </div>

                    <div class="admin-form-group full">
                        <label>Título</label>
                        <input
                            type="text"
                            id="publicacaoTitulo"
                            value="${AdminCore.escapeHTML(publicacao?.titulo || '')}"
                            placeholder="Título da publicação"
                            required
                        >
                    </div>

                    <div class="admin-form-group full">
                        <label>Subtítulo</label>
                        <input
                            type="text"
                            id="publicacaoSubtitulo"
                            value="${AdminCore.escapeHTML(publicacao?.subtitulo || '')}"
                            placeholder="Linha fina ou resumo curto"
                        >
                    </div>

                    <div class="admin-form-group">
                        <label>Slug</label>
                        <input
                            type="text"
                            id="publicacaoSlug"
                            value="${AdminCore.escapeHTML(publicacao?.slug || '')}"
                            placeholder="gerado-automaticamente"
                            readonly
                            aria-readonly="true"
                        >
                        <small>Gerado automaticamente pelo sistema para evitar duplicidade.</small>
                    </div>

                    <div class="admin-form-group">
                        <label>Status</label>
                        <select id="publicacaoStatus" required>
                            <option value="rascunho" ${AdminCore.normalize(publicacao?.status || 'rascunho') === 'rascunho' ? 'selected' : ''}>Rascunho</option>
                            <option value="publicado" ${AdminCore.normalize(publicacao?.status) === 'publicado' ? 'selected' : ''}>Publicado</option>
                        </select>
                    </div>

                    <div class="admin-form-group">
                        <label>Destaque</label>
                        <select
                            id="publicacaoDestaque"
                            required
                            ${isColunista() && !isAdmin() ? 'disabled' : ''}
                        >
                            <option value="false" ${(!publicacao?.destaque || (isColunista() && !isAdmin())) ? 'selected' : ''}>Não</option>
                            ${isAdmin() ? `<option value="true" ${publicacao?.destaque ? 'selected' : ''}>Sim</option>` : ''}
                        </select>
                        ${isColunista() && !isAdmin() ? '<small>Somente administradores podem definir destaque.</small>' : ''}
                    </div>

                    <div class="admin-form-group full">
                        <label>Conteúdo</label>
                        ${AdminEditor.createEditorHTML(
                            'publicacaoConteudo',
                            publicacao?.conteudo || '',
                            'publicacoes/conteudo'
                        )}
                    </div>

                    <div class="permission-card full">
                        ${
                            isAdmin()
                                ? 'Como administrador, você pode vincular a publicação a qualquer colunista.'
                                : 'Como colunista, esta publicação será vinculada automaticamente ao seu perfil.'
                        }
                    </div>
                </div>
            `,
            afterOpen: () => {
                AdminEditor.initEditor('publicacaoConteudo');

                const tituloInput = document.getElementById('publicacaoTitulo');
                const slugInput = document.getElementById('publicacaoSlug');
                const imagemInput = document.getElementById('publicacaoImagemCapa');
                const colunistaSelect = document.getElementById('publicacaoColunistaId');
                const categoriaSelect = document.getElementById('publicacaoCategoriaId');

                tituloInput?.addEventListener('input', () => {
                    if (!isEditing || !slugInput.value.trim()) {
                        slugInput.value = AdminCore.slugify(tituloInput.value);
                    }
                });

                slugInput?.addEventListener('input', () => {
                    slugInput.value = AdminCore.slugify(slugInput.value);
                });

                imagemInput?.addEventListener('change', () => {
                    AdminStorage.previewFile('publicacaoImagemCapa', 'publicacaoImagemPreview');
                });

                if (isColunista() && !isAdmin() && colunistaSelect && currentColunistaId) {
                    colunistaSelect.value = currentColunistaId;
                }

                if (isColunista() && !isAdmin() && categoriaSelect && categoriaAtual) {
                    categoriaSelect.value = categoriaAtual;
                }
            },
            onSubmit: async () => save(publicacaoId)
        });
    }

    async function save(publicacaoId = null) {
        const client = AdminCore.getClient();

        const existing = publicacaoId
            ? publicacoesCache.find((item) => item.id === publicacaoId)
            : null;

        if (publicacaoId && !canEditPublicacao(existing)) {
            AdminUI.renderToast('Você não possui permissão para salvar esta publicação.', 'error');
            return;
        }

        const titulo = AdminCore.getInputValue('publicacaoTitulo');
        const status = AdminCore.getInputValue('publicacaoStatus') || 'rascunho';
        const slug = AdminCore.getInputValue('publicacaoSlug') || AdminCore.slugify(titulo);
        const conteudo = AdminEditor.getValue('publicacaoConteudo');
        const categoriaId = AdminCore.getInputValue('publicacaoCategoriaId');

        let colunistaId = AdminCore.getInputValue('publicacaoColunistaId');

        if (isColunista() && !isAdmin()) {
            colunistaId = currentColunistaId;
        }

        if (!titulo) {
            AdminUI.renderToast('Informe o título.', 'error');
            return;
        }

        if (!slug) {
            AdminUI.renderToast('Informe um slug válido.', 'error');
            return;
        }

        if (!categoriaId) {
            AdminUI.renderToast('Selecione a categoria.', 'error');
            return;
        }

        if (!colunistaId) {
            AdminUI.renderToast('Selecione um colunista.', 'error');
            return;
        }

        if (!conteudo) {
            AdminUI.renderToast('Informe o conteúdo.', 'error');
            return;
        }

        const payload = {
            colunista_id: colunistaId,
            titulo,
            subtitulo: AdminCore.getInputValue('publicacaoSubtitulo'),
            conteudo,
            slug,
            status,
            destaque: isAdmin() ? AdminCore.getInputValue('publicacaoDestaque') === 'true' : false,
            imagem_capa_url: existing?.imagem_capa_url || null,
            imagem_capa_path: existing?.imagem_capa_path || null,
            updated_at: new Date().toISOString()
        };

        if (status === 'publicado' && !existing?.published_at) {
            payload.published_at = new Date().toISOString();
        }

        if (status === 'rascunho') {
            payload.published_at = null;
        }

        try {
            const uploadedImage = await AdminStorage.uploadFromInput(
                'publicacaoImagemCapa',
                'publicacoes/capas'
            );

            if (uploadedImage) {
                payload.imagem_capa_url = uploadedImage.url;
                payload.imagem_capa_path = uploadedImage.path;
            }

            let savedPublicacaoId = publicacaoId;

            if (publicacaoId) {
                const { error } = await client
                    .from('publicacoes')
                    .update(payload)
                    .eq('id', publicacaoId);

                if (error) throw error;
            } else {
                const { data, error } = await client
                    .from('publicacoes')
                    .insert(payload)
                    .select('id')
                    .single();

                if (error) throw error;

                savedPublicacaoId = data.id;
            }

            await syncCategoria(savedPublicacaoId, categoriaId);

            AdminUI.closeModal('publicacaoModal');
            AdminUI.renderToast('Publicação salva com sucesso.');
            await load();

        } catch (error) {
            console.error('[ADMIN PUBLICAÇÕES] save:', error);

            if (String(error.message || '').includes('duplicate key')) {
                AdminUI.renderToast('Este slug já está em uso. Escolha outro.', 'error');
                return;
            }

            AdminUI.renderToast(error.message || 'Erro ao salvar publicação.', 'error');
        }
    }

    async function syncCategoria(publicacaoId, categoriaId) {
        const client = AdminCore.getClient();

        const { error: deleteError } = await client
            .from('publicacoes_categorias')
            .delete()
            .eq('publicacao_id', publicacaoId);

        if (deleteError) throw deleteError;

        const { error: insertError } = await client
            .from('publicacoes_categorias')
            .insert({
                publicacao_id: publicacaoId,
                categoria_id: categoriaId
            });

        if (insertError) throw insertError;
    }

    async function remove(publicacaoId) {
        const client = AdminCore.getClient();

        if (!canDeletePublicacao()) {
            AdminUI.renderToast('Somente administradores podem excluir publicações.', 'error');
            return;
        }

        const publicacao = publicacoesCache.find((item) => item.id === publicacaoId);

        if (!publicacao) {
            AdminUI.renderToast('Publicação não encontrada.', 'error');
            return;
        }

        const confirmed = confirm(`Excluir a publicação "${publicacao.titulo}"?`);

        if (!confirmed) return;

        try {
            await client
                .from('publicacoes_categorias')
                .delete()
                .eq('publicacao_id', publicacaoId);

            const { error } = await client
                .from('publicacoes')
                .delete()
                .eq('id', publicacaoId);

            if (error) throw error;

            AdminUI.renderToast('Publicação excluída.');
            await load();

        } catch (error) {
            console.error('[ADMIN PUBLICAÇÕES] remove:', error);
            AdminUI.renderToast(error.message || 'Erro ao excluir publicação.', 'error');
        }
    }

    window.AdminPublicacoes = {
        init: load,
        load
    };
})();