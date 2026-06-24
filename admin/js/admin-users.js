// admin/js/admin-users.js

(function () {
    'use strict';

    let usuariosCache = [];
    let rolesCache = [];
    let usuariosRolesCache = [];

    function isAdmin() {
        if (typeof AdminCore.isAdmin === 'function') return AdminCore.isAdmin();
        return (AdminCore.state.currentRoles || []).includes('admin');
    }

    function normalize(value) {
        return AdminCore.normalize ? AdminCore.normalize(value) : String(value || '').trim().toLowerCase();
    }

    function roleNameById(roleId) {
        return rolesCache.find((role) => String(role.id) === String(roleId))?.nome || null;
    }

    function getRoleById(roleId) {
        return rolesCache.find((role) => String(role.id) === String(roleId)) || null;
    }

    function getPrimaryUserRole(user) {
        const userRole = usuariosRolesCache.find((item) => item.usuario_id === user.id);
        if (!userRole) return null;
        return getRoleById(userRole.role_id);
    }

    function getRoleByName(roleName) {
        const wanted = normalize(roleName);
        return rolesCache.find((role) => normalize(role.nome) === wanted) || null;
    }

    function renderNoPermission() {
        AdminUI.setPage('usuarios');
        AdminUI.setContent(`
            <div class="admin-empty-state empty-state">
                <i class="fas fa-lock"></i>
                <h3>Acesso restrito</h3>
                <p>Somente administradores podem gerenciar usuários e permissões.</p>
            </div>
        `);
    }

    async function loadRoles() {
        const client = AdminCore.getClient();
        const { data, error } = await client
            .from('roles')
            .select('id, nome')
            .order('id', { ascending: true });
        if (error) throw error;
        rolesCache = data || [];
        return rolesCache;
    }

    async function loadUsuariosRoles() {
        const client = AdminCore.getClient();
        const { data, error } = await client
            .from('usuarios_roles')
            .select('usuario_id, role_id');
        if (error) throw error;
        usuariosRolesCache = data || [];
        return usuariosRolesCache;
    }

    function statusActions(user) {
        const status = normalize(user.status || 'ativo');

        if (status === 'ativo') {
            return `
                <button class="btn-icon btn-status-usuario" type="button" title="Suspender usuário" data-id="${AdminCore.escapeHTML(user.id)}" data-status="suspenso">
                    <i class="fas fa-user-slash"></i>
                </button>
            `;
        }

        return `
            <button class="btn-icon btn-status-usuario" type="button" title="Reativar usuário" data-id="${AdminCore.escapeHTML(user.id)}" data-status="ativo">
                <i class="fas fa-user-check"></i>
            </button>
        `;
    }

    function renderCard(user) {
        const role = getPrimaryUserRole(user);
        const roleName = role?.nome || 'cliente';

        return `
            <article class="admin-catalog-card">
                <div class="admin-catalog-media">
                    ${user.foto_url
                        ? `<img src="${AdminCore.escapeHTML(user.foto_url)}" alt="${AdminCore.escapeHTML(user.nome || 'Usuário')}" loading="lazy">`
                        : `<div class="admin-catalog-placeholder"><i class="fas fa-user"></i></div>`
                    }
                </div>

                <div class="admin-catalog-body">
                    <div class="admin-catalog-top">
                        <span class="admin-catalog-badge">${AdminCore.escapeHTML(roleName)}</span>
                        ${AdminUI.statusBadge(user.status || 'ativo')}
                    </div>

                    <h3>${AdminCore.escapeHTML(user.nome || 'Usuário sem nome')}</h3>
                    <p>${AdminCore.escapeHTML(user.email || 'E-mail não informado')}</p>

                    <div class="admin-catalog-meta">
                        <span><i class="fas fa-location-dot"></i>${AdminCore.escapeHTML(user.cidade || 'Cidade não informada')}</span>
                        <span><i class="fas fa-cake-candles"></i>${AdminCore.escapeHTML(AdminCore.formatDate(user.data_nascimento))}</span>
                        <span><i class="fab fa-whatsapp"></i>${AdminCore.escapeHTML(user.whatsapp || user.telefone || 'Sem WhatsApp')}</span>
                        <span><i class="fas fa-calendar"></i>${AdminCore.escapeHTML(AdminCore.formatDate(user.created_at))}</span>
                    </div>

                    <div class="admin-catalog-actions">
                        <button class="btn-icon btn-edit-usuario" type="button" title="Editar usuário" data-id="${AdminCore.escapeHTML(user.id)}">
                            <i class="fas fa-pen"></i>
                        </button>
                        ${statusActions(user)}
                        <button class="btn-icon btn-delete-usuario" type="button" title="Excluir perfil público do usuário" data-id="${AdminCore.escapeHTML(user.id)}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    async function load() {
        AdminUI.setPage('usuarios');
        AdminUI.renderLoading('Carregando usuários...');

        const client = AdminCore.getClient();

        try {
            if (!isAdmin()) {
                renderNoPermission();
                return;
            }

            await Promise.all([loadRoles(), loadUsuariosRoles()]);

            const { data, error } = await client
                .from('usuarios')
                .select('id, nome, email, cidade, status, bio, foto_url, data_nascimento, whatsapp, telefone, created_at')
                .order('created_at', { ascending: false });

            if (error) throw error;
            usuariosCache = data || [];

            AdminUI.setContent(`
                <div class="section-header">
                    <div>
                        <h3>Usuários</h3>
                        <p>Gerencie status, perfis de acesso e permissões do portal.</p>
                    </div>
                </div>

                <div class="permission-card" style="margin-bottom: 18px;">
                    Ao alterar o perfil para <strong>colunista</strong> ou <strong>comerciante</strong>, o sistema cria automaticamente o vínculo necessário para liberar os módulos correspondentes.
                </div>

                ${usuariosCache.length
                    ? `<div class="admin-catalog-grid">${usuariosCache.map(renderCard).join('')}</div>`
                    : AdminUI.emptyState('fa-users', 'Nenhum usuário cadastrado.')
                }
            `);

            bindButtons();

        } catch (error) {
            console.error('[ADMIN USERS]', error);
            AdminUI.renderError(error.message || 'Erro ao carregar usuários.');
        }
    }

    function bindButtons() {
        document.querySelectorAll('.btn-edit-usuario').forEach((button) => {
            button.addEventListener('click', () => openModal(button.dataset.id));
        });

        document.querySelectorAll('.btn-status-usuario').forEach((button) => {
            button.addEventListener('click', () => updateStatus(button.dataset.id, button.dataset.status));
        });

        document.querySelectorAll('.btn-delete-usuario').forEach((button) => {
            button.addEventListener('click', () => deleteUser(button.dataset.id));
        });
    }

    async function openModal(userId) {
        const user = usuariosCache.find((item) => item.id === userId);
        if (!user) {
            AdminUI.renderToast('Usuário não encontrado.', 'error');
            return;
        }

        const currentRole = getPrimaryUserRole(user);
        const roleOptions = rolesCache.map((role) => `
            <option value="${role.id}" ${String(role.id) === String(currentRole?.id) ? 'selected' : ''}>${AdminCore.escapeHTML(role.nome)}</option>
        `).join('');

        const status = normalize(user.status || 'ativo');

        AdminUI.createModal({
            id: 'usuarioModal',
            formId: 'usuarioForm',
            title: 'Editar usuário',
            subtitle: user.nome || user.email || '',
            submitLabel: 'Salvar usuário',
            body: `
                <div class="admin-form-grid two">
                    <div class="admin-form-group full">
                        <label>Nome</label>
                        <input type="text" id="usuarioNome" value="${AdminCore.escapeHTML(user.nome || '')}" placeholder="Nome do usuário">
                    </div>

                    <div class="admin-form-group full">
                        <label>E-mail</label>
                        <input type="email" id="usuarioEmail" value="${AdminCore.escapeHTML(user.email || '')}" disabled>
                    </div>

                    <div class="admin-form-group">
                        <label>Status</label>
                        <select id="usuarioStatus" required>
                            <option value="ativo" ${status === 'ativo' ? 'selected' : ''}>Ativo</option>
                            <option value="suspenso" ${status === 'suspenso' ? 'selected' : ''}>Suspenso</option>
                            <option value="inativo" ${status === 'inativo' ? 'selected' : ''}>Inativo</option>
                            <option value="pendente" ${status === 'pendente' ? 'selected' : ''}>Pendente</option>
                        </select>
                    </div>

                    <div class="admin-form-group">
                        <label>Perfil de acesso</label>
                        <select id="usuarioRoleId" required>
                            <option value="">Selecione...</option>
                            ${roleOptions}
                        </select>
                    </div>

                    <div class="admin-form-group">
                        <label>Cidade</label>
                        <input type="text" id="usuarioCidade" value="${AdminCore.escapeHTML(user.cidade || '')}" placeholder="Cidade">
                    </div>

                    <div class="admin-form-group">
                        <label>Data de nascimento</label>
                        <input type="date" id="usuarioDataNascimento" value="${AdminCore.escapeHTML(user.data_nascimento || '')}" required>
                    </div>

                    <div class="admin-form-group">
                        <label>WhatsApp</label>
                        <input type="tel" id="usuarioWhatsapp" value="${AdminCore.escapeHTML(user.whatsapp || user.telefone || '')}" placeholder="Ex.: 61999999999">
                    </div>

                    <div class="admin-form-group full">
                        <label>Bio</label>
                        <textarea id="usuarioBio" rows="5" placeholder="Resumo público do usuário">${AdminCore.escapeHTML(user.bio || '')}</textarea>
                    </div>

                    <div class="permission-card full">
                        Se o perfil for Colunista ou Comerciante, o vínculo operacional será criado automaticamente ao salvar.
                    </div>
                </div>
            `,
            onSubmit: async () => save(userId)
        });
    }

    async function ensureColunistaProfile(user) {
        const client = AdminCore.getClient();
        const { data: existing, error: existingError } = await client
            .from('colunistas')
            .select('id')
            .eq('usuario_id', user.id)
            .maybeSingle();

        if (existingError) throw existingError;
        if (existing) return existing.id;

        const slugBase = AdminCore.slugify(user.nome || user.email?.split('@')[0] || 'colunista');
        const slug = `${slugBase}-${String(user.id).slice(0, 8)}`;

        const { error } = await client
            .from('colunistas')
            .insert({
                usuario_id: user.id,
                slug,
                formacao: '',
                biografia: 'Perfil de colunista criado automaticamente. Complete sua biografia no painel.',
                site: '',
                instagram: '',
                facebook: '',
                tiktok: '',
                kwai: '',
                outro: ''
            });

        if (error) throw error;
        return null;
    }

    async function ensureComercianteProfile(user) {
        const client = AdminCore.getClient();
        const { data: existing, error: existingError } = await client
            .from('negocios')
            .select('id')
            .eq('usuario_id', user.id)
            .maybeSingle();

        if (existingError) throw existingError;
        if (existing) return existing.id;

        let tipoNegocioId = null;
        try {
            const { data: tipo } = await client
                .from('tipos_negocio')
                .select('id')
                .ilike('nome', 'Outros')
                .maybeSingle();
            tipoNegocioId = tipo?.id || null;
        } catch {}

        const nome = user.nome ? `Negócio de ${user.nome}` : `Negócio ${String(user.id).slice(0, 8)}`;
        const slug = `${AdminCore.slugify(nome)}-${String(user.id).slice(0, 8)}`;

        const payload = {
            usuario_id: user.id,
            nome,
            slug,
            responsavel: user.nome || '',
            categoria_principal: 'Outros',
            cidade: user.cidade || '',
            descricao: 'Perfil comercial criado automaticamente. Complete os dados da empresa no painel.',
            status: 'ativo',
            destaque: false,
            verificado: false,
            plano: 'gratuito'
        };

        if (tipoNegocioId) payload.tipo_negocio_id = tipoNegocioId;

        const { error } = await client
            .from('negocios')
            .insert(payload);

        if (error) throw error;
        return null;
    }

    async function ensureOperationalProfile(userId, roleId) {
        const user = usuariosCache.find((item) => item.id === userId);
        const roleName = normalize(roleNameById(roleId));

        if (!user || !roleName) return;

        if (roleName === 'colunista') {
            await ensureColunistaProfile(user);
        }

        if (roleName === 'comerciante') {
            await ensureComercianteProfile(user);
        }
    }

    async function save(userId) {
        const client = AdminCore.getClient();
        const nome = AdminCore.getInputValue('usuarioNome');
        const status = AdminCore.getInputValue('usuarioStatus') || 'ativo';
        const roleId = AdminCore.getInputValue('usuarioRoleId');

        if (!roleId) {
            AdminUI.renderToast('Selecione um perfil de acesso.', 'error');
            return;
        }

        try {
            const { error: updateError } = await client
                .from('usuarios')
                .update({
                    nome,
                    status,
                    cidade: AdminCore.getInputValue('usuarioCidade'),
                    data_nascimento: AdminCore.getInputValue('usuarioDataNascimento'),
                    whatsapp: AdminCore.getInputValue('usuarioWhatsapp'),
                    bio: AdminCore.getInputValue('usuarioBio')
                })
                .eq('id', userId);

            if (updateError) throw updateError;

            const { error: deleteError } = await client
                .from('usuarios_roles')
                .delete()
                .eq('usuario_id', userId);

            if (deleteError) throw deleteError;

            const { error: insertError } = await client
                .from('usuarios_roles')
                .insert({ usuario_id: userId, role_id: roleId });

            if (insertError) throw insertError;

            await ensureOperationalProfile(userId, roleId);

            AdminUI.closeModal('usuarioModal');
            AdminUI.renderToast('Usuário atualizado com sucesso.');
            await load();

        } catch (error) {
            console.error('[ADMIN USERS] save:', error);
            AdminUI.renderToast(error.message || 'Erro ao salvar usuário.', 'error');
        }
    }

    async function updateStatus(userId, status) {
        const user = usuariosCache.find((item) => item.id === userId);
        const label = normalize(status) === 'ativo' ? 'reativar' : 'suspender';

        if (!user) return;
        if (!confirm(`Deseja ${label} o usuário ${user.nome || user.email}?`)) return;

        try {
            const { error } = await AdminCore.getClient()
                .from('usuarios')
                .update({ status })
                .eq('id', userId);

            if (error) throw error;
            AdminUI.renderToast(status === 'ativo' ? 'Usuário reativado.' : 'Usuário suspenso.');
            await load();
        } catch (error) {
            console.error('[ADMIN USERS] status:', error);
            AdminUI.renderToast(error.message || 'Erro ao alterar status.', 'error');
        }
    }

    async function deleteUser(userId) {
        const client = AdminCore.getClient();
        const user = usuariosCache.find((item) => item.id === userId);

        if (!user) return;

        const confirmed = confirm(`Excluir o perfil público de ${user.nome || user.email}?\n\nA conta no Supabase Auth pode precisar ser removida manualmente em Authentication > Users.`);
        if (!confirmed) return;

        try {
            await client.from('usuarios_roles').delete().eq('usuario_id', userId);
            await client.from('colunistas').delete().eq('usuario_id', userId);
            await client.from('negocios').delete().eq('usuario_id', userId);

            const { error } = await client
                .from('usuarios')
                .delete()
                .eq('id', userId);

            if (error) throw error;

            AdminUI.renderToast('Perfil público excluído. Remova também no Auth se for necessário novo cadastro com o mesmo e-mail.');
            await load();
        } catch (error) {
            console.error('[ADMIN USERS] delete:', error);
            AdminUI.renderToast(error.message || 'Erro ao excluir usuário. Verifique vínculos no banco.', 'error');
        }
    }

    window.AdminUsers = { init: load, load, getPrimaryUserRole };
    window.AdminUsuarios = window.AdminUsers;
})();
