// admin/js/admin-convites.js
(function () {
    'use strict';

    const TABLE = 'convites_portal';
    const TIPOS = {
        colunista: 'Colunista',
        comerciante: 'Comerciante',
        cliente: 'Cliente'
    };

    let convitesCache = [];
    let categoriasCache = [];
    let tiposNegocioCache = [];

    function client() {
        return AdminCore.getClient();
    }

    function esc(value) {
        return AdminCore.escapeHTML(value ?? '');
    }

    function cleanPhone(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function baseUrl() {
        return window.location.origin || 'https://www.temnoentornosul.com.br';
    }

    function inviteUrl(token) {
        return `${baseUrl()}/aceite-convite.html?token=${encodeURIComponent(token || '')}`;
    }

    function tipoLabel(tipo) {
        return TIPOS[tipo] || tipo || '-';
    }

    function generateToken() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return `convite-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    }

    function getDefaultArea(tipo) {
        const map = {
            colunista: 'conteúdo, opinião e informação regional',
            comerciante: 'negócios locais e fortalecimento do comércio regional',
            cliente: 'participação comunitária, informação regional e engajamento no portal'
        };

        return map[tipo] || 'participação no portal Tem no Entorno Sul';
    }

    function selectedAreaLabel(tipo, value) {
        if (value) return value;
        return getDefaultArea(tipo);
    }

    function buildInviteText(convite) {
        const nome = convite?.nome_convidado || '[Nome do convidado]';
        const tipo = tipoLabel(convite?.tipo_convidado).toLowerCase();
        const area = selectedAreaLabel(convite?.tipo_convidado, convite?.categoria_area);
        const indicado = convite?.indicado_por || 'um parceiro do portal';
        const token = convite?.token || '';
        const link = token ? inviteUrl(token) : '[link será gerado após salvar o convite]';
        const senha = cleanPhone(convite?.whatsapp) || '[seu WhatsApp sem máscara]';

        return `Olá, ${nome}! 👋\n\nSomos Regiane Lacerda & Éverton Lacerda, do portal *Tem no Entorno Sul* — uma plataforma criada para valorizar notícias, histórias, negócios, eventos e pessoas que movimentam o Entorno Sul de Brasília.\n\nNosso parceiro *${indicado}* indicou você para fazer parte do portal, especialmente pela sua atuação na área de *${area}*, como *${tipo}*.\n\nAcreditamos que a sua participação pode fortalecer a nossa comunidade, ampliar a visibilidade do seu trabalho e ajudar mais pessoas a encontrarem informações, oportunidades e referências confiáveis na região.\n\nPara aceitar o convite, acesse:\n${link}\n\n🔐 *Senha inicial:* ${senha}\n\nDepois do aceite, você poderá completar seu cadastro e conhecer as responsabilidades de colaboração no portal.\n\nSerá uma honra ter você conosco.\n\nAtenciosamente,\n*Regiane Lacerda & Éverton Lacerda*\nPortal *Tem no Entorno Sul*`;
    }

    function whatsappLink(convite) {
        const phone = cleanPhone(convite.whatsapp);
        const finalPhone = phone.startsWith('55') ? phone : `55${phone}`;
        const text = buildInviteText(convite);
        return `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`;
    }

    async function loadCategorias() {
        const [categoriasResult, tiposResult] = await Promise.allSettled([
            client().from('categorias').select('id,nome').order('nome', { ascending: true }),
            client().from('tipos_negocio').select('id,nome').order('nome', { ascending: true })
        ]);

        categoriasCache = categoriasResult.status === 'fulfilled' && !categoriasResult.value.error
            ? categoriasResult.value.data || []
            : [];

        tiposNegocioCache = tiposResult.status === 'fulfilled' && !tiposResult.value.error
            ? tiposResult.value.data || []
            : [];
    }

    function areaOptions(tipo, selectedValue = '') {
        let list = [];

        if (tipo === 'comerciante') {
            list = tiposNegocioCache.map((item) => item.nome);
        } else if (tipo === 'colunista') {
            list = categoriasCache.map((item) => item.nome);
        } else {
            list = [
                'Comunidade',
                'Participação regional',
                'Eventos',
                'Notícias',
                'Serviços públicos',
                'Oportunidades',
                'Outros'
            ];
        }

        const fallback = [
            'Alimentação',
            'Beleza e Estética',
            'Comércio',
            'Educação',
            'Saúde',
            'Serviços',
            'Cultura',
            'Esporte',
            'Política',
            'Segurança',
            'Eventos',
            'Outros'
        ];

        if (!list.length) list = fallback;

        if (selectedValue && !list.includes(selectedValue)) {
            list.unshift(selectedValue);
        }

        return [...new Set(list)].map((name) => `
            <option value="${esc(name)}" ${name === selectedValue ? 'selected' : ''}>
                ${esc(name)}
            </option>
        `).join('');
    }

    function statusBadge(status) {
        return AdminUI.statusBadge(status || 'pendente');
    }

    function renderCard(item) {
        return `
            <article class="admin-catalog-card">
                <div class="admin-catalog-media">
                    <div class="admin-catalog-placeholder">
                        <i class="fas fa-envelope-open-text"></i>
                    </div>
                </div>

                <div class="admin-catalog-body">
                    <div class="admin-catalog-top">
                        <span class="admin-catalog-badge">${esc(tipoLabel(item.tipo_convidado))}</span>
                        ${statusBadge(item.status)}
                    </div>

                    <h3>${esc(item.nome_convidado || 'Convidado')}</h3>
                    <p>${esc(selectedAreaLabel(item.tipo_convidado, item.categoria_area))}</p>

                    <div class="admin-catalog-meta">
                        <span><i class="fas fa-phone"></i>${esc(item.whatsapp || '-')}</span>
                        <span><i class="fas fa-user-check"></i>Indicação: ${esc(item.indicado_por || '-')}</span>
                        <span><i class="fas fa-clock"></i>Expira: ${AdminCore.formatDate(item.expires_at)}</span>
                    </div>

                    <div class="admin-catalog-actions">
                        <a class="btn-icon" href="${esc(inviteUrl(item.token))}" target="_blank" title="Abrir aceite"><i class="fas fa-link"></i></a>
                        <a class="btn-icon" href="${esc(whatsappLink(item))}" target="_blank" title="Enviar WhatsApp"><i class="fab fa-whatsapp"></i></a>
                        <button class="btn-icon btn-copy-convite" data-id="${esc(item.id)}" title="Copiar mensagem"><i class="fas fa-copy"></i></button>
                        <button class="btn-icon btn-edit-convite" data-id="${esc(item.id)}" title="Editar"><i class="fas fa-pen"></i></button>
                        <button class="btn-icon btn-delete-convite" data-id="${esc(item.id)}" title="Excluir convite"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </article>
        `;
    }

    async function load() {
        AdminUI.setPage('convites');
        AdminUI.renderLoading('Carregando convites...');

        try {
            if (!AdminCore.isAdmin()) {
                AdminUI.setContent(`
                    <div class="admin-empty-state">
                        <i class="fas fa-lock"></i>
                        <h3>Acesso restrito</h3>
                        <p>Apenas administradores podem enviar convites.</p>
                    </div>
                `);
                return;
            }

            await loadCategorias();

            const { data, error } = await client()
                .from(TABLE)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            convitesCache = data || [];

            AdminUI.setContent(`
                <div class="section-header">
                    <div>
                        <h3>Convites do Portal</h3>
                        <p>Envie convites por WhatsApp para colunistas, comerciantes e clientes.</p>
                    </div>
                    <button class="btn-primary" id="newConviteBtn" type="button">
                        <i class="fas fa-plus"></i>
                        Novo convite
                    </button>
                </div>

                <div class="permission-card" style="margin-bottom:18px;">
                    O convidado recebe um link de aceite e usa o próprio WhatsApp como senha inicial.
                </div>

                ${convitesCache.length
                    ? `<div class="admin-catalog-grid">${convitesCache.map(renderCard).join('')}</div>`
                    : AdminUI.emptyState('fa-envelope-open-text', 'Nenhum convite cadastrado.')}
            `);

            bind();
        } catch (error) {
            console.error('[ADMIN CONVITES]', error);
            AdminUI.renderError(error.message || 'Erro ao carregar convites.');
        }
    }

    function bind() {
        document.getElementById('newConviteBtn')?.addEventListener('click', () => openModal());

        document.querySelectorAll('.btn-edit-convite').forEach((button) => {
            button.addEventListener('click', () => openModal(button.dataset.id));
        });

        document.querySelectorAll('.btn-delete-convite').forEach((button) => {
            button.addEventListener('click', () => remove(button.dataset.id));
        });

        document.querySelectorAll('.btn-copy-convite').forEach((button) => {
            button.addEventListener('click', async () => {
                const item = convitesCache.find((convite) => convite.id === button.dataset.id);
                if (!item) return;
                await navigator.clipboard.writeText(buildInviteText(item));
                AdminUI.renderToast('Mensagem copiada com link de aceite.');
            });
        });
    }

    function openModal(id = null) {
        const item = id ? convitesCache.find((convite) => convite.id === id) : null;
        const currentTipo = item?.tipo_convidado || 'colunista';
        const currentArea = item?.categoria_area || '';
        const preview = item || {
            token: '',
            tipo_convidado: currentTipo,
            categoria_area: currentArea,
            nome_convidado: '',
            whatsapp: '',
            indicado_por: ''
        };

        AdminUI.createModal({
            id: 'conviteModal',
            formId: 'conviteForm',
            title: id ? 'Editar convite' : 'Novo convite',
            subtitle: 'Convite com mensagem pronta para WhatsApp.',
            submitLabel: 'Salvar convite',
            body: `
                <div class="admin-form-grid two">
                    <div class="admin-form-group">
                        <label>Tipo de convidado</label>
                        <select id="conviteTipo" required>
                            <option value="colunista" ${currentTipo === 'colunista' ? 'selected' : ''}>Colunista</option>
                            <option value="comerciante" ${currentTipo === 'comerciante' ? 'selected' : ''}>Comerciante</option>
                            <option value="cliente" ${currentTipo === 'cliente' ? 'selected' : ''}>Cliente</option>
                        </select>
                    </div>

                    <div class="admin-form-group">
                        <label>Categoria/área</label>
                        <select id="conviteArea" required>
                            <option value="">Selecione...</option>
                            ${areaOptions(currentTipo, currentArea)}
                        </select>
                    </div>

                    <div class="admin-form-group">
                        <label>Nome do convidado</label>
                        <input id="conviteNome" value="${esc(item?.nome_convidado || '')}" required>
                    </div>

                    <div class="admin-form-group">
                        <label>WhatsApp / senha inicial</label>
                        <input id="conviteWhatsapp" value="${esc(item?.whatsapp || '')}" placeholder="61999999999" required>
                    </div>

                    <div class="admin-form-group">
                        <label>E-mail</label>
                        <input type="email" id="conviteEmail" value="${esc(item?.email || '')}" placeholder="email@exemplo.com" required>
                    </div>

                    <div class="admin-form-group">
                        <label>Indicado por</label>
                        <input id="conviteIndicado" value="${esc(item?.indicado_por || '')}" placeholder="Nome do parceiro que indicou">
                    </div>

                    <div class="admin-form-group">
                        <label>Validade</label>
                        <input type="date" id="conviteExpira" value="${item?.expires_at ? new Date(item.expires_at).toISOString().slice(0, 10) : ''}">
                    </div>

                    <div class="admin-form-group full">
                        <label>Prévia do convite</label>
                        <textarea id="conviteTextoPreview" rows="14" readonly>${esc(buildInviteText(preview))}</textarea>
                    </div>

                    <div class="permission-card full">
                        A mensagem final sempre será montada automaticamente com categoria, indicação, link real de aceite e senha inicial.
                    </div>
                </div>
            `,
            afterOpen: () => {
                const tipoSelect = document.getElementById('conviteTipo');
                const areaSelect = document.getElementById('conviteArea');

                function updateAreaOptions() {
                    if (!tipoSelect || !areaSelect) return;
                    areaSelect.innerHTML = `<option value="">Selecione...</option>${areaOptions(tipoSelect.value, areaSelect.value)}`;
                }

                function updatePreview() {
                    const previewEl = document.getElementById('conviteTextoPreview');
                    if (!previewEl) return;
                    previewEl.value = buildInviteText(readForm(true));
                }

                tipoSelect?.addEventListener('change', () => {
                    updateAreaOptions();
                    updatePreview();
                });

                ['conviteArea', 'conviteNome', 'conviteWhatsapp', 'conviteEmail', 'conviteIndicado', 'conviteExpira'].forEach((field) => {
                    document.getElementById(field)?.addEventListener('input', updatePreview);
                    document.getElementById(field)?.addEventListener('change', updatePreview);
                });

                updatePreview();
            },
            onSubmit: async () => save(id)
        });
    }

    function readForm(previewOnly = false) {
        const tipo = AdminCore.getInputValue('conviteTipo') || 'cliente';
        const token = previewOnly ? '' : generateToken();

        return {
            tipo_convidado: tipo,
            categoria_area: AdminCore.getInputValue('conviteArea') || getDefaultArea(tipo),
            nome_convidado: AdminCore.getInputValue('conviteNome'),
            whatsapp: cleanPhone(AdminCore.getInputValue('conviteWhatsapp')),
            email: AdminCore.getInputValue('conviteEmail'),
            indicado_por: AdminCore.getInputValue('conviteIndicado') || 'um parceiro do portal',
            expires_at: AdminCore.getInputValue('conviteExpira') || null,
            token
        };
    }

    async function save(id = null) {
        try {
            const payload = readForm(false);

            if (!payload.tipo_convidado || !payload.categoria_area || !payload.nome_convidado || !payload.whatsapp || !payload.email) {
                AdminUI.renderToast('Informe tipo, categoria, nome, WhatsApp e e-mail.', 'error');
                return;
            }

            if (id) {
                const current = convitesCache.find((convite) => convite.id === id);
                payload.token = current?.token || generateToken();
                payload.status = current?.status || 'pendente';
                payload.convite_texto = buildInviteText(payload);
                payload.updated_at = new Date().toISOString();

                const { error } = await client()
                    .from(TABLE)
                    .update(payload)
                    .eq('id', id);

                if (error) throw error;
            } else {
                payload.status = 'pendente';
                payload.created_by = AdminCore.state.currentUser?.id || null;
                payload.convite_texto = buildInviteText(payload);

                const { error } = await client()
                    .from(TABLE)
                    .insert(payload);

                if (error) throw error;
            }

            AdminUI.closeModal('conviteModal');
            AdminUI.renderToast('Convite salvo. Use o botão WhatsApp do card salvo para enviar com o link real.');
            await load();
        } catch (error) {
            console.error('[ADMIN CONVITES] save:', error);
            AdminUI.renderToast(error.message || 'Erro ao salvar convite.', 'error');
        }
    }

    async function remove(id) {
        if (!confirm('Excluir este convite definitivamente?')) return;

        const { error } = await client()
            .from(TABLE)
            .delete()
            .eq('id', id);

        if (error) {
            AdminUI.renderToast(error.message || 'Erro ao excluir convite.', 'error');
            return;
        }

        AdminUI.renderToast('Convite excluído.');
        await load();
    }

    window.AdminConvites = {
        init: load,
        load
    };
})();
