// components/cookies.js

(function () {
    'use strict';

    const STORAGE_KEY = 'temnoentornosul_cookie_consent_v2';
    const LEGACY_KEY = 'temnoentornosul_cookie_consent_v1';
    const GA_ID = 'G-5FS77TS1WV';

    function parseStoredValue(key) {
        try {
            return JSON.parse(window.localStorage.getItem(key) || 'null');
        } catch {
            return null;
        }
    }

    function getConsent() {
        const current = parseStoredValue(STORAGE_KEY);
        if (current?.status) return current;

        const legacy = parseStoredValue(LEGACY_KEY);
        if (!legacy?.status) return null;

        const migrated = {
            status: legacy.status,
            updated_at: legacy.accepted_at || new Date().toISOString(),
            version: 2
        };

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        window.localStorage.removeItem(LEGACY_KEY);
        return migrated;
    }

    function isAccepted() {
        return getConsent()?.status === 'accepted';
    }

    function ensureGtag() {
        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function gtag() {
            window.dataLayer.push(arguments);
        };
    }

    function updateGoogleConsent(status) {
        ensureGtag();

        const granted = status === 'accepted';
        window[`ga-disable-${GA_ID}`] = !granted;

        window.gtag('consent', 'update', {
            analytics_storage: granted ? 'granted' : 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
        });
    }

    function loadGoogleAnalytics() {
        if (!isAccepted()) return;
        if (document.querySelector(`script[data-ga-id="${GA_ID}"]`)) return;

        ensureGtag();
        window[`ga-disable-${GA_ID}`] = false;

        window.gtag('consent', 'default', {
            analytics_storage: 'granted',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
        });
        window.gtag('js', new Date());
        window.gtag('config', GA_ID, {
            anonymize_ip: true,
            allow_google_signals: false,
            allow_ad_personalization_signals: false
        });

        const script = document.createElement('script');
        script.async = true;
        script.dataset.gaId = GA_ID;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
        document.head.appendChild(script);
    }

    function saveConsent(status) {
        const value = {
            status,
            updated_at: new Date().toISOString(),
            version: 2
        };

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        window.localStorage.removeItem(LEGACY_KEY);
        updateGoogleConsent(status);

        if (status === 'accepted') {
            loadGoogleAnalytics();
        }

        window.dispatchEvent(new CustomEvent('temnoentornosul:consent-changed', {
            detail: value
        }));

        return value;
    }

    function injectStyles() {
        if (document.getElementById('cookieConsentStyles')) return;

        const style = document.createElement('style');
        style.id = 'cookieConsentStyles';
        style.textContent = `
            .cookie-consent-banner {
                position: fixed;
                z-index: 10000;
                left: 16px;
                right: 16px;
                bottom: 16px;
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                gap: 20px;
                align-items: center;
                max-width: 1120px;
                margin: 0 auto;
                padding: 18px 20px;
                color: #193322;
                background: rgba(255, 255, 255, .98);
                border: 1px solid rgba(33, 108, 57, .24);
                border-radius: 16px;
                box-shadow: 0 18px 60px rgba(15, 23, 42, .22);
                font: 400 15px/1.5 Roboto, Arial, sans-serif;
            }
            .cookie-consent-banner strong {
                display: block;
                margin-bottom: 4px;
                color: #216c39;
                font-size: 17px;
            }
            .cookie-consent-banner p { margin: 0; }
            .cookie-consent-banner a {
                color: #216c39;
                font-weight: 700;
                text-decoration: underline;
            }
            .cookie-consent-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                justify-content: flex-end;
            }
            .cookie-consent-actions button {
                min-height: 42px;
                padding: 10px 16px;
                border: 1px solid #216c39;
                border-radius: 10px;
                cursor: pointer;
                font: 700 14px/1 Roboto, Arial, sans-serif;
            }
            .cookie-consent-actions [data-cookie-choice="rejected"] {
                color: #216c39;
                background: #fff;
            }
            .cookie-consent-actions [data-cookie-choice="accepted"] {
                color: #fff;
                background: #216c39;
            }
            .cookie-preferences-link {
                border: 0;
                padding: 0;
                color: inherit;
                background: transparent;
                cursor: pointer;
                font: inherit;
                text-decoration: underline;
            }
            @media (max-width: 720px) {
                .cookie-consent-banner {
                    grid-template-columns: 1fr;
                    gap: 14px;
                    padding: 16px;
                }
                .cookie-consent-actions { justify-content: stretch; }
                .cookie-consent-actions button { flex: 1 1 130px; }
            }
        `;
        document.head.appendChild(style);
    }

    function closeBanner() {
        document.getElementById('cookieConsentBanner')?.remove();
    }

    function renderBanner(force = false) {
        if (!force && getConsent()) return;
        if (document.getElementById('cookieConsentBanner')) return;

        injectStyles();

        const banner = document.createElement('section');
        banner.id = 'cookieConsentBanner';
        banner.className = 'cookie-consent-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-labelledby', 'cookieConsentTitle');
        banner.innerHTML = `
            <div>
                <strong id="cookieConsentTitle">Privacidade e cookies</strong>
                <p>
                    Usamos recursos essenciais para o funcionamento do portal. O Google Analytics
                    somente será carregado após sua autorização. Consulte a
                    <a href="privacidade.html">Política de Privacidade</a>.
                </p>
            </div>
            <div class="cookie-consent-actions">
                <button type="button" data-cookie-choice="rejected">Recusar opcionais</button>
                <button type="button" data-cookie-choice="accepted">Aceitar Analytics</button>
            </div>
        `;

        document.body.appendChild(banner);

        banner.querySelectorAll('[data-cookie-choice]').forEach((button) => {
            button.addEventListener('click', () => {
                saveConsent(button.dataset.cookieChoice);
                closeBanner();
            });
        });
    }

    function addPreferencesLink() {
        if (document.querySelector('[data-cookie-preferences]')) return;

        const container = document.querySelector('.footer-bottom-links');
        if (!container) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cookie-preferences-link';
        button.dataset.cookiePreferences = 'true';
        button.textContent = 'Preferências de cookies';
        button.addEventListener('click', () => renderBanner(true));
        container.appendChild(button);
    }

    function initialize() {
        injectStyles();

        const consent = getConsent();
        if (consent?.status === 'accepted') {
            updateGoogleConsent('accepted');
            loadGoogleAnalytics();
        } else {
            updateGoogleConsent('rejected');
            if (!consent) renderBanner();
        }

        window.setTimeout(addPreferencesLink, 350);
    }

    document.addEventListener('DOMContentLoaded', initialize);

    window.CookieConsent = {
        getConsent,
        isAccepted,
        saveConsent,
        openPreferences: () => renderBanner(true),
        loadGoogleAnalytics
    };
})();
