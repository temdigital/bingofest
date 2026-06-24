// js/remocao.js

(function () {
    'use strict';

    function client() {
        return window.supabaseClient || null;
    }

    function onlyDigits(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function maskWhatsapp(value) {
        const digits = onlyDigits(value).replace(/^55/, '').slice(0, 11);
        if (digits.length <= 2) return digits;
        if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }

    function normalizeWhatsapp(value) {
        let digits = onlyDigits(value);
        if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
        if (digits.length !== 11) return '';
        return `55${digits}`;
    }

    function show(message, type = 'error') {
        const el = document.getElementById('removalMessage');
        if (!el) return;
        el.className = `removal-message show ${type}`;
        el.textContent = message;
    }

    function setLoading(value) {
        const button = document.getElementById('removalSubmit');
        if (!button) return;
        button.disabled = value;
        button.innerHTML = value
            ? '<i class="fas fa-spinner fa-spin"></i> Enviando...'
            : '<i class="fas fa-paper-plane"></i> Enviar solicitação';
    }

    function bind() {
        const form = document.getElementById('removalForm');
        const whatsapp = document.getElementById('whatsapp');

        whatsapp?.addEventListener('input', () => {
            whatsapp.value = maskWhatsapp(whatsapp.value);
        });

        form?.addEventListener('submit', async (event) => {
            event.preventDefault();

            const db = client();
            if (!db) {
                show('Supabase não carregou. Atualize a página e tente novamente.');
                return;
            }

            const payload = {
                p_tipo: document.getElementById('tipo')?.value || 'perfil',
                p_nome: String(document.getElementById('nome')?.value || '').trim(),
                p_email: String(document.getElementById('email')?.value || '').trim().toLowerCase(),
                p_whatsapp: normalizeWhatsapp(document.getElementById('whatsapp')?.value || ''),
                p_link: String(document.getElementById('link')?.value || '').trim(),
                p_motivo: String(document.getElementById('motivo')?.value || '').trim(),
                p_detalhes: String(document.getElementById('detalhes')?.value || '').trim()
            };

            if (!payload.p_nome || !payload.p_email || !payload.p_whatsapp || !payload.p_motivo) {
                show('Preencha nome, e-mail, WhatsApp com DDD e motivo da solicitação.');
                return;
            }

            if (payload.p_tipo === 'publicacao' && !payload.p_link) {
                show('Para remover publicação ou conteúdo, informe o link do material.');
                return;
            }

            setLoading(true);

            try {
                const { data, error } = await db.rpc('criar_solicitacao_remocao', payload);
                if (error) throw error;

                const numero = data?.numero || data?.[0]?.numero || '';
                show(
                    numero
                        ? `Solicitação nº ${numero} enviada com sucesso. A equipe responderá pelo e-mail ou WhatsApp informado.`
                        : 'Solicitação enviada com sucesso. A equipe responderá pelo e-mail ou WhatsApp informado.',
                    'success'
                );

                form.reset();
            } catch (error) {
                console.error('[REMOÇÃO]', error);
                show(error.message || 'Não foi possível enviar sua solicitação. Tente novamente.');
            } finally {
                setLoading(false);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', bind);
})();
