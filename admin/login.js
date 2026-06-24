// admin/login.js

(function () {
    'use strict';

    const ADMIN_DASHBOARD_URL = '/admin/dashboard.html';
    const SITE_HOME_URL = '/index.html';

    function getSupabaseClient() {
        return window.supabaseClient || window.supabase?.client || null;
    }

    function normalize(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function showError(message) {
        const errorBox = document.getElementById('errorMessage');
        const successBox = document.getElementById('successMessage');

        if (successBox) {
            successBox.textContent = '';
            successBox.classList.remove('show');
        }

        if (!errorBox) {
            alert(message);
            return;
        }

        errorBox.textContent = message;
        errorBox.classList.add('show');
    }

    function showSuccess(message) {
        const errorBox = document.getElementById('errorMessage');
        const successBox = document.getElementById('successMessage');

        if (errorBox) {
            errorBox.textContent = '';
            errorBox.classList.remove('show');
        }

        if (!successBox) return;

        successBox.textContent = message;
        successBox.classList.add('show');
    }

    function clearMessages() {
        const errorBox = document.getElementById('errorMessage');
        const successBox = document.getElementById('successMessage');

        if (errorBox) {
            errorBox.textContent = '';
            errorBox.classList.remove('show');
        }

        if (successBox) {
            successBox.textContent = '';
            successBox.classList.remove('show');
        }
    }

    function setLoading(isLoading) {
        const button = document.getElementById('submitBtn');

        if (!button) return;

        button.disabled = isLoading;
        button.innerHTML = isLoading
            ? '<i class="fas fa-spinner fa-spin"></i><span>Validando acesso...</span>'
            : '<i class="fas fa-sign-in-alt"></i><span>Entrar no painel</span>';
    }

    async function getUserProfile(client, authUserId) {
        const { data: usuario, error: usuarioError } = await client
            .from('usuarios')
            .select('id, nome, email, status')
            .eq('id', authUserId)
            .maybeSingle();

        if (usuarioError) {
            console.error('Erro ao consultar public.usuarios:', usuarioError);
            throw new Error('Não foi possível validar seu cadastro administrativo.');
        }

        if (!usuario) {
            throw new Error('Seu login existe no Auth, mas não possui perfil público vinculado.');
        }

        if (normalize(usuario.status) !== 'ativo') {
            throw new Error('Seu usuário está inativo. Fale com a administração.');
        }

        const { data: roles, error: rolesError } = await client
            .from('usuarios_roles')
            .select(`
                role_id,
                roles (
                    id,
                    nome
                )
            `)
            .eq('usuario_id', authUserId);

        if (rolesError) {
            console.error('Erro ao consultar public.usuarios_roles:', rolesError);
            throw new Error('Não foi possível consultar suas permissões.');
        }

        const roleNames = (roles || [])
            .map((item) => normalize(item?.roles?.nome))
            .filter(Boolean);

        return {
            usuario,
            roles: roleNames
        };
    }

    async function requireAdmin(client, session) {
        if (!session?.user?.id) {
            throw new Error('Sessão inválida. Faça login novamente.');
        }

        const profile = await getUserProfile(client, session.user.id);

        console.log('[ADMIN LOGIN] Usuário:', profile.usuario.email);
        console.log('[ADMIN LOGIN] Perfis:', profile.roles);

        if (!profile.roles.includes('admin')) {
            await client.auth.signOut();
            throw new Error('Acesso negado. Este login não possui permissão administrativa.');
        }

        return profile;
    }

    async function redirectIfAlreadyLogged(client) {
        const { data, error } = await client.auth.getSession();

        if (error || !data?.session) return;

        try {
            await requireAdmin(client, data.session);
            window.location.replace(ADMIN_DASHBOARD_URL);
        } catch (err) {
            console.warn('[ADMIN LOGIN] Sessão existente recusada:', err.message);
        }
    }

    async function handleLoginSubmit(event) {
        event.preventDefault();

        clearMessages();
        setLoading(true);

        const client = getSupabaseClient();

        if (!client) {
            showError('Supabase não carregado. Verifique o arquivo js/supabase-config.js.');
            setLoading(false);
            return;
        }

        const email = document.getElementById('email')?.value.trim();
        const password = document.getElementById('password')?.value;

        if (!email || !password) {
            showError('Preencha e-mail e senha.');
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await client.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                throw new Error(error.message || 'Erro ao autenticar.');
            }

            if (!data?.session) {
                throw new Error('Login realizado, mas a sessão não foi criada.');
            }

            await requireAdmin(client, data.session);

            showSuccess('Acesso autorizado. Abrindo painel administrativo...');
            window.location.replace(ADMIN_DASHBOARD_URL);

        } catch (err) {
            console.error('[ADMIN LOGIN] Erro:', err);

            try {
                await client.auth.signOut();
            } catch (_) {
                // Ignora erro secundário de logout.
            }

            showError(err.message || 'Não foi possível acessar o painel administrativo.');
            setLoading(false);
        }
    }

    async function init() {
        const client = getSupabaseClient();

        if (!client) {
            showError('Supabase não carregado. Verifique o arquivo js/supabase-config.js.');
            return;
        }

        const form = document.getElementById('loginForm');

        if (!form) {
            showError('Formulário de login não encontrado.');
            return;
        }

        form.addEventListener('submit', handleLoginSubmit);

        await redirectIfAlreadyLogged(client);
    }

    document.addEventListener('DOMContentLoaded', init);
})();