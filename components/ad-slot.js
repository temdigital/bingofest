// components/ad-slot.js
// Release Candidate - publicidade pública estável, responsiva e clicável.

(function () {
    'use strict';

    const TABLE_ADS = 'publicidades';
    const TABLE_CLICKS = 'publicidade_cliques';

    const POSITION_LABELS = {
        topo: 'Topo do site',
        home_meio: 'Meio da home',
        entre_cards: 'Entre cards',
        lateral_desktop: 'Lateral desktop',
        rodape: 'Rodapé',
        comunidade_feed: 'Feed da comunidade',
        publicacoes_feed: 'Feed de publicações',
        eventos_feed: 'Feed de eventos',
        parceiros_feed: 'Feed de parceiros'
    };

    class AdSlot extends HTMLElement {
        connectedCallback() {
            this.posicao = this.getAttribute('posicao') || this.dataset.posicao || 'entre_cards';
            this.classList.add('ad-slot', `ad-${this.posicao}`);
            this.setAttribute('data-ad-posicao', this.posicao);
            this.impressionTracked = false;
            this.onConsentChanged = (event) => {
                if (event.detail?.status === 'accepted' && this.currentAd) {
                    this.trackImpression(this.currentAd);
                }
            };
            window.addEventListener('temnoentornosul:consent-changed', this.onConsentChanged);
            this.load();
        }

        disconnectedCallback() {
            window.removeEventListener('temnoentornosul:consent-changed', this.onConsentChanged);
        }

        client() {
            return window.supabaseClient || null;
        }

        canTrack() {
            return window.CookieConsent?.isAccepted?.() === true;
        }

        esc(value) {
            return String(value ?? '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#039;');
        }

        normalizeUrl(url) {
            const raw = String(url || '').trim();
            if (!raw) return '';

            if (/^(https?:|mailto:|tel:|whatsapp:)/i.test(raw)) return raw;
            if (/^www\./i.test(raw)) return `https://${raw}`;

            return `https://${raw}`;
        }

        async load() {
            const supabase = this.client();

            if (!supabase) {
                this.fallback();
                return;
            }

            try {
                const now = new Date().toISOString();

                const { data, error } = await supabase
                    .from(TABLE_ADS)
                    .select('*')
                    .eq('ativo', true)
                    .eq('posicao', this.posicao)
                    .lte('data_inicio', now)
                    .or(`data_fim.is.null,data_fim.gte.${now}`)
                    .order('prioridade', { ascending: false })
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (error) throw error;

                const ad = Array.isArray(data) ? data[0] : null;

                if (!ad) {
                    this.fallback();
                    return;
                }

                this.currentAd = ad;
                this.render(ad);
                this.trackImpression(ad);
            } catch (error) {
                console.warn('[AD SLOT]', this.posicao, error);
                this.fallback();
            }
        }

        youtubeEmbed(url) {
            const match = String(url || '').match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/);
            return match ? `https://www.youtube.com/embed/${match[1]}` : '';
        }

        media(ad) {
            const title = this.esc(ad.texto_alt || ad.titulo || 'Publicidade');

            if (ad.tipo_midia === 'youtube' && ad.youtube_url) {
                const src = this.youtubeEmbed(ad.youtube_url);
                if (!src) return `<div class="ad-default"><strong>Publicidade</strong><span>Vídeo indisponível.</span></div>`;

                return `
                    <iframe
                        src="${src}"
                        title="${title}"
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowfullscreen
                    ></iframe>
                `;
            }

            if (ad.tipo_midia === 'video') {
                if (!ad.midia_url) return `<div class="ad-default"><strong>Publicidade</strong><span>Vídeo indisponível.</span></div>`;

                return `
                    <video
                        src="${this.esc(ad.midia_url)}"
                        muted
                        autoplay
                        loop
                        playsinline
                        preload="metadata"
                    ></video>
                `;
            }

            if (!ad.midia_url) return `<div class="ad-default"><strong>Publicidade</strong><span>Imagem indisponível.</span></div>`;

            return `
                <img
                    src="${this.esc(ad.midia_url)}"
                    alt="${title}"
                    loading="lazy"
                    decoding="async"
                >
            `;
        }

        render(ad) {
            const content = this.media(ad);
            const label = POSITION_LABELS[this.posicao] || 'Publicidade';
            const href = this.normalizeUrl(ad.link_destino);

            this.innerHTML = `
                <div class="ad-label">Publicidade · ${this.esc(label)}</div>
                ${href
                    ? `
                        <a
                            class="ad-link"
                            href="${this.esc(href)}"
                            target="_blank"
                            rel="noopener noreferrer sponsored"
                            data-ad-click="${this.esc(ad.id)}"
                            aria-label="Abrir publicidade: ${this.esc(ad.titulo || 'anúncio')}"
                        >${content}</a>
                    `
                    : `<div class="ad-link">${content}</div>`
                }
            `;

            this.querySelector('[data-ad-click]')?.addEventListener('click', () => {
                this.trackClick(ad);
            }, { passive: true });
        }

        async trackImpression(ad) {
            const supabase = this.client();
            if (!supabase || !ad?.id || !this.canTrack() || this.impressionTracked) return;

            try {
                await supabase
                    .from(TABLE_ADS)
                    .update({ impressoes: Number(ad.impressoes || 0) + 1 })
                    .eq('id', ad.id);
                this.impressionTracked = true;
            } catch (error) {
                console.warn('[AD IMPRESSION]', error);
            }
        }

        async trackClick(ad) {
            const supabase = this.client();
            if (!supabase || !ad?.id || !this.canTrack()) return;

            try {
                await supabase
                    .from(TABLE_CLICKS)
                    .insert({
                        publicidade_id: ad.id,
                        pagina: window.location.pathname,
                        posicao: this.posicao,
                        user_agent: navigator.userAgent
                    });
            } catch (error) {
                console.warn('[AD CLICK INSERT]', error);
            }

            try {
                await supabase
                    .from(TABLE_ADS)
                    .update({ cliques: Number(ad.cliques || 0) + 1 })
                    .eq('id', ad.id);
            } catch (error) {
                console.warn('[AD CLICK UPDATE]', error);
            }
        }

        fallback() {
            const label = POSITION_LABELS[this.posicao] || 'Publicidade';

            this.innerHTML = `
                <div class="ad-label">Tem no Entorno Sul · ${this.esc(label)}</div>
                <a class="ad-link" href="parceiros.html">
                    <div class="ad-default">
                        <strong>Anuncie no portal</strong>
                        <span>Fortaleça sua marca no Entorno Sul.</span>
                    </div>
                </a>
            `;
        }
    }

    if (!customElements.get('ad-slot')) {
        customElements.define('ad-slot', AdSlot);
    }
})();
