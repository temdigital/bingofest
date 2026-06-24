// admin/js/admin-ui.js

(function () {
    'use strict';

    const TITLES = {
        dashboard: { title: 'Dashboard', subtitle: 'Visão geral do portal' },
        usuarios: { title: 'Usuários', subtitle: 'Gestão de contas, status e permissões' },
        colunistas: { title: 'Colunistas', subtitle: 'Gestão dos autores e perfis editoriais' },
        publicacoes: { title: 'Publicações', subtitle: 'Gestão editorial de notícias e artigos' },
        negocios: { title: 'Parceiros', subtitle: 'Gestão de empresas, parceiros e anunciantes' },
        eventos: { title: 'Eventos', subtitle: 'Gestão de eventos regionais' },
        comentarios: { title: 'Comunidade', subtitle: 'Moderação do mural da comunidade' },
        geolocalizacao: { title: 'Geolocalização', subtitle: 'Gestão de localização de parceiros e eventos' },
        storage: { title: 'Mídias', subtitle: 'Gestão de arquivos e imagens' },
        remocoes: { title: 'Solicitações de Remoção', subtitle: 'Pedidos LGPD e respostas administrativas' }
    };

    function setPage(section) {
        const item = TITLES[section] || TITLES.dashboard;

        const title =
            document.getElementById('adminPageTitle') ||
            document.getElementById('pageTitle');

        const subtitle =
            document.getElementById('adminPageSubtitle') ||
            document.getElementById('pageSubtitle');

        if (title) title.textContent = item.title;
        if (subtitle) subtitle.textContent = item.subtitle;

        document.querySelectorAll('.admin-menu-item, .nav-link').forEach((link) => {
            link.classList.toggle('active', link.dataset.section === section);
        });
    }

    function setContent(html) {
        const content =
            document.getElementById('adminContent') ||
            document.getElementById('dashboardContent');

        if (!content) return;

        content.innerHTML = html;
    }

    function renderLoading(message = 'Carregando...') {
        setContent(`
            <div class="admin-loading-state loading-box">
                <i class="fas fa-spinner fa-spin"></i>
                <h2>${AdminCore.escapeHTML(message)}</h2>
            </div>
        `);
    }

    function renderError(message) {
        setContent(`
            <div class="admin-empty-state error-state">
                <i class="fas fa-triangle-exclamation"></i>
                <h3>Não foi possível carregar</h3>
                <p>${AdminCore.escapeHTML(message || 'Erro inesperado.')}</p>
            </div>
        `);
    }

    function statusBadge(status) {
        const normalized = AdminCore.normalize(status || 'sem-status');

        return `
            <span class="status-badge status-${AdminCore.escapeHTML(normalized)}">
                ${AdminCore.escapeHTML(status || 'Sem status')}
            </span>
        `;
    }

    function statCard(title, value, icon) {
        return `
            <article class="stat-card">
                <div class="stat-info">
                    <span>${AdminCore.escapeHTML(title)}</span>
                    <strong>${Number(value || 0)}</strong>
                </div>

                <div class="stat-icon">
                    <i class="fas ${AdminCore.escapeHTML(icon)}"></i>
                </div>
            </article>
        `;
    }

    function renderToast(message, type = 'success') {
        const existing = document.querySelector('.admin-toast');

        if (existing) existing.remove();

        const toast = document.createElement('div');

        toast.className = `admin-toast admin-toast-${type} ${type}`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-triangle-exclamation'}"></i>
            <span>${AdminCore.escapeHTML(message)}</span>
        `;

        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 20);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 250);
        }, 3200);
    }

    function openMobileMenu() {
        document.getElementById('adminSidebar')?.classList.add('open');
        document.getElementById('adminOverlay')?.classList.add('active');
    }

    function closeMobileMenu() {
        document.getElementById('adminSidebar')?.classList.remove('open');
        document.getElementById('adminOverlay')?.classList.remove('active');
    }

    function setupMobileMenu() {
        const toggle =
            document.getElementById('adminSidebarToggle') ||
            document.getElementById('menuBtn');

        toggle?.addEventListener('click', openMobileMenu);
        document.getElementById('adminOverlay')?.addEventListener('click', closeMobileMenu);
    }

    function closeModal(modalId) {
        document.getElementById(modalId)?.remove();
    }

    function closeModalWithBody(modalId) {
        closeModal(modalId);

        if (!document.querySelector('.admin-modal-backdrop')) {
            document.body.classList.remove('admin-modal-open');
        }
    }

    function createModal(options) {
        const {
            id,
            title,
            subtitle,
            body,
            formId,
            submitLabel = 'Salvar',
            onSubmit,
            afterOpen
        } = options;

        closeModal(id);

        const modal = document.createElement('div');

        modal.className = 'admin-modal-backdrop';
        modal.id = id;
        modal.innerHTML = `
            <div class="admin-modal" role="dialog" aria-modal="true">
                <div class="admin-modal-header">
                    <div>
                        <h3>${AdminCore.escapeHTML(title)}</h3>
                        <p>${AdminCore.escapeHTML(subtitle || '')}</p>
                    </div>

                    <button class="admin-modal-close" type="button" data-close-modal="${AdminCore.escapeHTML(id)}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <form id="${AdminCore.escapeHTML(formId)}" class="admin-modal-form">
                    <div class="admin-modal-body">
                        ${body}
                    </div>

                    <div class="admin-modal-actions">
                        <button class="btn-secondary" type="button" data-close-modal="${AdminCore.escapeHTML(id)}">
                            Cancelar
                        </button>

                        <button class="btn-primary" type="submit">
                            <i class="fas fa-save"></i>
                            ${AdminCore.escapeHTML(submitLabel)}
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.classList.add('admin-modal-open');

        modal.querySelectorAll('[data-close-modal]').forEach((button) => {
            button.addEventListener('click', () => closeModalWithBody(id));
        });

        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeModalWithBody(id);
        });

        document.getElementById(formId)?.addEventListener('submit', async (event) => {
            event.preventDefault();

            if (typeof onSubmit === 'function') {
                await onSubmit(event);
            }
        });

        if (typeof afterOpen === 'function') {
            afterOpen(modal);
        }

        return modal;
    }

    function emptyState(icon, message, colspan = null) {
        const content = `
            <div class="empty-state admin-empty-state">
                <i class="fas ${AdminCore.escapeHTML(icon)}"></i>
                <p>${AdminCore.escapeHTML(message)}</p>
            </div>
        `;

        if (!colspan) return content;

        return `
            <tr>
                <td colspan="${Number(colspan)}">
                    ${content}
                </td>
            </tr>
        `;
    }

    function ensureDynamicStyles() {
        if (document.getElementById('adminDynamicStyles')) return;

        const style = document.createElement('style');

        style.id = 'adminDynamicStyles';
        style.textContent = `
            body.admin-modal-open {
                overflow: hidden;
            }

            .admin-toast {
                position: fixed;
                right: 22px;
                bottom: 22px;
                z-index: 3000;
                min-width: 260px;
                max-width: 420px;
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 16px;
                box-shadow: 0 20px 45px rgba(15, 23, 42, .16);
                padding: 14px 16px;
                display: flex;
                align-items: center;
                gap: 10px;
                transform: translateY(18px);
                opacity: 0;
                pointer-events: none;
                transition: .25s ease;
                font-weight: 800;
            }

            .admin-toast.show {
                transform: translateY(0);
                opacity: 1;
            }

            .admin-toast-success i {
                color: #16a34a;
            }

            .admin-toast-error i {
                color: #dc2626;
            }

            .admin-modal-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(15, 23, 42, .58);
                z-index: 2500;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                padding: 24px 18px;
                overflow-y: auto;
                scrollbar-width: thin;
                scrollbar-color: #216c39 #e2e8f0;
            }

            .admin-modal-backdrop::-webkit-scrollbar,
            .admin-modal-body::-webkit-scrollbar {
                width: 10px;
            }

            .admin-modal-backdrop::-webkit-scrollbar-track,
            .admin-modal-body::-webkit-scrollbar-track {
                background: #e2e8f0;
                border-radius: 999px;
            }

            .admin-modal-backdrop::-webkit-scrollbar-thumb,
            .admin-modal-body::-webkit-scrollbar-thumb {
                background: #216c39;
                border-radius: 999px;
            }

            .admin-modal {
                width: 100%;
                max-width: 980px;
                max-height: calc(100vh - 48px);
                margin: auto 0;
                background: #ffffff;
                border-radius: 24px;
                box-shadow: 0 30px 80px rgba(15, 23, 42, .25);
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }

            .admin-modal-header {
                padding: 22px 24px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 16px;
                flex: 0 0 auto;
            }

            .admin-modal-header h3 {
                margin: 0 0 6px;
                font-size: 1.25rem;
                font-weight: 900;
                color: #1e293b;
            }

            .admin-modal-header p {
                margin: 0;
                color: #64748b;
                line-height: 1.5;
            }

            .admin-modal-close {
                border: 0;
                width: 38px;
                height: 38px;
                border-radius: 12px;
                background: #f8fafc;
                cursor: pointer;
                color: #1e293b;
            }

            .admin-modal-form {
                min-height: 0;
                display: flex;
                flex-direction: column;
                flex: 1 1 auto;
            }

            .admin-modal-body {
                padding: 24px;
                overflow-y: auto;
                flex: 1 1 auto;
                min-height: 0;
                scrollbar-width: thin;
                scrollbar-color: #216c39 #e2e8f0;
            }

            .admin-form-grid {
                display: grid;
                gap: 16px;
            }

            .admin-form-grid.two {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .admin-form-grid.three {
                grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .admin-form-group.full {
                grid-column: 1 / -1;
            }

            .admin-form-group label {
                display: block;
                font-weight: 900;
                margin-bottom: 8px;
                color: #1e293b;
            }

            .admin-form-group input,
            .admin-form-group select,
            .admin-form-group textarea {
                width: 100%;
                min-height: 46px;
                border: 1px solid #e2e8f0;
                border-radius: 14px;
                padding: 0 14px;
                font-family: inherit;
                font-size: .98rem;
                background: #ffffff;
                color: #1e293b;
            }

            .admin-form-group textarea {
                padding: 14px;
                min-height: 150px;
                resize: vertical;
            }

            .admin-form-group input:disabled,
            .admin-form-group select:disabled {
                background: #f8fafc;
                color: #64748b;
                cursor: not-allowed;
            }

            .admin-modal-actions {
                padding: 18px 24px 24px;
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                border-top: 1px solid #e2e8f0;
                flex: 0 0 auto;
                background: #ffffff;
            }

            .admin-image-empty {
                min-height: 96px;
                border: 1px dashed #e2e8f0;
                border-radius: 16px;
                background: #f8fafc;
                color: #64748b;
                display: grid;
                place-items: center;
                padding: 14px;
                text-align: center;
                font-weight: 800;
            }

            .admin-image-preview {
                width: 100%;
                max-height: 320px;
                object-fit: contain;
                display: block;
                border-radius: 18px;
                border: 1px solid #e2e8f0;
                background: #f8fafc;
                padding: 6px;
            }

            .permission-card {
                background: #fffdf5;
                border: 1px solid #fef3c7;
                border-radius: 18px;
                padding: 14px;
                color: #92400e;
                font-size: .92rem;
                line-height: 1.5;
            }

            .user-actions {
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
            }

            .link-clean {
                color: #216c39;
                font-weight: 800;
                text-decoration: none;
            }

            .link-clean:hover {
                text-decoration: underline;
            }

            .rich-editor {
                border: 1px solid #e2e8f0;
                border-radius: 16px;
                overflow: hidden;
                background: #ffffff;
            }

            .rich-editor-toolbar {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                padding: 10px;
                border-bottom: 1px solid #e2e8f0;
                background: #f8fafc;
                position: sticky;
                top: 0;
                z-index: 3;
            }

            .rich-editor-toolbar button,
            .rich-editor-format {
                min-width: 38px;
                height: 36px;
                border: 1px solid #e2e8f0;
                background: #ffffff;
                border-radius: 10px;
                cursor: pointer;
                font-weight: 900;
                color: #1e293b;
            }

            .rich-editor-format {
                width: 150px;
                padding: 0 10px;
            }

            .rich-editor-toolbar button:hover,
            .rich-editor-format:hover {
                color: #216c39;
                border-color: #216c39;
            }

            .rich-editor-content {
                min-height: 500px;
                overflow: visible;
                padding: 18px;
                outline: none;
                line-height: 1.8;
                color: #1e293b;
                background: #ffffff;
            }

            .rich-editor-content img {
                max-width: 100%;
                width: auto;
                height: auto;
                border-radius: 16px;
                margin: 14px 0;
                display: block;
            }

            .rich-editor-content h1,
            .rich-editor-content h2,
            .rich-editor-content h3 {
                margin: 18px 0 10px;
                line-height: 1.25;
            }

            .rich-editor-content p {
                margin: 0 0 12px;
            }

            .rich-editor-content blockquote {
                margin: 18px 0;
                padding: 16px 18px;
                border-left: 5px solid #fba309;
                background: #fff8df;
                border-radius: 0 14px 14px 0;
                font-weight: 700;
            }

            .rich-editor-content table {
                width: 100%;
                border-collapse: collapse;
                margin: 18px 0;
            }

            .rich-editor-content th,
            .rich-editor-content td {
                border: 1px solid #e2e8f0;
                padding: 10px;
            }

            .rich-editor-content th {
                background: #216c39;
                color: #ffffff;
            }

            .rich-editor-content .article-video {
                position: relative;
                width: 100%;
                aspect-ratio: 16 / 9;
                margin: 18px 0;
                border-radius: 16px;
                overflow: hidden;
                background: #0f172a;
            }

            .rich-editor-content .article-video iframe {
                width: 100%;
                height: 100%;
            }

            .rich-editor-hidden {
                display: none !important;
            }

            @media (max-width: 760px) {
                .admin-modal {
                    max-height: calc(100vh - 20px);
                    border-radius: 18px;
                }

                .admin-modal-backdrop {
                    padding: 10px;
                    align-items: flex-start;
                }

                .admin-form-grid.two,
                .admin-form-grid.three {
                    grid-template-columns: 1fr;
                }

                .admin-modal-actions {
                    flex-direction: column-reverse;
                }

                .admin-modal-actions button {
                    width: 100%;
                }

                .admin-toast {
                    left: 14px;
                    right: 14px;
                    bottom: 14px;
                    min-width: auto;
                }

                .rich-editor-content {
                    min-height: 420px;
                }

                .rich-editor-format {
                    width: 100%;
                }
            }
        `;

        document.head.appendChild(style);
    }

    ensureDynamicStyles();

    window.AdminUI = {
        setPage,
        setContent,
        renderLoading,
        renderError,
        renderToast,
        statusBadge,
        statCard,
        openMobileMenu,
        closeMobileMenu,
        setupMobileMenu,
        createModal,
        closeModal: closeModalWithBody,
        emptyState,
        ensureDynamicStyles
    };
})();