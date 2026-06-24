// admin/js/admin-remocoes.js

(function () {
    'use strict';

    let items = [];
    let currentStatus = 'todos';

    function db() {
        return AdminCore.getClient();
    }

    function esc(value) {
        return AdminCore.escapeHTML(value);
    }

    function normalizeStatus(value) {
        return AdminCore.normalize(value || 'pendente');
    }

    function statusLabel(status) {
        const map = {
            pendente: 'Pendente',
            em_analise: 'Em análise',
            respondido: 'Respondido',
            arquivado: 'Arquivado'
        };
        return map[normalizeStatus(status)] || status || 'Pendente';
    }

    function tipoLabel(tipo) {
        const map = {
            perfil: 'Perfil / cadastro',
            publicacao: 'Publicação / conteúdo',
            outro: 'Outro pedido'
        };
        return map[AdminCore.normalize(tipo)] || tipo || 'Pedido';
    }

    function whatsappLink(item, resposta = null) {
        let digits = String(item.whatsapp || '').replace(/\D/g, '');
        if (!digits) return '#';
        if (!digits.startsWith('55')) digits = `55${digits}`;

        const texto = resposta || item.resposta || `Olá, ${item.nome}. Aqui é o Portal Tem no Entorno Sul. Recebemos sua solicitação de remoção nº ${item.numero} e estamos analisando seu pedido. Em breve retornaremos por este canal.`;
        return `https://wa.me/${digits}?text=${encodeURIComponent(texto)}`;
    }

    async function load() {
        AdminUI.setPage('remocoes');
        AdminUI.renderLoading('Carregando solicitações de remoção...');

        try {
            if (!AdminCore.isAdmin()) {
                AdminUI.setContent(`
                    <div class="admin-empty-state">
                        <i class="fas fa-lock"></i>
                        <h3>Acesso restrito</h3>
                        <p>Somente administradores podem consultar solicitações de remoção.</p>
                    </div>
                `);
                return;
            }

            const { data, error } = await db()
                .from('solicitacoes_remocao')
                .select('*')
                .order('numero', { ascending: true });

            if (error) throw error;

            items = data || [];
            render();
        } catch (error) {
            console.error('[ADMIN REMOÇÕES]', error);
            AdminUI.renderError(error.message || 'Erro ao carregar solicitações de remoção.');
        }
    }

    function filteredItems() {
        if (currentStatus === 'todos') return items;
        return items.filter((item) => normalizeStatus(item.status) === currentStatus);
    }

    function stats() {
        return {
            total: items.length,
            pendente: items.filter((i) => normalizeStatus(i.status) === 'pendente').length,
            emAnalise: items.filter((i) => normalizeStatus(i.status) === 'em_analise').length,
            respondido: items.filter((i) => normalizeStatus(i.status) === 'respondido').length
        };
    }

    function render() {
        const s = stats();
        const list = filteredItems();

        AdminUI.setContent(`
            <div class="section-header">
                <div>
                    <h3>Solicitações de Remoção</h3>
                    <p>Atendimento administrativo de pedidos de remoção, correção ou revisão. Organização por PEPS: primeiro que entra, primeiro que sai.</p>
                </div>
                <button class="btn-primary" type="button" id="refreshRemovalBtn">
                    <i class="fas fa-rotate"></i> Atualizar
                </button>
            </div>

            <div class="permission-card" style="margin-bottom:18px;">
                Siga a numeração crescente para evitar prejuízo ao solicitante. As respostas podem ser registradas no painel e enviadas pelo WhatsApp gratuito.
            </div>

            <div class="admin-stats-grid" style="margin-bottom:18px;">
                ${AdminUI.statCard('Total', s.total, 'fa-inbox')}
                ${AdminUI.statCard('Pendentes', s.pendente, 'fa-hourglass-half')}
                ${AdminUI.statCard('Em análise', s.emAnalise, 'fa-magnifying-glass')}
                ${AdminUI.statCard('Respondidas', s.respondido, 'fa-circle-check')}
            </div>

            <div class="filter-bar" style="margin-bottom:18px;display:flex;gap:12px;flex-wrap:wrap;align-items:end;">
                <div class="admin-form-group" style="min-width:220px;">
                    <label>Status</label>
                    <select id="removalStatusFilter">
                        <option value="todos">Todos</option>
                        <option value="pendente">Pendentes</option>
                        <option value="em_analise">Em análise</option>
                        <option value="respondido">Respondidas</option>
                        <option value="arquivado">Arquivadas</option>
                    </select>
                </div>
            </div>

            ${list.length ? `<div class="admin-card-grid">${list.map(renderCard).join('')}</div>` : AdminUI.emptyState('fa-user-shield', 'Nenhuma solicitação encontrada para este filtro.')}
        `);

        const filter = document.getElementById('removalStatusFilter');
        if (filter) {
            filter.value = currentStatus;
            filter.addEventListener('change', () => {
                currentStatus = filter.value;
                render();
            });
        }

        document.getElementById('refreshRemovalBtn')?.addEventListener('click', load);
        document.querySelectorAll('[data-removal-action]').forEach((button) => {
            button.addEventListener('click', () => handleAction(button.dataset.removalAction, button.dataset.id));
        });
    }

    function renderCard(item) {
        const status = normalizeStatus(item.status);
        const hasResponse = Boolean(String(item.resposta || '').trim());
        const responseSent = Boolean(item.resposta_whatsapp_enviada) || status === 'respondido';

        return `
            <article class="admin-card">
                <div class="admin-card-cover" style="min-height:96px;display:flex;align-items:center;justify-content:center;">
                    <i class="fas fa-user-shield" style="font-size:2rem;color:#216c39;"></i>
                </div>
                <div class="admin-card-body">
                    <div class="admin-card-badges">
                        <span class="status-badge status-${esc(status)}">#${esc(item.numero)}</span>
                        <span class="status-badge status-${esc(status)}">${esc(statusLabel(status))}</span>
                    </div>
                    <h3>${esc(item.nome)}</h3>
                    <p>${esc(tipoLabel(item.tipo))}</p>
                    <p><strong>E-mail:</strong> ${esc(item.email)}</p>
                    <p><strong>WhatsApp:</strong> ${esc(item.whatsapp)}</p>
                    ${item.link ? `<p><strong>Link:</strong> <a class="link-clean" href="${esc(item.link)}" target="_blank" rel="noopener">abrir conteúdo</a></p>` : ''}
                    <p><strong>Motivo:</strong> ${esc(item.motivo)}</p>
                    ${item.detalhes ? `<p><strong>Detalhes:</strong> ${esc(item.detalhes)}</p>` : ''}
                    ${item.resposta ? `<p><strong>Resposta registrada:</strong> ${esc(item.resposta)}</p>` : ''}
                    <small>Recebida em ${esc(AdminCore.formatDateTime(item.created_at))}</small>
                    <div class="user-actions" style="margin-top:14px;">
                        <button class="btn-secondary" type="button" data-removal-action="analise" data-id="${esc(item.id)}">
                            <i class="fas fa-magnifying-glass"></i> Em análise
                        </button>
                        <button class="btn-primary" type="button" data-removal-action="responder" data-id="${esc(item.id)}">
                            <i class="fas fa-reply"></i> Responder
                        </button>
                        ${hasResponse ? `<a class="btn-secondary" href="${esc(whatsappLink(item))}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> WhatsApp</a>` : ''}
                        ${hasResponse && !responseSent ? `<button class="btn-secondary" type="button" data-removal-action="confirmar_envio" data-id="${esc(item.id)}"><i class="fas fa-check"></i> Confirmar envio</button>` : ''}
                        <button class="btn-secondary" type="button" data-removal-action="arquivar" data-id="${esc(item.id)}">
                            <i class="fas fa-box-archive"></i> Arquivar
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    function getItem(id) {
        return items.find((item) => String(item.id) === String(id));
    }

    async function handleAction(action, id) {
        const item = getItem(id);
        if (!item) return;

        if (action === 'analise') {
            await updateStatus(item, 'em_analise');
            return;
        }

        if (action === 'arquivar') {
            await updateStatus(item, 'arquivado');
            return;
        }

        if (action === 'responder') {
            openResponseModal(item);
            return;
        }

        if (action === 'confirmar_envio') {
            await confirmWhatsappSent(item);
        }
    }

    async function confirmWhatsappSent(item) {
        try {
            const now = new Date().toISOString();
            const { error } = await db()
                .from('solicitacoes_remocao')
                .update({
                    status: 'respondido',
                    resposta_whatsapp_enviada: true,
                    respondido_por: AdminCore.state.currentUser?.id || null,
                    respondido_em: now,
                    updated_at: now
                })
                .eq('id', item.id);

            if (error) throw error;

            await AdminCore.logSystem('remocao_envio_confirmado', {
                numero: item.numero,
                email: item.email
            });
            AdminUI.renderToast('Envio pelo WhatsApp confirmado.');
            await load();
        } catch (error) {
            console.error('[ADMIN REMOÇÕES confirmar envio]', error);
            AdminUI.renderToast(error.message || 'Erro ao confirmar o envio.', 'error');
        }
    }

    async function updateStatus(item, status) {
        try {
            const { error } = await db()
                .from('solicitacoes_remocao')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', item.id);

            if (error) throw error;

            await AdminCore.logSystem('remocao_status', { numero: item.numero, status });
            AdminUI.renderToast('Status atualizado.');
            await load();
        } catch (error) {
            console.error('[ADMIN REMOÇÕES status]', error);
            AdminUI.renderToast(error.message || 'Erro ao atualizar status.', 'error');
        }
    }

    function openResponseModal(item) {
        const defaultText = item.resposta || `Olá, ${item.nome}. Aqui é o Portal Tem no Entorno Sul. Sobre sua solicitação de remoção nº ${item.numero}: `;

        AdminUI.createModal({
            id: 'removalResponseModal',
            title: `Responder solicitação nº ${item.numero}`,
            subtitle: 'Registre a resposta e envie pelo WhatsApp gratuito.',
            formId: 'removalResponseForm',
            submitLabel: 'Salvar resposta',
            body: `
                <div class="admin-form-grid">
                    <div class="permission-card">
                        Método PEPS: preserve a ordem de atendimento pela numeração. O botão WhatsApp abre a conversa com a resposta registrada.
                    </div>
                    <div class="admin-form-group full">
                        <label>Solicitante</label>
                        <input value="${esc(item.nome)} — ${esc(item.email)} — ${esc(item.whatsapp)}" disabled>
                    </div>
                    <div class="admin-form-group full">
                        <label>Resposta</label>
                        <textarea id="removalResponseText" required>${esc(defaultText)}</textarea>
                    </div>
                </div>
            `,
            onSubmit: async () => {
                const resposta = String(document.getElementById('removalResponseText')?.value || '').trim();

                if (!resposta) {
                    AdminUI.renderToast('Escreva a resposta antes de salvar.', 'error');
                    return;
                }

                try {
                    const { error } = await db()
                        .from('solicitacoes_remocao')
                        .update({
                            status: 'em_analise',
                            resposta,
                            resposta_whatsapp_enviada: false,
                            respondido_por: null,
                            respondido_em: null,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', item.id);

                    if (error) throw error;

                    await AdminCore.logSystem('remocao_resposta', { numero: item.numero, email: item.email });
                    AdminUI.closeModal('removalResponseModal');
                    window.open(whatsappLink(item, resposta), '_blank', 'noopener,noreferrer');
                    AdminUI.renderToast('Resposta registrada. Após enviar no WhatsApp, confirme o envio no cartão.');
                    await load();
                } catch (error) {
                    console.error('[ADMIN REMOÇÕES resposta]', error);
                    AdminUI.renderToast(error.message || 'Erro ao salvar resposta.', 'error');
                }
            }
        });
    }

    window.AdminRemocoes = {
        init: load,
        load
    };
})();
