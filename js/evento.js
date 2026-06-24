// js/evento.js

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

    function formatDateTime(value) {
        if (!value) return 'A definir';

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return 'A definir';

        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function money(value) {
        if (value === null || value === undefined || value === '') {
            return 'Gratuito';
        }

        const number = Number(value);

        if (Number.isNaN(number) || number <= 0) {
            return 'Gratuito';
        }

        return number.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    }

    function buildMapUrl(latitude, longitude) {
        if (!latitude || !longitude) return '';
        return `https://www.google.com/maps?q=${latitude},${longitude}`;
    }

    function buildEmbedMap(latitude, longitude) {
        if (!latitude || !longitude) return '';
        return `https://www.google.com/maps?q=${latitude},${longitude}&output=embed`;
    }

    function setMeta(evento) {
        const title = evento.nome || 'Evento';
        const description =
            stripHTML(evento.descricao || '').substring(0, 160) ||
            'Evento do Entorno Sul.';

        if (window.PublicSEO) {
            const meta = PublicSEO.update({
                title,
                description,
                image: evento.imagem_banner_url,
                url: `evento.html?slug=${encodeURIComponent(evento.slug || getSlug())}`,
                type: 'event'
            });

            PublicSEO.setJsonLD('schema-event', {
                '@context': 'https://schema.org',
                '@type': 'Event',
                name: title,
                description: meta.description,
                image: meta.image,
                startDate: evento.data_inicio || undefined,
                endDate: evento.data_fim || undefined,
                eventStatus: 'https://schema.org/EventScheduled',
                eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
                location: {
                    '@type': 'Place',
                    name: evento.local || evento.cidade || 'Entorno Sul',
                    address: evento.endereco_texto || evento.endereco || evento.cidade || 'Entorno Sul'
                },
                organizer: {
                    '@type': 'Organization',
                    name: evento.realizador || evento.responsavel || 'Tem no Entorno Sul'
                },
                offers: {
                    '@type': 'Offer',
                    price: evento.valor || 0,
                    priceCurrency: 'BRL',
                    availability: 'https://schema.org/InStock',
                    url: meta.url
                }
            });
            return;
        }

        document.title = `${title} | Tem no Entorno Sul`;

        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) metaDescription.setAttribute('content', description);
    }

    function renderError(message) {
        const root = document.getElementById('eventoRoot');

        if (!root) return;

        root.innerHTML = `
            <section class="error-state">
                <i class="fas fa-triangle-exclamation"></i>

                <h1>Evento não encontrado</h1>

                <p>${escapeHTML(message)}</p>

                <a href="eventos.html" class="header-btn">
                    <i class="fas fa-arrow-left"></i>
                    Voltar aos eventos
                </a>
            </section>
        `;
    }

    async function loadRelated(eventoAtual) {
        const client = getClient();

        if (!client) return '';

        try {
            const { data } = await client
                .from('v_eventos_publicos')
                .select('*')
                .neq('id', eventoAtual.id)
                .order('data_inicio', { ascending: true, nullsFirst: false })
                .limit(3);

            if (!data?.length) return '';

            return `
                <section class="related-section">
                    <h2 class="related-title">Outros eventos</h2>

                    <div class="related-grid">
                        ${data.map((evento) => `
                            <article class="related-card">
                                ${
                                    evento.imagem_banner_url
                                        ? `
                                            <img
                                                src="${escapeHTML(evento.imagem_banner_url)}"
                                                alt="${escapeHTML(evento.nome)}"
                                            >
                                        `
                                        : `
                                            <div class="related-placeholder">
                                                <i class="fas fa-calendar-alt"></i>
                                            </div>
                                        `
                                }

                                <div class="related-body">
                                    <h3>${escapeHTML(evento.nome)}</h3>

                                    <p>
                                        ${escapeHTML(stripHTML(evento.descricao || '').substring(0, 90))}...
                                    </p>

                                    <a href="evento.html?slug=${encodeURIComponent(evento.slug)}">
                                        Ver evento →
                                    </a>
                                </div>
                            </article>
                        `).join('')}
                    </div>
                </section>
            `;

        } catch (error) {
            console.warn('[EVENTO] Eventos relacionados não carregados:', error);
            return '';
        }
    }

    async function renderEvento(evento) {
        const root = document.getElementById('eventoRoot');

        if (!root) return;

        setMeta(evento);

        const mapEmbed = buildEmbedMap(evento.latitude, evento.longitude);
        const mapLink = buildMapUrl(evento.latitude, evento.longitude);
        const relatedHtml = await loadRelated(evento);

        root.innerHTML = `
            <section class="event-page">
                <div class="container">
                    <article class="event-card">
                        ${
                            evento.imagem_banner_url
                                ? `
                                    <img
                                        class="event-banner"
                                        src="${escapeHTML(evento.imagem_banner_url)}"
                                        alt="${escapeHTML(evento.nome)}"
                                    >
                                `
                                : ''
                        }

                        <div class="event-content">
                            <a href="eventos.html" class="event-kicker">
                                <i class="fas fa-calendar-alt"></i>
                                ${escapeHTML(evento.categoria_nome || 'Evento')}
                            </a>

                            <h1 class="event-title">
                                ${escapeHTML(evento.nome)}
                            </h1>

                            <div class="event-summary">
                                <div class="summary-item">
                                    <i class="fas fa-calendar-days"></i>

                                    <div>
                                        <span>Início</span>
                                        <strong>${escapeHTML(formatDateTime(evento.data_inicio))}</strong>
                                    </div>
                                </div>

                                <div class="summary-item">
                                    <i class="fas fa-calendar-check"></i>

                                    <div>
                                        <span>Fim</span>
                                        <strong>${escapeHTML(formatDateTime(evento.data_fim))}</strong>
                                    </div>
                                </div>

                                <div class="summary-item">
                                    <i class="fas fa-location-dot"></i>

                                    <div>
                                        <span>Local</span>
                                        <strong>
                                            ${
                                                escapeHTML(
                                                    [
                                                        evento.endereco_texto,
                                                        evento.bairro,
                                                        evento.cidade
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' • ')
                                                ) || 'A definir'
                                            }
                                        </strong>
                                    </div>
                                </div>

                                <div class="summary-item">
                                    <i class="fas fa-ticket"></i>

                                    <div>
                                        <span>Ingresso</span>
                                        <strong>${escapeHTML(money(evento.valor))}</strong>
                                    </div>
                                </div>

                                <div class="summary-item">
                                    <i class="fas fa-user-group"></i>

                                    <div>
                                        <span>Realizador</span>
                                        <strong>
                                            ${escapeHTML(evento.realizador || evento.responsavel || 'Não informado')}
                                        </strong>
                                    </div>
                                </div>

                                <div class="summary-item">
                                    <i class="fas fa-user-shield"></i>

                                    <div>
                                        <span>Classificação</span>
                                        <strong>${escapeHTML(evento.classificacao || 'Livre')}</strong>
                                    </div>
                                </div>
                            </div>

                            <div class="event-actions">
                                ${
                                    mapLink
                                        ? `
                                            <a
                                                class="action-btn"
                                                href="${escapeHTML(mapLink)}"
                                                target="_blank"
                                                rel="noopener"
                                            >
                                                <i class="fas fa-route"></i>
                                                Como chegar
                                            </a>
                                        `
                                        : ''
                                }

                                <a class="action-btn light" href="eventos.html">
                                    <i class="fas fa-calendar-alt"></i>
                                    Todos os eventos
                                </a>
                            </div>

                            <div id="userActionsRoot"></div>

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
                                                    title="Mapa do evento ${escapeHTML(evento.nome)}"
                                                ></iframe>
                                            </div>
                                        </section>
                                    `
                                    : ''
                            }

                            <div class="event-description">
                                ${evento.descricao || '<p>Descrição não informada.</p>'}
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
                tipoConteudo: 'evento',
                conteudoId: evento.id,
                titulo: evento.nome,
                texto: stripHTML(evento.descricao || '').slice(0, 120),
                imagem: evento.imagem_banner_url || '',
                url: `evento.html?slug=${encodeURIComponent(evento.slug || getSlug())}`
            });
        }
    }

    async function loadEvento() {
        const slug = getSlug();

        if (!slug) {
            renderError('Slug do evento não informado.');
            return;
        }

        const client = getClient();

        if (!client) {
            renderError('Supabase não encontrado.');
            return;
        }

        try {
            const { data, error } = await client
                .from('v_eventos_publicos')
                .select('*')
                .eq('slug', slug)
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                renderError('Evento não encontrado ou indisponível.');
                return;
            }

            await renderEvento(data);

        } catch (error) {
            console.error('[EVENTO]', error);
            renderError(error.message || 'Erro ao carregar evento.');
        }
    }

    document.addEventListener('DOMContentLoaded', loadEvento);
})();