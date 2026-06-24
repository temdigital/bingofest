// admin/js/admin-colunistas.js

(function () {
    'use strict';

    let colunistasCache = [];
    let currentColunistaId = null;

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
            console.warn('[ADMIN COLUNISTAS] colunista do usuário:', error);
            return null;
        }

        return data?.id || null;
    }

    function canAccessModule() {
        return isAdmin() || isColunista();
    }

    function canCreateColunista() {
        return isAdmin();
    }

    function canEditColunista(colunista) {
        if (isAdmin()) return true;

        if (isColunista()) {
            return colunista?.id === currentColunistaId;
        }

        return false;
    }

    function canDeleteColunista() {
        return isAdmin();
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
        AdminUI.setPage('colunistas');

        AdminUI.setContent(`
            <div class="admin-empty-state empty-state">
                <i class="fas fa-lock"></i>
                <h3>Acesso restrito</h3>
                <p>${AdminCore.escapeHTML(message)}</p>
            </div>
        `);
    }

    function getNome(item) {
        return item.usuarios?.nome || item.usuarios?.email || 'Colunista';
    }

    function getFotoUrl(item) {
        return item?.foto_url || item?.usuarios?.foto_url || '';
    }

    function getFotoPath(item) {
        return item?.foto_path || item?.usuarios?.foto_path || null;
    }

    function renderCard(item) {
        const nome = getNome(item);

        const previewUrl = item.slug
            ? `../colunista.html?slug=${encodeURIComponent(item.slug)}`
            : '';

        return `
            <article class="admin-catalog-card">
                <div class="admin-catalog-media">
                    ${
                        getFotoUrl(item)
                            ? `
                                <img
                                    src="${AdminCore.escapeHTML(getFotoUrl(item))}"
                                    alt="${AdminCore.escapeHTML(nome)}"
                                    loading="lazy"
                                >
                            `
                            : `
                                <div class="admin-catalog-placeholder">
                                    <i class="fas fa-user-pen"></i>
                                </div>
                            `
                    }
                </div>

                <div class="admin-catalog-body">
                    <div class="admin-catalog-top">
                        <span class="admin-catalog-badge">
                            Colunista
                        </span>

                        ${AdminUI.statusBadge(item.usuarios?.status || 'ativo')}
                    </div>

                    <h3>${AdminCore.escapeHTML(nome)}</h3>

                    <p>${AdminCore.escapeHTML(resumo(item.biografia || item.formacao || 'Perfil editorial sem biografia cadastrada.'))}</p>

                    <div class="admin-catalog-meta">
                        <span>
                            <i class="fas fa-link"></i>
                            ${AdminCore.escapeHTML(item.slug || 'sem-slug')}
                        </span>

                        <span>
                            <i class="fas fa-graduation-cap"></i>
                            ${AdminCore.escapeHTML(item.formacao || 'Formação não informada')}
                        </span>

                        <span>
                            <i class="fas fa-envelope"></i>
                            ${AdminCore.escapeHTML(item.usuarios?.email || 'E-mail não informado')}
                        </span>

                        <span>
                            <i class="fas fa-calendar"></i>
                            ${AdminCore.escapeHTML(AdminCore.formatDate(item.created_at))}
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
                                        title="Visualizar colunista"
                                    >
                                        <i class="fas fa-eye"></i>
                                    </a>
                                `
                                : ''
                        }

                        ${
                            canEditColunista(item)
                                ? `
                                    <button
                                        class="btn-icon btn-edit-colunista"
                                        type="button"
                                        title="Editar colunista"
                                        data-id="${AdminCore.escapeHTML(item.id)}"
                                    >
                                        <i class="fas fa-pen"></i>
                                    </button>
                                `
                                : ''
                        }

                        ${
                            canDeleteColunista()
                                ? `
                                    <button
                                        class="btn-icon btn-delete-colunista"
                                        type="button"
                                        title="Excluir perfil"
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
        AdminUI.setPage('colunistas');
        AdminUI.renderLoading('Carregando colunistas...');

        const client = AdminCore.getClient();

        try {
            ensureEditor();

            if (isComerciante() && !isAdmin()) {
                renderNoPermission('Seu perfil de comerciante não possui acesso ao módulo Colunistas.');
                return;
            }

            if (!canAccessModule()) {
                renderNoPermission('Seu perfil não possui acesso ao módulo Colunistas.');
                return;
            }

            currentColunistaId = isColunista() && !isAdmin()
                ? await getCurrentColunistaId()
                : null;

            if (isColunista() && !isAdmin() && !currentColunistaId) {
                renderNoPermission('Seu usuário ainda não possui perfil de colunista vinculado.');
                return;
            }

            let query = client
                .from('colunistas')
                .select(`
                    id,
                    usuario_id,
                    slug,
                    formacao,
                    biografia,
                    foto_url,
                    foto_path,
                    site,
                    instagram,
                    facebook,
                    tiktok,
                    kwai,
                    outro,
                    created_at,
                    updated_at,
                    usuarios (
                        id,
                        nome,
                        email,
                        status,
                        foto_url,
                        foto_path,
                        bio
                    )
                `)
                .order('created_at', { ascending: false });

            if (isColunista() && !isAdmin()) {
                query = query.eq('id', currentColunistaId);
            }

            const { data, error } = await query;

            if (error) throw error;

            colunistasCache = data || [];

            AdminUI.setContent(`
                <div class="section-header">
                    <div>
                        <h3>Colunistas</h3>
                        <p>
                            ${
                                isAdmin()
                                    ? 'Cadastre e edite os perfis editoriais usados nas publicações.'
                                    : 'Gerencie seu perfil público de colunista.'
                            }
                        </p>
                    </div>

                    ${
                        canCreateColunista()
                            ? `
                                <button class="btn-primary" type="button" id="newColunistaBtn">
                                    <i class="fas fa-plus"></i>
                                    Novo colunista
                                </button>
                            `
                            : ''
                    }
                </div>

                <div class="permission-card" style="margin-bottom: 18px;">
                    ${
                        isAdmin()
                            ? 'Administrador visualiza, cria, edita e remove perfis de colunistas.'
                            : 'Colunista visualiza e edita apenas seu próprio perfil. Criação e exclusão ficam restritas ao administrador.'
                    }
                </div>

                ${
                    colunistasCache.length
                        ? `
                            <div class="admin-catalog-grid">
                                ${colunistasCache.map(renderCard).join('')}
                            </div>
                        `
                        : AdminUI.emptyState('fa-user-pen', 'Nenhum colunista cadastrado.')
                }
            `);

            bindButtons();

        } catch (error) {
            console.error('[ADMIN COLUNISTAS]', error);
            AdminUI.renderError(error.message || 'Erro ao carregar colunistas.');
        }
    }

    function bindButtons() {
        document.getElementById('newColunistaBtn')?.addEventListener('click', () => openModal());

        document.querySelectorAll('.btn-edit-colunista').forEach((button) => {
            button.addEventListener('click', () => openModal(button.dataset.id));
        });

        document.querySelectorAll('.btn-delete-colunista').forEach((button) => {
            button.addEventListener('click', () => remove(button.dataset.id));
        });
    }

    async function getUsersForSelect() {
        const client = AdminCore.getClient();

        const { data, error } = await client
            .from('usuarios')
            .select(`
                id,
                nome,
                email,
                status,
                usuarios_roles (
                    role_id,
                    roles (
                        id,
                        nome
                    )
                )
            `)
            .eq('status', 'ativo')
            .order('nome', { ascending: true });

        if (error) throw error;

        return data || [];
    }

    async function openModal(colunistaId = null) {
        ensureEditor();

        const isEditing = Boolean(colunistaId);

        const colunista = isEditing
            ? colunistasCache.find((item) => item.id === colunistaId)
            : null;

        if (isEditing && !colunista) {
            AdminUI.renderToast('Colunista não encontrado.', 'error');
            return;
        }

        if (isEditing && !canEditColunista(colunista)) {
            AdminUI.renderToast('Você não possui permissão para editar este perfil.', 'error');
            return;
        }

        if (!isEditing && !canCreateColunista()) {
            AdminUI.renderToast('Somente administradores podem criar novos colunistas.', 'error');
            return;
        }

        let usuarios = [];

        try {
            usuarios = await getUsersForSelect();
        } catch (error) {
            console.error('[ADMIN COLUNISTAS] usuários:', error);
            AdminUI.renderToast('Erro ao carregar usuários.', 'error');
            return;
        }

        const usedUserIds = colunistasCache
            .filter((item) => item.id !== colunistaId)
            .map((item) => item.usuario_id);

        const userOptions = usuarios
            .filter((user) => isEditing || !usedUserIds.includes(user.id))
            .map((user) => {
                const role = window.AdminUsers?.getPrimaryUserRole
                    ? AdminUsers.getPrimaryUserRole(user)
                    : user.usuarios_roles?.[0]?.roles;

                return `
                    <option
                        value="${user.id}"
                        ${user.id === colunista?.usuario_id ? 'selected' : ''}
                    >
                        ${AdminCore.escapeHTML(user.nome || user.email)}
                        — ${AdminCore.escapeHTML(user.email)}
                        — ${AdminCore.escapeHTML(role?.nome || 'sem perfil')}
                    </option>
                `;
            }).join('');

        AdminUI.createModal({
            id: 'colunistaModal',
            formId: 'colunistaForm',
            title: isEditing ? 'Editar colunista' : 'Novo colunista',
            subtitle: isEditing ? (getNome(colunista)) : 'Selecione um usuário e complete o perfil editorial.',
            submitLabel: 'Salvar colunista',
            body: `
                <div class="admin-form-grid two">
                    <div class="admin-form-group full">
                        <label>Usuário</label>
                        <select
                            id="colunistaUsuarioId"
                            ${isEditing ? 'disabled' : ''}
                            required
                        >
                            <option value="">Selecione...</option>
                            ${userOptions}
                        </select>
                    </div>

                    <div class="admin-form-group full">
                        <label>Foto do colunista</label>
                        <input type="file" id="colunistaFoto" accept="image/*">

                        <div id="colunistaFotoPreview">
                            ${AdminStorage.existingImagePreview(getFotoUrl(colunista))}
                        </div>
                    </div>

                    <div class="admin-form-group full">
                        <label>Slug público</label>
                        <input
                            type="text"
                            id="colunistaSlug"
                            value="${AdminCore.escapeHTML(colunista?.slug || '')}"
                            placeholder="gerado-automaticamente"
                            readonly
                            aria-readonly="true"
                            required
                        >
                        <small>Gerado automaticamente pelo sistema para evitar duplicidade.</small>
                    </div>

                    <div class="admin-form-group full">
                        <label>Formação</label>
                        <input
                            type="text"
                            id="colunistaFormacao"
                            value="${AdminCore.escapeHTML(colunista?.formacao || '')}"
                            placeholder="Ex.: Jornalista, advogado, professor..."
                        >
                    </div>

                    <div class="admin-form-group full">
                        <label>Biografia</label>
                        ${AdminEditor.createEditorHTML(
                            'colunistaBiografia',
                            colunista?.biografia || '',
                            'colunistas/biografias'
                        )}
                    </div>

                    <div class="admin-form-group">
                        <label>Site</label>
                        <input
                            type="url"
                            id="colunistaSite"
                            value="${AdminCore.escapeHTML(colunista?.site || '')}"
                            placeholder="https://..."
                        >
                    </div>

                    <div class="admin-form-group">
                        <label>Instagram</label>
                        <input
                            type="url"
                            id="colunistaInstagram"
                            value="${AdminCore.escapeHTML(colunista?.instagram || '')}"
                            placeholder="https://instagram.com/..."
                        >
                    </div>

                    <div class="admin-form-group">
                        <label>Facebook</label>
                        <input
                            type="url"
                            id="colunistaFacebook"
                            value="${AdminCore.escapeHTML(colunista?.facebook || '')}"
                            placeholder="https://facebook.com/..."
                        >
                    </div>

                    <div class="admin-form-group">
                        <label>TikTok</label>
                        <input
                            type="url"
                            id="colunistaTiktok"
                            value="${AdminCore.escapeHTML(colunista?.tiktok || '')}"
                            placeholder="https://tiktok.com/@..."
                        >
                    </div>

                    <div class="admin-form-group">
                        <label>Kwai</label>
                        <input
                            type="url"
                            id="colunistaKwai"
                            value="${AdminCore.escapeHTML(colunista?.kwai || '')}"
                            placeholder="https://..."
                        >
                    </div>

                    <div class="admin-form-group">
                        <label>Outro link</label>
                        <input
                            type="url"
                            id="colunistaOutro"
                            value="${AdminCore.escapeHTML(colunista?.outro || '')}"
                            placeholder="https://..."
                        >
                    </div>

                    <div class="permission-card full">
                        ${
                            isAdmin()
                                ? 'O slug define a URL pública: /colunista.html?slug=nome-do-colunista.'
                                : 'Atualize seu perfil público de colunista. O slug define sua URL pública.'
                        }
                    </div>
                </div>
            `,
            afterOpen: () => {
                AdminEditor.initEditor('colunistaBiografia');

                const userSelect = document.getElementById('colunistaUsuarioId');
                const slugInput = document.getElementById('colunistaSlug');

                userSelect?.addEventListener('change', () => {
                    if (isEditing) return;
                    if (slugInput.value.trim()) return;

                    const selectedOption = userSelect.options[userSelect.selectedIndex];
                    const text = selectedOption?.textContent || '';
                    const namePart = text.split('—')[0]?.trim() || '';

                    slugInput.value = AdminCore.slugify(namePart);
                });

                slugInput?.addEventListener('input', () => {
                    slugInput.value = AdminCore.slugify(slugInput.value);
                });

                document.getElementById('colunistaFoto')?.addEventListener('change', () => {
                    AdminStorage.previewFile('colunistaFoto', 'colunistaFotoPreview');
                });
            },
            onSubmit: async () => save(colunistaId)
        });
    }

    async function save(colunistaId = null) {
        const client = AdminCore.getClient();

        const existing = colunistaId
            ? colunistasCache.find((item) => item.id === colunistaId)
            : null;

        if (colunistaId && !canEditColunista(existing)) {
            AdminUI.renderToast('Você não possui permissão para salvar este perfil.', 'error');
            return;
        }

        if (!colunistaId && !canCreateColunista()) {
            AdminUI.renderToast('Somente administradores podem criar novos colunistas.', 'error');
            return;
        }

        const usuarioId = existing?.usuario_id || AdminCore.getInputValue('colunistaUsuarioId');
        const slug = existing?.slug || AdminCore.slugify(AdminCore.getInputValue('colunistaSlug') || getNome(existing));

        if (!usuarioId) {
            AdminUI.renderToast('Selecione um usuário.', 'error');
            return;
        }

        if (!slug) {
            AdminUI.renderToast('Informe um slug público válido.', 'error');
            return;
        }

        const payload = {
            usuario_id: usuarioId,
            slug,
            formacao: AdminCore.getInputValue('colunistaFormacao'),
            biografia: AdminEditor.getValue('colunistaBiografia'),
            foto_url: getFotoUrl(existing) || null,
            foto_path: getFotoPath(existing) || null,
            site: AdminCore.getInputValue('colunistaSite'),
            instagram: AdminCore.getInputValue('colunistaInstagram'),
            facebook: AdminCore.getInputValue('colunistaFacebook'),
            tiktok: AdminCore.getInputValue('colunistaTiktok'),
            kwai: AdminCore.getInputValue('colunistaKwai'),
            outro: AdminCore.getInputValue('colunistaOutro'),
            updated_at: new Date().toISOString()
        };

        try {
            const uploadedFoto = await AdminStorage.uploadFromInput(
                'colunistaFoto',
                'colunistas/fotos'
            );

            if (uploadedFoto) {
                payload.foto_url = uploadedFoto.url;
                payload.foto_path = uploadedFoto.path;
            }

            if (colunistaId) {
                const { error } = await client
                    .from('colunistas')
                    .update(payload)
                    .eq('id', colunistaId);

                if (error) throw error;
            } else {
                const { error } = await client
                    .from('colunistas')
                    .insert(payload);

                if (error) throw error;
            }

            if (isAdmin()) {
                await AdminCore.ensureUserRole(usuarioId, 'colunista');
            }

            AdminUI.closeModal('colunistaModal');
            AdminUI.renderToast('Colunista salvo com sucesso.');
            await load();

        } catch (error) {
            console.error('[ADMIN COLUNISTAS] save:', error);

            if (String(error.message || '').includes('duplicate key')) {
                AdminUI.renderToast('Este slug já está em uso. Escolha outro.', 'error');
                return;
            }

            AdminUI.renderToast(error.message || 'Erro ao salvar colunista.', 'error');
        }
    }

    async function remove(colunistaId) {
        const client = AdminCore.getClient();

        if (!canDeleteColunista()) {
            AdminUI.renderToast('Somente administradores podem excluir colunistas.', 'error');
            return;
        }

        const colunista = colunistasCache.find((item) => item.id === colunistaId);

        if (!colunista) {
            AdminUI.renderToast('Colunista não encontrado.', 'error');
            return;
        }

        const confirmed = confirm(
            `Excluir o perfil de colunista de ${getNome(colunista)}?\n\nAtenção: publicações vinculadas podem impedir a exclusão.`
        );

        if (!confirmed) return;

        try {
            const { error } = await client
                .from('colunistas')
                .delete()
                .eq('id', colunistaId);

            if (error) throw error;

            AdminUI.renderToast('Perfil de colunista excluído.');
            await load();

        } catch (error) {
            console.error('[ADMIN COLUNISTAS] remove:', error);
            AdminUI.renderToast(error.message || 'Erro ao excluir colunista.', 'error');
        }
    }

    window.AdminColunistas = {
        init: load,
        load
    };
})();