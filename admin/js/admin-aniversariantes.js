// admin/js/admin-aniversariantes.js
// Sprint 5 — Aniversariantes do dia com envio por WhatsApp gratuito.

(function () {
    'use strict';

    let aniversariantes = [];

    function todayParts() {
        const now = new Date();
        return {
            day: now.getDate(),
            month: now.getMonth() + 1,
            label: now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
        };
    }

    function digits(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function formatDate(value) {
        if (!value) return '-';
        const [year, month, day] = String(value).split('-');
        if (!year || !month || !day) return AdminCore.formatDate(value);
        return `${day}/${month}/${year}`;
    }

    function age(value) {
        if (!value) return null;
        const birth = new Date(`${value}T00:00:00`);
        if (Number.isNaN(birth.getTime())) return null;
        const now = new Date();
        let years = now.getFullYear() - birth.getFullYear();
        const m = now.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years -= 1;
        return years >= 0 ? years : null;
    }

    function whatsappMessage(user) {
        const nome = user.nome || 'amigo(a)';
        return [
            `🎉 Olá, ${nome}!`,
            '',
            'Hoje o portal *Tem no Entorno Sul* quer celebrar você!',
            '',
            'Que seu aniversário seja cheio de alegria, saúde, boas notícias e novas conquistas. Somos gratos por você fazer parte da nossa comunidade regional.',
            '',
            'Feliz aniversário! 🎂✨',
            '',
            'Com carinho,',
            '*Equipe Tem no Entorno Sul*'
        ].join('\n');
    }

    function whatsappHref(user) {
        const phone = digits(user.whatsapp || user.telefone || user.contato || '');
        if (!phone) return null;
        const withCountry = phone.startsWith('55') ? phone : `55${phone}`;
        return `https://wa.me/${withCountry}?text=${encodeURIComponent(whatsappMessage(user))}`;
    }

    function renderCard(user) {
        const href = whatsappHref(user);
        const userAge = age(user.data_nascimento);
        return `
            <article class="admin-catalog-card birthday-admin-card">
                <div class="admin-catalog-media birthday-card-cover">
                    ${user.foto_url
                        ? `<img src="${AdminCore.escapeHTML(user.foto_url)}" alt="${AdminCore.escapeHTML(user.nome || 'Usuário')}" loading="lazy">`
                        : `<div class="admin-catalog-placeholder"><i class="fas fa-cake-candles"></i></div>`
                    }
                </div>

                <div class="admin-catalog-body">
                    <div class="admin-catalog-top">
                        <span class="admin-catalog-badge">Aniversariante</span>
                        ${AdminUI.statusBadge(user.status || 'ativo')}
                    </div>

                    <h3>${AdminCore.escapeHTML(user.nome || 'Usuário')}</h3>
                    <p>${AdminCore.escapeHTML(user.email || 'E-mail não informado')}</p>

                    <div class="admin-catalog-meta">
                        <span><i class="fas fa-cake-candles"></i>${AdminCore.escapeHTML(formatDate(user.data_nascimento))}${userAge !== null ? ` • ${userAge} anos` : ''}</span>
                        <span><i class="fas fa-location-dot"></i>${AdminCore.escapeHTML(user.cidade || 'Cidade não informada')}</span>
                        <span><i class="fab fa-whatsapp"></i>${AdminCore.escapeHTML(user.whatsapp || user.telefone || 'WhatsApp não informado')}</span>
                    </div>

                    <div class="permission-card birthday-message-preview">
                        ${AdminCore.escapeHTML(whatsappMessage(user)).replaceAll('\n', '<br>')}
                    </div>

                    <div class="admin-catalog-actions">
                        ${href
                            ? `<a class="btn-primary" href="${href}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Enviar parabéns</a>`
                            : `<button class="btn-secondary" type="button" disabled title="Este usuário não possui WhatsApp salvo."><i class="fab fa-whatsapp"></i> Sem WhatsApp</button>`
                        }
                    </div>
                </div>
            </article>
        `;
    }

    async function loadFromFunction(client) {
        const { data, error } = await client.rpc('aniversariantes_do_dia');
        if (error) throw error;
        return data || [];
    }

    async function loadFromTable(client) {
        const { data, error } = await client
            .from('usuarios')
            .select('id, nome, email, cidade, status, foto_url, data_nascimento, whatsapp, telefone')
            .not('data_nascimento', 'is', null)
            .eq('status', 'ativo')
            .order('nome', { ascending: true });

        if (error) throw error;

        const today = todayParts();
        return (data || []).filter((user) => {
            const value = String(user.data_nascimento || '');
            const parts = value.split('-');
            if (parts.length < 3) return false;
            return Number(parts[1]) === today.month && Number(parts[2]) === today.day;
        });
    }

    async function loadBirthdays() {
        const client = AdminCore.getClient();
        try {
            return await loadFromFunction(client);
        } catch (error) {
            console.warn('[ADMIN ANIVERSARIANTES] função indisponível, usando fallback:', error);
            return await loadFromTable(client);
        }
    }

    async function load() {
        AdminUI.setPage('aniversariantes');
        AdminUI.renderLoading('Carregando aniversariantes...');

        try {
            if (!AdminCore.isAdmin()) {
                AdminUI.setContent(`
                    <div class="admin-empty-state">
                        <i class="fas fa-lock"></i>
                        <h3>Acesso restrito</h3>
                        <p>Somente administradores podem visualizar aniversariantes.</p>
                    </div>
                `);
                return;
            }

            aniversariantes = await loadBirthdays();
            const today = todayParts();

            AdminUI.setContent(`
                <div class="section-header">
                    <div>
                        <h3>Aniversariantes do dia</h3>
                        <p>Usuários ativos que fazem aniversário hoje: ${AdminCore.escapeHTML(today.label)}.</p>
                    </div>

                    <button type="button" class="btn-primary" id="refreshBirthdaysBtn">
                        <i class="fas fa-rotate"></i>
                        Atualizar
                    </button>
                </div>

                <div class="permission-card" style="margin-bottom:18px;">
                    Use os cards para enviar uma mensagem personalizada de parabéns pelo WhatsApp gratuito do navegador. O botão aparece quando o usuário possui WhatsApp salvo.
                </div>

                ${aniversariantes.length
                    ? `<div class="admin-catalog-grid birthdays-grid">${aniversariantes.map(renderCard).join('')}</div>`
                    : AdminUI.emptyState('fa-cake-candles', 'Nenhum aniversariante hoje.', 'Quando houver aniversariantes ativos com data de nascimento cadastrada, eles aparecerão aqui.')
                }
            `);

            document.getElementById('refreshBirthdaysBtn')?.addEventListener('click', load);
        } catch (error) {
            console.error('[ADMIN ANIVERSARIANTES]', error);
            AdminUI.renderError(error.message || 'Erro ao carregar aniversariantes.');
        }
    }

    window.AdminAniversariantes = { init: load, load };
})();
