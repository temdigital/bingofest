// js/parceiros.js

(function () {
    'use strict';

    let allParceiros = [];
    let userLocation = null;

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

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function stripHTML(value) {
        const div = document.createElement('div');
        div.innerHTML = String(value || '');
        return div.textContent || div.innerText || '';
    }

    function resumo(value, limite = 130) {
        const texto = stripHTML(value).trim();

        if (!texto) return 'Conheça esta empresa parceira do Tem no Entorno Sul.';
        if (texto.length <= limite) return texto;

        return `${texto.slice(0, limite).trim()}...`;
    }

    function parceiroUrl(item) {
        return item.slug
            ? `parceiro.html?slug=${encodeURIComponent(item.slug)}`
            : 'parceiros.html';
    }

    function hasCoords(item) {
        return item?.latitude !== null &&
            item?.latitude !== undefined &&
            item?.longitude !== null &&
            item?.longitude !== undefined &&
            item?.latitude !== '' &&
            item?.longitude !== '';
    }

    function mapUrl(item) {
        if (!hasCoords(item)) return '';
        return `https://www.google.com/maps?q=${item.latitude},${item.longitude}`;
    }

    function embedMapUrl(item) {
        if (!hasCoords(item)) return '';
        return `https://www.google.com/maps?q=${item.latitude},${item.longitude}&output=embed`;
    }

    function distanceKm(a, b) {
        if (!a || !b || !hasCoords(b)) return null;

        const lat1 = Number(a.latitude);
        const lon1 = Number(a.longitude);
        const lat2 = Number(b.latitude);
        const lon2 = Number(b.longitude);

        if ([lat1, lon1, lat2, lon2].some(Number.isNaN)) return null;

        const radius = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;

        const calc =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

        return radius * (2 * Math.atan2(Math.sqrt(calc), Math.sqrt(1 - calc)));
    }

    function renderMap(item) {
        const mapBox = document.getElementById('mapBox');

        if (!mapBox) return;

        if (!item || !hasCoords(item)) {
            mapBox.innerHTML = `
                <div class="map-empty">
                    <div>
                        <i class="fas fa-map-location-dot"></i>
                        <p>Selecione uma empresa com localização para visualizar no mapa.</p>
                    </div>
                </div>
            `;
            return;
        }

        mapBox.innerHTML = `
            <iframe
                src="${escapeHTML(embedMapUrl(item))}"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
                title="Mapa de ${escapeHTML(item.nome)}"
            ></iframe>
        `;
    }

    function renderError(message) {
        const root = document.getElementById('parceirosRoot');

        if (!root) return;

        root.innerHTML = `
            <div class="error-state">
                <i class="fas fa-triangle-exclamation"></i>
                <h2>Não foi possível carregar</h2>
                <p>${escapeHTML(message)}</p>
            </div>
        `;
    }

    function renderEmpty(message) {
        const root = document.getElementById('parceirosRoot');

        if (!root) return;

        root.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-store-slash"></i>
                <h2>Nenhuma empresa encontrada</h2>
                <p>${escapeHTML(message)}</p>
            </div>
        `;
    }

    function renderResultsInfo(total) {
        const el = document.getElementById('resultsInfo');

        if (!el) return;

        el.textContent = total === 1
            ? '1 empresa encontrada.'
            : `${total} empresas encontradas.`;
    }

    function populateFilters() {
        const tipoSelect = document.getElementById('tipoFilter');
        const cidadeSelect = document.getElementById('cidadeFilter');

        const tipos = [
            ...new Map(
                allParceiros
                    .filter((item) => item.tipo_negocio_id && item.tipo_negocio_nome)
                    .map((item) => [item.tipo_negocio_id, item.tipo_negocio_nome])
            )
        ];

        const cidades = [
            ...new Set(
                allParceiros
                    .map((item) => item.cidade)
                    .filter(Boolean)
            )
        ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

        if (tipoSelect) {
            tipoSelect.innerHTML = `
                <option value="">Todas</option>
                ${tipos.map(([id, nome]) => `
                    <option value="${escapeHTML(id)}">${escapeHTML(nome)}</option>
                `).join('')}
            `;
        }

        if (cidadeSelect) {
            cidadeSelect.innerHTML = `
                <option value="">Todas</option>
                ${cidades.map((cidade) => `
                    <option value="${escapeHTML(cidade)}">${escapeHTML(cidade)}</option>
                `).join('')}
            `;
        }
    }

    function sortParceiros(items, ordem) {
        const list = [...items];

        if (ordem === 'titulo') {
            return list.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
        }

        if (ordem === 'verificados') {
            return list.sort((a, b) => {
                if (Boolean(b.verificado) !== Boolean(a.verificado)) {
                    return Number(Boolean(b.verificado)) - Number(Boolean(a.verificado));
                }

                return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
            });
        }

        if (ordem === 'proximidade' && userLocation) {
            return list.sort((a, b) => {
                const da = distanceKm(userLocation, a);
                const db = distanceKm(userLocation, b);

                if (da === null && db === null) return 0;
                if (da === null) return 1;
                if (db === null) return -1;

                return da - db;
            });
        }

        if (ordem === 'recentes') {
            return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        }

        return list.sort((a, b) => {
            if (Boolean(b.destaque) !== Boolean(a.destaque)) {
                return Number(Boolean(b.destaque)) - Number(Boolean(a.destaque));
            }

            return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
        });
    }

    function getFilteredParceiros() {
        const search = normalizeText(document.getElementById('searchInput')?.value || '');
        const tipo = document.getElementById('tipoFilter')?.value || '';
        const cidade = document.getElementById('cidadeFilter')?.value || '';
        const ordem = document.getElementById('ordemFilter')?.value || 'destaques';

        const filtered = allParceiros.filter((item) => {
            const matchesTipo = !tipo || item.tipo_negocio_id === tipo;
            const matchesCidade = !cidade || item.cidade === cidade;

            const searchable = normalizeText([
                item.nome,
                item.descricao,
                item.cidade,
                item.bairro,
                item.endereco_texto,
                item.tipo_negocio_nome,
                item.categoria_principal,
                item.responsavel
            ].join(' '));

            const matchesSearch = !search || searchable.includes(search);

            return matchesTipo && matchesCidade && matchesSearch;
        });

        return sortParceiros(filtered, ordem);
    }

    function renderParceiros(items) {
        const root = document.getElementById('parceirosRoot');

        if (!root) return;

        if (!items.length) {
            renderResultsInfo(0);
            renderEmpty('Tente alterar os filtros ou limpar a busca.');
            return;
        }

        renderResultsInfo(items.length);

        root.innerHTML = items.map((item) => {
            const distancia = userLocation && hasCoords(item)
                ? distanceKm(userLocation, item)
                : null;

            const categoria = item.tipo_negocio_nome || item.categoria_principal || 'Empresa';
            const linkPerfil = parceiroUrl(item);

            return `
                <article class="partner-card">
                    <a href="${escapeHTML(linkPerfil)}" aria-label="Ver empresa ${escapeHTML(item.nome)}">
                        ${item.imagem_capa_url ? `
                            <img
                                class="partner-cover"
                                src="${escapeHTML(item.imagem_capa_url)}"
                                alt="${escapeHTML(item.nome)}"
                                loading="lazy"
                            >
                        ` : `
                            <div class="partner-placeholder">
                                <i class="fas fa-store"></i>
                            </div>
                        `}
                    </a>

                    <div class="partner-body">
                        <div class="partner-top">
                            ${item.imagem_logo_url ? `
                                <img
                                    class="partner-logo"
                                    src="${escapeHTML(item.imagem_logo_url)}"
                                    alt="${escapeHTML(item.nome)}"
                                    loading="lazy"
                                >
                            ` : `
                                <div class="partner-initial">
                                    ${escapeHTML(String(item.nome || 'E').charAt(0))}
                                </div>
                            `}

                            <div>
                                <div class="partner-category">
                                    <i class="fas fa-tag"></i>
                                    ${escapeHTML(categoria)}
                                </div>
                            </div>
                        </div>

                        <h2 class="partner-title">
                            <a href="${escapeHTML(linkPerfil)}" style="color:inherit;text-decoration:none;">
                                ${escapeHTML(item.nome)}
                            </a>

                            ${item.verificado ? `
                                <i class="fas fa-circle-check verified-icon" title="Empresa verificada"></i>
                            ` : ''}
                        </h2>

                        <p class="partner-description">
                            ${escapeHTML(resumo(item.descricao))}
                        </p>

                        <div class="partner-meta">
                            ${item.cidade ? `
                                <span>
                                    <i class="fas fa-location-dot"></i>
                                    ${escapeHTML(item.cidade)}
                                </span>
                            ` : ''}

                            ${distancia !== null ? `
                                <span>
                                    <i class="fas fa-route"></i>
                                    ${distancia.toFixed(1).replace('.', ',')} km de você
                                </span>
                            ` : ''}
                        </div>

                        <div class="partner-actions">
                            <a href="${escapeHTML(linkPerfil)}" class="partner-btn">
                                <i class="fas fa-building"></i>
                                Ver empresa
                            </a>

                            ${hasCoords(item) ? `
                                <button class="partner-btn secondary btn-map" type="button" data-id="${escapeHTML(item.id)}">
                                    <i class="fas fa-map"></i>
                                    Mapa
                                </button>

                                <a class="partner-btn secondary" href="${escapeHTML(mapUrl(item))}" target="_blank">
                                    <i class="fas fa-location-arrow"></i>
                                    Rotas
                                </a>
                            ` : ''}
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        bindMapButtons(items);
    }

    function bindMapButtons(items) {
        document.querySelectorAll('.btn-map').forEach((button) => {
            button.addEventListener('click', () => {
                const parceiro = items.find((item) => item.id === button.dataset.id);

                renderMap(parceiro);

                document.getElementById('mapBox')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            });
        });
    }

    function applyFilters() {
        renderParceiros(getFilteredParceiros());
    }

    function useLocation() {
        if (!navigator.geolocation) {
            alert('Seu navegador não suporta geolocalização.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };

                const ordem = document.getElementById('ordemFilter');

                if (ordem && ![...ordem.options].some((item) => item.value === 'proximidade')) {
                    const option = document.createElement('option');
                    option.value = 'proximidade';
                    option.textContent = 'Mais próximos de mim';
                    ordem.appendChild(option);
                }

                if (ordem) ordem.value = 'proximidade';

                applyFilters();
            },
            () => {
                alert('Não foi possível obter sua localização.');
            },
            {
                enableHighAccuracy: true,
                timeout: 12000,
                maximumAge: 30000
            }
        );
    }

    function bindFilters() {
        document.getElementById('searchInput')?.addEventListener('input', applyFilters);
        document.getElementById('tipoFilter')?.addEventListener('change', applyFilters);
        document.getElementById('cidadeFilter')?.addEventListener('change', applyFilters);
        document.getElementById('ordemFilter')?.addEventListener('change', applyFilters);
        document.getElementById('usarLocalizacaoBtn')?.addEventListener('click', useLocation);

        document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
            const searchInput = document.getElementById('searchInput');
            const tipoFilter = document.getElementById('tipoFilter');
            const cidadeFilter = document.getElementById('cidadeFilter');
            const ordemFilter = document.getElementById('ordemFilter');

            if (searchInput) searchInput.value = '';
            if (tipoFilter) tipoFilter.value = '';
            if (cidadeFilter) cidadeFilter.value = '';
            if (ordemFilter) ordemFilter.value = 'destaques';

            userLocation = null;

            renderMap(null);
            applyFilters();
        });
    }

    async function loadParceiros() {
        const client = getClient();

        if (!client) {
            renderError('Erro ao conectar ao Supabase.');
            return;
        }

        try {
            const { data, error } = await client
                .from('v_negocios_publicos')
                .select('*')
                .order('destaque', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;

            allParceiros = data || [];

            populateFilters();
            bindFilters();
            renderMap(null);
            applyFilters();

        } catch (error) {
            console.error('[PARCEIROS]', error);
            renderError(error.message || 'Erro ao carregar empresas.');
        }
    }

    document.addEventListener('DOMContentLoaded', loadParceiros);
})();