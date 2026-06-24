// admin/js/admin-analytics.js

(function () {
    'use strict';

    const TABLES = [
        { key: 'usuarios', label: 'Usuários', icon: 'fa-users' },
        { key: 'publicacoes', label: 'Publicações', icon: 'fa-newspaper' },
        { key: 'eventos', label: 'Eventos', icon: 'fa-calendar-days' },
        { key: 'negocios', label: 'Parceiros', icon: 'fa-store' },
        { key: 'colunistas', label: 'Colunistas', icon: 'fa-user-pen' },
        { key: 'comunidade_posts', label: 'Posts comunidade', icon: 'fa-comments' },
        { key: 'comunidade_respostas', label: 'Respostas', icon: 'fa-reply' },
        { key: 'convites_portal', label: 'Convites', icon: 'fa-envelope-open-text' },
        { key: 'publicidades', label: 'Anúncios', icon: 'fa-rectangle-ad' }
    ];

    function card(item, value) {
        return `
            <div class="admin-home-card">
                <i class="fas ${item.icon}"></i>
                <strong>${Number(value || 0)}</strong>
                <span>${AdminCore.escapeHTML(item.label)}</span>
            </div>
        `;
    }

    async function countTable(table) {
        try {
            const client = AdminCore.getClient();
            const { count, error } = await client
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (error) throw error;
            return { ok: true, count: count || 0, error: null };
        } catch (error) {
            console.warn('[ADMIN ANALYTICS] count', table, error);
            return { ok: false, count: 0, error: error.message || 'Erro ao consultar.' };
        }
    }

    async function loadRecentPublicacoes() {
        const client = AdminCore.getClient();
        const { data, error } = await client
            .from('publicacoes')
            .select('id, titulo, status, destaque, published_at, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) return [];
        return data || [];
    }

    async function loadRecentEventos() {
        const client = AdminCore.getClient();
        const { data, error } = await client
            .from('eventos')
            .select('id, nome, status, destaque, data_inicio, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) return [];
        return data || [];
    }

    function renderRecentTable(title, rows, type) {
        if (!rows.length) {
            return `
                <div class="admin-health-section">
                    <h3>${AdminCore.escapeHTML(title)}</h3>
                    ${AdminUI.emptyState('fa-chart-simple', 'Sem registros recentes.')}
                </div>
            `;
        }

        return `
            <div class="admin-health-section">
                <h3>${AdminCore.escapeHTML(title)}</h3>
                <div class="table-wrap">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Título/Nome</th>
                                <th>Status</th>
                                <th>Destaque</th>
                                <th>Data</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map((item) => `
                                <tr>
                                    <td>${AdminCore.escapeHTML(type === 'evento' ? item.nome : item.titulo)}</td>
                                    <td>${AdminUI.statusBadge(item.status || 'rascunho')}</td>
                                    <td>${item.destaque ? 'Sim' : 'Não'}</td>
                                    <td>${AdminCore.escapeHTML(AdminCore.formatDate(item.published_at || item.data_inicio || item.created_at))}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    async function load() {
        AdminUI.setPage('analytics');
        AdminUI.renderLoading('Carregando analytics...');

        try {
            if (!AdminCore.isAdmin()) {
                AdminUI.setContent(`
                    <div class="admin-empty-state">
                        <i class="fas fa-lock"></i>
                        <h3>Acesso restrito</h3>
                        <p>Somente administradores podem visualizar Analytics.</p>
                    </div>
                `);
                return;
            }

            const counts = {};
            for (const table of TABLES) {
                counts[table.key] = await countTable(table.key);
            }

            const [publicacoes, eventos] = await Promise.all([
                loadRecentPublicacoes(),
                loadRecentEventos()
            ]);

            AdminUI.setContent(`
                <div class="section-header">
                    <div>
                        <h3>Analytics</h3>
                        <p>Indicadores operacionais do portal, conteúdo, comunidade e anúncios.</p>
                    </div>
                </div>

                <div class="permission-card" style="margin-bottom:18px;">
                    Esta versão consolida indicadores internos do Supabase. Métricas avançadas de visualizações, origem de tráfego e CTR podem ser conectadas em uma próxima etapa.
                </div>

                <div class="admin-stats-grid">
                    ${TABLES.map((item) => card(item, counts[item.key]?.count || 0)).join('')}
                </div>

                ${renderRecentTable('Publicações recentes', publicacoes, 'publicacao')}
                ${renderRecentTable('Eventos recentes', eventos, 'evento')}
            `);
        } catch (error) {
            console.error('[ADMIN ANALYTICS]', error);
            AdminUI.renderError(error.message || 'Erro ao carregar Analytics.');
        }
    }

    window.AdminAnalytics = { init: load, load };
})();
