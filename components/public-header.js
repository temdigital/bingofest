// components/public-header.js

(function () {
    'use strict';

    const LOGO_URL = 'assets/logo-tem-no-entorno-sul.png';
    const LOGO_FALLBACK = 'https://i.imgur.com/9eZarki.png';

    function getClient() {
        return window.supabaseClient || null;
    }

    function currentPage() {
        return window.location.pathname.split('/').pop()?.toLowerCase() || 'index.html';
    }

    function isActive(page) {
        return currentPage() === page ? 'active' : '';
    }

    function getRedirectUrl() {
        const path = window.location.pathname.split('/').pop() || 'index.html';
        return `${path}${window.location.search}${window.location.hash}`;
    }

    function normalize(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function escapeHTML(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function closeDropdown() {
        document.querySelector('.public-user-dropdown')?.classList.remove('open');
    }

    function closeMobileMenu() {
        document.querySelector('.public-nav')?.classList.remove('open');
    }

    function renderGuest() {
        return `
            <a href="login.html?redirect=${encodeURIComponent(getRedirectUrl())}" class="public-login-btn">
                <i class="fas fa-right-to-bracket"></i>
                Entrar
            </a>
        `;
    }

    async function getUserProfile(user) {
        const client = getClient();

        if (!client || !user?.id) {
            return {
                nome: user?.email?.split('@')?.[0] || 'Usuário',
                roles: []
            };
        }

        let nome =
            user.user_metadata?.nome ||
            user.email?.split('@')?.[0] ||
            'Usuário';

        let roles = [];

        try {
            const { data: usuario } = await client
                .from('usuarios')
                .select('nome, email, status')
                .eq('id', user.id)
                .maybeSingle();

            if (usuario?.nome) {
                nome = usuario.nome;
            }

            const { data: roleRows, error } = await client
                .from('usuarios_roles')
                .select(`
                    roles (
                        nome
                    )
                `)
                .eq('usuario_id', user.id);

            if (error) throw error;

            roles = (roleRows || [])
                .map((item) => normalize(item.roles?.nome))
                .filter(Boolean);

        } catch (error) {
            console.warn('[HEADER] Perfil/roles:', error);
        }

        return {
            nome,
            roles
        };
    }

    function canAccessAdmin(roles) {
        return roles.some((role) => {
            return ['admin', 'administrador', 'colunista', 'comerciante'].includes(role);
        });
    }

    function renderUser(userName, showAdmin) {
        return `
            <div class="public-user-menu">
                <button type="button" class="public-user-btn" id="publicUserBtn">
                    <i class="fas fa-user-circle"></i>
                    Olá, ${escapeHTML(userName)}
                    <i class="fas fa-chevron-down"></i>
                </button>

                <div class="public-user-dropdown" id="publicUserDropdown">
                    <a href="perfil.html">
                        <i class="fas fa-user"></i>
                        Meu Perfil
                    </a>

                    <a href="perfil.html#pontos">
                        <i class="fas fa-star"></i>
                        Pontos
                    </a>

                    <a href="favoritos.html">
                        <i class="fas fa-bookmark"></i>
                        Favoritos
                    </a>

                    <a href="ranking.html">
                        <i class="fas fa-trophy"></i>
                        Ranking
                    </a>

                    <a href="comunidade.html">
                        <i class="fas fa-users"></i>
                        Comunidade
                    </a>

                    ${
                        showAdmin
                            ? `
                                <a href="admin/dashboard.html">
                                    <i class="fas fa-gauge-high"></i>
                                    Painel Administrativo
                                </a>
                            `
                            : ''
                    }

                    <button type="button" id="logoutBtn">
                        <i class="fas fa-right-from-bracket"></i>
                        Sair
                    </button>
                </div>
            </div>
        `;
    }

    async function logout() {
        const client = getClient();

        if (!client) return;

        try {
            await client.auth.signOut();
            window.location.href = 'index.html';
        } catch (error) {
            console.error('[HEADER] Logout:', error);
            alert('Não foi possível encerrar sua sessão.');
        }
    }

    function bindUserMenu() {
        const button = document.getElementById('publicUserBtn');
        const dropdown = document.getElementById('publicUserDropdown');

        if (!button || !dropdown) return;

        button.addEventListener('click', (event) => {
            event.stopPropagation();
            dropdown.classList.toggle('open');
        });

        document.addEventListener('click', () => {
            dropdown.classList.remove('open');
        });

        dropdown.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        document.getElementById('logoutBtn')?.addEventListener('click', logout);
    }

    function bindMobileMenu() {
        document.getElementById('publicMenuBtn')?.addEventListener('click', () => {
            document.querySelector('.public-nav')?.classList.toggle('open');
        });

        document.querySelectorAll('.public-nav a').forEach((link) => {
            link.addEventListener('click', closeMobileMenu);
        });
    }

    async function renderHeader() {
        const container = document.getElementById('publicHeader');

        if (!container) return;

        let user = null;
        let profile = {
            nome: 'Usuário',
            roles: []
        };

        try {
            const client = getClient();

            if (client) {
                const { data } = await client.auth.getSession();
                user = data?.session?.user || null;

                if (user) {
                    profile = await getUserProfile(user);
                }
            }
        } catch (error) {
            console.warn('[HEADER] Sessão:', error);
        }

        const showAdmin = user ? canAccessAdmin(profile.roles) : false;

        container.innerHTML = `
            <header class="public-header">
                <div class="public-header-container">
                    <a href="index.html" class="public-brand">
                        <img src="${LOGO_URL}" onerror="this.onerror=null;this.src='${LOGO_FALLBACK}'" alt="Tem no Entorno Sul">
                    </a>

                    <button id="publicMenuBtn" class="public-menu-btn" type="button" aria-label="Abrir menu">
                        <i class="fas fa-bars"></i>
                    </button>

                    <nav class="public-nav">
                        <a href="index.html" class="${isActive('index.html')}">
                            <i class="fas fa-house"></i>
                            Início
                        </a>

                        <a href="publicacoes.html" class="${isActive('publicacoes.html')}">
                            <i class="fas fa-newspaper"></i>
                            Publicações
                        </a>

                        <a href="eventos.html" class="${isActive('eventos.html')}">
                            <i class="fas fa-calendar-days"></i>
                            Eventos
                        </a>

                        <a href="parceiros.html" class="${isActive('parceiros.html')}">
                            <i class="fas fa-store"></i>
                            Parceiros
                        </a>

                        <a href="colunistas.html" class="${isActive('colunistas.html')}">
                            <i class="fas fa-user-pen"></i>
                            Colunistas
                        </a>

                        <a href="comunidade.html" class="${isActive('comunidade.html')}">
                            <i class="fas fa-users"></i>
                            Comunidade
                        </a>

                        <a href="ranking.html" class="${isActive('ranking.html')}">
                            <i class="fas fa-trophy"></i>
                            Ranking
                        </a>
                    </nav>

                    <div class="public-actions">
                        ${user ? renderUser(profile.nome, showAdmin) : renderGuest()}
                    </div>
                </div>
            </header>
        `;

        bindMobileMenu();

        if (user) {
            bindUserMenu();
        }

        window.addEventListener('scroll', closeDropdown, { passive: true });
    }

    document.addEventListener('DOMContentLoaded', renderHeader);
})();
