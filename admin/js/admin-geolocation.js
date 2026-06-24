// admin/js/admin-geolocation.js

(function () {
    'use strict';

    const MAP_DEFAULT_ZOOM = 15;

    let geolocalizacoesCache = [];

    function isAdmin() {
        if (typeof AdminCore?.isAdmin === 'function') {
            return AdminCore.isAdmin();
        }

        return (AdminCore?.state?.currentRoles || []).includes('admin');
    }

    function parseCoordinate(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }

        const number = Number(String(value).replace(',', '.'));

        if (Number.isNaN(number)) {
            throw new Error('Coordenada inválida.');
        }

        return number;
    }

    function validatePair(latitude, longitude) {
        const lat = parseCoordinate(latitude);
        const lng = parseCoordinate(longitude);

        if (lat === null && lng === null) {
            return {
                latitude: null,
                longitude: null
            };
        }

        if (lat === null || lng === null) {
            throw new Error('Latitude e longitude devem ser informadas juntas.');
        }

        if (lat < -90 || lat > 90) {
            throw new Error('Latitude inválida.');
        }

        if (lng < -180 || lng > 180) {
            throw new Error('Longitude inválida.');
        }

        return {
            latitude: lat,
            longitude: lng
        };
    }

    function renderMapPreview(containerId, latitude, longitude) {
        const container = document.getElementById(containerId);

        if (!container) return;

        if (!latitude || !longitude) {
            container.innerHTML = `
                <div class="admin-map-empty">
                    <i class="fas fa-map-location-dot"></i>
                    <span>Nenhuma coordenada informada.</span>
                </div>
            `;
            return;
        }

        const lat = Number(latitude);
        const lng = Number(longitude);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            container.innerHTML = `
                <div class="admin-map-empty">
                    <i class="fas fa-triangle-exclamation"></i>
                    <span>Coordenadas inválidas.</span>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="admin-map-preview">
                <iframe
                    title="Mapa"
                    loading="lazy"
                    allowfullscreen
                    referrerpolicy="no-referrer-when-downgrade"
                    src="https://maps.google.com/maps?q=${lat},${lng}&z=${MAP_DEFAULT_ZOOM}&output=embed">
                </iframe>

                <div class="admin-map-coords">
                    <strong>Latitude:</strong> ${lat}
                    <br>
                    <strong>Longitude:</strong> ${lng}
                </div>
            </div>
        `;
    }

    function bindPreview(latitudeInputId, longitudeInputId, previewContainerId) {
        const latInput = document.getElementById(latitudeInputId);
        const lngInput = document.getElementById(longitudeInputId);

        if (!latInput || !lngInput) return;

        const updatePreview = () => {
            renderMapPreview(
                previewContainerId,
                latInput.value,
                lngInput.value
            );
        };

        latInput.addEventListener('input', updatePreview);
        lngInput.addEventListener('input', updatePreview);

        updatePreview();
    }

    async function fillCurrentLocation(latitudeInputId, longitudeInputId, previewContainerId) {
        if (!navigator.geolocation) {
            AdminUI.renderToast('Seu navegador não suporta geolocalização.', 'error');
            return;
        }

        AdminUI.renderToast('Obtendo localização atual...');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const latInput = document.getElementById(latitudeInputId);
                const lngInput = document.getElementById(longitudeInputId);

                if (!latInput || !lngInput) return;

                latInput.value = position.coords.latitude.toFixed(8);
                lngInput.value = position.coords.longitude.toFixed(8);

                renderMapPreview(
                    previewContainerId,
                    latInput.value,
                    lngInput.value
                );

                AdminUI.renderToast('Localização capturada com sucesso.');
            },
            (error) => {
                console.error('[ADMIN GEOLOCATION]', error);
                AdminUI.renderToast('Não foi possível obter sua localização.', 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }

    async function loadNegociosWithCoordinates() {
        const client = AdminCore.getClient();

        const { data, error } = await client
            .from('negocios')
            .select(`
                id,
                nome,
                cidade,
                bairro,
                endereco_texto,
                latitude,
                longitude,
                status,
                updated_at
            `)
            .order('updated_at', { ascending: false, nullsFirst: false });

        if (error) throw error;

        return (data || []).map((item) => ({
            tipo: 'Parceiro',
            nome: item.nome,
            cidade: item.cidade || item.bairro || '-',
            endereco: item.endereco_texto || '-',
            latitude: item.latitude,
            longitude: item.longitude,
            status: item.status || '-',
            updated_at: item.updated_at
        }));
    }

    async function loadEventosWithCoordinates() {
        const client = AdminCore.getClient();

        const { data, error } = await client
            .from('eventos')
            .select(`
                id,
                nome,
                cidade,
                bairro,
                endereco_texto,
                latitude,
                longitude,
                status,
                updated_at
            `)
            .order('updated_at', { ascending: false, nullsFirst: false });

        if (error) throw error;

        return (data || []).map((item) => ({
            tipo: 'Evento',
            nome: item.nome,
            cidade: item.cidade || item.bairro || '-',
            endereco: item.endereco_texto || '-',
            latitude: item.latitude,
            longitude: item.longitude,
            status: item.status || '-',
            updated_at: item.updated_at
        }));
    }

    async function loadEntitiesWithCoordinates() {
        const [negocios, eventos] = await Promise.all([
            loadNegociosWithCoordinates(),
            loadEventosWithCoordinates()
        ]);

        geolocalizacoesCache = [
            ...negocios,
            ...eventos
        ];
    }

    function hasCoordinates(item) {
        return (
            item.latitude !== null &&
            item.latitude !== undefined &&
            item.latitude !== '' &&
            item.longitude !== null &&
            item.longitude !== undefined &&
            item.longitude !== ''
        );
    }

    function renderGeoPage() {
        const total = geolocalizacoesCache.length;
        const comGeo = geolocalizacoesCache.filter(hasCoordinates).length;
        const semGeo = total - comGeo;

        AdminUI.setContent(`
            <div class="section-header">
                <div>
                    <h3>Geolocalização</h3>
                    <p>
                        Controle e auditoria das coordenadas geográficas usadas por parceiros e eventos.
                    </p>
                </div>
            </div>

            <div class="admin-stats-grid">
                <div class="admin-home-card">
                    <i class="fas fa-location-dot"></i>
                    <strong>${total}</strong>
                    <span>Total de registros</span>
                </div>

                <div class="admin-home-card">
                    <i class="fas fa-map-location-dot"></i>
                    <strong>${comGeo}</strong>
                    <span>Com coordenadas</span>
                </div>

                <div class="admin-home-card">
                    <i class="fas fa-triangle-exclamation"></i>
                    <strong>${semGeo}</strong>
                    <span>Sem coordenadas</span>
                </div>
            </div>

            ${
                total
                    ? `
                        <div class="table-wrap">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Tipo</th>
                                        <th>Nome</th>
                                        <th>Cidade/Local</th>
                                        <th>Endereço</th>
                                        <th>Latitude</th>
                                        <th>Longitude</th>
                                        <th>Status</th>
                                        <th>Atualizado</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    ${geolocalizacoesCache.map((item) => `
                                        <tr>
                                            <td>${AdminCore.escapeHTML(item.tipo || '-')}</td>
                                            <td>${AdminCore.escapeHTML(item.nome || '-')}</td>
                                            <td>${AdminCore.escapeHTML(item.cidade || '-')}</td>
                                            <td>${AdminCore.escapeHTML(item.endereco || '-')}</td>
                                            <td>${item.latitude ?? '-'}</td>
                                            <td>${item.longitude ?? '-'}</td>
                                            <td>${AdminUI.statusBadge(item.status || 'sem-status')}</td>
                                            <td>${AdminCore.formatDate(item.updated_at)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `
                    : AdminUI.emptyState('fa-map-location-dot', 'Nenhum registro encontrado.')
            }
        `);
    }

    async function load() {
        AdminUI.setPage('geolocalizacao');
        AdminUI.renderLoading('Carregando geolocalização...');

        try {
            if (!isAdmin()) {
                AdminUI.setContent(`
                    <div class="admin-empty-state">
                        <i class="fas fa-lock"></i>
                        <h3>Acesso restrito</h3>
                        <p>Apenas administradores podem acessar este módulo.</p>
                    </div>
                `);

                return;
            }

            await loadEntitiesWithCoordinates();
            renderGeoPage();

        } catch (error) {
            console.error('[ADMIN GEOLOCATION]', error);
            AdminUI.renderError(error.message || 'Erro ao carregar geolocalização.');
        }
    }

    window.AdminGeolocation = {
        init: load,
        load,
        validatePair,
        bindPreview,
        renderMapPreview,
        fillCurrentLocation
    };

    window.AdminGeolocalizacao = window.AdminGeolocation;
})();