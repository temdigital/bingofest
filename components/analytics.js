// components/analytics.js

(function () {
    'use strict';

    let tracked = false;

    function getClient() {
        return window.supabaseClient || null;
    }

    function hasConsent() {
        return window.CookieConsent?.isAccepted?.() === true;
    }

    function getSlug() {
        return new URLSearchParams(window.location.search).get('slug') || null;
    }

    function inferType() {
        const page = window.location.pathname.split('/').pop() || 'index.html';

        if (page === 'publicacao.html') return 'publicacao';
        if (page === 'evento.html') return 'evento';
        if (page === 'parceiro.html') return 'parceiro';
        if (page === 'colunista.html') return 'colunista';
        if (page === 'index.html' || page === '') return 'home';

        return page.replace('.html', '');
    }

    async function trackPageView(extra = {}) {
        if (tracked || !hasConsent()) return false;

        const client = getClient();
        if (!client) return false;

        try {
            let userId = null;

            try {
                const { data } = await client.auth.getUser();
                userId = data?.user?.id || null;
            } catch {
                userId = null;
            }

            const { error } = await client
                .from('analytics_paginas')
                .insert({
                    pagina: window.location.pathname,
                    slug: getSlug(),
                    tipo: inferType(),
                    referencia_id: extra.referencia_id || null,
                    user_id: userId,
                    user_agent: navigator.userAgent
                });

            if (error) throw error;

            tracked = true;
            return true;
        } catch (error) {
            console.warn('[ANALYTICS] pageview ignorado:', error?.message || error);
            return false;
        }
    }

    function scheduleTrack() {
        window.setTimeout(() => trackPageView(), 700);
    }

    document.addEventListener('DOMContentLoaded', scheduleTrack);

    window.addEventListener('temnoentornosul:consent-changed', (event) => {
        if (event.detail?.status === 'accepted') {
            scheduleTrack();
        }
    });

    window.PortalAnalytics = {
        trackPageView
    };
})();
