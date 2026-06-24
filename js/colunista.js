// js/colunista.js

(function () {
    'use strict';

    function getClient() {
        return window.supabaseClient || null;
    }

    function getSlug() {
        const params = new URLSearchParams(window.location.search);
        return String(params.get('slug') || '').trim();
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
        const div = document.createElement('div');
        div.innerHTML = String(value || '');
        return div.textContent || div.innerText || '';
    }

    function firstLetter(value) {
        return String(value || 'C').trim().charAt(0).toUpperCase();
    }

    function formatDate(value) {
        if (!value) return '';

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return '';

        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }

    function setMeta(colunista) {
        document.title = `${colunista.nome || 'Colunista'} | Tem no Entorno Sul`;

        const metaDescription = document.querySelector('meta[name="description"]');

        if (metaDescription) {
            metaDescription.setAttribute(
                'content',
                stripHTML(
                    colunista.bio ||
                    colunista.biografia ||
                    `${colunista.nome || 'Colunista'} no Tem no Entorno Sul.`
                ).slice(0, 160)
            );
        }
    }

    function renderError(message) {
        const root = document.getElementById('colunistaRoot');

        if (!root) return;

        root.innerHTML = `
            <section
                class="error-state"
                style="
                    width:min(760px, calc(100% - 32px));
                    margin:70px auto;
                    background:#fff;
                    border:1px solid #e2e8f0;
                    border-radius:24px;
                    box-shadow:0 22px 60px rgba(15,23,42,.10);
                    padding:42px 24px;
                    text-align:center;
                "
            >
                <i class="fas fa-user-slash" style="font-size:2.4rem;color:#216c39;"></i>

                <h1 style="margin:16px 0 8px;color:#12231a;">
                    Colunista não encontrado
                </h1>

                <p style="color:#64748b;">
                    ${escapeHTML(message)}
                </p>

                <a
                    href="colunistas.html"
                    style="
                        display:inline-flex;
                        align-items:center;
                        gap:8px;
                        margin-top:18px;
                        color:#216c39;
                        font-weight:900;
                        text-decoration:none;
                    "
                >
                    <i class="fas fa-arrow-left"></i>
                    Ver colunistas
                </a>
            </section>
        `;
    }


    function mergeColunistaData(primary, secondary) {
        const result = Object.assign({}, primary || {});

        Object.entries(secondary || {}).forEach(([key, value]) => {
            const current = result[key];

            if ((current === null || current === undefined || current === '') && value !== null && value !== undefined && value !== '') {
                result[key] = value;
            }
        });

        return result;
    }

    function normalizeExternalUrl(value) {
        const url = String(value || '').trim();

        if (!url || url === '-' || url === '#') return '';

        if (/^(https?:)?\/\//i.test(url)) {
            return url.startsWith('//') ? `https:${url}` : url;
        }

        if (/^(mailto:|tel:|whatsapp:)/i.test(url)) return url;

        return `https://${url}`;
    }

    function renderColunistaLinks(colunista) {
        const links = [
            {
                label: 'Site',
                icon: 'fas fa-globe',
                url: colunista.site
            },
            {
                label: 'Instagram',
                icon: 'fab fa-instagram',
                url: colunista.instagram
            },
            {
                label: 'Facebook',
                icon: 'fab fa-facebook-f',
                url: colunista.facebook
            },
            {
                label: 'TikTok',
                icon: 'fab fa-tiktok',
                url: colunista.tiktok
            },
            {
                label: 'Kwai',
                icon: 'fas fa-video',
                url: colunista.kwai
            },
            {
                label: 'Outro link',
                icon: 'fas fa-link',
                url: colunista.outro || colunista.outro_link
            }
        ]
            .map((item) => ({
                ...item,
                url: normalizeExternalUrl(item.url)
            }))
            .filter((item) => Boolean(item.url));

        if (!links.length) return '';

        return `
            <div
                class="colunista-links-card"
                style="
                    margin-top:24px;
                    background:#ffffff;
                    border:1px solid #e2e8f0;
                    border-radius:24px;
                    box-shadow:0 18px 50px rgba(15,23,42,.08);
                    padding:22px;
                "
            >
                <h2
                    style="
                        margin:0 0 16px;
                        color:#12231a;
                        font-size:1.35rem;
                        font-weight:900;
                    "
                >
                    Links oficiais
                </h2>

                <div
                    style="
                        display:flex;
                        flex-wrap:wrap;
                        gap:12px;
                    "
                >
                    ${links.map((item) => `
                        <a
                            href="${escapeHTML(item.url)}"
                            target="_blank"
                            rel="noopener noreferrer"
                            style="
                                display:inline-flex;
                                align-items:center;
                                gap:9px;
                                min-height:42px;
                                padding:10px 14px;
                                border-radius:999px;
                                background:rgba(33,108,57,.10);
                                color:#216c39;
                                border:1px solid rgba(33,108,57,.18);
                                font-weight:900;
                                text-decoration:none;
                            "
                        >
                            <i class="${escapeHTML(item.icon)}"></i>
                            ${escapeHTML(item.label)}
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    }

    async function buscarColunistaPorView(client, slug) {
        const { data, error } = await client
            .from('v_colunistas_publicos')
            .select('*')
            .eq('slug', slug)
            .maybeSingle();

        if (error) throw error;

        return data;
    }

    async function buscarColunistaPorTabela(client, slug) {
        const { data, error } = await client
            .from('colunistas')
            .select('*')
            .eq('slug', slug)
            .maybeSingle();

        if (error) throw error;

        return data;
    }

    async function buscarColunista(client, slug) {
        let viewData = null;
        let tableData = null;

        try {
            viewData = await buscarColunistaPorView(client, slug);
        } catch (error) {
            console.warn('[COLUNISTA] View v_colunistas_publicos indisponível:', error);
        }

        try {
            tableData = await buscarColunistaPorTabela(client, slug);
        } catch (error) {
            console.warn('[COLUNISTA] Tabela colunistas indisponível:', error);
        }

        if (viewData && tableData) {
            return mergeColunistaData(viewData, tableData);
        }

        return viewData || tableData;
    }

    async function buscarPublicacoesDoColunista(client, colunista) {
        const tentativas = [
            async () => client
                .from('v_publicacoes_publicas')
                .select('*')
                .eq('colunista_id', colunista.id)
                .order('published_at', { ascending: false, nullsFirst: false })
                .limit(6),

            async () => client
                .from('v_publicacoes_publicas')
                .select('*')
                .eq('autor_id', colunista.id)
                .order('published_at', { ascending: false, nullsFirst: false })
                .limit(6),

            async () => client
                .from('v_publicacoes_publicas')
                .select('*')
                .eq('colunista_slug', colunista.slug)
                .order('published_at', { ascending: false, nullsFirst: false })
                .limit(6),

            async () => client
                .from('v_publicacoes_publicas')
                .select('*')
                .eq('autor_slug', colunista.slug)
                .order('published_at', { ascending: false, nullsFirst: false })
                .limit(6)
        ];

        for (const tentativa of tentativas) {
            try {
                const { data, error } = await tentativa();

                if (error) throw error;

                return data || [];
            } catch (error) {
                console.warn('[COLUNISTA] Tentativa de carregar publicações falhou:', error);
            }
        }

        return [];
    }

    function renderPublicacoes(publicacoes) {
        if (!publicacoes.length) {
            return `
                <div
                    style="
                        background:#ffffff;
                        border:1px solid #e2e8f0;
                        border-radius:24px;
                        padding:30px;
                        color:#64748b;
                        font-weight:700;
                        text-align:center;
                    "
                >
                    <i class="fas fa-newspaper" style="font-size:2rem;color:#216c39;"></i>
                    <p>Este colunista ainda não possui publicações disponíveis.</p>
                </div>
            `;
        }

        return `
            <div
                style="
                    display:grid;
                    grid-template-columns:repeat(3, minmax(0, 1fr));
                    gap:22px;
                "
                class="colunista-publications-grid"
            >
                ${publicacoes.map((pub) => {
                    const imagem = pub.imagem_capa_url || pub.imagem_destaque || '';
                    const dataPublicacao = formatDate(pub.published_at || pub.created_at);
                    const resumo = pub.subtitulo || stripHTML(pub.conteudo || '').slice(0, 120);
                    const link = pub.slug
                        ? `publicacao.html?slug=${encodeURIComponent(pub.slug)}`
                        : 'publicacoes.html';

                    return `
                        <article
                            style="
                                background:#ffffff;
                                border:1px solid #e2e8f0;
                                border-radius:24px;
                                overflow:hidden;
                                box-shadow:0 22px 60px rgba(15,23,42,.10);
                            "
                        >
                            ${
                                imagem
                                    ? `
                                        <a href="${escapeHTML(link)}">
                                            <img
                                                src="${escapeHTML(imagem)}"
                                                alt="${escapeHTML(pub.titulo || 'Publicação')}"
                                                style="
                                                    width:100%;
                                                    height:190px;
                                                    object-fit:cover;
                                                    display:block;
                                                "
                                            >
                                        </a>
                                    `
                                    : `
                                        <div
                                            style="
                                                height:190px;
                                                display:grid;
                                                place-items:center;
                                                background:#f8fafc;
                                                color:#216c39;
                                                font-size:2rem;
                                            "
                                        >
                                            <i class="fas fa-newspaper"></i>
                                        </div>
                                    `
                            }

                            <div style="padding:20px;">
                                <div
                                    style="
                                        display:inline-flex;
                                        background:rgba(33,108,57,.10);
                                        color:#216c39;
                                        border-radius:999px;
                                        padding:6px 10px;
                                        font-size:.78rem;
                                        font-weight:900;
                                        margin-bottom:12px;
                                    "
                                >
                                    ${escapeHTML(pub.categoria_nome || 'Publicação')}
                                </div>

                                <h3
                                    style="
                                        margin:0 0 10px;
                                        color:#12231a;
                                        font-size:1.25rem;
                                        line-height:1.25;
                                    "
                                >
                                    ${escapeHTML(pub.titulo || 'Publicação')}
                                </h3>

                                ${
                                    dataPublicacao
                                        ? `
                                            <p
                                                style="
                                                    color:#64748b;
                                                    font-weight:800;
                                                    margin:0 0 12px;
                                                    font-size:.9rem;
                                                "
                                            >
                                                <i class="fas fa-calendar-alt"></i>
                                                ${escapeHTML(dataPublicacao)}
                                            </p>
                                        `
                                        : ''
                                }

                                <p
                                    style="
                                        color:#64748b;
                                        line-height:1.55;
                                        margin:0 0 16px;
                                    "
                                >
                                    ${escapeHTML(resumo)}${resumo.length >= 120 ? '...' : ''}
                                </p>

                                <a
                                    href="${escapeHTML(link)}"
                                    style="
                                        display:inline-flex;
                                        align-items:center;
                                        gap:8px;
                                        color:#216c39;
                                        font-weight:900;
                                        text-decoration:none;
                                    "
                                >
                                    Ler publicação
                                    <i class="fas fa-arrow-right"></i>
                                </a>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        `;
    }

    async function renderColunista(colunista) {
        const root = document.getElementById('colunistaRoot');
        const client = getClient();

        if (!root || !client) return;

        setMeta(colunista);

        const foto =
            colunista.foto_url ||
            colunista.imagem_url ||
            colunista.avatar_url ||
            '';

        const bio =
            colunista.bio ||
            colunista.biografia ||
            colunista.descricao ||
            'Colunista do Tem no Entorno Sul.';

        const especialidade =
            colunista.especialidade ||
            colunista.cargo ||
            colunista.titulo ||
            'Colunista';

        const publicacoes = await buscarPublicacoesDoColunista(client, colunista);

        root.innerHTML = `
            <section
                style="
                    padding:42px 0 60px;
                    background:#fffcf7;
                    color:#1e293b;
                    font-family:Roboto, Arial, sans-serif;
                "
            >
                <div
                    class="container"
                    style="
                        width:min(1120px, calc(100% - 32px));
                        margin:0 auto;
                    "
                >
                    <article
                        style="
                            background:#ffffff;
                            border:1px solid #e2e8f0;
                            border-radius:30px;
                            box-shadow:0 22px 60px rgba(15,23,42,.10);
                            overflow:hidden;
                            margin-bottom:30px;
                        "
                    >
                        <div
                            style="
                                height:190px;
                                background:linear-gradient(135deg, #216c39, #fba309);
                            "
                        ></div>

                        <div
                            style="
                                padding:0 clamp(24px, 5vw, 48px) clamp(28px, 5vw, 48px);
                            "
                        >
                            <div
                                style="
                                    display:grid;
                                    grid-template-columns:160px 1fr;
                                    gap:26px;
                                    align-items:end;
                                    margin-top:-80px;
                                "
                                class="colunista-header-grid"
                            >
                                ${
                                    foto
                                        ? `
                                            <img
                                                src="${escapeHTML(foto)}"
                                                alt="${escapeHTML(colunista.nome)}"
                                                style="
                                                    width:160px;
                                                    height:160px;
                                                    border-radius:999px;
                                                    object-fit:cover;
                                                    border:7px solid #ffffff;
                                                    box-shadow:0 18px 42px rgba(15,23,42,.18);
                                                    background:#f8fafc;
                                                "
                                            >
                                        `
                                        : `
                                            <div
                                                style="
                                                    width:160px;
                                                    height:160px;
                                                    border-radius:999px;
                                                    border:7px solid #ffffff;
                                                    background:linear-gradient(135deg, #216c39, #fba309);
                                                    color:#ffffff;
                                                    display:grid;
                                                    place-items:center;
                                                    font-size:4rem;
                                                    font-weight:900;
                                                    box-shadow:0 18px 42px rgba(15,23,42,.18);
                                                "
                                            >
                                                ${firstLetter(colunista.nome)}
                                            </div>
                                        `
                                }

                                <div
                                    style="
                                        background:rgba(255,255,255,.94);
                                        border:1px solid rgba(226,232,240,.85);
                                        border-radius:24px;
                                        padding:20px;
                                    "
                                >
                                    <span
                                        style="
                                            display:inline-flex;
                                            align-items:center;
                                            gap:8px;
                                            background:rgba(33,108,57,.10);
                                            color:#216c39;
                                            border-radius:999px;
                                            padding:8px 14px;
                                            font-weight:900;
                                            margin-bottom:14px;
                                        "
                                    >
                                        <i class="fas fa-user-pen"></i>
                                        ${escapeHTML(especialidade)}
                                    </span>

                                    <h1
                                        style="
                                            margin:0;
                                            font-size:clamp(2rem, 5vw, 3.8rem);
                                            line-height:1.04;
                                            letter-spacing:-.04em;
                                            color:#12231a;
                                            font-weight:900;
                                        "
                                    >
                                        ${escapeHTML(colunista.nome || 'Colunista')}
                                    </h1>
                                </div>
                            </div>

                            <div id="userActionsRoot"></div>

                            <div
                                style="
                                    margin-top:26px;
                                    font-size:1.13rem;
                                    line-height:1.85;
                                    color:#263241;
                                "
                            >
                                ${bio.includes('<') ? bio : `<p>${escapeHTML(bio)}</p>`}
                            </div>

                            ${renderColunistaLinks(colunista)}
                        </div>
                    </article>

                    <section>
                        <h2
                            style="
                                margin:0 0 20px;
                                color:#12231a;
                                font-size:1.9rem;
                                font-weight:900;
                            "
                        >
                            Publicações de ${escapeHTML(colunista.nome || 'Colunista')}
                        </h2>

                        ${renderPublicacoes(publicacoes)}
                    </section>
                </div>
            </section>
        `;

        if (window.UserActions) {
            window.UserActions.init({
                rootId: 'userActionsRoot',
                tipoConteudo: 'colunista',
                conteudoId: colunista.id,
                titulo: colunista.nome || 'Colunista',
                texto: stripHTML(bio).slice(0, 120)
            });
        }
    }

    async function loadColunista() {
        const slug = getSlug();

        if (!slug) {
            renderError('Slug do colunista não informado.');
            return;
        }

        const client = getClient();

        if (!client) {
            renderError('Supabase não encontrado.');
            return;
        }

        try {
            const colunista = await buscarColunista(client, slug);

            if (!colunista) {
                renderError('Colunista não encontrado ou indisponível.');
                return;
            }

            await renderColunista(colunista);

        } catch (error) {
            console.error('[COLUNISTA]', error);
            renderError(error.message || 'Erro ao carregar colunista.');
        }
    }

    document.addEventListener('DOMContentLoaded', loadColunista);
})();