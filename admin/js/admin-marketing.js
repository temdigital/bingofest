// admin/js/admin-marketing.js

(function () {
    'use strict';

    const TABLE_NAME = 'publicidades';
    const BUCKET_FOLDER = 'publicidades';

    const POSICOES = [
        ['topo', 'Topo do site — aparece abaixo do menu público. Recomendado: 1200×300 desktop e 320×100 mobile.'],
        ['home', 'Home — aparece no bloco principal de publicidade da página inicial. Recomendado: 1200×300 desktop e 320×100 mobile.'],
        ['home_meio', 'Meio da home — aparece entre Empresas Parceiras e Nossa Missão. Recomendado: 1200×300 desktop e 320×100 mobile.'],
        ['entre_cards', 'Entre cards/listagens — aparece entre blocos de publicações, eventos ou parceiros. Recomendado: 1080×260.'],
        ['lateral_desktop', 'Lateral desktop — aparece apenas em áreas laterais no computador. Recomendado: 300×600.'],
        ['rodape', 'Rodapé — aparece acima do rodapé institucional, sem sobrepor o footer. Recomendado: 1200×300 desktop e 320×100 mobile.'],
        ['comunidade_feed', 'Feed da comunidade — aparece no fluxo da Comunidade. Recomendado: 1080×260.'],
        ['publicacoes_feed', 'Feed de publicações — aparece na listagem de Publicações. Recomendado: 1080×260.'],
        ['eventos_feed', 'Feed de eventos — aparece na listagem de Eventos. Recomendado: 1080×260.'],
        ['parceiros_feed', 'Feed de parceiros — aparece na listagem de Parceiros. Recomendado: 1080×260.']
    ];

    let campanhas = [];

    function client() {
        return AdminCore.getClient();
    }

    function isAdmin() {
        return typeof AdminCore.isAdmin === 'function'
            ? AdminCore.isAdmin()
            : (AdminCore.state.currentRoles || []).includes('admin');
    }

    function formatDateTime(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function toDatetimeLocal(value) {
        if (!value) return '';

        if (typeof AdminCore.toDatetimeLocal === 'function') {
            return AdminCore.toDatetimeLocal(value) || '';
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function statusCampanha(item) {
        const now = new Date();
        const start = item.data_inicio ? new Date(item.data_inicio) : null;
        const end = item.data_fim ? new Date(item.data_fim) : null;

        if (!item.ativo) return 'inativo';
        if (start && start > now) return 'agendado';
        if (end && end < now) return 'encerrado';
        return 'ativo';
    }

    function getPositionLabel(value) {
        return POSICOES.find(([key]) => key === value)?.[1] || value || '-';
    }

    function isVideoUrl(url) {
        return /\.mp4(\?|#|$)/i.test(String(url || ''));
    }

    function mediaPreview(item) {
        const title = AdminCore.escapeHTML(item.titulo || 'Publicidade');

        if (item.tipo_midia === 'youtube') {
            return `
                <div class="admin-catalog-placeholder marketing-youtube-preview">
                    <i class="fab fa-youtube"></i>
                </div>
            `;
        }

        if (item.tipo_midia === 'video' || isVideoUrl(item.midia_url)) {
            return item.midia_url
                ? `
                    <video
                        src="${AdminCore.escapeHTML(item.midia_url)}"
                        muted
                        playsinline
                        controls
                    ></video>
                `
                : `
                    <div class="admin-catalog-placeholder">
                        <i class="fas fa-video"></i>
                    </div>
                `;
        }

        if (item.midia_url) {
            return `
                <img
                    src="${AdminCore.escapeHTML(item.midia_url)}"
                    alt="${title}"
                    loading="lazy"
                >
            `;
        }

        return `
            <div class="admin-catalog-placeholder">
                <i class="fas fa-rectangle-ad"></i>
            </div>
        `;
    }

    function renderCard(item) {
        const status = statusCampanha(item);

        return `
            <article class="admin-catalog-card marketing-card">
                <div class="admin-catalog-media marketing-media-admin">
                    ${mediaPreview(item)}
                </div>

                <div class="admin-catalog-body">
                    <div class="admin-catalog-top">
                        <span class="admin-catalog-badge">
                            ${AdminCore.escapeHTML(getPositionLabel(item.posicao))}
                        </span>

                        ${AdminUI.statusBadge(status)}
                    </div>

                    <h3>${AdminCore.escapeHTML(item.titulo || 'Publicidade sem título')}</h3>

                    <p>${AdminCore.escapeHTML(item.anunciante || 'Anunciante não informado')}</p>

                    <div class="admin-catalog-meta">
                        <span>
                            <i class="fas fa-calendar"></i>
                            ${AdminCore.escapeHTML(formatDateTime(item.data_inicio))}
                        </span>

                        <span>
                            <i class="fas fa-hourglass-end"></i>
                            ${AdminCore.escapeHTML(formatDateTime(item.data_fim))}
                        </span>

                        <span>
                            <i class="fas fa-eye"></i>
                            ${Number(item.impressoes || 0)} impressões
                        </span>

                        <span>
                            <i class="fas fa-computer-mouse"></i>
                            ${Number(item.cliques || 0)} cliques
                        </span>
                    </div>

                    <div class="admin-catalog-actions">
                        ${item.link_destino ? `
                            <a
                                class="btn-icon"
                                href="${AdminCore.escapeHTML(item.link_destino)}"
                                target="_blank"
                                rel="noopener"
                                title="Abrir link"
                            >
                                <i class="fas fa-up-right-from-square"></i>
                            </a>
                        ` : ''}

                        <button
                            class="btn-icon btn-edit-marketing"
                            type="button"
                            title="Editar publicidade"
                            data-id="${AdminCore.escapeHTML(item.id)}"
                        >
                            <i class="fas fa-pen"></i>
                        </button>

                        <button
                            class="btn-icon btn-delete-marketing"
                            type="button"
                            title="Excluir publicidade"
                            data-id="${AdminCore.escapeHTML(item.id)}"
                        >
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    async function load() {
        AdminUI.setPage('publicidade');
        AdminUI.renderLoading('Carregando publicidade...');

        try {
            if (!isAdmin()) {
                AdminUI.setContent(`
                    <div class="admin-empty-state">
                        <i class="fas fa-lock"></i>
                        <h3>Acesso restrito</h3>
                        <p>Somente administradores podem gerenciar publicidade.</p>
                    </div>
                `);
                return;
            }

            const { data, error } = await client()
                .from(TABLE_NAME)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            campanhas = data || [];

            AdminUI.setContent(`
                <div class="section-header">
                    <div>
                        <h3>Publicidade</h3>
                        <p>Cadastre anúncios responsivos com imagem, vídeo, YouTube, link, período e contagem de cliques.</p>
                    </div>

                    <button id="newMarketingBtn" class="btn-primary" type="button">
                        <i class="fas fa-plus"></i>
                        Novo anúncio
                    </button>
                </div>

                <div class="permission-card" style="margin-bottom:18px;">
                    <strong>Posições validadas no Sprint 4:</strong> Meio da home aparece entre Empresas Parceiras e Nossa Missão.<br>
                    Topo/Rodapé/Home: 1200×300 no desktop e 320×100 no mobile. Entre cards: 1080×260. Lateral desktop: 300×600.<br>
                    Use JPG, PNG, WEBP, MP4 ou link do YouTube.<br>
                    <strong>Prioridade:</strong> quando houver mais de um anúncio na mesma posição, aparece o anúncio ativo com maior prioridade; em empate, aparece o mais recente.
                </div>

                ${campanhas.length
                    ? `<div class="admin-catalog-grid">${campanhas.map(renderCard).join('')}</div>`
                    : AdminUI.emptyState('fa-rectangle-ad', 'Nenhuma publicidade cadastrada.')}
            `);

            bind();

        } catch (error) {
            console.error('[ADMIN MARKETING]', error);
            AdminUI.renderError(error.message || 'Erro ao carregar publicidade.');
        }
    }

    function bind() {
        document.getElementById('newMarketingBtn')?.addEventListener('click', () => openModal());

        document.querySelectorAll('.btn-edit-marketing').forEach((button) => {
            button.addEventListener('click', () => openModal(button.dataset.id));
        });

        document.querySelectorAll('.btn-delete-marketing').forEach((button) => {
            button.addEventListener('click', () => remove(button.dataset.id));
        });
    }

    function positionOptions(currentValue) {
        return POSICOES.map(([value, label]) => `
            <option value="${value}" ${currentValue === value ? 'selected' : ''}>
                ${AdminCore.escapeHTML(label)}
            </option>
        `).join('');
    }

    function openModal(id = null) {
        const item = id ? campanhas.find((entry) => entry.id === id) : null;

        AdminUI.createModal({
            id: 'marketingModal',
            formId: 'marketingForm',
            title: id ? 'Editar anúncio' : 'Novo anúncio',
            subtitle: 'Publicidade responsiva do portal.',
            submitLabel: 'Salvar anúncio',
            body: `
                <div class="admin-form-grid two">
                    <div class="admin-form-group full">
                        <label>Título</label>
                        <input
                            id="marketingTitulo"
                            type="text"
                            value="${AdminCore.escapeHTML(item?.titulo || '')}"
                            placeholder="Ex.: Campanha Dia dos Namorados"
                            required
                        >
                    </div>

                    <div class="admin-form-group">
                        <label>Anunciante</label>
                        <input
                            id="marketingAnunciante"
                            type="text"
                            value="${AdminCore.escapeHTML(item?.anunciante || '')}"
                            placeholder="Nome do anunciante"
                        >
                    </div>

                    <div class="admin-form-group">
                        <label>Posição</label>
                        <select id="marketingPosicao" required>
                            <option value="">Selecione...</option>
                            ${positionOptions(item?.posicao)}
                        </select>
                    </div>

                    <div class="admin-form-group">
                        <label>Tipo de mídia</label>
                        <select id="marketingTipo" required>
                            <option value="imagem" ${item?.tipo_midia === 'imagem' || !item?.tipo_midia ? 'selected' : ''}>Imagem</option>
                            <option value="video" ${item?.tipo_midia === 'video' ? 'selected' : ''}>Vídeo MP4</option>
                            <option value="youtube" ${item?.tipo_midia === 'youtube' ? 'selected' : ''}>YouTube</option>
                        </select>
                    </div>

                    <div class="admin-form-group">
                        <label>Prioridade <small>(ordem de exibição)</small></label>
                        <input
                            id="marketingPrioridade"
                            type="number"
                            value="${Number(item?.prioridade || 1)}"
                            min="1"
                        >
                        <small>Use 1 como padrão. Quanto maior o número, maior a chance de aparecer quando houver vários anúncios na mesma posição.</small>
                    </div>

                    <div class="admin-form-group full">
                        <label>Arquivo JPG, PNG, WEBP ou MP4</label>
                        <input
                            id="marketingArquivo"
                            type="file"
                            accept="image/jpeg,image/png,image/webp,video/mp4"
                        >
                        <div id="marketingPreview">
                            ${item?.midia_url ? AdminStorage.existingImagePreview(item.midia_url) : ''}
                        </div>
                    </div>

                    <div class="admin-form-group full">
                        <label>URL do YouTube</label>
                        <input
                            id="marketingYoutube"
                            type="url"
                            value="${AdminCore.escapeHTML(item?.youtube_url || '')}"
                            placeholder="https://www.youtube.com/watch?v=..."
                        >
                    </div>

                    <div class="admin-form-group full">
                        <label>Link de destino ao clicar</label>
                        <input
                            id="marketingLink"
                            type="url"
                            value="${AdminCore.escapeHTML(item?.link_destino || '')}"
                            placeholder="https://..."
                        >
                    </div>

                    <div class="admin-form-group">
                        <label>Início</label>
                        <input
                            id="marketingInicio"
                            type="datetime-local"
                            value="${toDatetimeLocal(item?.data_inicio)}"
                            required
                        >
                    </div>

                    <div class="admin-form-group">
                        <label>Fim</label>
                        <input
                            id="marketingFim"
                            type="datetime-local"
                            value="${toDatetimeLocal(item?.data_fim)}"
                        >
                    </div>

                    <div class="admin-form-group">
                        <label>Ativo</label>
                        <select id="marketingAtivo">
                            <option value="true" ${item?.ativo !== false ? 'selected' : ''}>Sim</option>
                            <option value="false" ${item?.ativo === false ? 'selected' : ''}>Não</option>
                        </select>
                    </div>

                    <div class="admin-form-group full">
                        <label>Texto alternativo</label>
                        <input
                            id="marketingAlt"
                            type="text"
                            value="${AdminCore.escapeHTML(item?.texto_alt || '')}"
                            placeholder="Descrição curta para acessibilidade"
                        >
                    </div>
                </div>
            `,
            afterOpen: () => {
                document.getElementById('marketingArquivo')?.addEventListener('change', () => {
                    AdminStorage.previewFile('marketingArquivo', 'marketingPreview');
                });
            },
            onSubmit: async () => save(id)
        });
    }

    async function save(id = null) {
        try {
            const existing = id ? campanhas.find((entry) => entry.id === id) : null;

            const titulo = AdminCore.getInputValue('marketingTitulo');
            const posicao = AdminCore.getInputValue('marketingPosicao');
            const inicio = AdminCore.getInputValue('marketingInicio');
            const fim = AdminCore.getInputValue('marketingFim');
            const tipo = AdminCore.getInputValue('marketingTipo') || 'imagem';

            if (!titulo || !posicao || !inicio) {
                AdminUI.renderToast('Informe título, posição e data de início.', 'error');
                return;
            }

            if (fim && new Date(fim) < new Date(inicio)) {
                AdminUI.renderToast('A data final não pode ser anterior à data inicial.', 'error');
                return;
            }

            const uploaded = await AdminStorage.uploadFromInput('marketingArquivo', BUCKET_FOLDER);

            const payload = {
                titulo,
                anunciante: AdminCore.getInputValue('marketingAnunciante'),
                posicao,
                tipo_midia: tipo,
                midia_url: uploaded?.url || existing?.midia_url || null,
                midia_path: uploaded?.path || existing?.midia_path || null,
                youtube_url: AdminCore.getInputValue('marketingYoutube'),
                link_destino: AdminCore.getInputValue('marketingLink'),
                texto_alt: AdminCore.getInputValue('marketingAlt'),
                data_inicio: inicio,
                data_fim: fim || null,
                ativo: AdminCore.getInputValue('marketingAtivo') === 'true',
                prioridade: Number(AdminCore.getInputValue('marketingPrioridade') || 1),
                updated_at: new Date().toISOString()
            };

            if (id) {
                const { error } = await client()
                    .from(TABLE_NAME)
                    .update(payload)
                    .eq('id', id);

                if (error) throw error;
            } else {
                payload.created_by = AdminCore.state.currentUser?.id || null;

                const { error } = await client()
                    .from(TABLE_NAME)
                    .insert(payload);

                if (error) throw error;
            }

            AdminUI.closeModal('marketingModal');
            AdminUI.renderToast('Publicidade salva com sucesso.');
            await load();

        } catch (error) {
            console.error('[ADMIN MARKETING] save:', error);
            AdminUI.renderToast(error.message || 'Erro ao salvar publicidade.', 'error');
        }
    }

    async function remove(id) {
        const item = campanhas.find((entry) => entry.id === id);
        if (!item) return;

        if (!confirm(`Excluir o anúncio "${item.titulo}"?`)) return;

        try {
            const { error } = await client()
                .from(TABLE_NAME)
                .delete()
                .eq('id', id);

            if (error) throw error;

            AdminUI.renderToast('Anúncio removido.');
            await load();

        } catch (error) {
            console.error('[ADMIN MARKETING] remove:', error);
            AdminUI.renderToast(error.message || 'Erro ao excluir publicidade.', 'error');
        }
    }

    window.AdminMarketing = {
        init: load,
        load
    };

    window.AdminPublicidade = window.AdminMarketing;
})();
