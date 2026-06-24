// admin/js/admin-negocios.js

(function () {
    'use strict';

    let negociosCache = [];
    let tiposNegocioCache = [];
    let usuariosCache = [];
    let currentNegocioId = null;

    function ensureEditor() {
        if (window.AdminEditor) return window.AdminEditor;

        window.AdminEditor = {
            createEditorHTML(id, value) {
                return `
                    <textarea id="${AdminCore.escapeHTML(id)}" rows="14" style="width:100%;min-height:320px;">${AdminCore.escapeHTML(value || '')}</textarea>
                `;
            },
            initEditor() { return null; },
            getValue(id) { return document.getElementById(id)?.value?.trim() || ''; }
        };

        return window.AdminEditor;
    }

    function hasRole(roleName) {
        const role = AdminCore.normalize(roleName);
        if (typeof AdminCore.hasRole === 'function') return AdminCore.hasRole(role);
        return (AdminCore.state.currentRoles || []).includes(role);
    }

    function isAdmin() { return hasRole('admin') || hasRole('administrador'); }
    function isComerciante() { return hasRole('comerciante'); }
    function isColunista() { return hasRole('colunista'); }

    async function getCurrentNegocioId() {
        const client = AdminCore.getClient();
        const userId = AdminCore.state.currentUser?.id;
        if (!userId) return null;

        const { data, error } = await client
            .from('negocios')
            .select('id')
            .eq('usuario_id', userId)
            .maybeSingle();

        if (error) {
            console.warn('[ADMIN NEGÓCIOS] negócio do usuário:', error);
            return null;
        }

        return data?.id || null;
    }

    function canAccessModule() { return isAdmin() || isComerciante(); }
    function canCreateNegocio() { return isAdmin(); }
    function canEditNegocio(negocio) { return isAdmin() || (isComerciante() && negocio?.id === currentNegocioId); }
    function canDeleteNegocio() { return isAdmin(); }

    function resumo(text, limit = 130) {
        const clean = String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (clean.length <= limit) return clean;
        return `${clean.slice(0, limit).trim()}...`;
    }

    function renderNoPermission(message) {
        AdminUI.setPage('negocios');
        AdminUI.setContent(`
            <div class="admin-empty-state empty-state">
                <i class="fas fa-lock"></i>
                <h3>Acesso restrito</h3>
                <p>${AdminCore.escapeHTML(message)}</p>
            </div>
        `);
    }

    async function loadTiposNegocio() {
        const client = AdminCore.getClient();

        const { data, error } = await client
            .from('tipos_negocio')
            .select('id, nome')
            .order('nome', { ascending: true });

        if (error) {
            console.warn('[ADMIN NEGÓCIOS] tipos_negocio indisponível. Usando lista local.', error);
            tiposNegocioCache = [
                { id: null, nome: 'Alimentação' },
                { id: null, nome: 'Beleza e Estética' },
                { id: null, nome: 'Comércio' },
                { id: null, nome: 'Educação' },
                { id: null, nome: 'Saúde' },
                { id: null, nome: 'Serviços' },
                { id: null, nome: 'Tecnologia' },
                { id: null, nome: 'Eventos' },
                { id: null, nome: 'Outros' }
            ];
            return tiposNegocioCache;
        }

        tiposNegocioCache = data || [];
        return tiposNegocioCache;
    }

    async function loadUsuarios() {
        const client = AdminCore.getClient();

        const { data, error } = await client
            .from('usuarios')
            .select('id, nome, email, status')
            .order('nome', { ascending: true });

        if (error) {
            console.warn('[ADMIN NEGÓCIOS] usuários indisponíveis:', error);
            usuariosCache = [];
            return usuariosCache;
        }

        usuariosCache = data || [];
        return usuariosCache;
    }

    function getTipoNome(tipoId, categoriaPrincipal) {
        const tipo = tiposNegocioCache.find((item) => item.id && item.id === tipoId);
        return tipo?.nome || categoriaPrincipal || 'Parceiro';
    }

    function getUsuarioById(usuarioId) {
        return usuariosCache.find((user) => user.id === usuarioId) || null;
    }

    function getResponsavelNome(item) {
        const user = getUsuarioById(item.usuario_id);
        return user?.nome || user?.email || item.responsavel || 'Responsável não informado';
    }

    function renderCard(item) {
        const previewUrl = item.slug ? `../parceiro.html?slug=${encodeURIComponent(item.slug)}` : '';

        return `
            <article class="admin-catalog-card">
                <div class="admin-catalog-media">
                    ${item.imagem_capa_url || item.imagem_logo_url ? `
                        <img src="${AdminCore.escapeHTML(item.imagem_capa_url || item.imagem_logo_url)}" alt="${AdminCore.escapeHTML(item.nome || 'Parceiro')}" loading="lazy">
                    ` : `
                        <div class="admin-catalog-placeholder"><i class="fas fa-store"></i></div>
                    `}
                </div>

                <div class="admin-catalog-body">
                    <div class="admin-catalog-top">
                        <span class="admin-catalog-badge">${AdminCore.escapeHTML(getTipoNome(item.tipo_negocio_id, item.categoria_principal))}</span>
                        ${AdminUI.statusBadge(item.status || 'ativo')}
                    </div>

                    <h3>${AdminCore.escapeHTML(item.nome || 'Negócio sem nome')}</h3>
                    <p>${AdminCore.escapeHTML(resumo(item.descricao || item.contato_negocio || ''))}</p>

                    <div class="admin-catalog-meta">
                        <span><i class="fas fa-user"></i>${AdminCore.escapeHTML(getResponsavelNome(item))}</span>
                        <span><i class="fas fa-location-dot"></i>${AdminCore.escapeHTML(item.cidade || item.bairro || 'Local não informado')}</span>
                        <span><i class="fas fa-crown"></i>${AdminCore.escapeHTML(item.plano || 'gratuito')}</span>
                        <span><i class="fas fa-circle-check"></i>${item.verificado ? 'Verificado' : 'Não verificado'}</span>
                        <span><i class="fas fa-star"></i>${item.destaque ? 'Destaque' : 'Normal'}</span>
                    </div>

                    <div class="admin-catalog-actions">
                        ${previewUrl ? `<a class="btn-icon" href="${AdminCore.escapeHTML(previewUrl)}" target="_blank" title="Visualizar empresa"><i class="fas fa-eye"></i></a>` : ''}
                        ${canEditNegocio(item) ? `<button class="btn-icon btn-edit-negocio" type="button" title="Editar negócio" data-id="${AdminCore.escapeHTML(item.id)}"><i class="fas fa-pen"></i></button>` : ''}
                        ${canDeleteNegocio() ? `<button class="btn-icon btn-delete-negocio" type="button" title="Excluir negócio" data-id="${AdminCore.escapeHTML(item.id)}"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                </div>
            </article>
        `;
    }

    async function load() {
        AdminUI.setPage('negocios');
        AdminUI.renderLoading('Carregando parceiros...');
        const client = AdminCore.getClient();

        try {
            ensureEditor();

            if (isColunista() && !isAdmin()) {
                renderNoPermission('Seu perfil de colunista não possui acesso ao módulo Parceiros.');
                return;
            }

            if (!canAccessModule()) {
                renderNoPermission('Seu perfil não possui acesso ao módulo Parceiros.');
                return;
            }

            currentNegocioId = isComerciante() && !isAdmin() ? await getCurrentNegocioId() : null;

            if (isComerciante() && !isAdmin() && !currentNegocioId) {
                renderNoPermission('Seu usuário comerciante ainda não possui uma empresa vinculada.');
                return;
            }

            await Promise.all([loadTiposNegocio(), loadUsuarios()]);

            let query = client
                .from('negocios')
                .select(`
                    id,
                    usuario_id,
                    endereco_id,
                    tipo_negocio_id,
                    nome,
                    slug,
                    responsavel,
                    whatsapp,
                    whatsapp_link,
                    contato_negocio,
                    site,
                    instagram,
                    facebook,
                    tiktok,
                    kwai,
                    youtube,
                    outro,
                    categoria_principal,
                    descricao,
                    imagem_logo_url,
                    imagem_logo_path,
                    imagem_capa_url,
                    imagem_capa_path,
                    endereco_texto,
                    cidade,
                    bairro,
                    latitude,
                    longitude,
                    verificado,
                    plano,
                    destaque,
                    status,
                    created_at,
                    updated_at
                `)
                .order('created_at', { ascending: false });

            if (isComerciante() && !isAdmin()) query = query.eq('id', currentNegocioId);

            const { data, error } = await query;
            if (error) throw error;

            negociosCache = data || [];

            AdminUI.setContent(`
                <div class="section-header">
                    <div>
                        <h3>Parceiros</h3>
                        <p>${isAdmin() ? 'Cadastre empresas, prestadores, parceiros, anunciantes e localização.' : 'Gerencie os dados públicos da sua empresa parceira.'}</p>
                    </div>

                    ${canCreateNegocio() ? `<button class="btn-primary" type="button" id="newNegocioBtn"><i class="fas fa-plus"></i>Novo negócio</button>` : ''}
                </div>

                <div class="permission-card" style="margin-bottom:18px;">
                    ${isAdmin() ? 'Administrador visualiza, cria, edita e remove empresas parceiras.' : 'Comerciante visualiza e edita apenas a própria empresa.'}
                </div>

                ${negociosCache.length ? `<div class="admin-catalog-grid">${negociosCache.map(renderCard).join('')}</div>` : AdminUI.emptyState('fa-store', 'Nenhum negócio cadastrado.')}
            `);

            bindButtons();

        } catch (error) {
            console.error('[ADMIN NEGÓCIOS]', error);
            AdminUI.renderError(error.message || 'Erro ao carregar parceiros.');
        }
    }

    function bindButtons() {
        document.getElementById('newNegocioBtn')?.addEventListener('click', () => openModal());
        document.querySelectorAll('.btn-edit-negocio').forEach((button) => button.addEventListener('click', () => openModal(button.dataset.id)));
        document.querySelectorAll('.btn-delete-negocio').forEach((button) => button.addEventListener('click', () => remove(button.dataset.id)));
    }

    async function openModal(negocioId = null) {
        ensureEditor();
        const isEditing = Boolean(negocioId);
        const negocio = isEditing ? negociosCache.find((item) => item.id === negocioId) : null;

        if (isEditing && !negocio) {
            AdminUI.renderToast('Negócio não encontrado.', 'error');
            return;
        }

        if (isEditing && !canEditNegocio(negocio)) {
            AdminUI.renderToast('Você não possui permissão para editar este negócio.', 'error');
            return;
        }

        if (!isEditing && !canCreateNegocio()) {
            AdminUI.renderToast('Somente administradores podem criar novos negócios.', 'error');
            return;
        }

        if (!usuariosCache.length) await loadUsuarios();
        if (!tiposNegocioCache.length) await loadTiposNegocio();

        const usuarioOptions = usuariosCache
            .filter((user) => user.status === 'ativo' || user.id === negocio?.usuario_id)
            .map((user) => `
                <option value="${user.id}" ${user.id === negocio?.usuario_id ? 'selected' : ''}>
                    ${AdminCore.escapeHTML(user.nome || user.email)} — ${AdminCore.escapeHTML(user.email || '')}
                </option>
            `).join('');

        const tipoOptions = tiposNegocioCache.map((tipo) => `
            <option value="${tipo.id || ''}" ${tipo.id && tipo.id === negocio?.tipo_negocio_id ? 'selected' : ''}>
                ${AdminCore.escapeHTML(tipo.nome)}
            </option>
        `).join('');

        const previewLink = negocio?.slug ? `../parceiro.html?slug=${encodeURIComponent(negocio.slug)}` : '';
        const lockedSlug = negocio?.slug || '';

        AdminUI.createModal({
            id: 'negocioModal',
            formId: 'negocioForm',
            title: isEditing ? 'Editar negócio' : 'Novo negócio',
            subtitle: isEditing ? (negocio.nome || '') : 'Preencha os dados comerciais e localização do negócio.',
            submitLabel: 'Salvar negócio',
            body: `
                <div class="admin-form-grid three">
                    ${previewLink ? `<div class="admin-form-group full"><a class="btn-primary" href="${AdminCore.escapeHTML(previewLink)}" target="_blank"><i class="fas fa-eye"></i>Visualizar empresa</a></div>` : ''}

                    <div class="admin-form-group full">
                        <label>Usuário responsável</label>
                        <select id="negocioUsuarioId" required ${isComerciante() && !isAdmin() ? 'disabled' : ''}>
                            <option value="">Selecione...</option>
                            ${usuarioOptions}
                        </select>
                    </div>

                    <div class="admin-form-group full">
                        <label>Logo do negócio</label>
                        <input type="file" id="negocioImagemLogo" accept="image/*">
                        <div id="negocioLogoPreview">${AdminStorage.existingImagePreview(negocio?.imagem_logo_url)}</div>
                    </div>

                    <div class="admin-form-group full">
                        <label>Imagem de capa</label>
                        <input type="file" id="negocioImagemCapa" accept="image/*">
                        <div id="negocioCapaPreview">${AdminStorage.existingImagePreview(negocio?.imagem_capa_url)}</div>
                    </div>

                    <div class="admin-form-group full">
                        <label>Nome do negócio</label>
                        <input type="text" id="negocioNome" value="${AdminCore.escapeHTML(negocio?.nome || '')}" placeholder="Ex.: Mercado Central" required>
                    </div>

                    <div class="admin-form-group full">
                        <label>Slug automático</label>
                        <input type="text" id="negocioSlug" value="${AdminCore.escapeHTML(lockedSlug)}" placeholder="Gerado automaticamente ao salvar" disabled>
                    </div>

                    <div class="admin-form-group">
                        <label>Tipo de negócio</label>
                        <select id="negocioTipoId"><option value="">Selecione...</option>${tipoOptions}</select>
                    </div>

                    <div class="admin-form-group">
                        <label>Categoria principal</label>
                        <input type="text" id="negocioCategoria" value="${AdminCore.escapeHTML(negocio?.categoria_principal || '')}" placeholder="Ex.: Alimentação">
                    </div>

                    <div class="admin-form-group">
                        <label>Plano</label>
                        <select id="negocioPlano" required ${isComerciante() && !isAdmin() ? 'disabled' : ''}>
                            <option value="gratuito" ${AdminCore.normalize(negocio?.plano || 'gratuito') === 'gratuito' ? 'selected' : ''}>Gratuito</option>
                            <option value="premium" ${AdminCore.normalize(negocio?.plano) === 'premium' ? 'selected' : ''}>Premium</option>
                            <option value="parceiro" ${AdminCore.normalize(negocio?.plano) === 'parceiro' ? 'selected' : ''}>Parceiro</option>
                        </select>
                    </div>

                    <div class="admin-form-group">
                        <label>Status</label>
                        <select id="negocioStatus" required ${isComerciante() && !isAdmin() ? 'disabled' : ''}>
                            <option value="ativo" ${AdminCore.normalize(negocio?.status || 'ativo') === 'ativo' ? 'selected' : ''}>Ativo</option>
                            <option value="inativo" ${AdminCore.normalize(negocio?.status) === 'inativo' ? 'selected' : ''}>Inativo</option>
                            <option value="pendente" ${AdminCore.normalize(negocio?.status) === 'pendente' ? 'selected' : ''}>Pendente</option>
                        </select>
                    </div>

                    <div class="admin-form-group"><label>Verificado</label><select id="negocioVerificado" ${isComerciante() && !isAdmin() ? 'disabled' : ''}><option value="false" ${!negocio?.verificado ? 'selected' : ''}>Não</option><option value="true" ${negocio?.verificado ? 'selected' : ''}>Sim</option></select></div>
                    <div class="admin-form-group"><label>Destaque</label><select id="negocioDestaque" ${isComerciante() && !isAdmin() ? 'disabled' : ''}><option value="false" ${!negocio?.destaque ? 'selected' : ''}>Não</option><option value="true" ${negocio?.destaque ? 'selected' : ''}>Sim</option></select></div>
                    <div class="admin-form-group"><label>Responsável</label><input type="text" id="negocioResponsavel" value="${AdminCore.escapeHTML(negocio?.responsavel || '')}"></div>
                    <div class="admin-form-group"><label>WhatsApp</label><input type="text" id="negocioWhatsapp" value="${AdminCore.escapeHTML(negocio?.whatsapp || '')}"></div>
                    <div class="admin-form-group"><label>Contato comercial</label><input type="text" id="negocioContato" value="${AdminCore.escapeHTML(negocio?.contato_negocio || '')}"></div>
                    <div class="admin-form-group full"><label>Endereço</label><input type="text" id="negocioEnderecoTexto" value="${AdminCore.escapeHTML(negocio?.endereco_texto || '')}"></div>
                    <div class="admin-form-group"><label>Cidade</label><input type="text" id="negocioCidade" value="${AdminCore.escapeHTML(negocio?.cidade || '')}"></div>
                    <div class="admin-form-group"><label>Bairro</label><input type="text" id="negocioBairro" value="${AdminCore.escapeHTML(negocio?.bairro || '')}"></div>
                    <div class="admin-form-group"><label>Latitude</label><input type="text" id="negocioLatitude" value="${negocio?.latitude ?? ''}"></div>
                    <div class="admin-form-group"><label>Longitude</label><input type="text" id="negocioLongitude" value="${negocio?.longitude ?? ''}"></div>
                    <div class="admin-form-group"><label>Capturar localização</label><button class="btn-secondary" type="button" id="negocioUsarLocalizacao"><i class="fas fa-location-crosshairs"></i>Usar minha localização atual</button></div>
                    <div class="admin-form-group full"><label>Prévia do mapa</label><div id="negocioMapaPreview"></div></div>
                    <div class="admin-form-group"><label>Site</label><input type="url" id="negocioSite" value="${AdminCore.escapeHTML(negocio?.site || '')}"></div>
                    <div class="admin-form-group"><label>Instagram</label><input type="url" id="negocioInstagram" value="${AdminCore.escapeHTML(negocio?.instagram || '')}"></div>
                    <div class="admin-form-group"><label>Facebook</label><input type="url" id="negocioFacebook" value="${AdminCore.escapeHTML(negocio?.facebook || '')}"></div>
                    <div class="admin-form-group"><label>TikTok</label><input type="url" id="negocioTiktok" value="${AdminCore.escapeHTML(negocio?.tiktok || '')}"></div>
                    <div class="admin-form-group"><label>Kwai</label><input type="url" id="negocioKwai" value="${AdminCore.escapeHTML(negocio?.kwai || '')}"></div>
                    <div class="admin-form-group"><label>YouTube</label><input type="url" id="negocioYoutube" value="${AdminCore.escapeHTML(negocio?.youtube || '')}"></div>
                    <div class="admin-form-group full"><label>Outro link</label><input type="url" id="negocioOutro" value="${AdminCore.escapeHTML(negocio?.outro || '')}"></div>
                    <div class="admin-form-group full"><label>Descrição</label>${AdminEditor.createEditorHTML('negocioDescricao', negocio?.descricao || '', 'negocios/descricoes')}</div>
                </div>
            `,
            afterOpen: () => {
                AdminEditor.initEditor('negocioDescricao');

                const usuarioSelect = document.getElementById('negocioUsuarioId');
                if (isComerciante() && !isAdmin() && usuarioSelect) usuarioSelect.value = AdminCore.state.currentUser?.id || '';

                document.getElementById('negocioImagemLogo')?.addEventListener('change', () => AdminStorage.previewFile('negocioImagemLogo', 'negocioLogoPreview'));
                document.getElementById('negocioImagemCapa')?.addEventListener('change', () => AdminStorage.previewFile('negocioImagemCapa', 'negocioCapaPreview'));
                document.getElementById('negocioUsarLocalizacao')?.addEventListener('click', () => {
                    if (!window.AdminGeolocation?.fillCurrentLocation) {
                        AdminUI.renderToast('Módulo de geolocalização indisponível.', 'error');
                        return;
                    }
                    AdminGeolocation.fillCurrentLocation('negocioLatitude', 'negocioLongitude', 'negocioMapaPreview');
                });
                if (window.AdminGeolocation?.bindPreview) AdminGeolocation.bindPreview('negocioLatitude', 'negocioLongitude', 'negocioMapaPreview');
            },
            onSubmit: async () => save(negocioId)
        });
    }

    async function makeUniqueSlug(baseName, currentId = null) {
        const client = AdminCore.getClient();
        const baseSlug = AdminCore.slugify(baseName) || `negocio-${Date.now()}`;
        let slug = baseSlug;
        let counter = 2;

        while (true) {
            let query = client.from('negocios').select('id').eq('slug', slug).limit(1);
            if (currentId) query = query.neq('id', currentId);
            const { data, error } = await query;
            if (error) throw error;
            if (!data || !data.length) return slug;
            slug = `${baseSlug}-${counter}`;
            counter += 1;
        }
    }

    async function save(negocioId = null) {
        const client = AdminCore.getClient();
        const existing = negocioId ? negociosCache.find((item) => item.id === negocioId) : null;

        if (negocioId && !canEditNegocio(existing)) {
            AdminUI.renderToast('Você não possui permissão para salvar este negócio.', 'error');
            return;
        }
        if (!negocioId && !canCreateNegocio()) {
            AdminUI.renderToast('Somente administradores podem criar novos negócios.', 'error');
            return;
        }

        const nome = AdminCore.getInputValue('negocioNome');
        const whatsapp = AdminCore.getInputValue('negocioWhatsapp');

        if (!nome) {
            AdminUI.renderToast('Informe o nome do negócio.', 'error');
            return;
        }

        let geo = { latitude: null, longitude: null };
        try {
            if (window.AdminGeolocation?.validatePair) geo = AdminGeolocation.validatePair(AdminCore.getInputValue('negocioLatitude'), AdminCore.getInputValue('negocioLongitude'));
            else {
                geo.latitude = AdminCore.getInputValue('negocioLatitude') || null;
                geo.longitude = AdminCore.getInputValue('negocioLongitude') || null;
            }
        } catch (error) {
            AdminUI.renderToast(error.message, 'error');
            return;
        }

        let usuarioId = AdminCore.getInputValue('negocioUsuarioId');
        if (isComerciante() && !isAdmin()) usuarioId = AdminCore.state.currentUser?.id;

        if (!usuarioId) {
            AdminUI.renderToast('Selecione o usuário responsável.', 'error');
            return;
        }

        const slug = existing?.slug || await makeUniqueSlug(nome, negocioId);

        const payload = {
            usuario_id: usuarioId,
            tipo_negocio_id: AdminCore.getInputValue('negocioTipoId') || null,
            nome,
            slug,
            responsavel: AdminCore.getInputValue('negocioResponsavel'),
            whatsapp,
            whatsapp_link: AdminCore.makeWhatsappLink(whatsapp),
            contato_negocio: AdminCore.getInputValue('negocioContato'),
            site: AdminCore.getInputValue('negocioSite'),
            instagram: AdminCore.getInputValue('negocioInstagram'),
            facebook: AdminCore.getInputValue('negocioFacebook'),
            tiktok: AdminCore.getInputValue('negocioTiktok'),
            kwai: AdminCore.getInputValue('negocioKwai'),
            youtube: AdminCore.getInputValue('negocioYoutube'),
            outro: AdminCore.getInputValue('negocioOutro'),
            categoria_principal: AdminCore.getInputValue('negocioCategoria'),
            descricao: AdminEditor.getValue('negocioDescricao'),
            imagem_logo_url: existing?.imagem_logo_url || null,
            imagem_logo_path: existing?.imagem_logo_path || null,
            imagem_capa_url: existing?.imagem_capa_url || null,
            imagem_capa_path: existing?.imagem_capa_path || null,
            endereco_texto: AdminCore.getInputValue('negocioEnderecoTexto'),
            cidade: AdminCore.getInputValue('negocioCidade'),
            bairro: AdminCore.getInputValue('negocioBairro'),
            latitude: geo.latitude,
            longitude: geo.longitude,
            updated_at: new Date().toISOString()
        };

        if (isAdmin()) {
            payload.plano = AdminCore.getInputValue('negocioPlano') || existing?.plano || 'gratuito';
            payload.status = AdminCore.getInputValue('negocioStatus') || existing?.status || 'ativo';
            payload.verificado = AdminCore.getInputValue('negocioVerificado') === 'true';
            payload.destaque = AdminCore.getInputValue('negocioDestaque') === 'true';
        } else if (existing) {
            payload.plano = existing.plano || 'gratuito';
            payload.status = existing.status || 'ativo';
            payload.verificado = Boolean(existing.verificado);
            payload.destaque = Boolean(existing.destaque);
        }

        try {
            const uploadedLogo = await AdminStorage.uploadFromInput('negocioImagemLogo', 'negocios/logos');
            if (uploadedLogo) {
                payload.imagem_logo_url = uploadedLogo.url;
                payload.imagem_logo_path = uploadedLogo.path;
            }

            const uploadedCapa = await AdminStorage.uploadFromInput('negocioImagemCapa', 'negocios/capas');
            if (uploadedCapa) {
                payload.imagem_capa_url = uploadedCapa.url;
                payload.imagem_capa_path = uploadedCapa.path;
            }

            if (negocioId) {
                const { error } = await client.from('negocios').update(payload).eq('id', negocioId);
                if (error) throw error;
            } else {
                const { error } = await client.from('negocios').insert(payload);
                if (error) throw error;
            }

            if (isAdmin()) await AdminCore.ensureUserRole(payload.usuario_id, 'comerciante');

            AdminUI.closeModal('negocioModal');
            AdminUI.renderToast('Negócio salvo com sucesso.');
            await load();

        } catch (error) {
            console.error('[ADMIN NEGÓCIOS] save:', error);
            AdminUI.renderToast(error.message || 'Erro ao salvar negócio.', 'error');
        }
    }

    async function remove(negocioId) {
        const client = AdminCore.getClient();
        if (!canDeleteNegocio()) {
            AdminUI.renderToast('Somente administradores podem excluir negócios.', 'error');
            return;
        }
        const negocio = negociosCache.find((item) => item.id === negocioId);
        if (!negocio) {
            AdminUI.renderToast('Negócio não encontrado.', 'error');
            return;
        }
        if (!confirm(`Excluir o negócio "${negocio.nome}"?`)) return;
        try {
            const { error } = await client.from('negocios').delete().eq('id', negocioId);
            if (error) throw error;
            AdminUI.renderToast('Negócio excluído.');
            await load();
        } catch (error) {
            console.error('[ADMIN NEGÓCIOS] remove:', error);
            AdminUI.renderToast(error.message || 'Erro ao excluir negócio.', 'error');
        }
    }

    window.AdminNegocios = { init: load, load };
})();
