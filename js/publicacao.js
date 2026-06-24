// js/publicacao.js

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

    function setMeta(publicacao) {
        const title = publicacao.titulo || 'Publicação';
        const description =
            publicacao.subtitulo ||
            stripHTML(publicacao.conteudo || '').slice(0, 160) ||
            'Publicação do Tem no Entorno Sul.';

        if (window.PublicSEO) {
            const meta = PublicSEO.update({
                title,
                description,
                image: publicacao.imagem_capa_url,
                url: `publicacao.html?slug=${encodeURIComponent(publicacao.slug || getSlug())}`,
                type: 'article'
            });

            PublicSEO.setJsonLD('schema-newsarticle', {
                '@context': 'https://schema.org',
                '@type': 'NewsArticle',
                headline: title,
                description: meta.description,
                image: meta.image,
                datePublished: publicacao.published_at || publicacao.created_at || new Date().toISOString(),
                dateModified: publicacao.updated_at || publicacao.published_at || publicacao.created_at || new Date().toISOString(),
                author: {
                    '@type': 'Person',
                    name: publicacao.colunista_nome || publicacao.autor_nome || 'Tem no Entorno Sul'
                },
                publisher: {
                    '@type': 'Organization',
                    name: 'Tem no Entorno Sul',
                    logo: {
                        '@type': 'ImageObject',
                        url: PublicSEO.DEFAULT_IMAGE
                    }
                },
                mainEntityOfPage: meta.url
            });
            return;
        }

        document.title = `${title} | Tem no Entorno Sul`;

        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) metaDescription.setAttribute('content', description);
    }

    function renderError(message) {
        const root = document.getElementById('publicationRoot');

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
                <i class="fas fa-triangle-exclamation" style="font-size:2.4rem;color:#216c39;"></i>

                <h1 style="margin:16px 0 8px;color:#12231a;">
                    Publicação não encontrada
                </h1>

                <p style="color:#64748b;">
                    ${escapeHTML(message)}
                </p>

                <a
                    href="publicacoes.html"
                    class="back-link"
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
                    Ver publicações
                </a>
            </section>
        `;
    }

    function renderPublicacao(publicacao) {
        const root = document.getElementById('publicationRoot');

        if (!root) return;

        setMeta(publicacao);

        const autorNome =
            publicacao.autor_nome ||
            publicacao.colunista_nome ||
            'Redação';

        const autorSlug =
            publicacao.autor_slug ||
            publicacao.colunista_slug ||
            '';

        const categoria =
            publicacao.categoria_nome ||
            'Publicação';

        const dataPublicacao =
            formatDate(publicacao.published_at || publicacao.created_at);

        const autorLink = autorSlug
            ? `colunista.html?slug=${encodeURIComponent(autorSlug)}`
            : 'colunistas.html';

        root.innerHTML = `
            <article
                class="publication-page"
                style="
                    padding:42px 0 60px;
                    background:#fffcf7;
                    color:#1e293b;
                    font-family:Roboto, Arial, sans-serif;
                "
            >
                <div
                    class="publication-container container"
                    style="
                        width:min(980px, calc(100% - 32px));
                        margin:0 auto;
                    "
                >
                    <header
                        class="publication-header"
                        style="
                            background:#ffffff;
                            border:1px solid #e2e8f0;
                            border-radius:28px;
                            box-shadow:0 22px 60px rgba(15,23,42,.10);
                            padding:clamp(24px, 5vw, 48px);
                            margin-bottom:26px;
                        "
                    >
                        <a
                            href="publicacoes.html"
                            class="publication-kicker"
                            style="
                                display:inline-flex;
                                align-items:center;
                                gap:8px;
                                background:rgba(33,108,57,.10);
                                color:#216c39;
                                border-radius:999px;
                                padding:8px 14px;
                                font-weight:900;
                                text-decoration:none;
                                margin-bottom:18px;
                            "
                        >
                            <i class="fas fa-newspaper"></i>
                            ${escapeHTML(categoria)}
                        </a>

                        <h1
                            class="publication-title"
                            style="
                                margin:0;
                                font-size:clamp(2.2rem, 6vw, 4.6rem);
                                line-height:1.03;
                                letter-spacing:-.04em;
                                color:#12231a;
                                font-weight:900;
                            "
                        >
                            ${escapeHTML(publicacao.titulo || 'Publicação')}
                        </h1>

                        ${
                            publicacao.subtitulo
                                ? `
                                    <p
                                        class="publication-subtitle"
                                        style="
                                            margin:20px 0 0;
                                            font-size:clamp(1.08rem, 2vw, 1.35rem);
                                            line-height:1.65;
                                            color:#64748b;
                                        "
                                    >
                                        ${escapeHTML(publicacao.subtitulo)}
                                    </p>
                                `
                                : ''
                        }

                        <div
                            class="publication-meta"
                            style="
                                margin-top:22px;
                                display:flex;
                                flex-wrap:wrap;
                                gap:14px;
                                color:#64748b;
                                font-weight:800;
                            "
                        >
                            <a
                                href="${escapeHTML(autorLink)}"
                                style="
                                    color:#216c39;
                                    text-decoration:none;
                                    display:inline-flex;
                                    align-items:center;
                                    gap:8px;
                                    font-weight:900;
                                "
                            >
                                <i class="fas fa-user"></i>
                                ${escapeHTML(autorNome)}
                            </a>

                            ${
                                dataPublicacao
                                    ? `
                                        <span
                                            style="
                                                display:inline-flex;
                                                align-items:center;
                                                gap:8px;
                                            "
                                        >
                                            <i class="fas fa-calendar-alt"></i>
                                            ${escapeHTML(dataPublicacao)}
                                        </span>
                                    `
                                    : ''
                            }
                        </div>
                    </header>

                    ${
                        publicacao.imagem_capa_url
                            ? `
                                <img
                                    class="publication-cover"
                                    src="${escapeHTML(publicacao.imagem_capa_url)}"
                                    alt="${escapeHTML(publicacao.titulo || 'Publicação')}"
                                    style="
                                        width:100%;
                                        height:auto;
                                        max-height:520px;
                                        object-fit:cover;
                                        display:block;
                                        border-radius:28px;
                                        box-shadow:0 22px 60px rgba(15,23,42,.12);
                                        margin-bottom:26px;
                                    "
                                >
                            `
                            : ''
                    }

                    <div id="userActionsRoot"></div>

                    <section
                        class="publication-content"
                        style="
                            background:#ffffff;
                            border:1px solid #e2e8f0;
                            border-radius:28px;
                            box-shadow:0 22px 60px rgba(15,23,42,.10);
                            padding:clamp(24px, 5vw, 48px);
                            font-size:1.14rem;
                            line-height:1.9;
                            color:#263241;
                            overflow-wrap:anywhere;
                        "
                    >
                        ${publicacao.conteudo || '<p>Conteúdo não informado.</p>'}
                    </section>

                    <footer
                        class="publication-footer"
                        style="
                            margin-top:28px;
                            display:flex;
                            justify-content:flex-start;
                        "
                    >
                        <a
                            href="publicacoes.html"
                            class="back-link"
                            style="
                                display:inline-flex;
                                align-items:center;
                                gap:8px;
                                color:#216c39;
                                font-weight:900;
                                text-decoration:none;
                                background:rgba(33,108,57,.10);
                                border-radius:999px;
                                padding:12px 18px;
                            "
                        >
                            <i class="fas fa-arrow-left"></i>
                            Voltar para publicações
                        </a>
                    </footer>
                </div>
            </article>
        `;

        if (window.UserActions) {
            window.UserActions.init({
                rootId: 'userActionsRoot',
                tipoConteudo: 'publicacao',
                conteudoId: publicacao.id,
                titulo: publicacao.titulo || 'Publicação',
                texto: publicacao.subtitulo || stripHTML(publicacao.conteudo || '').slice(0, 120),
                imagem: publicacao.imagem_capa_url || '',
                url: `publicacao.html?slug=${encodeURIComponent(publicacao.slug || getSlug())}`
            });
        }
    }

    async function loadPublicacao() {
        const slug = getSlug();

        if (!slug) {
            renderError('Slug da publicação não informado.');
            return;
        }

        const client = getClient();

        if (!client) {
            renderError('Supabase não encontrado.');
            return;
        }

        try {
            const { data, error } = await client
                .from('v_publicacoes_publicas')
                .select('*')
                .eq('slug', slug)
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                renderError('Esta publicação não existe ou ainda não foi publicada.');
                return;
            }

            renderPublicacao(data);

        } catch (error) {
            console.error('[PUBLICACAO]', error);
            renderError(error.message || 'Erro ao carregar publicação.');
        }
    }

    document.addEventListener('DOMContentLoaded', loadPublicacao);
})();