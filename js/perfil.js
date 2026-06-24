// js/perfil.js

(function () {
    'use strict';

    const BUCKET_NAME = 'avatars';
    const MAX_IMAGE_WIDTH = 900;
    const MAX_IMAGE_HEIGHT = 900;
    const IMAGE_QUALITY = 0.82;

    let supabase = null;
    let currentUser = null;
    let currentProfile = null;
    let currentStats = null;

    function getClient() {
        return window.supabaseClient || null;
    }

    function escapeHTML(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function firstLetter(value) {
        return String(value || 'U').trim().charAt(0).toUpperCase();
    }

    function formatNumber(value) {
        return Number(value || 0).toLocaleString('pt-BR');
    }


    function formatBirthDate(value) {
        if (!value) return '';
        const [year, month, day] = String(value).split('-');
        if (!year || !month || !day) return '';
        return `${day}/${month}/${year}`;
    }

    function calculateAge(value) {
        if (!value) return null;

        const parts = String(value).split('-').map(Number);
        if (parts.length < 3 || parts.some(Number.isNaN)) return null;

        const [year, month, day] = parts;
        const today = new Date();
        let age = today.getFullYear() - year;
        const hasBirthdayPassed =
            today.getMonth() + 1 > month ||
            (today.getMonth() + 1 === month && today.getDate() >= day);

        if (!hasBirthdayPassed) age -= 1;

        return age >= 0 && age <= 130 ? age : null;
    }

    function updateAgePreview() {
        const input = document.getElementById('dataNascimento');
        const output = document.getElementById('idadeCalculada');

        if (!input || !output) return;

        const age = calculateAge(input.value);
        output.textContent = age === null ? 'Idade: —' : `Idade: ${age} ${age === 1 ? 'ano' : 'anos'}`;
    }


    function onlyDigits(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function normalizeBrazilWhatsapp(value) {
        let digits = onlyDigits(value);

        if (digits.startsWith('55') && digits.length > 11) {
            digits = digits.slice(2);
        }

        if (digits.length !== 11) return '';

        return `55${digits}`;
    }

    function maskWhatsapp(value) {
        const digits = onlyDigits(value).replace(/^55/, '').slice(0, 11);

        if (digits.length <= 2) return digits;
        if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }


    function splitDateParts(value) {
        const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return match ? { year: match[1], month: match[2], day: match[3] } : { year: '', month: '', day: '' };
    }

    function renderBirthDayOptions(selected) {
        let html = '<option value="">Dia</option>';
        for (let i = 1; i <= 31; i += 1) {
            const value = String(i).padStart(2, '0');
            html += `<option value="${value}" ${value === selected ? 'selected' : ''}>${value}</option>`;
        }
        return html;
    }

    function renderBirthMonthOptions(selected) {
        const months = [
            ['01', 'Janeiro'], ['02', 'Fevereiro'], ['03', 'Março'], ['04', 'Abril'],
            ['05', 'Maio'], ['06', 'Junho'], ['07', 'Julho'], ['08', 'Agosto'],
            ['09', 'Setembro'], ['10', 'Outubro'], ['11', 'Novembro'], ['12', 'Dezembro']
        ];
        return '<option value="">Mês</option>' + months.map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');
    }

    function syncProfileBirthDate() {
        const day = document.getElementById('birthDay')?.value || '';
        const month = document.getElementById('birthMonth')?.value || '';
        const year = String(document.getElementById('birthYear')?.value || '').trim();
        const hidden = document.getElementById('dataNascimento');
        const age = document.getElementById('idadeCalculada');
        if (!hidden) return '';
        if (!day || !month || !/^\d{4}$/.test(year)) {
            hidden.value = '';
            if (age) age.textContent = 'Idade: —';
            return '';
        }
        const value = `${year}-${month}-${day}`;
        const parsed = new Date(`${value}T00:00:00`);
        if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== Number(year) || parsed.getMonth() + 1 !== Number(month) || parsed.getDate() !== Number(day)) {
            hidden.value = '';
            if (age) age.textContent = 'Idade: —';
            return '';
        }
        hidden.value = value;
        const years = calculateAge(value);
        if (age) age.textContent = `Idade: ${years === null ? '—' : `${years} ${years === 1 ? 'ano' : 'anos'}`}`;
        return value;
    }

    function whatsappDisplay(value) {
        const digits = onlyDigits(value).replace(/^55/, '').slice(0, 11);
        if (digits.length !== 11) return value || '';
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }

    function sanitizeRichHTML(value) {
        const template = document.createElement('template');
        template.innerHTML = String(value || '');

        const allowedTags = new Set(['P','BR','STRONG','B','EM','I','U','UL','OL','LI','A','H1','H2','H3','BLOCKQUOTE']);
        const allowedAttrs = new Set(['href','target','rel']);

        template.content.querySelectorAll('*').forEach((node) => {
            if (!allowedTags.has(node.tagName)) {
                node.replaceWith(document.createTextNode(node.textContent || ''));
                return;
            }

            [...node.attributes].forEach((attr) => {
                if (!allowedAttrs.has(attr.name)) node.removeAttribute(attr.name);
            });

            if (node.tagName === 'A') {
                const href = node.getAttribute('href') || '';
                if (!/^(https?:|mailto:|tel:)/i.test(href)) {
                    node.removeAttribute('href');
                } else {
                    node.setAttribute('target', '_blank');
                    node.setAttribute('rel', 'noopener');
                }
            }
        });

        return template.innerHTML.trim();
    }

    function createProfileEditorHTML(id, initialContent = '') {
        return `
            <div class="profile-rich-editor" data-profile-editor="${id}">
                <div class="profile-rich-toolbar" role="toolbar" aria-label="Ferramentas de texto">
                    <select data-profile-format="${id}" title="Formato">
                        <option value="p">Parágrafo</option>
                        <option value="h2">Título H2</option>
                        <option value="h3">Título H3</option>
                        <option value="blockquote">Citação</option>
                    </select>
                    <button type="button" data-profile-command="bold" title="Negrito"><i class="fas fa-bold"></i></button>
                    <button type="button" data-profile-command="italic" title="Itálico"><i class="fas fa-italic"></i></button>
                    <button type="button" data-profile-command="underline" title="Sublinhado"><i class="fas fa-underline"></i></button>
                    <button type="button" data-profile-command="insertUnorderedList" title="Lista"><i class="fas fa-list-ul"></i></button>
                    <button type="button" data-profile-command="insertOrderedList" title="Lista numerada"><i class="fas fa-list-ol"></i></button>
                    <button type="button" data-profile-action="link" title="Inserir link"><i class="fas fa-link"></i></button>
                    <button type="button" data-profile-action="quote" title="Citação"><i class="fas fa-quote-right"></i></button>
                    <button type="button" data-profile-command="removeFormat" title="Limpar"><i class="fas fa-eraser"></i></button>
                </div>
                <div id="${id}Editor" class="profile-rich-content" contenteditable="true" spellcheck="true">${initialContent || ''}</div>
                <textarea id="${id}" class="profile-rich-hidden">${escapeHTML(initialContent || '')}</textarea>
            </div>
        `;
    }

    function syncProfileEditor(id) {
        const editor = document.getElementById(`${id}Editor`);
        const textarea = document.getElementById(id);
        if (!editor || !textarea) return;
        textarea.value = sanitizeRichHTML(editor.innerHTML.trim());
    }

    function initProfileEditor(id) {
        const editor = document.getElementById(`${id}Editor`);
        const textarea = document.getElementById(id);
        if (!editor || !textarea || editor.dataset.initialized === 'true') return;
        editor.dataset.initialized = 'true';

        const wrapper = editor.closest('.profile-rich-editor');
        const exec = (command, value = null) => {
            editor.focus();
            document.execCommand(command, false, value);
            syncProfileEditor(id);
        };

        editor.addEventListener('input', () => syncProfileEditor(id));
        editor.addEventListener('blur', () => syncProfileEditor(id));
        editor.addEventListener('paste', (event) => {
            event.preventDefault();
            const text = (event.clipboardData || window.clipboardData).getData('text/plain');
            document.execCommand('insertText', false, text);
            syncProfileEditor(id);
        });

        wrapper?.querySelectorAll('[data-profile-command]').forEach((button) => {
            button.addEventListener('click', () => exec(button.dataset.profileCommand));
        });

        wrapper?.querySelector(`[data-profile-format="${id}"]`)?.addEventListener('change', (event) => {
            exec('formatBlock', event.target.value || 'p');
        });

        wrapper?.querySelector('[data-profile-action="link"]')?.addEventListener('click', () => {
            const url = prompt('Informe a URL do link:');
            if (!url) return;
            const normalized = /^(https?:|mailto:|tel:)/i.test(url) ? url : `https://${url}`;
            exec('createLink', normalized);
        });

        wrapper?.querySelector('[data-profile-action="quote"]')?.addEventListener('click', () => exec('formatBlock', 'blockquote'));
        syncProfileEditor(id);
    }

    function getProfileEditorValue(id) {
        syncProfileEditor(id);
        return document.getElementById(id)?.value?.trim() || '';
    }

    function isBirthdayToday(value) {
        if (!value) return false;
        const parts = String(value).split('-');
        if (parts.length < 3) return false;
        const now = new Date();
        return Number(parts[1]) === now.getMonth() + 1 && Number(parts[2]) === now.getDate();
    }

    function birthdayBanner(profile) {
        if (!isBirthdayToday(profile.data_nascimento)) return '';

        const nome = String(profile.nome || 'você').split(' ')[0];
        const confetti = Array.from({ length: 26 }, (_, index) => {
            const left = (index * 7 + 5) % 100;
            const delay = (index % 9) * 0.25;
            const duration = 3.4 + (index % 5) * 0.35;
            return `<span style="left:${left}%;animation-delay:${delay}s;animation-duration:${duration}s"></span>`;
        }).join('');

        return `
            <section class="birthday-celebration" aria-label="Mensagem de aniversário">
                <div class="birthday-confetti">${confetti}</div>
                <div class="birthday-balloons" aria-hidden="true"><span>🎈</span><span>🎉</span><span>🎂</span></div>
                <h2>Feliz aniversário, ${escapeHTML(nome)}!</h2>
                <p>
                    O portal Tem no Entorno Sul celebra sua vida hoje. Que seu novo ciclo seja cheio de saúde,
                    alegria, boas notícias e grandes conquistas na nossa região.
                </p>
            </section>
        `;
    }

    function createSlug(text) {
        return String(text || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+/g, '')
            .replace(/-+$/g, '');
    }

    function levelByPoints(points) {
        points = Number(points || 0);

        if (points >= 5000) return 'Lenda do Entorno';
        if (points >= 2500) return 'Embaixador';
        if (points >= 1000) return 'Especialista';
        if (points >= 500) return 'Colaborador';
        if (points >= 100) return 'Participante';

        return 'Explorador Regional';
    }

    function scrollToHashTarget() {
        const hash = window.location.hash;

        if (!hash) return;

        const target = document.querySelector(hash);

        if (!target) return;

        setTimeout(() => {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 250);
    }

    async function makeUniqueSlug(nome) {
        const base = createSlug(nome) || `usuario-${currentUser.id.slice(0, 8)}`;

        let candidate = base;
        let counter = 1;

        while (true) {
            const { data, error } = await supabase
                .from('usuarios')
                .select('id')
                .eq('slug', candidate)
                .neq('id', currentUser.id)
                .maybeSingle();

            if (error) throw error;
            if (!data) return candidate;

            candidate = `${base}-${counter}`;
            counter += 1;
        }
    }

    function showError(message) {
        const root = document.getElementById('perfilRoot');

        if (!root) return;

        root.innerHTML = `
            <div class="error-state">
                <i class="fas fa-circle-exclamation"></i>
                <h2>${escapeHTML(message)}</h2>

                <p style="margin-top:15px">
                    Faça login para acessar esta página.
                </p>

                <a
                    href="login.html?redirect=perfil.html"
                    class="btn-primary"
                    style="margin-top:20px;text-decoration:none;display:inline-flex"
                >
                    <i class="fas fa-right-to-bracket"></i>
                    Entrar
                </a>
            </div>
        `;
    }

    function showMessage(message, type = 'success') {
        const el = document.getElementById('profileMessage');

        if (!el) {
            alert(message);
            return;
        }

        el.className = `profile-message show ${type}`;
        el.textContent = message;

        setTimeout(() => {
            el.classList.remove('show');
        }, 4200);
    }

    function setButtonLoading(isLoading) {
        const button = document.getElementById('saveProfileBtn');

        if (!button) return;

        button.disabled = isLoading;
        button.innerHTML = isLoading
            ? '<i class="fas fa-spinner fa-spin"></i> Salvando...'
            : '<i class="fas fa-floppy-disk"></i> Salvar Perfil';
    }

    function renderProfile(profile) {
        const stats = currentStats || {};
        const pontos = Number(stats.pontos ?? profile.pontos ?? 0);
        const nivel = levelByPoints(pontos);

        const avatar = profile.foto_url
            ? `
                <img
                    class="profile-avatar"
                    src="${escapeHTML(profile.foto_url)}"
                    alt="${escapeHTML(profile.nome)}"
                >
            `
            : `
                <div class="profile-avatar-placeholder">
                    ${firstLetter(profile.nome)}
                </div>
            `;

        document.getElementById('perfilRoot').innerHTML = `
            ${birthdayBanner(profile)}
            <div class="profile-grid">
                <aside class="profile-sidebar">
                    <div class="profile-cover"></div>

                    <div class="profile-body">
                        ${avatar}

                        <h1 class="profile-name">
                            ${escapeHTML(profile.nome || 'Usuário')}
                        </h1>

                        <div class="profile-level">
                            <i class="fas fa-trophy"></i>
                            ${escapeHTML(nivel)}
                        </div>

                        <div class="profile-city">
                            <i class="fas fa-location-dot"></i>
                            ${escapeHTML(profile.cidade || 'Cidade não informada')}
                        </div>

                        ${profile.data_nascimento ? `
                            <div class="profile-city">
                                <i class="fas fa-cake-candles"></i>
                                ${escapeHTML(formatBirthDate(profile.data_nascimento))}
                            </div>
                        ` : ''}

                        <div class="profile-bio">
                            ${profile.bio ? sanitizeRichHTML(profile.bio) : 'Nenhuma biografia cadastrada.'}
                        </div>

                        <div class="profile-stats">
                            <div class="profile-stat">
                                <span class="profile-stat-value">${formatNumber(pontos)}</span>
                                <span class="profile-stat-label">Pontos</span>
                            </div>

                            <div class="profile-stat">
                                <span class="profile-stat-value">${formatNumber(stats.total_favoritos || 0)}</span>
                                <span class="profile-stat-label">Favoritos</span>
                            </div>

                            <div class="profile-stat">
                                <span class="profile-stat-value">${formatNumber(stats.total_curtidas || 0)}</span>
                                <span class="profile-stat-label">Curtidas</span>
                            </div>

                            <div class="profile-stat">
                                <span class="profile-stat-value">${formatNumber(stats.total_compartilhamentos || 0)}</span>
                                <span class="profile-stat-label">Compartilhamentos</span>
                            </div>

                            <div class="profile-stat">
                                <span class="profile-stat-value">${stats.posicao_ranking ? `#${stats.posicao_ranking}` : '—'}</span>
                                <span class="profile-stat-label">Ranking</span>
                            </div>

                            <div class="profile-stat">
                                <span class="profile-stat-value">${formatNumber(stats.total_interacoes || 0)}</span>
                                <span class="profile-stat-label">Interações</span>
                            </div>
                        </div>
                    </div>
                </aside>

                <section class="profile-content">
                    <div id="profileMessage" class="profile-message"></div>

                    <section class="profile-section">
                        <h2 class="section-title">Dados do Perfil</h2>

                        <form id="perfilForm" class="profile-form">
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Nome</label>
                                    <input
                                        id="nome"
                                        type="text"
                                        value="${escapeHTML(profile.nome || '')}"
                                        required
                                    >
                                </div>

                                <div class="form-group">
                                    <label>Cidade</label>
                                    <input
                                        id="cidade"
                                        type="text"
                                        value="${escapeHTML(profile.cidade || '')}"
                                        placeholder="Ex.: Valparaíso de Goiás"
                                    >
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label>Data de nascimento</label>
                                    ${(() => { const parts = splitDateParts(profile.data_nascimento || ''); return `
                                        <div class="birth-select-grid profile-birth-grid" aria-label="Data de nascimento">
                                            <select id="birthDay" required>${renderBirthDayOptions(parts.day)}</select>
                                            <select id="birthMonth" required>${renderBirthMonthOptions(parts.month)}</select>
                                            <input id="birthYear" type="number" min="1900" max="2100" inputmode="numeric" autocomplete="bday-year" placeholder="Ano" value="${escapeHTML(parts.year)}" required>
                                        </div>
                                        <input id="dataNascimento" type="hidden" value="${escapeHTML(profile.data_nascimento || '')}" required>
                                    `; })()}
                                    <span id="idadeCalculada" class="profile-age-badge">
                                        Idade: ${calculateAge(profile.data_nascimento) === null ? '—' : `${calculateAge(profile.data_nascimento)} ${calculateAge(profile.data_nascimento) === 1 ? 'ano' : 'anos'}`}
                                    </span>
                                    <small class="password-rules">
                                        Informe dia, mês e digite o ano com 4 números. Usada para a mensagem de aniversário no seu perfil.
                                    </small>
                                </div>

                                <div class="form-group">
                                    <label>WhatsApp</label>
                                    <input
                                        id="whatsapp"
                                        type="tel"
                                        inputmode="numeric"
                                        autocomplete="tel"
                                        maxlength="15"
                                        value="${escapeHTML(whatsappDisplay(profile.whatsapp || profile.telefone || ''))}"
                                        placeholder="(61) 99999-9999"
                                        required
                                    >
                                    <small class="password-rules">
                                        Obrigatório para recursos do portal, como mensagens de aniversário.
                                    </small>
                                </div>
                            </div>

                            <div class="form-row">
                                <div class="form-group">
                                    <label>E-mail</label>
                                    <input
                                        value="${escapeHTML(profile.email || currentUser.email || '')}"
                                        disabled
                                    >
                                </div>

                                <div class="form-group">
                                    <label>Slug Público</label>
                                    <input
                                        id="slug"
                                        type="text"
                                        value="${escapeHTML(profile.slug || '')}"
                                        readonly
                                        disabled
                                    >
                                    <small class="password-rules">
                                        Gerado automaticamente pelo sistema para evitar duplicidade.
                                    </small>
                                </div>
                            </div>

                            <div class="form-group">
                                <label>Biografia</label>
                                ${createProfileEditorHTML('bio', profile.bio || '')}
                            </div>

                            <div class="form-group">
                                <label>Foto de Perfil</label>
                                <input
                                    id="foto"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                >

                                <small class="password-rules">
                                    A imagem será otimizada automaticamente para economizar espaço.
                                </small>
                            </div>

                            <div class="profile-actions">
                                <button
                                    id="saveProfileBtn"
                                    type="submit"
                                    class="btn-primary"
                                >
                                    <i class="fas fa-floppy-disk"></i>
                                    Salvar Perfil
                                </button>

                                <a
                                    href="perfil-publico.html?slug=${encodeURIComponent(profile.slug || '')}"
                                    class="btn-secondary"
                                    style="text-decoration:none"
                                >
                                    <i class="fas fa-eye"></i>
                                    Ver Perfil Público
                                </a>

                                <a
                                    href="favoritos.html"
                                    class="btn-secondary"
                                    style="text-decoration:none"
                                >
                                    <i class="fas fa-bookmark"></i>
                                    Meus Favoritos
                                </a>

                                <a
                                    href="ranking.html"
                                    class="btn-secondary"
                                    style="text-decoration:none"
                                >
                                    <i class="fas fa-trophy"></i>
                                    Ranking
                                </a>
                            </div>
                        </form>
                    </section>

                    <section id="pontos" class="profile-section">
                        <h2 class="section-title">Resumo de Participação</h2>

                        <div class="profile-badges">
                            <div class="badge-card">
                                <i class="fas fa-seedling"></i>
                                Novo Membro
                            </div>

                            ${
                                pontos >= 100
                                    ? `
                                        <div class="badge-card">
                                            <i class="fas fa-award"></i>
                                            Participante
                                        </div>
                                    `
                                    : ''
                            }

                            ${
                                pontos >= 500
                                    ? `
                                        <div class="badge-card">
                                            <i class="fas fa-medal"></i>
                                            Colaborador
                                        </div>
                                    `
                                    : ''
                            }

                            ${
                                pontos >= 1000
                                    ? `
                                        <div class="badge-card">
                                            <i class="fas fa-crown"></i>
                                            Especialista
                                        </div>
                                    `
                                    : ''
                            }

                            <a
                                href="ranking.html"
                                class="badge-card"
                                style="text-decoration:none"
                            >
                                <i class="fas fa-ranking-star"></i>
                                Ver Ranking
                            </a>
                        </div>
                    </section>
                </section>
            </div>
        `;

        document.getElementById('perfilForm')?.addEventListener('submit', saveProfile);
        document.getElementById('dataNascimento')?.addEventListener('change', updateAgePreview);
        document.getElementById('whatsapp')?.addEventListener('input', (event) => { event.target.value = maskWhatsapp(event.target.value); });
        ['birthDay', 'birthMonth', 'birthYear'].forEach((id) => {
            document.getElementById(id)?.addEventListener(id === 'birthYear' ? 'input' : 'change', syncProfileBirthDate);
        });
        syncProfileBirthDate();
        initProfileEditor('bio');
        updateAgePreview();


        scrollToHashTarget();
    }

    function validateImage(file) {
        if (!file) return;

        const allowed = ['image/jpeg', 'image/png', 'image/webp'];

        if (!allowed.includes(file.type)) {
            throw new Error('Formato inválido. Use JPG, PNG ou WebP.');
        }

        if (file.size > 8 * 1024 * 1024) {
            throw new Error('Imagem muito grande. Envie uma imagem com até 8MB.');
        }
    }

    function loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Não foi possível ler a imagem.'));
            };

            img.src = url;
        });
    }

    function calculateSize(width, height) {
        let newWidth = width;
        let newHeight = height;

        if (newWidth > MAX_IMAGE_WIDTH) {
            newHeight = Math.round((MAX_IMAGE_WIDTH / newWidth) * newHeight);
            newWidth = MAX_IMAGE_WIDTH;
        }

        if (newHeight > MAX_IMAGE_HEIGHT) {
            newWidth = Math.round((MAX_IMAGE_HEIGHT / newHeight) * newWidth);
            newHeight = MAX_IMAGE_HEIGHT;
        }

        return {
            width: newWidth,
            height: newHeight
        };
    }

    async function compressImage(file) {
        validateImage(file);

        const img = await loadImageFromFile(file);
        const size = calculateSize(img.width, img.height);

        const canvas = document.createElement('canvas');
        canvas.width = size.width;
        canvas.height = size.height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size.width, size.height);

        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('Não foi possível otimizar a imagem.'));
                        return;
                    }

                    resolve(new File(
                        [blob],
                        `avatar-${Date.now()}.webp`,
                        { type: 'image/webp' }
                    ));
                },
                'image/webp',
                IMAGE_QUALITY
            );
        });
    }

    async function deleteOldAvatar() {
        if (!currentProfile?.foto_path) return;

        try {
            await supabase.storage
                .from(BUCKET_NAME)
                .remove([currentProfile.foto_path]);
        } catch (error) {
            console.warn('[PERFIL] Não foi possível remover avatar antigo:', error);
        }
    }

    async function uploadAvatar(file) {
        const optimizedFile = await compressImage(file);
        const filePath = `usuarios/${currentUser.id}/avatar-${Date.now()}.webp`;

        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, optimizedFile, {
                contentType: 'image/webp',
                cacheControl: '3600',
                upsert: true
            });

        if (error) throw error;

        await deleteOldAvatar();

        const { data } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        return {
            foto_url: data.publicUrl,
            foto_path: filePath
        };
    }

    async function saveProfile(event) {
        event.preventDefault();

        const nome = String(document.getElementById('nome')?.value || '').trim();
        const cidade = String(document.getElementById('cidade')?.value || '').trim();
        const dataNascimento = String(document.getElementById('dataNascimento')?.value || '').trim();
        const whatsapp = normalizeBrazilWhatsapp(document.getElementById('whatsapp')?.value || '');
        const bio = getProfileEditorValue('bio');
        const file = document.getElementById('foto')?.files?.[0] || null;

        if (!nome) {
            showMessage('Informe seu nome.', 'error');
            return;
        }

        if (!dataNascimento) {
            showMessage('Informe sua data de nascimento.', 'error');
            return;
        }

        if (!whatsapp) {
            showMessage('Informe um WhatsApp brasileiro válido com DDD e 11 dígitos.', 'error');
            return;
        }

        setButtonLoading(true);

        try {
            const slug = currentProfile?.slug || await makeUniqueSlug(nome);
            const pontosAtuais = Number(currentStats?.pontos ?? currentProfile?.pontos ?? 0);
            const nivelAtual = levelByPoints(pontosAtuais);

            const payload = {
                nome,
                cidade,
                data_nascimento: dataNascimento,
                whatsapp,
                telefone: whatsapp,
                bio,
                slug,
                nivel: nivelAtual
            };

            if (file) {
                showMessage('Otimizando e enviando sua foto...', 'success');

                const avatar = await uploadAvatar(file);

                payload.foto_url = avatar.foto_url;
                payload.foto_path = avatar.foto_path;
            }

            const { error } = await supabase
                .from('usuarios')
                .update(payload)
                .eq('id', currentUser.id);

            if (error) throw error;

            await loadProfile();

            setTimeout(() => {
                showMessage('Perfil atualizado com sucesso.', 'success');
            }, 100);

        } catch (error) {
            console.error('[PERFIL] salvar:', error);

            if (String(error.message || '').includes('duplicate key')) {
                showMessage('Não foi possível gerar um slug único. Tente alterar seu nome.', 'error');
                return;
            }

            showMessage(error.message || 'Erro ao salvar perfil.', 'error');
        } finally {
            setButtonLoading(false);
        }
    }

    async function ensureProfileExists() {
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (error) throw error;

        const metadata = currentUser.user_metadata || {};
        const nome = data?.nome || metadata.nome || currentUser.email?.split('@')?.[0] || 'Usuário';
        const slug = data?.slug || metadata.slug || await makeUniqueSlug(nome);
        const dataNascimento = data?.data_nascimento || metadata.data_nascimento || null;
        const whatsapp = data?.whatsapp || data?.telefone || metadata.whatsapp || metadata.telefone || null;

        if (data) {
            const payload = {};
            if (!data.slug && slug) payload.slug = slug;
            if (!data.data_nascimento && dataNascimento) payload.data_nascimento = dataNascimento;
            if (!data.whatsapp && whatsapp) payload.whatsapp = whatsapp;
            if (!data.telefone && whatsapp) payload.telefone = whatsapp;
            if (!data.email && currentUser.email) payload.email = currentUser.email;

            if (Object.keys(payload).length) {
                const { error: updateError } = await supabase
                    .from('usuarios')
                    .update(payload)
                    .eq('id', currentUser.id);

                if (updateError) throw updateError;
            }

            return;
        }

        const { error: insertError } = await supabase
            .from('usuarios')
            .insert({
                id: currentUser.id,
                nome,
                email: currentUser.email,
                data_nascimento: dataNascimento,
                whatsapp,
                telefone: whatsapp,
                status: 'ativo',
                slug,
                pontos: 0,
                nivel: 'Explorador Regional'
            });

        if (insertError) throw insertError;
    }

    async function loadStats() {
        const { data, error } = await supabase
            .from('v_ranking_usuarios')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (error) {
            console.warn('[PERFIL] Estatísticas não carregadas:', error);
            currentStats = null;
            return;
        }

        currentStats = data || null;
    }

    async function loadProfile() {
        await ensureProfileExists();

        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;

        currentProfile = data;

        await loadStats();

        renderProfile(data);
    }

    async function initialize() {
        supabase = getClient();

        if (!supabase) {
            showError('Supabase não encontrado.');
            return;
        }

        const { data, error } = await supabase.auth.getSession();

        if (error) {
            showError('Erro ao validar sua sessão.');
            return;
        }

        currentUser = data?.session?.user || null;

        if (!currentUser) {
            window.location.href = 'login.html?redirect=perfil.html';
            return;
        }

        try {
            await loadProfile();
        } catch (error) {
            console.error('[PERFIL] carregar:', error);
            showError(error.message || 'Não foi possível carregar seu perfil.');
        }
    }

    window.addEventListener('hashchange', scrollToHashTarget);

    document.addEventListener('DOMContentLoaded', initialize);
})();