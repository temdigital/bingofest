// components/portal-midia.js

(function () {
    'use strict';

    const TABLE = 'publicidades';
    const CLICK_TABLE = 'publicidades_cliques';

    function getClient() {
        return window.supabaseClient || null;
    }

    function escapeHTML(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function youtubeEmbed(url) {
        const raw = String(url || '').trim();
        if (!raw) return '';

        const patterns = [
            /youtube\.com\/watch\?v=([^&]+)/,
            /youtu\.be\/([^?&]+)/,
            /youtube\.com\/embed\/([^?&]+)/,
            /youtube\.com\/shorts\/([^?&]+)/
        ];

        for (const pattern of patterns) {
            const match = raw.match(pattern);
            if (match?.[1]) {
                return `https://www.youtube.com/embed/${encodeURIComponent(match[1])}`;
            }
        }

        return '';
    }

    function defaultAd(posicao) {
        const labels = {
            topo: 'Divulgue sua marca no Tem no Entorno Sul',
            meio_home: 'Sua empresa pode aparecer aqui',
            entre_cards: 'Publicidade regional com alcance local',
            lateral_desktop: 'Espaço para parceiro local',
            rodape: 'Tem no Entorno Sul — valorizando o comércio e a comunidade regional'
        };

        return `
            <div class="portal-midia-inner">
                <div class="portal-midia-default">
                    ${escapeHTML(labels[posicao] || labels.topo)}
                </div>
            </div>
        `;
    }

    class PortalMidia extends HTMLElement {
        connectedCallback() {
            this.posicao = this.getAttribute('posicao') || this.getAttribute('data-posicao') || 'topo';
            this.classList.add('portal-midia');
            this.load();
        }

        async load() {
            const client = getClient();

            if (!client) {
                this.innerHTML = defaultAd(this.posicao);
                return;
            }

            try {
                const now = new Date().toISOString();

                const { data, error } = await client
                    .from(TABLE)
                    .select('id,titulo,posicao,tipo_midia,midia_url,youtube_url,link_destino,texto_alt,data_inicio,data_fim,ativo,prioridade')
                    .eq('posicao', this.posicao)
                    .eq('ativo', true)
                    .lte('data_inicio', now)
                    .or(`data_fim.is.null,data_fim.gte.${now}`)
                    .order('prioridade', { ascending: false })
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (error) throw error;

                const item = data?.[0];

                if (!item) {
                    this.innerHTML = defaultAd(this.posicao);
                    return;
                }

                this.renderItem(item);

            } catch (error) {
                console.warn('[PORTAL MIDIA]', error);
                this.innerHTML = defaultAd(this.posicao);
            }
        }

        renderItem(item) {
            const title = escapeHTML(item.texto_alt || item.titulo || 'Publicidade');
            const link = String(item.link_destino || '').trim();
            let media = '';

            if (item.tipo_midia === 'youtube') {
                const embed = youtubeEmbed(item.youtube_url || item.midia_url);
                media = embed
                    ? `<iframe src="${embed}" title="${title}" loading="lazy" allowfullscreen></iframe>`
                    : `<div class="portal-midia-default">Vídeo indisponível</div>`;
            } else if (item.tipo_midia === 'video') {
                media = `
                    <video controls playsinline preload="metadata" title="${title}">
                        <source src="${escapeHTML(item.midia_url)}" type="video/mp4">
                    </video>
                `;
            } else {
                media = `
                    <img
                        src="${escapeHTML(item.midia_url)}"
                        alt="${title}"
                        loading="lazy"
                    >
                `;
            }

            this.innerHTML = `
                <div class="portal-midia-inner" data-publicidade-id="${escapeHTML(item.id)}">
                    ${
                        link
                            ? `<a class="portal-midia-link" href="${escapeHTML(link)}" target="_blank" rel="noopener sponsored">${media}</a>`
                            : media
                    }
                </div>
            `;

            this.querySelector('.portal-midia-link')?.addEventListener('click', () => {
                this.trackClick(item.id);
            });
        }

        async trackClick(publicidadeId) {
            const client = getClient();
            if (!client || !publicidadeId) return;

            try {
                await client
                    .from(CLICK_TABLE)
                    .insert({
                        publicidade_id: publicidadeId,
                        pagina: window.location.pathname,
                        posicao: this.posicao,
                        user_agent: navigator.userAgent
                    });
            } catch (error) {
                console.warn('[PORTAL MIDIA CLICK]', error);
            }
        }
    }

    if (!customElements.get('portal-midia')) {
        customElements.define('portal-midia', PortalMidia);
    }

    if (!customElements.get('ad-slot')) {
        customElements.define('ad-slot', PortalMidia);
    }
})();
