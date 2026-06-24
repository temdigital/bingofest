// components/seo.js

(function () {
    'use strict';

    const SITE_NAME = 'Tem no Entorno Sul';
    const SITE_URL = 'https://www.temnoentornosul.com.br';
    const DEFAULT_IMAGE = `${SITE_URL}/assets/logo-tem-no-entorno-sul.png`;

    function absoluteUrl(pathOrUrl) {
        const value = String(pathOrUrl || '').trim();

        if (!value) return window.location.href;
        if (/^https?:\/\//i.test(value)) return value;

        if (value.startsWith('/')) {
            return `${SITE_URL}${value}`;
        }

        return `${SITE_URL}/${value.replace(/^\/+/, '')}`;
    }

    function stripHTML(value) {
        const div = document.createElement('div');
        div.innerHTML = String(value || '');
        return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
    }

    function limit(value, size = 160) {
        const text = stripHTML(value);

        if (text.length <= size) return text;

        return `${text.slice(0, size - 3).trim()}...`;
    }

    function ensureMeta(selector, attrs) {
        let element = document.querySelector(selector);

        if (!element) {
            element = document.createElement('meta');

            Object.entries(attrs.seed || {}).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });

            document.head.appendChild(element);
        }

        Object.entries(attrs.set || {}).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });

        return element;
    }

    function setCanonical(url) {
        const href = absoluteUrl(url || window.location.pathname + window.location.search);

        let link = document.querySelector('link[rel="canonical"]');

        if (!link) {
            link = document.createElement('link');
            link.setAttribute('rel', 'canonical');
            document.head.appendChild(link);
        }

        link.setAttribute('href', href);
    }

    function setJsonLD(id, data) {
        if (!data) return;

        let script = document.getElementById(id);

        if (!script) {
            script = document.createElement('script');
            script.id = id;
            script.type = 'application/ld+json';
            document.head.appendChild(script);
        }

        script.textContent = JSON.stringify(data);
    }

    function update(config = {}) {
        const title = config.title || SITE_NAME;
        const description = limit(config.description || 'Notícias, eventos, empresas parceiras e informações do Entorno Sul de Brasília.', 160);
        const image = absoluteUrl(config.image || DEFAULT_IMAGE);
        const url = absoluteUrl(config.url || window.location.pathname + window.location.search);
        const type = config.type || 'website';

        document.title = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

        ensureMeta('meta[name="description"]', {
            seed: { name: 'description' },
            set: { content: description }
        });

        ensureMeta('meta[name="robots"]', {
            seed: { name: 'robots' },
            set: { content: config.robots || 'index,follow' }
        });

        ensureMeta('meta[property="og:site_name"]', {
            seed: { property: 'og:site_name' },
            set: { content: SITE_NAME }
        });

        ensureMeta('meta[property="og:type"]', {
            seed: { property: 'og:type' },
            set: { content: type }
        });

        ensureMeta('meta[property="og:title"]', {
            seed: { property: 'og:title' },
            set: { content: document.title }
        });

        ensureMeta('meta[property="og:description"]', {
            seed: { property: 'og:description' },
            set: { content: description }
        });

        ensureMeta('meta[property="og:image"]', {
            seed: { property: 'og:image' },
            set: { content: image }
        });

        ensureMeta('meta[property="og:image:secure_url"]', {
            seed: { property: 'og:image:secure_url' },
            set: { content: image }
        });

        ensureMeta('meta[property="og:image:alt"]', {
            seed: { property: 'og:image:alt' },
            set: { content: title }
        });

        ensureMeta('meta[property="og:url"]', {
            seed: { property: 'og:url' },
            set: { content: url }
        });

        ensureMeta('meta[name="twitter:card"]', {
            seed: { name: 'twitter:card' },
            set: { content: 'summary_large_image' }
        });

        ensureMeta('meta[name="twitter:title"]', {
            seed: { name: 'twitter:title' },
            set: { content: document.title }
        });

        ensureMeta('meta[name="twitter:description"]', {
            seed: { name: 'twitter:description' },
            set: { content: description }
        });

        ensureMeta('meta[name="twitter:image"]', {
            seed: { name: 'twitter:image' },
            set: { content: image }
        });

        setCanonical(url);

        return {
            title: document.title,
            description,
            image,
            url,
            type
        };
    }

    function organizationSchema() {
        return {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
            logo: DEFAULT_IMAGE,
            sameAs: [
                'https://www.instagram.com/temnoentornosul',
                'https://www.youtube.com/@temnoentornosul'
            ]
        };
    }

    window.PublicSEO = {
        SITE_NAME,
        SITE_URL,
        DEFAULT_IMAGE,
        absoluteUrl,
        stripHTML,
        limit,
        update,
        setJsonLD,
        organizationSchema
    };

    document.addEventListener('DOMContentLoaded', () => {
        setJsonLD('schema-organization', organizationSchema());
    });
})();
