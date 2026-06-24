// js/colunistas.js

(function () {
    'use strict';

    function getClient() {
        return window.supabaseClient || window.supabase?.client || null;
    }

    function escapeHTML(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function stripHTML(value) {
        const temp = document.createElement('div');
        temp.innerHTML = String(value || '');
        return temp.textContent || temp.innerText || '';
    }

    function resumo(value, limite = 120) {
        const text = stripHTML(value).trim();

        if (!text) return 'Conheça as publicações deste colunista no Tem no Entorno Sul.';

        if (text.length <= limite) return text;

        return `${text.slice(0, limite).trim()}...`;
    }

    function initial(nome) {
        return String(nome || 'T').trim().charAt(0).toUpperCase();
    }

    function renderError(message) {
        document.getElementById('colunistasRoot').innerHTML = `
            <div class="error-state">
                <i class="fas fa-triangle-exclamation"></i>
                <h2>Não foi possível carregar</h2>
                <p>${escapeHTML(message)}</p>
            </div>
        `;
    }

    function renderEmpty() {
        document.getElementById('colunistasRoot').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h2>Nenhum colunista disponível</h2>
                <p>Os colunistas aparecerão aqui assim que forem cadastrados.</p>
            </div>
        `;
    }

    function renderColunistas(colunistas) {
        const root = document.getElementById('colunistasRoot');

        if (!colunistas.length) {
            renderEmpty();
            return;
        }

        root.innerHTML = colunistas.map((item) => {
            const href = `colunista.html?slug=${encodeURIComponent(item.slug)}`;

            return `
                <article class="author-card">
                    ${item.foto_url ? `
                        <img class="author-photo" src="${escapeHTML(item.foto_url)}" alt="${escapeHTML(item.nome)}">
                    ` : `
                        <div class="author-initial">${escapeHTML(initial(item.nome))}</div>
                    `}

                    <h2>${escapeHTML(item.nome)}</h2>

                    <p class="author-role">${escapeHTML(item.formacao || 'Colunista')}</p>

                    <p class="author-bio">${escapeHTML(resumo(item.biografia))}</p>

                    <a class="author-link" href="${escapeHTML(href)}">
                        Ver perfil
                        <i class="fas fa-arrow-right"></i>
                    </a>
                </article>
            `;
        }).join('');
    }

    async function loadColunistas() {
        const client = getClient();

        if (!client) {
            renderError('Não foi possível conectar ao Supabase.');
            return;
        }

        try {
            const { data, error } = await client
                .from('v_colunistas_publicos')
                .select('*')
                .order('nome', { ascending: true });

            if (error) throw error;

            renderColunistas(data || []);

        } catch (error) {
            console.error('[COLUNISTAS]', error);
            renderError(error.message || 'Erro ao carregar colunistas.');
        }
    }

    document.addEventListener('DOMContentLoaded', loadColunistas);
})();