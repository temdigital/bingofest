// admin/js/admin-editor.js

(function () {
    'use strict';

    const BUCKET_NAME = 'midias';

    function safeEscape(value) {
        if (window.AdminCore?.escapeHTML) return AdminCore.escapeHTML(value);

        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function createEditorHTML(textareaId, initialContent = '', uploadFolder = 'editor/imagens') {
        const id = safeEscape(textareaId);
        const folder = safeEscape(uploadFolder || 'editor/imagens');

        return `
            <div class="rich-editor" data-editor-wrapper="${id}">
                <div class="rich-editor-toolbar" role="toolbar" aria-label="Ferramentas de formatação">
                    <select class="rich-editor-format" data-editor-format="${id}" title="Formato do bloco">
                        <option value="p">Parágrafo</option>
                        <option value="h1">Título H1</option>
                        <option value="h2">Título H2</option>
                        <option value="h3">Título H3</option>
                        <option value="blockquote">Citação</option>
                    </select>

                    <button type="button" data-editor-command="bold" title="Negrito"><i class="fas fa-bold"></i></button>
                    <button type="button" data-editor-command="italic" title="Itálico"><i class="fas fa-italic"></i></button>
                    <button type="button" data-editor-command="underline" title="Sublinhado"><i class="fas fa-underline"></i></button>
                    <button type="button" data-editor-command="insertUnorderedList" title="Lista"><i class="fas fa-list-ul"></i></button>
                    <button type="button" data-editor-command="insertOrderedList" title="Lista numerada"><i class="fas fa-list-ol"></i></button>
                    <button type="button" data-editor-command="justifyLeft" title="Alinhar à esquerda"><i class="fas fa-align-left"></i></button>
                    <button type="button" data-editor-command="justifyCenter" title="Centralizar"><i class="fas fa-align-center"></i></button>
                    <button type="button" data-editor-command="justifyRight" title="Alinhar à direita"><i class="fas fa-align-right"></i></button>
                    <button type="button" data-editor-action="link" title="Inserir link"><i class="fas fa-link"></i></button>
                    <button type="button" data-editor-action="image" title="Inserir imagem responsiva"><i class="fas fa-image"></i></button>
                    <button type="button" data-editor-action="youtube" title="Inserir vídeo do YouTube"><i class="fab fa-youtube"></i></button>
                    <button type="button" data-editor-action="table" title="Inserir tabela"><i class="fas fa-table"></i></button>
                    <button type="button" data-editor-action="quote" title="Inserir citação"><i class="fas fa-quote-right"></i></button>
                    <button type="button" data-editor-action="clearBlock" title="Converter bloco em parágrafo"><i class="fas fa-paragraph"></i></button>
                    <button type="button" data-editor-command="removeFormat" title="Limpar formatação"><i class="fas fa-eraser"></i></button>
                </div>

                <div
                    id="${id}Editor"
                    class="rich-editor-content"
                    contenteditable="true"
                    data-editor-content="${id}"
                    data-upload-folder="${folder}"
                    spellcheck="true"
                >${initialContent || ''}</div>
            </div>

            <textarea id="${id}" class="rich-editor-hidden">${safeEscape(initialContent || '')}</textarea>
        `;
    }

    function initEditor(textareaId) {
        const editor = document.getElementById(`${textareaId}Editor`);
        const textarea = document.getElementById(textareaId);

        if (!editor || !textarea) return;
        if (editor.dataset.initialized === 'true') return;

        editor.dataset.initialized = 'true';
        syncTextarea(textareaId);

        editor.addEventListener('input', () => syncTextarea(textareaId));
        editor.addEventListener('blur', () => syncTextarea(textareaId));
        editor.addEventListener('keyup', () => updateFormatSelect(textareaId));
        editor.addEventListener('mouseup', () => updateFormatSelect(textareaId));
        editor.addEventListener('paste', cleanPaste);

        const wrapper = editor.closest('.rich-editor');
        if (!wrapper) return;

        wrapper.querySelectorAll('[data-editor-command]').forEach((button) => {
            button.addEventListener('click', () => {
                const command = button.dataset.editorCommand;
                editor.focus();

                if (command === 'removeFormat') {
                    document.execCommand('removeFormat', false, null);
                    normalizeCurrentBlockToParagraph();
                } else {
                    document.execCommand(command, false, null);
                }

                syncTextarea(textareaId);
                updateFormatSelect(textareaId);
            });
        });

        wrapper.querySelector(`[data-editor-format="${textareaId}"]`)?.addEventListener('change', (event) => {
            editor.focus();
            applyBlockFormat(event.target.value || 'p');
            syncTextarea(textareaId);
            updateFormatSelect(textareaId);
        });

        wrapper.querySelector('[data-editor-action="link"]')?.addEventListener('click', () => insertLink(textareaId));
        wrapper.querySelector('[data-editor-action="image"]')?.addEventListener('click', () => insertImage(textareaId));
        wrapper.querySelector('[data-editor-action="youtube"]')?.addEventListener('click', () => insertYoutube(textareaId));
        wrapper.querySelector('[data-editor-action="table"]')?.addEventListener('click', () => insertTable(textareaId));
        wrapper.querySelector('[data-editor-action="quote"]')?.addEventListener('click', () => insertQuote(textareaId));
        wrapper.querySelector('[data-editor-action="clearBlock"]')?.addEventListener('click', () => {
            editor.focus();
            normalizeCurrentBlockToParagraph();
            syncTextarea(textareaId);
            updateFormatSelect(textareaId);
        });
    }

    function cleanPaste(event) {
        event.preventDefault();
        const text = (event.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, text);
    }

    function syncTextarea(textareaId) {
        const editor = document.getElementById(`${textareaId}Editor`);
        const textarea = document.getElementById(textareaId);
        if (!editor || !textarea) return;
        textarea.value = sanitizeEditorHTML(editor.innerHTML.trim());
    }

    function getValue(textareaId) {
        syncTextarea(textareaId);
        return document.getElementById(textareaId)?.value.trim() || null;
    }

    function applyBlockFormat(tagName) {
        const tag = String(tagName || 'p').toLowerCase();
        document.execCommand('formatBlock', false, tag);
    }

    function getCurrentBlock() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return null;

        let node = selection.anchorNode;
        if (!node) return null;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;

        while (node && node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName?.toLowerCase();
            if (['p', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'li', 'div'].includes(tagName)) return node;
            node = node.parentNode;
        }

        return null;
    }

    function normalizeCurrentBlockToParagraph() {
        const block = getCurrentBlock();
        if (!block) {
            document.execCommand('formatBlock', false, 'p');
            return;
        }

        const tagName = block.tagName?.toLowerCase();
        if (tagName === 'p') return;

        const paragraph = document.createElement('p');
        paragraph.innerHTML = block.innerHTML || '<br>';
        block.replaceWith(paragraph);
        placeCursorAtEnd(paragraph);
    }

    function placeCursorAtEnd(element) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    function updateFormatSelect(textareaId) {
        const select = document.querySelector(`[data-editor-format="${textareaId}"]`);
        const block = getCurrentBlock();
        if (!select || !block) return;

        const tagName = block.tagName?.toLowerCase();
        select.value = ['p', 'h1', 'h2', 'h3', 'blockquote'].includes(tagName) ? tagName : 'p';
    }

    function insertLink(textareaId) {
        const editor = document.getElementById(`${textareaId}Editor`);
        if (!editor) return;

        const url = prompt('Informe a URL do link:');
        if (!url) return;

        editor.focus();
        document.execCommand('createLink', false, normalizeUrl(url));
        syncTextarea(textareaId);
    }

    function normalizeUrl(url) {
        const value = String(url || '').trim();
        if (!value) return '';
        if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
        return `https://${value}`;
    }

    async function uploadEditorImage(file, uploadFolder) {
        const client = window.AdminCore?.getClient ? AdminCore.getClient() : window.supabaseClient;
        if (!client) throw new Error('Supabase não encontrado para upload da imagem.');

        let finalFile = file;
        if (window.AdminStorage?.compressImage && file.type.startsWith('image/')) {
            finalFile = await AdminStorage.compressImage(file, {
                maxWidth: 1920,
                maxHeight: 1920,
                quality: 0.82
            });
        }

        const extension = (finalFile.name.split('.').pop() || 'webp').toLowerCase();
        const folder = String(uploadFolder || 'editor/imagens').replace(/^\/+|\/+$/g, '');
        const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

        const { error } = await client.storage
            .from(BUCKET_NAME)
            .upload(filename, finalFile, {
                upsert: true,
                cacheControl: '3600',
                contentType: finalFile.type || undefined
            });

        if (error) throw error;

        const { data } = client.storage.from(BUCKET_NAME).getPublicUrl(filename);

        return {
            path: filename,
            url: data.publicUrl
        };
    }

    function insertImage(textareaId) {
        const editor = document.getElementById(`${textareaId}Editor`);
        if (!editor) return;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/png,image/webp,image/gif';

        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (!file) return;

            try {
                if (window.AdminUI?.renderToast) AdminUI.renderToast('Compactando e enviando imagem...', 'success');

                const uploadFolder = editor.dataset.uploadFolder || 'editor/imagens';
                const uploaded = await uploadEditorImage(file, uploadFolder);
                const altText = prompt('Texto alternativo da imagem (opcional):') || '';

                editor.focus();
                document.execCommand('insertHTML', false, `
                    <figure class="article-figure">
                        <img src="${safeEscape(uploaded.url)}" alt="${safeEscape(altText)}" loading="lazy" class="article-image-responsive">
                        <figcaption></figcaption>
                    </figure>
                    <p><br></p>
                `);

                syncTextarea(textareaId);
                if (window.AdminUI?.renderToast) AdminUI.renderToast('Imagem inserida no texto.');

            } catch (error) {
                console.error('[ADMIN EDITOR] insertImage:', error);
                if (window.AdminUI?.renderToast) AdminUI.renderToast(error.message || 'Erro ao inserir imagem.', 'error');
                else alert(error.message || 'Erro ao inserir imagem.');
            }
        });

        input.click();
    }

    function extractYoutubeId(url) {
        const value = String(url || '').trim();
        if (!value) return null;

        const patterns = [
            /youtube\.com\/watch\?v=([^&]+)/,
            /youtube\.com\/embed\/([^?&]+)/,
            /youtu\.be\/([^?&]+)/,
            /youtube\.com\/shorts\/([^?&]+)/
        ];

        for (const pattern of patterns) {
            const match = value.match(pattern);
            if (match?.[1]) return match[1];
        }

        return null;
    }

    function insertYoutube(textareaId) {
        const editor = document.getElementById(`${textareaId}Editor`);
        if (!editor) return;

        const url = prompt('Cole a URL do vídeo do YouTube:');
        const videoId = extractYoutubeId(url);

        if (!videoId) {
            if (window.AdminUI?.renderToast) AdminUI.renderToast('URL do YouTube inválida.', 'error');
            return;
        }

        editor.focus();
        document.execCommand('insertHTML', false, `
            <div class="article-video">
                <iframe
                    src="https://www.youtube.com/embed/${safeEscape(videoId)}"
                    title="Vídeo incorporado"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                    loading="lazy"
                ></iframe>
            </div>
            <p><br></p>
        `);

        syncTextarea(textareaId);
    }

    function insertTable(textareaId) {
        const editor = document.getElementById(`${textareaId}Editor`);
        if (!editor) return;

        editor.focus();
        document.execCommand('insertHTML', false, `
            <div class="article-table-wrap">
                <table class="article-table">
                    <thead>
                        <tr>
                            <th>Coluna 1</th>
                            <th>Coluna 2</th>
                            <th>Coluna 3</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Informação</td>
                            <td>Informação</td>
                            <td>Informação</td>
                        </tr>
                        <tr>
                            <td>Informação</td>
                            <td>Informação</td>
                            <td>Informação</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p><br></p>
        `);

        syncTextarea(textareaId);
    }

    function insertQuote(textareaId) {
        const editor = document.getElementById(`${textareaId}Editor`);
        if (!editor) return;

        editor.focus();
        document.execCommand('insertHTML', false, `
            <blockquote>
                <p>Escreva a citação aqui.</p>
            </blockquote>
            <p><br></p>
        `);

        syncTextarea(textareaId);
    }

    function sanitizeEditorHTML(html) {
        const template = document.createElement('template');
        template.innerHTML = html || '';

        template.content.querySelectorAll('script, style').forEach((node) => node.remove());
        template.content.querySelectorAll('*').forEach((node) => {
            [...node.attributes].forEach((attr) => {
                const name = attr.name.toLowerCase();
                const value = attr.value || '';

                if (name.startsWith('on')) node.removeAttribute(attr.name);
                if ((name === 'href' || name === 'src') && /^javascript:/i.test(value)) node.removeAttribute(attr.name);
            });
        });

        return template.innerHTML.trim();
    }

    window.AdminEditor = {
        createEditorHTML,
        initEditor,
        syncTextarea,
        getValue,
        uploadEditorImage
    };
})();
