// js/parceiro.js

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

    function buildMapUrl(latitude, longitude) {
        if (!latitude || !longitude) return '';
        return `https://www.google.com/maps?q=${latitude},${longitude}`;
    }

    function buildEmbedMap(latitude, longitude) {
        if (!latitude || !longitude) return '';
        return `https://www.google.com/maps?q=${latitude},${longitude}&output=embed`;
    }

    function setMeta(parceiro) {
        const title = parceiro.nome || 'Empresa Parceira';
        const description = stripHTML(
            parceiro.descricao ||
            parceiro.nome ||
            'Empresa parceira do Tem no Entorno Sul.'
        ).slice(0, 160);

        if (window.PublicSEO) {
            const meta = PublicSEO.update({
                title,
                description,
                image: parceiro.imagem_capa_url || parceiro.imagem_logo_url,
                url: `parceiro.html?slug=${encodeURIComponent(parceiro.slug || getSlug())}`,
                type: 'business.business'
            });

            PublicSEO.setJsonLD('schema-localbusiness', {
                '@context': 'https://schema.org',
                '@type': 'LocalBusiness',
                name: title,
                description: meta.description,
                image: meta.image,
                url: parceiro.site || meta.url,
                telephone: parceiro.whatsapp || parceiro.contato_negocio || undefined,
                address: {
                    '@type': 'PostalAddress',
                    streetAddress: parceiro.endereco_texto || parceiro.bairro || undefined,
                    addressLocality: parceiro.cidade || 'Entorno Sul',
                    addressRegion: 'GO',
                    addressCountry: 'BR'
                },
                geo: parceiro.latitude && parceiro.longitude
                    ? {
                        '@type': 'GeoCoordinates',
                        latitude: parceiro.latitude,
                        longitude: parceiro.longitude
                    }
                    : undefined
            });
            return;
        }

        document.title = `${title} | Tem no Entorno Sul`;
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) metaDescription.setAttribute('content', description);
    }

    function renderError(message) {
        const root = document.getElementById('parceiroRoot');

        if (!root) return;

        root.innerHTML = `
            <section class="error-state">
                <i class="fas fa-store-slash"></i>

                <h1>Parceiro não encontrado</h1>

                <p>${escapeHTML(message)}</p>

                <a href="parceiros.html" class="header-btn">
                    <i class="fas fa-arrow-left"></i>
                    Voltar para parceiros
                </a>
            </section>
        `;
    }

    function socialButton(icon, text, url) {
        if (!url) return '';

        return `
            <a
                href="${escapeHTML(url)}"
                target="_blank"
                rel="noopener"
                class="action-btn light"
            >
                <i class="${escapeHTML(icon)}"></i>
                ${escapeHTML(text)}
            </a>
        `;
    }

    async function loadRelated(parceiroAtual) {
        const client = getClient();

        if (!client) return '';

        try {
            const { data } = await client
                .from('v_negocios_publicos')
                .select('*')
                .neq('id', parceiroAtual.id)
                .order('destaque', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(3);

            if (!data?.length) return '';

            return `
                <section class="related-section">
                    <div class="container">
                        <h2 class="related-title">
                            Outras empresas parceiras
                        </h2>

                        <div class="related-grid">
                            ${data.map((item) => `
                                <article class="related-card">
                                    ${
                                        item.imagem_capa_url
                                            ? `
                                                <img
                                                    src="${escapeHTML(item.imagem_capa_url)}"
                                                    alt="${escapeHTML(item.nome)}"
                                                >
                                            `
                                            : `
                                                <div class="related-placeholder">
                                                    <i class="fas fa-store"></i>
                                                </div>
                                            `
                                    }

                                    <div class="related-body">
                                        <h3>${escapeHTML(item.nome)}</h3>

                                        <p>
                                            ${escapeHTML(stripHTML(item.descricao || '').substring(0, 90))}...
                                        </p>

                                        <a href="parceiro.html?slug=${encodeURIComponent(item.slug)}">
                                            Ver empresa →
                                        </a>
                                    </div>
                                </article>
                            `).join('')}
                        </div>
                    </div>
                </section>
            `;

        } catch (error) {
            console.warn('[PARCEIRO] Relacionados:', error);
            return '';
        }
    }

    async function renderParceiro(parceiro) {
        const root = document.getElementById('parceiroRoot');

        if (!root) return;

        setMeta(parceiro);

        const categoria =
            parceiro.tipo_negocio_nome ||
            parceiro.categoria_principal ||
            'Empresa Parceira';

        const capa = parceiro.imagem_capa_url || '';
        const logo = parceiro.imagem_logo_url || '';
        const mapLink = buildMapUrl(parceiro.latitude, parceiro.longitude);
        const mapEmbed = buildEmbedMap(parceiro.latitude, parceiro.longitude);
        const relatedHtml = await loadRelated(parceiro);

        root.innerHTML = `
            <section class="partner-page">
                <div class="container">
                    <article class="partner-card">
                        ${
                            capa
                                ? `
                                    <img
                                        class="partner-cover"
                                        src="${escapeHTML(capa)}"
                                        alt="${escapeHTML(parceiro.nome)}"
                                    >
                                `
                                : ''
                        }

                        <div class="partner-content">
                            <div class="partner-header">
                                ${
                                    logo
                                        ? `
                                            <img
                                                class="partner-logo"
                                                src="${escapeHTML(logo)}"
                                                alt="${escapeHTML(parceiro.nome)}"
                                            >
                                        `
                                        : `
                                            <div class="partner-initial">
                                                ${escapeHTML(String(parceiro.nome || 'E').charAt(0))}
                                            </div>
                                        `
                                }

                                <div class="partner-title-box">
                                    <div class="partner-kicker">
                                        <i class="fas fa-store"></i>
                                        ${escapeHTML(categoria)}
                                    </div>

                                    <h1 class="partner-title">
                                        ${escapeHTML(parceiro.nome || 'Empresa Parceira')}

                                        ${
                                            parceiro.verificado
                                                ? '<i class="fas fa-circle-check verified-icon" title="Empresa verificada"></i>'
                                                : ''
                                        }
                                    </h1>

                                    <p class="partner-subtitle">
                                        ${escapeHTML(
                                            parceiro.contato_negocio ||
                                            parceiro.responsavel ||
                                            'Empresa parceira do Tem no Entorno Sul'
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div class="partner-summary">
                                <div class="summary-item">
                                    <i class="fas fa-tag"></i>
                                    <div>
                                        <span>Categoria</span>
                                        <strong>${escapeHTML(categoria)}</strong>
                                    </div>
                                </div>

                                <div class="summary-item">
                                    <i class="fas fa-location-dot"></i>
                                    <div>
                                        <span>Localização</span>
                                        <strong>
                                            ${
                                                escapeHTML(
                                                    [
                                                        parceiro.endereco_texto,
                                                        parceiro.bairro,
                                                        parceiro.cidade
                                                    ].filter(Boolean).join(' • ')
                                                ) || 'Não informado'
                                            }
                                        </strong>
                                    </div>
                                </div>

                                <div class="summary-item">
                                    <i class="fas fa-crown"></i>
                                    <div>
                                        <span>Plano</span>
                                        <strong>${escapeHTML(parceiro.plano || 'Padrão')}</strong>
                                    </div>
                                </div>

                                <div class="summary-item">
                                    <i class="fas fa-user"></i>
                                    <div>
                                        <span>Responsável</span>
                                        <strong>${escapeHTML(parceiro.responsavel || 'Não informado')}</strong>
                                    </div>
                                </div>
                            </div>

                            <div class="partner-actions">
                                ${
                                    parceiro.whatsapp_link
                                        ? `
                                            <a
                                                href="${escapeHTML(parceiro.whatsapp_link)}"
                                                target="_blank"
                                                rel="noopener"
                                                class="action-btn"
                                            >
                                                <i class="fab fa-whatsapp"></i>
                                                WhatsApp
                                            </a>
                                        `
                                        : ''
                                }

                                ${
                                    parceiro.site
                                        ? `
                                            <a
                                                href="${escapeHTML(parceiro.site)}"
                                                target="_blank"
                                                rel="noopener"
                                                class="action-btn secondary"
                                            >
                                                <i class="fas fa-globe"></i>
                                                Site
                                            </a>
                                        `
                                        : ''
                                }

                                ${
                                    mapLink
                                        ? `
                                            <a
                                                href="${escapeHTML(mapLink)}"
                                                target="_blank"
                                                rel="noopener"
                                                class="action-btn secondary"
                                            >
                                                <i class="fas fa-route"></i>
                                                Como chegar
                                            </a>
                                        `
                                        : ''
                                }

                                <a href="parceiros.html" class="action-btn light">
                                    <i class="fas fa-store"></i>
                                    Todas as empresas
                                </a>
                            </div>

                            <div id="userActionsRoot"></div>

                            <div class="partner-actions">
                                ${socialButton('fab fa-instagram', 'Instagram', parceiro.instagram)}
                                ${socialButton('fab fa-facebook', 'Facebook', parceiro.facebook)}
                                ${socialButton('fab fa-youtube', 'YouTube', parceiro.youtube)}
                                ${socialButton('fab fa-tiktok', 'TikTok', parceiro.tiktok)}
                            </div>

                            ${
                                mapEmbed
                                    ? `
                                        <section class="map-section">
                                            <h2 class="map-title">Localização</h2>

                                            <div class="map-box">
                                                <iframe
                                                    src="${escapeHTML(mapEmbed)}"
                                                    loading="lazy"
                                                    referrerpolicy="no-referrer-when-downgrade"
                                                    title="Mapa de ${escapeHTML(parceiro.nome)}"
                                                ></iframe>
                                            </div>
                                        </section>
                                    `
                                    : ''
                            }

                            <div class="partner-description">
                                ${parceiro.descricao || '<p>Descrição não informada.</p>'}
                            </div>
                        </div>
                    </article>
                </div>

                ${relatedHtml}
            </section>
        `;

        if (window.UserActions) {
            window.UserActions.init({
                rootId: 'userActionsRoot',
                tipoConteudo: 'parceiro',
                conteudoId: parceiro.id,
                titulo: parceiro.nome,
                texto: stripHTML(parceiro.descricao || '').slice(0, 120)
            });
        }
    }

    async function loadParceiro() {
        const slug = getSlug();

        if (!slug) {
            renderError('Slug do parceiro não informado.');
            return;
        }

        const client = getClient();

        if (!client) {
            renderError('Supabase não encontrado.');
            return;
        }

        try {
            const { data, error } = await client
                .from('v_negocios_publicos')
                .select('*')
                .eq('slug', slug)
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                renderError('Parceiro não encontrado ou indisponível.');
                return;
            }

            await renderParceiro(data);

        } catch (error) {
            console.error('[PARCEIRO]', error);
            renderError(error.message || 'Erro ao carregar parceiro.');
        }
    }

    document.addEventListener('DOMContentLoaded', loadParceiro);
})();