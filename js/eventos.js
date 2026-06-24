// js/eventos.js

(function () {
    'use strict';

    let allEventos = [];
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
        const temp = document.createElement('div');
        temp.innerHTML = String(value || '');
        return temp.textContent || temp.innerText || '';
    }

    function resumo(value, limite = 120) {
        const text = stripHTML(value).trim();
        if (!text) return 'Confira os detalhes deste evento.';
        if (text.length <= limite) return text;
        return `${text.slice(0, limite).trim()}...`;
    }

    function formatDateTime(value) {
        if (!value) return 'Data a definir';

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Data a definir';

        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function money(value) {
        if (value === null || value === undefined || value === '') return 'Gratuito';

        const number = Number(value);
        if (Number.isNaN(number) || number <= 0) return 'Gratuito';

        return number.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    }

    function parseCoord(value) {
        if (value === null || value === undefined || value === '') return null;
        const number = Number(value);
        return Number.isNaN(number) ? null : number;
    }

    function hasCoords(item) {
        return parseCoord(item.latitude) !== null && parseCoord(item.longitude) !== null;
    }

    function mapUrl(item) {
        if (!hasCoords(item)) return '';
        return `https://www.google.com/maps?q=${item.latitude},${item.longitude}`;
    }

    function embedMapUrl(item) {
        if (!hasCoords(item)) return '';
        return `https://www.google.com/maps?q=${item.latitude},${item.longitude}&output=embed`;
    }

    function eventoUrl(item) {
        if (!item.slug) return 'eventos.html';
        return `evento.html?slug=${encodeURIComponent(item.slug)}`;
    }

    function distanceKm(a, b) {
        if (!a || !b) return null;

        const lat1 = Number(a.latitude);
        const lon1 = Number(a.longitude);
        const lat2 = Number(b.latitude);
        const lon2 = Number(b.longitude);

        if ([lat1, lon1, lat2, lon2].some(Number.isNaN)) return null;

        const earthRadius = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;

        const x =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

        return earthRadius * (2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
    }

    function renderError(message) {
        document.getElementById('eventosRoot').innerHTML = `
            <div class="error-state">
                <i class="fas fa-triangle-exclamation"></i>
                <h2>Não foi possível carregar</h2>
                <p>${escapeHTML(message)}</p>
            </div>
        `;
    }

    function renderEmpty(message = 'Nenhum evento disponível no momento.') {
        document.getElementById('eventosRoot').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-alt"></i>
                <h2>Nenhum evento encontrado</h2>
                <p>${escapeHTML(message)}</p>
            </div>
        `;
    }

    function renderResultsInfo(total) {
        const info = document.getElementById('resultsInfo');
        if (!info) return;

        info.textContent = total === 1
            ? '1 evento encontrado.'
            : `${total} eventos encontrados.`;
    }

    function renderMap(item) {
        const mapBox = document.getElementById('mapBox');

        if (!mapBox) return;

        if (!item || !hasCoords(item)) {
            mapBox.innerHTML = `
                <div class="map-empty">
                    <div>
                        <i class="fas fa-map-location-dot"></i>
                        <p>Selecione um evento com localização para abrir no mapa.</p>
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
                title="Mapa do evento ${escapeHTML(item.nome)}"
            ></iframe>
        `;
    }

    function populateFilters() {
        const categoriaSelect = document.getElementById('categoriaFilter');
        const cidadeSelect = document.getElementById('cidadeFilter');

        const categorias = [...new Map(
            allEventos
                .filter((item) => item.categoria_id && item.categoria_nome)
                .map((item) => [item.categoria_id, item.categoria_nome])
        )];

        const cidades = [...new Set(
            allEventos
                .map((item) => item.cidade)
                .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, 'pt-BR'));

        if (categoriaSelect) {
            categoriaSelect.innerHTML = `
                <option value="">Todas</option>
                ${categorias.map(([id, nome]) => `
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

    function getFilteredEventos() {
        const search = normalizeText(document.getElementById('searchInput')?.value || '');
        const categoriaId = document.getElementById('categoriaFilter')?.value || '';
        const cidade = document.getElementById('cidadeFilter')?.value || '';
        const ordem = document.getElementById('ordemFilter')?.value || 'proximos';

        let filtered = allEventos.filter((item) => {
            const matchesCategoria = !categoriaId || item.categoria_id === categoriaId;
            const matchesCidade = !cidade || item.cidade === cidade;

            const searchable = normalizeText([
                item.nome,
                item.descricao,
                item.cidade,
                item.bairro,
                item.endereco_texto,
                item.categoria_nome,
                item.realizador,
                item.responsavel
            ].join(' '));

            const matchesSearch = !search || searchable.includes(search);

            return matchesCategoria && matchesCidade && matchesSearch;
        });

        return sortEventos(filtered, ordem);
    }

    function sortEventos(items, ordem) {
        const copy = [...items];

        if (ordem === 'destaques') {
            return copy.sort((a, b) => {
                if (Boolean(b.destaque) !== Boolean(a.destaque)) {
                    return Number(Boolean(b.destaque)) - Number(Boolean(a.destaque));
                }

                return new Date(a.data_inicio || 8640000000000000) - new Date(b.data_inicio || 8640000000000000);
            });
        }

        if (ordem === 'gratuitos') {
            return copy.sort((a, b) => {
                const aFree = !Number(a.valor || 0);
                const bFree = !Number(b.valor || 0);

                if (aFree !== bFree) return Number(bFree) - Number(aFree);

                return new Date(a.data_inicio || 8640000000000000) - new Date(b.data_inicio || 8640000000000000);
            });
        }

        if (ordem === 'titulo') {
            return copy.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
        }

        if (ordem === 'proximidade' && userLocation) {
            return copy.sort((a, b) => {
                const da = distanceKm(userLocation, a);
                const db = distanceKm(userLocation, b);

                if (da === null && db === null) return 0;
                if (da === null) return 1;
                if (db === null) return -1;

                return da - db;
            });
        }

        return copy.sort((a, b) => new Date(a.data_inicio || 8640000000000000) - new Date(b.data_inicio || 8640000000000000));
    }

    function renderEventos(eventos) {
        const root = document.getElementById('eventosRoot');

        if (!eventos.length) {
            renderResultsInfo(0);
            renderEmpty('Tente limpar os filtros ou buscar por outro termo.');
            renderMap(null);
            return;
        }

        renderResultsInfo(eventos.length);

        root.innerHTML = eventos.map((item) => {
            const categoria = item.categoria_nome || 'Evento';
            const local = [item.bairro, item.cidade].filter(Boolean).join(' — ') || item.endereco_texto || 'Local a definir';
            const distancia = userLocation && hasCoords(item)
                ? distanceKm(userLocation, item)
                : null;

            const linkEvento = eventoUrl(item);

            return `
                <article class="event-card">
                    <a href="${escapeHTML(linkEvento)}" aria-label="Ler evento ${escapeHTML(item.nome)}">
                        ${item.imagem_banner_url ? `
                            <img class="event-cover" src="${escapeHTML(item.imagem_banner_url)}" alt="${escapeHTML(item.nome)}">
                        ` : `
                            <div class="event-placeholder">
                                <i class="fas fa-calendar-alt"></i>
                            </div>
                        `}
                    </a>

                    <div class="event-body">
                        <div class="event-category">
                            <i class="fas fa-tag"></i>
                            ${escapeHTML(categoria)}
                        </div>

                        <h2 class="event-title">
                            <a href="${escapeHTML(linkEvento)}" style="color:inherit;text-decoration:none;">
                                ${escapeHTML(item.nome)}
                            </a>
                        </h2>

                        <p class="event-description">${escapeHTML(resumo(item.descricao))}</p>

                        <div class="event-meta">
                            <span>
                                <i class="fas fa-calendar-alt"></i>
                                ${escapeHTML(formatDateTime(item.data_inicio))}
                            </span>

                            <span>
                                <i class="fas fa-location-dot"></i>
                                ${escapeHTML(local)}
                            </span>

                            <span>
                                <i class="fas fa-ticket"></i>
                                ${escapeHTML(money(item.valor))}
                            </span>

                            ${distancia !== null ? `
                                <span>
                                    <i class="fas fa-route"></i>
                                    ${distancia.toFixed(1).replace('.', ',')} km de você
                                </span>
                            ` : ''}
                        </div>

                        <div class="event-actions">
                            <a class="event-btn" href="${escapeHTML(linkEvento)}">
                                <i class="fas fa-book-open"></i>
                                Saiba mais
                            </a>

                            ${hasCoords(item) ? `
                                <button class="event-btn btn-map secondary" type="button" data-event-id="${escapeHTML(item.id)}">
                                    <i class="fas fa-map"></i>
                                    Ver mapa
                                </button>

                                <a class="event-btn secondary" href="${escapeHTML(mapUrl(item))}" target="_blank">
                                    <i class="fas fa-location-arrow"></i>
                                    Rotas
                                </a>
                            ` : ''}
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        bindMapButtons(eventos);
    }

    function bindMapButtons(eventos) {
        document.querySelectorAll('.btn-map').forEach((button) => {
            button.addEventListener('click', () => {
                const evento = eventos.find((item) => item.id === button.dataset.eventId);
                renderMap(evento);
                document.getElementById('mapBox')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        });
    }

    function applyFilters() {
        renderEventos(getFilteredEventos());
    }

    function bindFilters() {
        document.getElementById('searchInput')?.addEventListener('input', applyFilters);
        document.getElementById('categoriaFilter')?.addEventListener('change', applyFilters);
        document.getElementById('cidadeFilter')?.addEventListener('change', applyFilters);
        document.getElementById('ordemFilter')?.addEventListener('change', applyFilters);

        document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
            document.getElementById('searchInput').value = '';
            document.getElementById('categoriaFilter').value = '';
            document.getElementById('cidadeFilter').value = '';
            document.getElementById('ordemFilter').value = 'proximos';

            userLocation = null;

            applyFilters();
        });

        document.getElementById('usarLocalizacaoBtn')?.addEventListener('click', useLocation);
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

                const ordemFilter = document.getElementById('ordemFilter');

                if (ordemFilter && ![...ordemFilter.options].some((option) => option.value === 'proximidade')) {
                    const option = document.createElement('option');
                    option.value = 'proximidade';
                    option.textContent = 'Mais próximos de mim';
                    ordemFilter.appendChild(option);
                }

                if (ordemFilter) ordemFilter.value = 'proximidade';

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

    async function loadEventos() {
        const client = getClient();

        if (!client) {
            renderError('Não foi possível conectar ao Supabase.');
            return;
        }

        try {
            const { data, error } = await client
                .from('v_eventos_publicos')
                .select('*')
                .order('data_inicio', { ascending: true, nullsFirst: false });

            if (error) throw error;

            allEventos = data || [];

            populateFilters();
            bindFilters();
            applyFilters();

        } catch (error) {
            console.error('[EVENTOS]', error);
            renderError(error.message || 'Erro ao carregar eventos.');
        }
    }

    document.addEventListener('DOMContentLoaded', loadEventos);
})();