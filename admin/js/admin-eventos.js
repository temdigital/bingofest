// admin/js/admin-eventos.js

(function () {
    'use strict';

    let eventosCache = [];

    function isAdmin() {
        return typeof AdminCore?.isAdmin === 'function' && AdminCore.isAdmin();
    }

    function isComerciante() {
        return typeof AdminCore?.isComerciante === 'function' && AdminCore.isComerciante();
    }

    function isColunista() {
        return typeof AdminCore?.isColunista === 'function' && AdminCore.isColunista();
    }

    function canCreateEvento() {
        return isAdmin() || isComerciante();
    }

    function canEditEvento(evento) {
        if (isAdmin()) return true;
        if (isComerciante()) return evento?.criado_por_usuario_id === AdminCore.state.currentUser?.id;
        return false;
    }

    function canDeleteEvento(evento) {
        return canEditEvento(evento);
    }


    function parseValorEvento(value) {
        const raw = String(value || '').trim();

        if (!raw) {
            return { value: null, error: null };
        }

        const normalized = raw
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .trim();

        if (['gratuito', 'gratis', 'free', 'sem custo', 'entrada franca', '0', '0,00', 'r$ 0,00'].includes(normalized)) {
            return { value: null, error: null };
        }

        const cleaned = raw
            .replace(/[^0-9,.-]/g, '')
            .replace(/\.(?=\d{3}(\D|$))/g, '')
            .replace(',', '.');

        const number = Number.parseFloat(cleaned);

        if (!Number.isFinite(number) || number < 0) {
            return { value: null, error: 'Informe um valor válido em reais ou deixe o campo vazio para evento gratuito.' };
        }

        return { value: number, error: null };
    }

    function resumo(text, limit = 130) {
        const clean = String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return clean.length <= limit ? clean : `${clean.slice(0, limit).trim()}...`;
    }

    function renderNoPermission(message) {
        AdminUI.setPage('eventos');
        AdminUI.setContent(`
            <div class="admin-empty-state empty-state">
                <i class="fas fa-lock"></i>
                <h3>Acesso restrito</h3>
                <p>${AdminCore.escapeHTML(message)}</p>
            </div>
        `);
    }

    async function generateUniqueSlug(baseValue, currentId = null) {
        const client = AdminCore.getClient();
        const base = AdminCore.slugify(baseValue) || 'evento';
        let candidate = base;
        let suffix = 0;

        while (true) {
            let query = client.from('eventos').select('id').eq('slug', candidate).limit(1);
            if (currentId) query = query.neq('id', currentId);
            const { data, error } = await query;
            if (error) throw error;
            if (!data || !data.length) return candidate;
            suffix += 1;
            candidate = `${base}-${Date.now().toString().slice(-4)}${suffix > 1 ? '-' + suffix : ''}`;
        }
    }

    function renderCard(item) {
        const previewUrl = item.slug ? `../evento.html?slug=${encodeURIComponent(item.slug)}` : '';

        return `
            <article class="admin-catalog-card">
                <div class="admin-catalog-media">
                    ${
                        item.imagem_banner_url
                            ? `<img src="${AdminCore.escapeHTML(item.imagem_banner_url)}" alt="${AdminCore.escapeHTML(item.nome || 'Evento')}" loading="lazy">`
                            : `<div class="admin-catalog-placeholder"><i class="fas fa-calendar-days"></i></div>`
                    }
                </div>

                <div class="admin-catalog-body">
                    <div class="admin-catalog-top">
                        <span class="admin-catalog-badge">${AdminCore.escapeHTML(item.classificacao || 'Evento')}</span>
                        ${AdminUI.statusBadge(item.status || 'rascunho')}
                    </div>

                    <h3>${AdminCore.escapeHTML(item.nome || 'Evento sem nome')}</h3>
                    <p>${AdminCore.escapeHTML(resumo(item.descricao || ''))}</p>

                    <div class="admin-catalog-meta">
                        <span><i class="fas fa-clock"></i>${AdminCore.escapeHTML(AdminCore.formatDateTime(item.data_inicio))}</span>
                        <span><i class="fas fa-location-dot"></i>${AdminCore.escapeHTML(item.cidade || item.bairro || 'Local não informado')}</span>
                        <span><i class="fas fa-user"></i>${AdminCore.escapeHTML(item.realizador || item.responsavel || 'Realizador não informado')}</span>
                        <span><i class="fas fa-star"></i>${item.destaque ? 'Destaque' : 'Normal'}</span>
                    </div>

                    <div class="admin-catalog-actions">
                        ${previewUrl ? `<a class="btn-icon" href="${AdminCore.escapeHTML(previewUrl)}" target="_blank" title="Visualizar evento"><i class="fas fa-eye"></i></a>` : ''}
                        ${canEditEvento(item) ? `<button class="btn-icon btn-edit-evento" type="button" title="Editar evento" data-id="${AdminCore.escapeHTML(item.id)}"><i class="fas fa-pen"></i></button>` : ''}
                        ${canDeleteEvento(item) ? `<button class="btn-icon btn-delete-evento" type="button" title="Excluir evento" data-id="${AdminCore.escapeHTML(item.id)}"><i class="fas fa-trash"></i></button>` : ''}
                    </div>
                </div>
            </article>
        `;
    }

    async function load() {
        AdminUI.setPage('eventos');
        AdminUI.renderLoading('Carregando eventos...');

        const client = AdminCore.getClient();

        try {
            if (isColunista() && !isAdmin()) {
                renderNoPermission('Seu perfil de colunista não possui acesso ao módulo Eventos.');
                return;
            }

            let query = client
                .from('eventos')
                .select(`
                    id,
                    criado_por_usuario_id,
                    bairro,
                    cidade,
                    classificacao,
                    data_fim,
                    data_inicio,
                    descricao,
                    destaque,
                    endereco_id,
                    endereco_texto,
                    imagem_banner_path,
                    imagem_banner_url,
                    latitude,
                    longitude,
                    nome,
                    realizador,
                    responsavel,
                    slug,
                    status,
                    valor,
                    created_at,
                    updated_at
                `)
                .order('data_inicio', { ascending: true, nullsFirst: false });

            if (isComerciante() && !isAdmin()) {
                query = query.eq('criado_por_usuario_id', AdminCore.state.currentUser?.id);
            }

            const { data, error } = await query;
            if (error) throw error;

            eventosCache = data || [];

            AdminUI.setContent(`
                <div class="section-header">
                    <div>
                        <h3>Eventos</h3>
                        <p>${isAdmin() ? 'Gerencie todos os eventos cadastrados no portal.' : 'Gerencie os eventos cadastrados pela sua conta.'}</p>
                    </div>

                    ${canCreateEvento() ? `<button class="btn-primary" type="button" id="newEventoBtn"><i class="fas fa-plus"></i>Novo evento</button>` : ''}
                </div>

                <div class="permission-card" style="margin-bottom:18px;">
                    ${isAdmin() ? 'Administrador visualiza, cria, edita e remove eventos.' : 'Comerciante gerencia apenas os eventos criados por sua conta.'}
                </div>

                ${eventosCache.length ? `<div class="admin-catalog-grid">${eventosCache.map(renderCard).join('')}</div>` : AdminUI.emptyState('fa-calendar-days', 'Nenhum evento cadastrado.')}
            `);

            bindButtons();
        } catch (error) {
            console.error('[ADMIN EVENTOS]', error);
            AdminUI.renderError(error.message || 'Erro ao carregar eventos.');
        }
    }

    function bindButtons() {
        document.getElementById('newEventoBtn')?.addEventListener('click', () => openModal());
        document.querySelectorAll('.btn-edit-evento').forEach((button) => button.addEventListener('click', () => openModal(button.dataset.id)));
        document.querySelectorAll('.btn-delete-evento').forEach((button) => button.addEventListener('click', () => remove(button.dataset.id)));
    }

    async function openModal(eventoId = null) {
        const isEditing = Boolean(eventoId);
        const evento = isEditing ? eventosCache.find((item) => item.id === eventoId) : null;

        if (isEditing && !evento) {
            AdminUI.renderToast('Evento não encontrado.', 'error');
            return;
        }

        if (isEditing && !canEditEvento(evento)) {
            AdminUI.renderToast('Você não possui permissão para editar este evento.', 'error');
            return;
        }

        if (!isEditing && !canCreateEvento()) {
            AdminUI.renderToast('Você não possui permissão para criar eventos.', 'error');
            return;
        }

        const previewLink = evento?.slug ? `../evento.html?slug=${encodeURIComponent(evento.slug)}` : '';

        AdminUI.createModal({
            id: 'eventoModal',
            formId: 'eventoForm',
            title: isEditing ? 'Editar evento' : 'Novo evento',
            subtitle: isEditing ? evento.nome : 'Preencha as informações do evento regional.',
            submitLabel: 'Salvar evento',
            body: `
                <div class="admin-form-grid two">
                    ${previewLink ? `<div class="admin-form-group full"><a class="btn-primary" href="${AdminCore.escapeHTML(previewLink)}" target="_blank"><i class="fas fa-eye"></i>Visualizar evento</a></div>` : ''}

                    <div class="admin-form-group full">
                        <label>Banner do evento</label>
                        <input type="file" id="eventoImagemBanner" accept="image/*">
                        <div id="eventoImagemPreview">${AdminStorage.existingImagePreview(evento?.imagem_banner_url)}</div>
                    </div>

                    <div class="admin-form-group full">
                        <label>Nome do evento</label>
                        <input type="text" id="eventoNome" value="${AdminCore.escapeHTML(evento?.nome || '')}" placeholder="Nome do evento" required>
                    </div>

                    <div class="admin-form-group">
                        <label>Slug automático</label>
                        <input type="text" id="eventoSlug" value="${AdminCore.escapeHTML(evento?.slug || '')}" placeholder="gerado-automaticamente" readonly>
                    </div>

                    <div class="admin-form-group">
                        <label>Status</label>
                        <select id="eventoStatus" required>
                            <option value="rascunho" ${AdminCore.normalize(evento?.status || 'rascunho') === 'rascunho' ? 'selected' : ''}>Rascunho</option>
                            <option value="publicado" ${AdminCore.normalize(evento?.status) === 'publicado' ? 'selected' : ''}>Publicado</option>
                        </select>
                    </div>

                    <div class="admin-form-group">
                        <label>Classificação</label>
                        <input type="text" id="eventoClassificacao" value="${AdminCore.escapeHTML(evento?.classificacao || '')}" placeholder="Ex.: Cultura, Esporte, Feira...">
                    </div>

                    <div class="admin-form-group">
                        <label>Destaque</label>
                        <select id="eventoDestaque" required>
                            <option value="false" ${!evento?.destaque ? 'selected' : ''}>Não</option>
                            <option value="true" ${evento?.destaque ? 'selected' : ''}>Sim</option>
                        </select>
                    </div>

                    <div class="admin-form-group">
                        <label>Data de início</label>
                        <input type="datetime-local" id="eventoDataInicio" value="${AdminCore.escapeHTML(AdminCore.toDatetimeLocal(evento?.data_inicio))}" required>
                    </div>

                    <div class="admin-form-group">
                        <label>Data de término</label>
                        <input type="datetime-local" id="eventoDataFim" value="${AdminCore.escapeHTML(AdminCore.toDatetimeLocal(evento?.data_fim))}">
                    </div>

                    <div class="admin-form-group">
                        <label>Cidade</label>
                        <input type="text" id="eventoCidade" value="${AdminCore.escapeHTML(evento?.cidade || '')}" placeholder="Ex.: Valparaíso de Goiás">
                    </div>

                    <div class="admin-form-group">
                        <label>Bairro</label>
                        <input type="text" id="eventoBairro" value="${AdminCore.escapeHTML(evento?.bairro || '')}" placeholder="Bairro">
                    </div>

                    <div class="admin-form-group full">
                        <label>Endereço</label>
                        <input type="text" id="eventoEnderecoTexto" value="${AdminCore.escapeHTML(evento?.endereco_texto || '')}" placeholder="Endereço completo">
                    </div>

                    <div class="admin-form-group">
                        <label>Realizador</label>
                        <input type="text" id="eventoRealizador" value="${AdminCore.escapeHTML(evento?.realizador || '')}" placeholder="Quem realiza o evento">
                    </div>

                    <div class="admin-form-group">
                        <label>Responsável</label>
                        <input type="text" id="eventoResponsavel" value="${AdminCore.escapeHTML(evento?.responsavel || '')}" placeholder="Contato responsável">
                    </div>

                    <div class="admin-form-group">
                        <label>Valor em reais</label>
                        <input type="text" id="eventoValor" inputmode="decimal" value="${AdminCore.escapeHTML(evento?.valor ?? '')}" placeholder="Deixe vazio se for gratuito. Ex.: 20,00">
                    </div>

                    <div class="admin-form-group">
                        <label>Latitude</label>
                        <input type="text" id="eventoLatitude" value="${evento?.latitude ?? ''}" placeholder="-16.0650000">
                    </div>

                    <div class="admin-form-group">
                        <label>Longitude</label>
                        <input type="text" id="eventoLongitude" value="${evento?.longitude ?? ''}" placeholder="-47.9750000">
                    </div>

                    <div class="admin-form-group full">
                        <label>Descrição</label>
                        ${AdminEditor.createEditorHTML('eventoDescricao', evento?.descricao || '', 'eventos/descricao')}
                    </div>
                </div>
            `,
            afterOpen: () => {
                AdminEditor.initEditor('eventoDescricao');
                const nomeInput = document.getElementById('eventoNome');
                const slugInput = document.getElementById('eventoSlug');
                nomeInput?.addEventListener('input', () => {
                    if (!isEditing) slugInput.value = AdminCore.slugify(nomeInput.value) || '';
                });
                document.getElementById('eventoImagemBanner')?.addEventListener('change', () => AdminStorage.previewFile('eventoImagemBanner', 'eventoImagemPreview'));
            },
            onSubmit: async () => save(eventoId)
        });
    }

    async function save(eventoId = null) {
        const client = AdminCore.getClient();
        const existing = eventoId ? eventosCache.find((item) => item.id === eventoId) : null;

        if (eventoId && !canEditEvento(existing)) {
            AdminUI.renderToast('Você não possui permissão para salvar este evento.', 'error');
            return;
        }

        const nome = AdminCore.getInputValue('eventoNome');
        const descricao = AdminEditor.getValue('eventoDescricao');

        if (!nome) return AdminUI.renderToast('Informe o nome do evento.', 'error');
        if (!AdminCore.getInputValue('eventoDataInicio')) return AdminUI.renderToast('Informe a data de início.', 'error');
        if (!descricao) return AdminUI.renderToast('Informe a descrição do evento.', 'error');

        let geo = { latitude: null, longitude: null };
        try {
            if (window.AdminGeolocation?.validatePair) {
                geo = AdminGeolocation.validatePair(AdminCore.getInputValue('eventoLatitude'), AdminCore.getInputValue('eventoLongitude'));
            }
        } catch (error) {
            AdminUI.renderToast(error.message, 'error');
            return;
        }

        const valorResult = parseValorEvento(AdminCore.getInputValue('eventoValor'));
        if (valorResult.error) {
            AdminUI.renderToast(valorResult.error, 'error');
            return;
        }

        const slug = eventoId ? (existing?.slug || await generateUniqueSlug(nome, eventoId)) : await generateUniqueSlug(nome);

        const payload = {
            nome,
            slug,
            descricao,
            status: AdminCore.getInputValue('eventoStatus') || 'rascunho',
            destaque: AdminCore.getInputValue('eventoDestaque') === 'true',
            classificacao: AdminCore.getInputValue('eventoClassificacao'),
            data_inicio: AdminCore.getInputValue('eventoDataInicio'),
            data_fim: AdminCore.getInputValue('eventoDataFim'),
            cidade: AdminCore.getInputValue('eventoCidade'),
            bairro: AdminCore.getInputValue('eventoBairro'),
            endereco_texto: AdminCore.getInputValue('eventoEnderecoTexto'),
            realizador: AdminCore.getInputValue('eventoRealizador'),
            responsavel: AdminCore.getInputValue('eventoResponsavel'),
            valor: valorResult.value,
            latitude: geo.latitude,
            longitude: geo.longitude,
            imagem_banner_url: existing?.imagem_banner_url || null,
            imagem_banner_path: existing?.imagem_banner_path || null,
            updated_at: new Date().toISOString()
        };

        if (!eventoId) payload.criado_por_usuario_id = AdminCore.state.currentUser?.id || null;

        try {
            const uploadedImage = await AdminStorage.uploadFromInput('eventoImagemBanner', 'eventos/banners', { maxWidth: 1600, maxHeight: 1000, quality: 0.78 });
            if (uploadedImage) {
                payload.imagem_banner_url = uploadedImage.url;
                payload.imagem_banner_path = uploadedImage.path;
            }

            if (eventoId) {
                const { error } = await client.from('eventos').update(payload).eq('id', eventoId);
                if (error) throw error;
            } else {
                const { error } = await client.from('eventos').insert(payload);
                if (error) throw error;
            }

            AdminUI.closeModal('eventoModal');
            AdminUI.renderToast('Evento salvo com sucesso.');
            await load();
        } catch (error) {
            console.error('[ADMIN EVENTOS] save:', error);
            AdminUI.renderToast(error.message || 'Erro ao salvar evento.', 'error');
        }
    }

    async function remove(eventoId) {
        const client = AdminCore.getClient();
        const evento = eventosCache.find((item) => item.id === eventoId);
        if (!evento) return AdminUI.renderToast('Evento não encontrado.', 'error');
        if (!canDeleteEvento(evento)) return AdminUI.renderToast('Você não possui permissão para excluir este evento.', 'error');
        if (!confirm(`Excluir o evento "${evento.nome}"?`)) return;

        try {
            const { error } = await client.from('eventos').delete().eq('id', eventoId);
            if (error) throw error;
            AdminUI.renderToast('Evento excluído.');
            await load();
        } catch (error) {
            console.error('[ADMIN EVENTOS] remove:', error);
            AdminUI.renderToast(error.message || 'Erro ao excluir evento.', 'error');
        }
    }

    window.AdminEventos = { init: load, load };
})();
