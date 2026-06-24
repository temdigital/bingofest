// js/auth-redefinir-senha.js

(function () {
    'use strict';

    let recoveryReady = false;

    function getClient() {
        return window.supabaseClient || null;
    }

    function setLoading(isLoading) {
        const form = document.getElementById('redefinirSenhaForm');
        const button = document.getElementById('submitBtn');

        if (form) {
            form.classList.toggle('auth-loading', isLoading);
        }

        if (button) {
            button.disabled = isLoading || !recoveryReady;
            button.innerHTML = isLoading
                ? '<i class="fas fa-spinner fa-spin"></i> Atualizando...'
                : '<i class="fas fa-key"></i> Atualizar senha';
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

    function validatePassword(password, confirmPassword) {
        if (!password || !confirmPassword) {
            return 'Informe e confirme a nova senha.';
        }

        if (password.length < 6) {
            return 'A senha precisa ter pelo menos 6 caracteres.';
        }

        if (password !== confirmPassword) {
            return 'As senhas não conferem.';
        }

        return null;
    }

    function getErrorMessage(error) {
        const message = String(error?.message || '').toLowerCase();

        if (message.includes('session') || message.includes('jwt')) {
            return 'Sessão de recuperação inválida ou expirada. Solicite um novo link.';
        }

        if (message.includes('password')) {
            return 'A senha informada não atende aos requisitos.';
        }

        if (message.includes('rate limit') || message.includes('too many')) {
            return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
        }

        return error?.message || 'Não foi possível redefinir a senha.';
    }

    async function waitForRecoverySession() {
        const client = getClient();

        if (!client) {
            showMessage('Cliente Supabase não encontrado. Verifique js/supabase-config.js.');
            return;
        }

        recoveryReady = false;
        setLoading(false);

        try {
            for (let attempt = 0; attempt < 8; attempt += 1) {
                const { data, error } = await client.auth.getSession();
                if (error) throw error;

                if (data?.session) {
                    recoveryReady = true;
                    showMessage('Link validado. Digite sua nova senha abaixo e clique em Atualizar senha.', 'success');
                    setLoading(false);
                    return;
                }

                await new Promise((resolve) => setTimeout(resolve, 350));
            }

            showMessage('Link inválido ou expirado. Solicite uma nova recuperação de senha.');
            setLoading(false);
        } catch (error) {
            console.error('[AUTH REDEFINIR SENHA] sessão:', error);
            showMessage(getErrorMessage(error));
            setLoading(false);
        }
    }

    async function handleReset(event) {
        event.preventDefault();

        const client = getClient();

        if (!client) {
            showMessage('Cliente Supabase não encontrado. Verifique js/supabase-config.js.');
            return;
        }

        if (!recoveryReady) {
            showMessage('Aguarde a validação do link de recuperação ou solicite um novo link.');
            return;
        }

        const password = String(document.getElementById('password')?.value || '');
        const confirmPassword = String(document.getElementById('confirmPassword')?.value || '');

        clearMessage();

        const passwordError = validatePassword(password, confirmPassword);

        if (passwordError) {
            showMessage(passwordError);
            return;
        }

        setLoading(true);

        try {
            const { error } = await client.auth.updateUser({ password });
            if (error) throw error;

            showMessage('Senha atualizada com sucesso. Entre novamente com sua nova senha.', 'success');

            setTimeout(async () => {
                await client.auth.signOut();
                window.location.href = 'login.html?senha_atualizada=1';
            }, 1400);

        } catch (error) {
            console.error('[AUTH REDEFINIR SENHA]', error);
            showMessage(getErrorMessage(error), 'error');
            setLoading(false);
        }
    }

    function bindForm() {
        const form = document.getElementById('redefinirSenhaForm');

        if (!form) return;

        form.addEventListener('submit', handleReset);
    }

    document.addEventListener('DOMContentLoaded', async () => {
        bindForm();
        await waitForRecoverySession();
    });
})();
