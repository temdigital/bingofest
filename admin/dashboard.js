// admin/dashboard.js

(function () {
    'use strict';

    let currentSection = 'dashboard';

    const sectionTitles = {
        dashboard: {
            title: 'Dashboard',
            subtitle: 'Visão geral do portal Tem no Entorno Sul.'
        },
        publicacoes: {
            title: 'Publicações',
            subtitle: 'Gerencie notícias, artigos e conteúdos editoriais.'
        },
        eventos: {
            title: 'Eventos',
            subtitle: 'Cadastre e acompanhe eventos regionais.'
        },
        negocios: {
            title: 'Parceiros',
            subtitle: 'Gerencie empresas parceiras e negócios locais.'
        },
        colunistas: {
            title: 'Colunistas',
            subtitle: 'Gerencie colunistas e autores do portal.'
        },
        usuarios: {
            title: 'Usuários',
            subtitle: 'Acompanhe usuários cadastrados e permissões.'
        },
        comentarios: {
            title: 'Comunidade',
            subtitle: 'Modere posts e respostas do mural da comunidade.'
        },
        convites: {
            title: 'Convites',
            subtitle: 'Convide colunistas, comerciantes e clientes para o portal.'
        },
        publicidade: {
            title: 'Publicidade',
            subtitle: 'Gerencie espaços publicitários, mídias, links e cliques.'
        },
        geolocalizacao: {
            title: 'Geolocalização',
            subtitle: 'Gerencie dados de localização de parceiros e eventos.'
        },
        storage: {
            title: 'Mídias',
            subtitle: 'Gerencie arquivos e imagens do portal.'
        },
        saude: {
            title: 'Saúde do sistema',
            subtitle: 'Auditoria rápida de tabelas, permissões e módulos essenciais.'
        },
        analytics: {
            title: 'Analytics',
            subtitle: 'Indicadores do portal, acessos e engajamento.'
        },
        logs: {
            title: 'Logs de Segurança',
            subtitle: 'Auditoria de acessos, alterações e eventos sensíveis do painel.'
        },
        remocoes: {
            title: 'Solicitações de Remoção',
            subtitle: 'Pedidos de remoção, revisão e respostas administrativas.'
        },
        aniversariantes: {
            title: 'Aniversariantes',
            subtitle: 'Veja aniversariantes do dia e envie parabéns pelo WhatsApp.'
        }
    };

    const modules = {
        publicacoes: {
            objectName: 'AdminPublicacoes',
            allowed: () => AdminCore.isAdmin() || AdminCore.isColunista()
        },
        eventos: {
            objectName: 'AdminEventos',
            allowed: () => AdminCore.isAdmin() || AdminCore.isComerciante()
        },
        negocios: {
            objectName: 'AdminNegocios',
            allowed: () => AdminCore.isAdmin() || AdminCore.isComerciante()
        },
        colunistas: {
            objectName: 'AdminColunistas',
            allowed: () => AdminCore.isAdmin() || AdminCore.isColunista()
        },
        usuarios: {
            objectName: 'AdminUsers',
            allowed: () => AdminCore.isAdmin()
        },
        comentarios: {
            objectName: 'AdminComentarios',
            allowed: () => AdminCore.isAdmin()
        },
        convites: {
            objectName: 'AdminConvites',
            allowed: () => AdminCore.isAdmin()
        },
        publicidade: {
            objectName: 'AdminMarketing',
            allowed: () => AdminCore.isAdmin()
        },
        geolocalizacao: {
            objectName: 'AdminGeolocation',
            allowed: () => AdminCore.isAdmin()
        },
        storage: {
            objectName: 'AdminStorage',
            allowed: () => AdminCore.isAdmin()
        },
        saude: {
            objectName: 'AdminHealth',
            allowed: () => AdminCore.isAdmin()
        },
        analytics: {
            objectName: 'AdminAnalytics',
            allowed: () => AdminCore.isAdmin()
        },
        logs: {
            objectName: 'AdminLogs',
            allowed: () => AdminCore.isAdmin()
        },
        remocoes: {
            objectName: 'AdminRemocoes',
            allowed: () => AdminCore.isAdmin()
        },
        aniversariantes: {
            objectName: 'AdminAniversariantes',
            allowed: () => AdminCore.isAdmin()
        }
    };

    function escapeHTML(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function getContentRoot() {
        return document.getElementById('adminContent');
    }

    function setTitle(section) {
        const info = sectionTitles[section] || sectionTitles.dashboard;

        const title = document.getElementById('adminPageTitle');
        const subtitle = document.getElementById('adminPageSubtitle');

        if (title) title.textContent = info.title;
        if (subtitle) subtitle.textContent = info.subtitle;
    }

    function setActiveMenu(section) {
        document.querySelectorAll('.admin-menu-item').forEach((button) => {
            button.classList.toggle('active', button.dataset.section === section);
        });
    }

    function closeSidebarMobile() {
        document.getElementById('adminSidebar')?.classList.remove('open');
    }

    function showLoading(message = 'Carregando...') {
        const root = getContentRoot();

        if (!root) return;

        root.innerHTML = `
            <div class="admin-loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <h2>${escapeHTML(message)}</h2>
            </div>
        `;
    }

    function showError(message) {
        const root = getContentRoot();

        if (!root) return;

        root.innerHTML = `
            <div class="admin-empty-state">
                <i class="fas fa-triangle-exclamation"></i>
                <h3>Não foi possível carregar esta área</h3>
                <p>${escapeHTML(message || 'Erro inesperado.')}</p>
            </div>
        `;
    }

    function showRestricted(message) {
        const root = getContentRoot();

        if (!root) return;

        root.innerHTML = `
            <div class="admin-empty-state">
                <i class="fas fa-lock"></i>
                <h3>Acesso restrito</h3>
                <p>${escapeHTML(message || 'Seu perfil não possui permissão para acessar esta área.')}</p>
            </div>
        `;
    }

    function getInitialSection() {
        const params = new URLSearchParams(window.location.search);

        return (
            params.get('section') ||
            params.get('area') ||
            'dashboard'
        );
    }

    function updateUrl(section) {
        const url = new URL(window.location.href);

        if (section === 'dashboard') {
            url.searchParams.delete('section');
            url.searchParams.delete('area');
        } else {
            url.searchParams.set('section', section);
            url.searchParams.delete('area');
        }

        window.history.replaceState({}, '', url.toString());
    }

    function userRoleLabel() {
        if (AdminCore.isAdmin()) return 'Administrador';
        if (AdminCore.isColunista()) return 'Colunista';
        if (AdminCore.isComerciante()) return 'Comerciante';

        return 'Usuário';
    }

    function moduleCard(section, icon, title, text) {
        const module = modules[section];
        const allowed = !module || module.allowed();

        if (!allowed) return '';

        return `
            <button type="button" class="admin-home-card" data-go-section="${section}">
                <i class="fas ${icon}"></i>
                <strong>${title}</strong>
                <span>${text}</span>
            </button>
        `;
    }

    function renderDashboardHome() {
        const root = getContentRoot();

        if (!root) return;

        root.innerHTML = `
            <section class="admin-dashboard-home">
                <div class="admin-page-header">
                    <div>
                        <span class="admin-kicker">
                            <i class="fas fa-gauge-high"></i>
                            ${escapeHTML(userRoleLabel())}
                        </span>

                        <h1>Bem-vindo ao Painel</h1>

                        <p>
                            Acesse os módulos disponíveis para o seu perfil.
                        </p>
                    </div>
                </div>

                <div class="admin-stats-grid">
                    ${moduleCard(
                        'publicacoes',
                        'fa-newspaper',
                        'Publicações',
                        AdminCore.isAdmin()
                            ? 'Gerenciar conteúdos editoriais'
                            : 'Gerenciar suas publicações'
                    )}

                    ${moduleCard(
                        'eventos',
                        'fa-calendar-days',
                        'Eventos',
                        AdminCore.isAdmin()
                            ? 'Gerenciar agenda regional'
                            : 'Gerenciar eventos da sua empresa'
                    )}

                    ${moduleCard(
                        'negocios',
                        'fa-store',
                        'Parceiros',
                        AdminCore.isAdmin()
                            ? 'Gerenciar empresas locais'
                            : 'Gerenciar sua empresa'
                    )}

                    ${moduleCard(
                        'colunistas',
                        'fa-user-pen',
                        'Colunistas',
                        AdminCore.isAdmin()
                            ? 'Gerenciar perfis editoriais'
                            : 'Gerenciar seu perfil de colunista'
                    )}

                    ${moduleCard(
                        'usuarios',
                        'fa-users',
                        'Usuários',
                        'Gerenciar usuários e permissões'
                    )}

                    ${moduleCard(
                        'comentarios',
                        'fa-comments',
                        'Comunidade',
                        'Moderar mural e respostas'
                    )}

                    ${moduleCard(
                        'convites',
                        'fa-envelope-open-text',
                        'Convites',
                        'Enviar convites por WhatsApp'
                    )}

                    ${moduleCard(
                        'publicidade',
                        'fa-rectangle-ad',
                        'Publicidade',
                        'Gerenciar anúncios e cliques'
                    )}

                    ${moduleCard(
                        'geolocalizacao',
                        'fa-map-location-dot',
                        'Geolocalização',
                        'Gerenciar dados de localização'
                    )}

                    ${moduleCard(
                        'storage',
                        'fa-cloud-arrow-up',
                        'Mídias',
                        'Gerenciar arquivos e imagens'
                    )}

                    ${moduleCard(
                        'saude',
                        'fa-heart-pulse',
                        'Saúde do sistema',
                        'Verificar tabelas e permissões'
                    )}

                    ${moduleCard(
                        'analytics',
                        'fa-chart-pie',
                        'Analytics',
                        'Acompanhar indicadores do portal'
                    )}

                    ${moduleCard(
                        'logs',
                        'fa-shield-halved',
                        'Logs de Segurança',
                        'Auditar acessos e alterações'
                    )}

                    ${moduleCard(
                        'remocoes',
                        'fa-user-shield',
                        'Solicitações de Remoção',
                        'Responder pedidos LGPD'
                    )}

                    ${moduleCard(
                        'aniversariantes',
                        'fa-cake-candles',
                        'Aniversariantes',
                        'Enviar parabéns pelo WhatsApp'
                    )}
                </div>
            </section>
        `;

        document.querySelectorAll('[data-go-section]').forEach((button) => {
            button.addEventListener('click', () => {
                loadSection(button.dataset.goSection);
            });
        });
    }

    function normalizeSectionByPermission(section) {
        if (!section || section === 'dashboard') {
            return 'dashboard';
        }

        if (!modules[section]) {
            return 'dashboard';
        }

        return section;
    }

    async function callModule(section) {
        const config = modules[section];

        if (!config) {
            throw new Error(`Seção "${section}" não encontrada.`);
        }

        if (!config.allowed()) {
            showRestricted('Seu perfil não possui permissão para acessar este módulo.');
            return;
        }

        const module = window[config.objectName];

        if (!module) {
            throw new Error(`Módulo "${config.objectName}" não encontrado.`);
        }

        if (typeof module.init === 'function') {
            await module.init();
            return;
        }

        if (typeof module.load === 'function') {
            await module.load();
            return;
        }

        throw new Error(`Módulo "${config.objectName}" não possui init() nem load().`);
    }

    async function loadSection(section) {
        currentSection = normalizeSectionByPermission(section);

        setTitle(currentSection);
        setActiveMenu(currentSection);
        closeSidebarMobile();
        updateUrl(currentSection);

        if (currentSection === 'dashboard') {
            renderDashboardHome();
            return;
        }

        showLoading(`Carregando ${sectionTitles[currentSection]?.title || 'área'}...`);

        try {
            await callModule(currentSection);
        } catch (error) {
            console.error('[DASHBOARD] Seção:', currentSection, error);
            showError(error.message);
        }
    }

    function configureMenuByPermission() {
        document.querySelectorAll('.admin-menu-item').forEach((button) => {
            const section = button.dataset.section;
            let allowed = false;

            if (!section || section === 'dashboard') {
                allowed = true;
            } else {
                const config = modules[section];
                allowed = Boolean(config && config.allowed());
            }

            button.hidden = !allowed;
            button.disabled = !allowed;
            button.setAttribute('aria-hidden', allowed ? 'false' : 'true');
            button.style.display = allowed ? '' : 'none';
        });
    }

    function bindMenu() {
        document.querySelectorAll('.admin-menu-item').forEach((button) => {
            button.addEventListener('click', () => {
                loadSection(button.dataset.section || 'dashboard');
            });
        });
    }

    function bindTopbar() {
        document.getElementById('adminLogoutBtn')?.addEventListener('click', AdminCore.logout);
        document.getElementById('adminSidebarLogoutBtn')?.addEventListener('click', AdminCore.logout);

        document.getElementById('adminSidebarToggle')?.addEventListener('click', () => {
            document.getElementById('adminSidebar')?.classList.toggle('open');
        });
    }

    async function initialize() {
        try {
            showLoading('Validando acesso...');

            const allowed = await AdminCore.requireAdmin();

            if (!allowed) return;

            configureMenuByPermission();
            bindMenu();
            bindTopbar();

            await loadSection(getInitialSection());

        } catch (error) {
            console.error('[DASHBOARD] Inicialização:', error);
            showError(error.message || 'Erro ao carregar painel.');
        }
    }

    document.addEventListener('DOMContentLoaded', initialize);
})();