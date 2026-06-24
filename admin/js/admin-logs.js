// admin/js/admin-logs.js

(function () {
    'use strict';

    let logsCache = [];

    function isAdmin() {
        return typeof AdminCore?.isAdmin === 'function' && AdminCore.isAdmin();
    }

    function esc(value) {
        return AdminCore?.escapeHTML ? AdminCore.escapeHTML(value) : String(value ?? '');
    }

    function formatDetails(details) {
        if (!details) return '-';

        try {
            if (typeof details === 'string') return details;
            return JSON.stringify(details, null, 2);
        } catch {
            return String(details);
        }
    }

    function actionLabel(action) {
        const map = {
            login_admin: 'Entrada no painel',
            logout_admin: 'Saída do painel',
            usuario_update: 'Usuário atualizado',
            usuario_status: 'Status de usuário',
            usuario_delete: 'Usuário excluído',
            convite_create: 'Convite criado',
            convite_delete: 'Convite excluído',
            publicacao_save: 'Publicação salva',
            evento_save: 'Evento salvo',
            negocio_save: 'Parceiro salvo',
            colunista_save: 'Colunista salvo'
        };

        return map[action] || action || 'Evento do sistema';
    }

    async function load() {
        AdminUI.setPage('logs');
        AdminUI.renderLoading('Carregando logs de segurança...');

        try {
            if (!isAdmin()) {
                AdminUI.setContent(`
                    <div class="admin-empty-state">
                        <i class="fas fa-lock"></i>
                        <h3>Acesso restrito</h3>
                        <p>Somente administradores podem acessar os logs de segurança.</p>
                    </div>
                `);
                return;
            }

            const { data, error } = await AdminCore.getClient()
                .from('logs_sistema')
                .select('id, usuario_id, usuario_nome, usuario_email, acao, modulo, detalhes, pagina, ip, user_agent, created_at')
                .order('created_at', { ascending: false })
                .limit(300);

            if (error) throw error;

            logsCache = data || [];

            AdminUI.setContent(`
                <div class="section-header">
                    <div>
                        <h3>Logs de Segurança</h3>
                        <p>Registro de acessos, alterações e eventos sensíveis do painel para consulta administrativa e jurídica.</p>
                    </div>

                    <button class="btn-primary" type="button" id="refreshLogsBtn">
                        <i class="fas fa-rotate"></i>
                        Atualizar
                    </button>
                </div>

                <div class="permission-card" style="margin-bottom:18px;">
                    Os logs são administrativos. Use para auditoria interna, suporte, segurança e eventuais solicitações jurídicas.
                </div>

                ${logsCache.length ? renderTable() : AdminUI.emptyState('fa-shield-halved', 'Nenhum log registrado ainda.')}
            `);

            document.getElementById('refreshLogsBtn')?.addEventListener('click', load);

        } catch (error) {
            console.error('[ADMIN LOGS]', error);
            AdminUI.renderError(error.message || 'Erro ao carregar logs de segurança.');
        }
    }

    function renderTable() {
        return `
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Ação</th>
                            <th>Usuário</th>
                            <th>Página</th>
                            <th>Detalhes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logsCache.map((item) => `
                            <tr>
                                <td>${esc(AdminCore.formatDateTime(item.created_at))}</td>
                                <td>
                                    <strong>${esc(actionLabel(item.acao))}</strong>
                                    <br>
                                    <small>${esc(item.modulo || '-')}</small>
                                </td>
                                <td>
                                    ${esc(item.usuario_nome || 'Sistema')}
                                    <br>
                                    <small>${esc(item.usuario_email || item.usuario_id || '-')}</small>
                                </td>
                                <td><small>${esc(item.pagina || '-')}</small></td>
                                <td>
                                    <pre style="white-space:pre-wrap;max-width:360px;margin:0;font-size:.78rem;">${esc(formatDetails(item.detalhes))}</pre>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    window.AdminLogs = {
        init: load,
        load
    };
})();
