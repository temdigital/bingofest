// js/auth-login.js

(function () {
    'use strict';

    function getClient() {
        return window.supabaseClient || null;
    }

    function getRedirectUrl() {
        const params = new URLSearchParams(window.location.search);
        const redirect = String(params.get('redirect') || '').trim();

        if (!redirect) {
            return 'perfil.html';
        }

        try {
            const candidate = new URL(redirect, window.location.origin);

            if (candidate.origin !== window.location.origin) {
                return 'perfil.html';
            }

            if (!['http:', 'https:'].includes(candidate.protocol)) {
                return 'perfil.html';
            }

            const safePath = `${candidate.pathname}${candidate.search}${candidate.hash}`;
            return safePath.startsWith('/') ? safePath : 'perfil.html';
        } catch {
            return 'perfil.html';
        }
    }

    function setLoading(isLoading) {
        const form = document.getElementById('loginForm');
        const button = document.getElementById('submitBtn');

        if (form) {
            form.classList.toggle('auth-loading', isLoading);
        }

        if (button) {
            button.disabled = isLoading;
            button.innerHTML = isLoading
                ? '<i class="fas fa-spinner fa-spin"></i> Entrando...'
                : '<i class="fas fa-right-to-bracket"></i> Entrar';
        }
    }

    function showMessage(message, type = 'error') {
        const el = document.getElementById('authMessage');

        if (!el) return;

        el.className = `auth-message show ${type}`;
        el.textContent = message;
    }

    function clearMessage() {
        const el = document.getElementById('authMessage');

        if (!el) return;

        el.className = 'auth-message';
        el.textContent = '';
    }

    function getErrorMessage(error) {
        const message = String(error?.message || '').toLowerCase();

        if (message.includes('invalid login credentials')) {
            return 'E-mail ou senha inválidos.';
        }

        if (message.includes('email not confirmed')) {
            return 'Confirme seu e-mail antes de entrar.';
        }

        if (message.includes('too many requests')) {
            return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
        }

        if (message.includes('network')) {
            return 'Erro de conexão. Verifique sua internet e tente novamente.';
        }

        return error?.message || 'Não foi possível entrar. Tente novamente.';
    }

    async function redirectIfLoggedIn() {
        const client = getClient();

        if (!client) return;

        const { data } = await client.auth.getSession();

        if (data?.session?.user) {
            window.location.href = getRedirectUrl();
        }
    }

    async function handleLogin(event) {
        event.preventDefault();

        const client = getClient();

        if (!client) {
            showMessage('Cliente Supabase não encontrado. Verifique js/supabase-config.js.');
            return;
        }

        const email = String(document.getElementById('email')?.value || '').trim().toLowerCase();
        const password = String(document.getElementById('password')?.value || '');

        clearMessage();

        if (!email || !password) {
            showMessage('Informe e-mail e senha.');
            return;
        }

        setLoading(true);

        try {
            const { data, error } = await client.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            if (!data?.user) {
                throw new Error('Login não retornou usuário.');
            }

            showMessage('Login realizado com sucesso. Redirecionando...', 'success');

            setTimeout(() => {
                window.location.href = getRedirectUrl();
            }, 700);

        } catch (error) {
            console.error('[AUTH LOGIN]', error);
            showMessage(getErrorMessage(error), 'error');
        } finally {
            setLoading(false);
        }
    }

    function bindForm() {
        const form = document.getElementById('loginForm');

        if (!form) return;

        form.addEventListener('submit', handleLogin);
    }

    document.addEventListener('DOMContentLoaded', async () => {
        await redirectIfLoggedIn();
        bindForm();

        const params = new URLSearchParams(window.location.search);
        if (params.get('confirmed') === '1') {
            showMessage('E-mail confirmado. Agora entre com seu e-mail e senha.', 'success');
        }
    });
})();
