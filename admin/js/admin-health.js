// admin/js/admin-health.js

(function () {
    'use strict';

    /*
        Sprint 1 — Saúde do Sistema
        Correção definitiva do loop 403.

        Este arquivo é o módulo REAL carregado pelo dashboard.html.
        O dashboard usa AdminHealth, não AdminSaude.

        Portanto:
        - NÃO consulta logs_sistema.
        - NÃO consulta publicidade_cliques.
        - NÃO registra log operacional durante o diagnóstico.
        - NÃO dispara requisições para tabelas operacionais que causavam 403.
        - Audita apenas tabelas principais, Storage e módulos JS carregados.
    */

    const MAIN_TABLES = [
        'usuarios',
        'roles',
        'usuarios_roles',
        'categorias',
        'publicacoes',
        'publicacoes_categorias',
        'eventos',
        'negocios',
        'tipos_negocio',
        'colunistas',
        'comunidade_posts',
        'comunidade_respostas',
        'convites_portal',
        'publicidades'
    ];

    const OPERATIONAL_TABLES = [
        {
            table: 'publicidade_cliques',
            description: 'Tabela operacional de métricas de publicidade. Não é consultada pela Saúde para evitar falso erro 403 no navegador.'
        },
        {
            table: 'logs_sistema',
            description: 'Tabela operacional de logs. Não é consultada pela Saúde para evitar falso erro 403 no navegador.'
        }
    ];

    const MODULES = [
        { objectName: 'AdminCore', label: 'Base administrativa' },
        { objectName: 'AdminUI', label: 'Interface administrativa' },
        { objectName: 'AdminStorage', label: 'Mídias' },
        { objectName: 'AdminGeolocation', label: 'Geolocalização' },
        { objectName: 'AdminUsers', label: 'Usuários' },
        { objectName: 'AdminPublicacoes', label: 'Publicações' },
        { objectName: 'AdminEventos', label: 'Eventos' },
        { objectName: 'AdminNegocios', label: 'Parceiros' },
        { objectName: 'AdminColunistas', label: 'Colunistas' },
        { objectName: 'AdminComentarios', label: 'Comunidade' },
        { objectName: 'AdminConvites', label: 'Convites' },
        { objectName: 'AdminMarketing', label: 'Publicidade' }
    ];

    let lastDiagnostic = null;

    function getClient() {
        if (window.AdminCore && typeof AdminCore.getClient === 'function') {
            return AdminCore.getClient();
        }

        return window.supabaseClient || null;
    }

    function escapeHTML(value) {
        if (window.AdminCore && typeof AdminCore.escapeHTML === 'function') {
            return AdminCore.escapeHTML(value ?? '');
        }

        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function setPage() {
        if (window.AdminUI && typeof AdminUI.setPage === 'function') {
            AdminUI.setPage('saude');
        }
    }

    function setContent(html) {
        if (window.AdminUI && typeof AdminUI.setContent === 'function') {
            AdminUI.setContent(html);
            return;
        }

        const root = document.getElementById('adminContent');

        if (root) {
            root.innerHTML = html;
        }
    }

    function renderLoading() {
        if (window.AdminUI && typeof AdminUI.renderLoading === 'function') {
            AdminUI.renderLoading('Verificando saúde do sistema...');
            return;
        }

        setContent('<p>Verificando saúde do sistema...</p>');
    }

    function renderToast(message, type = 'success') {
        if (window.AdminUI && typeof AdminUI.renderToast === 'function') {
            AdminUI.renderToast(message, type);
            return;
        }

        if (type === 'error') {
            alert(message);
        }
    }

    function serializeError(error) {
        if (!error) return null;
        if (typeof error === 'string') return error;

        const parts = [
            error.message,
            error.details,
            error.hint,
            error.code,
            error.status,
            error.statusText
        ].filter(Boolean);

        if (parts.length) return parts.join(' | ');

        try {
            return JSON.stringify(error);
        } catch {
            return 'Erro desconhecido.';
        }
    }

    async function checkTable(tableName) {
        const client = getClient();

        try {
            const { data, error } = await client
                .from(tableName)
                .select('*')
                .limit(1);

            if (error) {
                return {
                    table: tableName,
                    ok: false,
                    count: null,
                    message: serializeError(error)
                };
            }

            let count = Array.isArray(data) ? data.length : 0;
            let message = 'Leitura permitida';

            try {
                const countResult = await client
                    .from(tableName)
                    .select('*', {
                        count: 'exact',
                        head: true
                    });

                if (!countResult.error && typeof countResult.count === 'number') {
                    count = countResult.count;
                }
            } catch {
                message = 'Leitura permitida. Contagem exata indisponível.';
            }

            return {
                table: tableName,
                ok: true,
                count,
                message
            };

        } catch (error) {
            return {
                table: tableName,
                ok: false,
                count: null,
                message: serializeError(error)
            };
        }
    }

    async function checkStorage() {
        const client = getClient();

        try {
            const { data, error } = await client.storage
                .from('midias')
                .list('', {
                    limit: 1
                });

            if (error) {
                return {
                    ok: false,
                    count: null,
                    message: serializeError(error)
                };
            }

            return {
                ok: true,
                count: Array.isArray(data) ? data.length : 0,
                message: 'Bucket midias acessível'
            };

        } catch (error) {
            return {
                ok: false,
                count: null,
                message: serializeError(error)
            };
        }
    }

    function checkModules() {
        return MODULES.map((item) => {
            const mod = window[item.objectName];
            const loaded = Boolean(mod);
            const executable = loaded && (
                typeof mod.init === 'function' ||
                typeof mod.load === 'function' ||
                item.objectName === 'AdminCore' ||
                item.objectName === 'AdminUI'
            );

            return {
                label: item.label,
                objectName: item.objectName,
                loaded: loaded && executable,
                message: loaded ? 'Carregado' : 'Não encontrado'
            };
        });
    }

    function getCurrentUser() {
        return window.AdminCore?.state?.currentUser || null;
    }

    function getCurrentRoles() {
        return window.AdminCore?.state?.currentRoles || [];
    }

    async function buildDiagnostic() {
        const client = getClient();

        if (!client) {
            throw new Error('Cliente Supabase não encontrado.');
        }

        const tables = [];

        for (const tableName of MAIN_TABLES) {
            tables.push(await checkTable(tableName));
        }

        const operational = OPERATIONAL_TABLES.map((item) => ({
            table: item.table,
            ok: true,
            count: null,
            message: item.description,
            ignored: true
        }));

        const storage = await checkStorage();
        const modules = checkModules();
        const user = getCurrentUser();

        return {
            generated_at: new Date().toISOString(),
            url: window.location.href,
            user: user
                ? {
                    id: user.id || null,
                    nome: user.nome || null,
                    email: user.email || null,
                    status: user.status || null
                }
                : null,
            roles: getCurrentRoles(),
            tables,
            operational_tables: operational,
            storage,
            modules
        };
    }

    function okBadge(ok, ignored = false) {
        if (ignored) {
            return '<span class="status-badge status-ativo">Ignorada</span>';
        }

        return ok
            ? '<span class="status-badge status-ativo">OK</span>'
            : '<span class="status-badge status-inativo">Falha</span>';
    }

    function renderTableRows(results) {
        return results.map((item) => `
            <tr>
                <td>${escapeHTML(item.table)}</td>
                <td>${okBadge(item.ok, item.ignored)}</td>
                <td>${item.count === null || item.count === undefined ? '-' : Number(item.count)}</td>
                <td>${escapeHTML(item.message || '-')}</td>
            </tr>
        `).join('');
    }

    function renderModuleRows(modules) {
        return modules.map((item) => `
            <tr>
                <td>${escapeHTML(item.label)}</td>
                <td>${escapeHTML(item.objectName)}</td>
                <td>${okBadge(item.loaded)}</td>
                <td>${escapeHTML(item.message)}</td>
            </tr>
        `).join('');
    }

    function renderCards(diagnostic) {
        const okTables = diagnostic.tables.filter((item) => item.ok).length;
        const failTables = diagnostic.tables.filter((item) => !item.ok).length;
        const okModules = diagnostic.modules.filter((item) => item.loaded).length;
        const totalModules = diagnostic.modules.length;

        return `
            <div class="admin-stats-grid health-stats">
                <div class="admin-home-card">
                    <i class="fas fa-database"></i>
                    <strong>${okTables}</strong>
                    <span>Tabelas principais OK</span>
                </div>

                <div class="admin-home-card">
                    <i class="fas fa-triangle-exclamation"></i>
                    <strong>${failTables}</strong>
                    <span>Tabelas principais com falha</span>
                </div>

                <div class="admin-home-card">
                    <i class="fas fa-code"></i>
                    <strong>${okModules}/${totalModules}</strong>
                    <span>Módulos carregados</span>
                </div>

                <div class="admin-home-card">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <strong>${diagnostic.storage.ok ? 'OK' : 'Falha'}</strong>
                    <span>Bucket midias</span>
                </div>
            </div>
        `;
    }

    function renderPage(diagnostic) {
        const hasFailures =
            diagnostic.tables.some((item) => !item.ok) ||
            diagnostic.modules.some((item) => !item.loaded) ||
            !diagnostic.storage.ok;

        setContent(`
            <div class="section-header">
                <div>
                    <h3>Saúde do sistema</h3>
                    <p>Auditoria rápida para evitar retrabalho: tabelas principais, Storage e módulos carregados.</p>
                </div>

                <button class="btn-primary" type="button" id="copyDiagnosticBtn">
                    <i class="fas fa-copy"></i>
                    Copiar diagnóstico
                </button>
            </div>

            ${renderCards(diagnostic)}

            <div class="permission-card" style="margin: 18px 0;">
                ${
                    hasFailures
                        ? 'Ainda há falhas detectadas nas tabelas principais, módulos ou Storage.'
                        : 'Sistema estabilizado: tabelas principais, módulos e Storage responderam corretamente.'
                }
                As tabelas operacionais de logs e cliques não são consultadas nesta tela para evitar falso erro 403 no navegador.
            </div>

            <div class="admin-health-section">
                <h3>Tabelas principais do Supabase</h3>
                <div class="table-wrap">
                    <table class="data-table health-table">
                        <thead>
                            <tr>
                                <th>Tabela</th>
                                <th>Status</th>
                                <th>Registros</th>
                                <th>Mensagem</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderTableRows(diagnostic.tables)}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="admin-health-section">
                <h3>Tabelas operacionais ignoradas</h3>
                <div class="table-wrap">
                    <table class="data-table health-table">
                        <thead>
                            <tr>
                                <th>Tabela</th>
                                <th>Status</th>
                                <th>Registros</th>
                                <th>Mensagem</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderTableRows(diagnostic.operational_tables)}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="admin-health-section">
                <h3>Storage</h3>
                <div class="health-storage-card ${diagnostic.storage.ok ? 'ok' : 'error'}">
                    <div><i class="fas fa-cloud-upload-alt"></i></div>
                    <div>
                        <strong>${diagnostic.storage.ok ? 'Bucket midias OK' : 'Bucket midias com falha'}</strong>
                        <span>${escapeHTML(diagnostic.storage.message || '-')}</span>
                    </div>
                </div>
            </div>

            <div class="admin-health-section">
                <h3>Módulos JavaScript</h3>
                <div class="table-wrap">
                    <table class="data-table health-table">
                        <thead>
                            <tr>
                                <th>Módulo</th>
                                <th>Objeto</th>
                                <th>Status</th>
                                <th>Mensagem</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderModuleRows(diagnostic.modules)}
                        </tbody>
                    </table>
                </div>
            </div>
        `);

        bindActions();
    }

    function bindActions() {
        document.getElementById('copyDiagnosticBtn')?.addEventListener('click', async () => {
            const content = JSON.stringify(lastDiagnostic, null, 2);

            try {
                await navigator.clipboard.writeText(content);
                renderToast('Diagnóstico copiado.');
            } catch {
                window.prompt('Copie o diagnóstico:', content);
            }
        });
    }

    async function load() {
        setPage();
        renderLoading();

        try {
            lastDiagnostic = await buildDiagnostic();
            renderPage(lastDiagnostic);
        } catch (error) {
            console.error('[ADMIN HEALTH]', error);
            setContent(`
                <div class="admin-empty-state empty-state">
                    <i class="fas fa-triangle-exclamation"></i>
                    <h3>Não foi possível carregar a saúde do sistema</h3>
                    <p>${escapeHTML(serializeError(error))}</p>
                </div>
            `);
        }
    }

    window.AdminHealth = {
        init: load,
        load,
        buildDiagnostic
    };
})();
