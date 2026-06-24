// js/auth-cadastro.js

(function () {
    'use strict';

    const APP_URL = 'https://www.temnoentornosul.com.br';

    function getClient() {
        return window.supabaseClient || null;
    }

    function onlyDigits(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function normalizeBrazilWhatsapp(value) {
        let digits = onlyDigits(value);

        if (digits.startsWith('55') && digits.length > 11) {
            digits = digits.slice(2);
        }

        if (digits.length !== 11) return '';

        return `55${digits}`;
    }

    function maskWhatsapp(value) {
        const digits = onlyDigits(value).replace(/^55/, '').slice(0, 11);

        if (digits.length <= 2) return digits;
        if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }


    function createSlug(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'usuario';
    }

    function localSlug(nome, email) {
        const base = createSlug(nome || String(email || '').split('@')[0] || 'usuario');
        const suffix = Math.random().toString(36).slice(2, 8);
        return `${base}-${suffix}`;
    }

    function populateBirthSelects() {
        const day = document.getElementById('birthDay');
        const year = document.getElementById('birthYear');

        if (day && day.options.length <= 1) {
            for (let i = 1; i <= 31; i += 1) {
                const option = document.createElement('option');
                option.value = String(i).padStart(2, '0');
                option.textContent = String(i).padStart(2, '0');
                day.appendChild(option);
            }
        }

        if (year) {
            year.setAttribute('min', '1900');
            year.setAttribute('max', String(new Date().getFullYear()));
            year.setAttribute('inputmode', 'numeric');
        }
    }

    function syncBirthDate() {
        const day = document.getElementById('birthDay')?.value || '';
        const month = document.getElementById('birthMonth')?.value || '';
        const year = String(document.getElementById('birthYear')?.value || '').trim();
        const hidden = document.getElementById('dataNascimento');

        if (!hidden) return '';

        if (!day || !month || !/^\d{4}$/.test(year)) {
            hidden.value = '';
            return '';
        }

        const value = `${year}-${month}-${day}`;
        const parsed = new Date(`${value}T00:00:00`);

        if (
            Number.isNaN(parsed.getTime()) ||
            parsed.getFullYear() !== Number(year) ||
            parsed.getMonth() + 1 !== Number(month) ||
            parsed.getDate() !== Number(day)
        ) {
            hidden.value = '';
            return '';
        }

        hidden.value = value;
        return value;
    }

    function setLoading(isLoading) {
        const form = document.getElementById('cadastroForm');
        const button = document.getElementById('submitBtn');

        if (form) {
            form.classList.toggle('auth-loading', isLoading);
        }

        if (button) {
            button.disabled = isLoading;
            button.innerHTML = isLoading
                ? '<i class="fas fa-spinner fa-spin"></i> Criando conta...'
                : '<i class="fas fa-user-plus"></i> Criar conta';
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

        if (message.includes('already registered') || message.includes('already been registered')) {
            return 'Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.';
        }

        if (message.includes('invalid email')) {
            return 'Informe um e-mail válido.';
        }

        if (message.includes('password')) {
            return 'A senha informada não atende aos requisitos.';
        }

        if (message.includes('redirect')) {
            return 'URL de redirecionamento não autorizada no Supabase. Verifique Authentication → URL Configuration.';
        }

        if (message.includes('rate limit') || message.includes('too many')) {
            return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
        }

        return error?.message || 'Não foi possível criar a conta. Tente novamente.';
    }

    async function handleCadastro(event) {
        event.preventDefault();

        const client = getClient();

        if (!client) {
            showMessage('Cliente Supabase não encontrado. Verifique js/supabase-config.js.');
            return;
        }

        const nome = String(document.getElementById('nome')?.value || '').trim();
        const email = String(document.getElementById('email')?.value || '').trim().toLowerCase();
        const whatsappMasked = String(document.getElementById('whatsapp')?.value || '').trim();
        const whatsapp = normalizeBrazilWhatsapp(whatsappMasked);
        const dataNascimento = syncBirthDate();
        const password = String(document.getElementById('password')?.value || '');
        const slug = localSlug(nome, email);
        const confirmPassword = String(document.getElementById('confirmPassword')?.value || '');

        clearMessage();

        if (!nome || !email || !whatsapp || !dataNascimento || !password || !confirmPassword) {
            showMessage('Preencha todos os campos obrigatórios. O WhatsApp deve ter DDD e 11 dígitos.');
            return;
        }

        const passwordError = validatePassword(password, confirmPassword);

        if (passwordError) {
            showMessage(passwordError);
            return;
        }

        setLoading(true);

        try {
            const { data, error } = await client.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        nome,
                        data_nascimento: dataNascimento,
                        whatsapp,
                        telefone: whatsapp,
                        tipo: 'cliente',
                        slug
                    },
                    emailRedirectTo: `${APP_URL}/login.html?confirmed=1`
                }
            });

            if (error) throw error;

            if (!data?.user) {
                throw new Error('Cadastro não retornou usuário.');
            }

            document.getElementById('cadastroForm')?.reset();
            syncBirthDate();

            if (data.session) {
                showMessage(
                    'Conta criada e ativada com sucesso. Você será direcionado ao seu perfil.',
                    'success'
                );

                window.setTimeout(() => {
                    window.location.href = 'perfil.html';
                }, 1200);
            } else {
                showMessage(
                    `Conta criada com sucesso. Enviamos um e-mail de confirmação para ${email}. Abra sua caixa de entrada, confirme o cadastro e depois entre usando a senha cadastrada.`,
                    'success'
                );
            }

        } catch (error) {
            console.error('[AUTH CADASTRO]', error);
            showMessage(getErrorMessage(error), 'error');
        } finally {
            setLoading(false);
        }
    }

    function bindForm() {
        populateBirthSelects();
        syncBirthDate();

        ['birthDay', 'birthMonth', 'birthYear'].forEach((id) => {
            document.getElementById(id)?.addEventListener(id === 'birthYear' ? 'input' : 'change', syncBirthDate);
        });

        const whatsapp = document.getElementById('whatsapp');
        whatsapp?.addEventListener('input', () => {
            whatsapp.value = maskWhatsapp(whatsapp.value);
        });

        const form = document.getElementById('cadastroForm');

        if (!form) return;

        form.addEventListener('submit', handleCadastro);
    }

    document.addEventListener('DOMContentLoaded', bindForm);
})();
