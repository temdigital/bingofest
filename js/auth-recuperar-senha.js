// js/auth-recuperar-senha.js

(function () {
    'use strict';

    const APP_URL = 'https://www.temnoentornosul.com.br';

    function getClient() {
        return window.supabaseClient || null;
    }

    function setLoading(isLoading) {
        const form = document.getElementById('recuperarSenhaForm');
        const button = document.getElementById('submitBtn');

        if (form) form.classList.toggle('auth-loading', isLoading);

        if (button) {
            button.disabled = isLoading;
            button.innerHTML = isLoading
                ? '<i class="fas fa-spinner fa-spin"></i> Enviando...'
                : '<i class="fas fa-envelope"></i> Enviar link';
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

        if (message.includes('invalid email')) return 'Informe um e-mail válido.';
        if (message.includes('rate limit') || message.includes('too many')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
        if (message.includes('redirect')) return 'URL de redirecionamento não autorizada no Supabase. Verifique Authentication → URL Configuration.';

        return error?.message || 'Não foi possível enviar o link de recuperação.';
    }

    async function handleRecovery(event) {
        event.preventDefault();

        const client = getClient();

        if (!client) {
            showMessage('Cliente Supabase não encontrado. Verifique js/supabase-config.js.');
            return;
        }

        const email = String(document.getElementById('email')?.value || '').trim().toLowerCase();

        clearMessage();

        if (!email) {
            showMessage('Informe seu e-mail.');
            return;
        }

        setLoading(true);

        try {
            const { error } = await client.auth.resetPasswordForEmail(email, {
                redirectTo: `${APP_URL}/redefinir-senha.html?type=recovery`
            });

            if (error) throw error;

            showMessage(
                'Se o e-mail existir em nossa base, enviaremos um link para redefinir sua senha.',
                'success'
            );

            document.getElementById('recuperarSenhaForm')?.reset();

        } catch (error) {
            console.error('[AUTH RECUPERAR SENHA]', error);
            showMessage(getErrorMessage(error), 'error');
        } finally {
            setLoading(false);
        }
    }

    function bindForm() {
        document.getElementById('recuperarSenhaForm')?.addEventListener('submit', handleRecovery);
    }

    document.addEventListener('DOMContentLoaded', bindForm);
})();