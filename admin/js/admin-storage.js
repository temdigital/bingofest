// admin/js/admin-storage.js

(function () {
    'use strict';

    const BUCKET_NAME = 'midias';
    const MAX_DEPTH = 3;

    let arquivosCache = [];

    function isAdmin() {
        if (typeof AdminCore?.isAdmin === 'function') return AdminCore.isAdmin();
        return (AdminCore?.state?.currentRoles || []).includes('admin');
    }

    function bytesToSize(bytes) {
        const value = Number(bytes || 0);
        if (!value) return '0 B';

        const sizes = ['B', 'KB', 'MB', 'GB'];
        const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), sizes.length - 1);

        return `${(value / Math.pow(1024, index)).toFixed(2)} ${sizes[index]}`;
    }

    function getFileIcon(name) {
        const extension = String(name || '').split('.').pop().toLowerCase();

        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) return 'fa-image';
        if (extension === 'pdf') return 'fa-file-pdf';
        if (['doc', 'docx'].includes(extension)) return 'fa-file-word';
        if (['xls', 'xlsx', 'csv'].includes(extension)) return 'fa-file-excel';
        if (['zip', 'rar', '7z'].includes(extension)) return 'fa-file-zipper';
        if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension)) return 'fa-file-video';

        return 'fa-file';
    }

    function isImage(path) {
        return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(String(path || ''));
    }

    function isVideo(path) {
        return /\.(mp4|mov|webm|avi|mkv)$/i.test(String(path || ''));
    }

    function existingImagePreview(url) {
        if (!url) {
            return `
                <div class="admin-image-empty">
                    Nenhuma imagem selecionada
                </div>
            `;
        }

        return `
            <img
                src="${AdminCore.escapeHTML(url)}"
                alt="Pré-visualização"
                class="admin-image-preview"
            >
        `;
    }

    function previewFile(inputId, previewContainerId) {
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewContainerId);

        if (!input || !preview) return;

        const file = input.files?.[0];

        if (!file) {
            preview.innerHTML = '';
            return;
        }

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();

            reader.onload = (event) => {
                preview.innerHTML = `
                    <img
                        src="${event.target.result}"
                        alt="Preview"
                        class="admin-image-preview"
                    >
                `;
            };

            reader.readAsDataURL(file);
            return;
        }

        if (file.type.startsWith('video/')) {
            const url = URL.createObjectURL(file);
            preview.innerHTML = `
                <video class="admin-image-preview" src="${url}" controls muted playsinline></video>
            `;
            return;
        }

        preview.innerHTML = `
            <div class="admin-image-empty">
                Arquivo selecionado:<br>
                <strong>${AdminCore.escapeHTML(file.name)}</strong>
            </div>
        `;
    }

    async function compressImage(file, options = {}) {
        const maxWidth = options.maxWidth || 1600;
        const maxHeight = options.maxHeight || 1200;
        const quality = options.quality || 0.82;

        if (!file.type.startsWith('image/')) return file;
        if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

        const imageUrl = URL.createObjectURL(file);

        try {
            const image = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = imageUrl;
            });

            let width = image.width;
            let height = image.height;

            const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, width, height);

            const blob = await new Promise((resolve) => {
                canvas.toBlob(resolve, 'image/webp', quality);
            });

            if (!blob) return file;

            const baseName = file.name.replace(/\.[^.]+$/, '');
            return new File([blob], `${baseName}.webp`, { type: 'image/webp' });

        } finally {
            URL.revokeObjectURL(imageUrl);
        }
    }

    async function uploadFromInput(inputId, folder = 'uploads', options = {}) {
        const input = document.getElementById(inputId);

        if (!input?.files?.length) return null;

        const client = AdminCore.getClient();
        const originalFile = input.files[0];
        const file = await compressImage(originalFile, options);
        const extension = file.name.split('.').pop().toLowerCase();
        const cleanFolder = String(folder || 'uploads').replace(/^\/+|\/+$/g, '');
        const filename = `${cleanFolder}/${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${extension}`;

        const { error } = await client.storage
            .from(BUCKET_NAME)
            .upload(filename, file, {
                upsert: true,
                contentType: file.type || undefined,
                cacheControl: '3600'
            });

        if (error) throw error;

        const { data } = client.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filename);

        return {
            path: filename,
            url: data.publicUrl,
            originalName: originalFile.name,
            savedName: file.name,
            size: file.size,
            type: file.type
        };
    }

    async function deleteFile(path) {
        const client = AdminCore.getClient();

        const { error } = await client.storage
            .from(BUCKET_NAME)
            .remove([path]);

        if (error) throw error;
    }

    async function listFolder(path = '', depth = 0) {
        const client = AdminCore.getClient();
        const normalizedPath = String(path || '').replace(/^\/+|\/+$/g, '');

        const { data, error } = await client.storage
            .from(BUCKET_NAME)
            .list(normalizedPath, {
                limit: 1000
            });

        if (error) throw error;

        const items = data || [];
        const files = [];

        for (const item of items) {
            const fullPath = normalizedPath ? `${normalizedPath}/${item.name}` : item.name;
            const isFolder = !item.id && !item.metadata?.size && !/\.[a-z0-9]{2,5}$/i.test(item.name);

            if (isFolder && depth < MAX_DEPTH) {
                const children = await listFolder(fullPath, depth + 1);
                files.push(...children);
                continue;
            }

            files.push({
                ...item,
                path: fullPath,
                name: item.name,
                folder: normalizedPath || 'raiz'
            });
        }

        return files;
    }

    async function loadBucketFiles() {
        arquivosCache = await listFolder('', 0);
        arquivosCache.sort((a, b) => new Date(b.created_at || b.updated_at || 0) - new Date(a.created_at || a.updated_at || 0));
        return arquivosCache;
    }

    function publicUrlFor(path) {
        return AdminCore.getClient()
            .storage
            .from(BUCKET_NAME)
            .getPublicUrl(path)
            .data
            .publicUrl;
    }

    function mediaPreview(path, publicUrl) {
        if (isImage(path)) {
            return `
                <img
                    src="${AdminCore.escapeHTML(publicUrl)}"
                    alt="${AdminCore.escapeHTML(path)}"
                    loading="lazy"
                >
            `;
        }

        if (isVideo(path)) {
            return `
                <video src="${AdminCore.escapeHTML(publicUrl)}" muted controls playsinline></video>
            `;
        }

        return `
            <div class="admin-catalog-placeholder">
                <i class="fas ${getFileIcon(path)}"></i>
            </div>
        `;
    }

    function renderStorageGrid() {
        if (!arquivosCache.length) {
            return AdminUI.emptyState('fa-folder-open', 'Nenhum arquivo encontrado no bucket midias.');
        }

        return `
            <div class="admin-catalog-grid">
                ${arquivosCache.map((file) => {
                    const path = file.path || file.name;
                    const publicUrl = publicUrlFor(path);

                    return `
                        <article class="admin-catalog-card">
                            <div class="admin-catalog-media">
                                ${mediaPreview(path, publicUrl)}
                            </div>

                            <div class="admin-catalog-body">
                                <div class="admin-catalog-top">
                                    <span class="admin-catalog-badge">${AdminCore.escapeHTML(file.folder || 'raiz')}</span>
                                </div>

                                <h3>${AdminCore.escapeHTML(file.name)}</h3>

                                <div class="admin-catalog-meta">
                                    <span>
                                        <i class="fas fa-folder"></i>
                                        ${AdminCore.escapeHTML(file.folder || 'raiz')}
                                    </span>

                                    <span>
                                        <i class="fas fa-weight-hanging"></i>
                                        ${bytesToSize(file.metadata?.size)}
                                    </span>

                                    <span>
                                        <i class="fas fa-calendar"></i>
                                        ${AdminCore.formatDate(file.created_at || file.updated_at)}
                                    </span>
                                </div>

                                <div class="admin-catalog-actions">
                                    <a class="btn-icon" href="${AdminCore.escapeHTML(publicUrl)}" target="_blank" title="Abrir arquivo">
                                        <i class="fas fa-eye"></i>
                                    </a>

                                    <button class="btn-icon btn-copy-link" type="button" data-url="${AdminCore.escapeHTML(publicUrl)}" title="Copiar link">
                                        <i class="fas fa-link"></i>
                                    </button>

                                    <button class="btn-icon btn-delete-file" type="button" data-path="${AdminCore.escapeHTML(path)}" title="Excluir arquivo">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        `;
    }

    function openUploadModal() {
        AdminUI.createModal({
            id: 'uploadStorageModal',
            formId: 'uploadStorageForm',
            title: 'Enviar arquivo',
            subtitle: 'Upload para o bucket midias. Imagens são convertidas para WEBP e compactadas automaticamente.',
            submitLabel: 'Enviar arquivo',
            body: `
                <div class="admin-form-grid two">
                    <div class="admin-form-group full">
                        <label>Pasta</label>
                        <select id="storageUploadFolder">
                            <option value="uploads">Uploads gerais</option>
                            <option value="publicacoes/capas">Publicações / capas</option>
                            <option value="publicacoes/conteudo">Publicações / conteúdo</option>
                            <option value="eventos/banners">Eventos / banners</option>
                            <option value="negocios/logos">Negócios / logos</option>
                            <option value="negocios/capas">Negócios / capas</option>
                            <option value="colunistas/fotos">Colunistas / fotos</option>
                            <option value="publicidades">Publicidade</option>
                        </select>
                    </div>

                    <div class="admin-form-group full">
                        <label>Arquivo</label>
                        <input type="file" id="storageUploadFile" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.zip" required>
                    </div>

                    <div id="storageUploadPreview" class="admin-form-group full"></div>
                </div>
            `,
            afterOpen: () => {
                document.getElementById('storageUploadFile')?.addEventListener('change', () => {
                    previewFile('storageUploadFile', 'storageUploadPreview');
                });
            },
            onSubmit: async () => {
                try {
                    const folder = AdminCore.getInputValue('storageUploadFolder') || 'uploads';
                    await uploadFromInput('storageUploadFile', folder);
                    AdminUI.closeModal('uploadStorageModal');
                    AdminUI.renderToast('Arquivo enviado com sucesso.');
                    await load();
                } catch (error) {
                    console.error('[ADMIN STORAGE] upload:', error);
                    AdminUI.renderToast(error.message || 'Erro ao enviar arquivo.', 'error');
                }
            }
        });
    }

    async function remove(path) {
        const confirmed = confirm(`Excluir o arquivo?\n\n${path}`);
        if (!confirmed) return;

        try {
            await deleteFile(path);
            AdminUI.renderToast('Arquivo removido com sucesso.');
            await load();
        } catch (error) {
            console.error('[ADMIN STORAGE] remove:', error);
            AdminUI.renderToast(error.message || 'Erro ao excluir arquivo.', 'error');
        }
    }

    function bindEvents() {
        document.getElementById('newStorageFileBtn')?.addEventListener('click', openUploadModal);
        document.getElementById('refreshStorageBtn')?.addEventListener('click', load);

        document.querySelectorAll('.btn-delete-file').forEach((button) => {
            button.addEventListener('click', () => remove(button.dataset.path));
        });

        document.querySelectorAll('.btn-copy-link').forEach((button) => {
            button.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(button.dataset.url);
                    AdminUI.renderToast('Link copiado.');
                } catch {
                    AdminUI.renderToast('Não foi possível copiar o link.', 'error');
                }
            });
        });
    }

    async function load() {
        AdminUI.setPage('storage');
        AdminUI.renderLoading('Carregando arquivos...');

        try {
            if (!isAdmin()) {
                AdminUI.setContent(`
                    <div class="admin-empty-state">
                        <i class="fas fa-lock"></i>
                        <h3>Acesso restrito</h3>
                        <p>Apenas administradores podem acessar o Storage.</p>
                    </div>
                `);
                return;
            }

            await loadBucketFiles();

            AdminUI.setContent(`
                <div class="section-header">
                    <div>
                        <h3>Mídias</h3>
                        <p>Gerencie os arquivos armazenados no bucket <strong>${BUCKET_NAME}</strong>.</p>
                    </div>

                    <div style="display:flex;gap:10px;flex-wrap:wrap;">
                        <button id="refreshStorageBtn" class="btn-secondary" type="button">
                            <i class="fas fa-rotate"></i>
                            Atualizar
                        </button>

                        <button id="newStorageFileBtn" class="btn-primary" type="button">
                            <i class="fas fa-upload"></i>
                            Novo arquivo
                        </button>
                    </div>
                </div>

                <div class="permission-card" style="margin-bottom:18px;">
                    Imagens enviadas por este painel são compactadas e convertidas para WEBP para reduzir consumo do Storage.
                </div>

                ${renderStorageGrid()}
            `);

            bindEvents();

        } catch (error) {
            console.error('[ADMIN STORAGE]', error);
            AdminUI.renderError(error.message || 'Erro ao carregar Storage. Confira se o bucket midias existe e se as policies de Storage permitem acesso ao administrador.');
        }
    }


    async function uploadImage(file, folder = 'editor/imagens', options = {}) {
        if (!file) return null;

        if (!String(file.type || '').startsWith('image/')) {
            throw new Error('Selecione um arquivo de imagem válido.');
        }

        const input = document.createElement('input');
        const dataTransfer = new DataTransfer();

        dataTransfer.items.add(file);
        input.type = 'file';
        input.files = dataTransfer.files;
        input.id = `tempUploadImage${Date.now()}`;

        input.style.display = 'none';
        document.body.appendChild(input);

        try {
            return await uploadFromInput(input.id, folder, {
                maxWidth: options.maxWidth || 1920,
                maxHeight: options.maxHeight || 1400,
                quality: options.quality || 0.82
            });
        } finally {
            input.remove();
        }
    }

    window.AdminStorage = {
        init: load,
        load,
        uploadFromInput,
        deleteFile,
        previewFile,
        uploadImage,
        existingImagePreview,
        compressImage
    };
})();
