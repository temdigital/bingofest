// js/aceite-convite.js
// Release Candidate - aceite de convite estável para smartphone.
// Regra aplicada: não ler .value de elementos fora da tela; dados passam por objeto interno.

(function () {
    'use strict';

    const SITE_URL = 'https://www.temnoentornosul.com.br';
    const TOKEN = new URLSearchParams(window.location.search).get('token');

    let convite = null;
    let selectedName = null;
    let cadastro = null;

    function root() {
        return document.getElementById('inviteApp')
            || document.getElementById('aceiteConviteApp')
            || document.querySelector('main')
            || document.body;
    }

    function db() {
        return window.supabaseClient || window.supabase || null;
    }

    function esc(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function onlyDigits(value) {
        return String(value || '').replace(/\D/g, '');
    }

    function normalize(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }


    function createSlug(value) {
        return normalize(value)
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'usuario';
    }

    function localSlug(nome, email) {
        const base = createSlug(nome || String(email || '').split('@')[0] || 'usuario');
        const suffix = Math.random().toString(36).slice(2, 8);
        return `${base}-${suffix}`;
    }

    function populateInviteBirthSelects() {
        const day = document.getElementById('inviteBirthDay');
        const year = document.getElementById('inviteBirthYear');

        if (day && day.options.length <= 1) {
            for (let i = 1; i <= 31; i += 1) {
                const option = document.createElement('option');
                option.value = String(i).padStart(2, '0');
                option.textContent = String(i).padStart(2, '0');
                day.appendChild(option);
            }
        }

        if (year) {
            year.setAttribute('min', '1900');
            year.setAttribute('max', String(new Date().getFullYear()));
            year.setAttribute('inputmode', 'numeric');
        }
    }

    function syncInviteBirthDate() {
        const day = document.getElementById('inviteBirthDay')?.value || '';
        const month = document.getElementById('inviteBirthMonth')?.value || '';
        const year = String(document.getElementById('inviteBirthYear')?.value || '').trim();
        const hidden = document.getElementById('inviteDataNascimento');

        if (!hidden) return '';

        if (!day || !month || !/^\d{4}$/.test(year)) {
            hidden.value = '';
            return '';
        }

        const value = `${year}-${month}-${day}`;
        const parsed = new Date(`${value}T00:00:00`);

        if (
            Number.isNaN(parsed.getTime()) ||
            parsed.getFullYear() !== Number(year) ||
            parsed.getMonth() + 1 !== Number(month) ||
            parsed.getDate() !== Number(day)
        ) {
            hidden.value = '';
            return '';
        }

        hidden.value = value;
        return value;
    }


    function conviteTipo() {
        return String(
            convite?.tipo_convidado ||
            convite?.tipo ||
            convite?.tipo_usuario ||
            convite?.perfil ||
            'cliente'
        ).trim().toLowerCase();
    }

    function tipoLabel(tipo) {
        const map = {
            colunista: 'Colunista',
            comerciante: 'Comerciante',
            cliente: 'Cliente'
        };

        return map[tipo] || 'Convidado';
    }

    function set(html) {
        const el = root();
        el.innerHTML = html;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function alertBox(message, showBack = false) {
        set(`
            <div class="invite-alert">
                <i class="fas fa-triangle-exclamation"></i>
                ${esc(message)}
            </div>
            ${showBack ? '<button class="invite-secondary" type="button" id="inviteBackBtn">Voltar</button>' : ''}
            <a class="invite-secondary" href="${SITE_URL}/index.html">Voltar ao portal</a>
        `);

        document.getElementById('inviteBackBtn')?.addEventListener('click', () => {
            if (cadastro) stepReview();
            else if (convite) stepPassword();
            else loadInvite();
        });
    }

    function loading(message = 'Processando...') {
        set(`
            <div class="invite-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <h1>${esc(message)}</h1>
                <p>Aguarde alguns instantes.</p>
            </div>
        `);
    }

    function formValues(form) {
        return Object.fromEntries(new FormData(form).entries());
    }

    function nameOptions(name) {
        const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        const first = parts[0] || 'Convidado';
        const last = parts.length > 1 ? parts[parts.length - 1] : '';

        const options = [
            name,
            `${first} ${last}`.trim(),
            `${first} Silva`,
            `${first} Santos`,
            `${first} Oliveira`,
            `${first} Lacerda`
        ].filter(Boolean);

        return [...new Set(options)]
            .sort(() => Math.random() - 0.5)
            .slice(0, 5);
    }

    function termText() {
        return `
            <div class="term-box">
                <h2>Termo de Colaboração Não Remunerada e Responsabilidade</h2>
                <p>Ao aceitar este convite, declaro que compreendo que minha participação no portal Tem no Entorno Sul possui natureza colaborativa, voluntária e não remunerada, sem geração de vínculo empregatício, societário, comercial obrigatório ou qualquer obrigação de pagamento por parte do portal, de seus responsáveis ou parceiros.</p>
                <p>Declaro estar ciente de que todo conteúdo, informação, imagem, texto, opinião, dado comercial, divulgação, comentário ou material enviado por mim deverá respeitar a legislação brasileira, os direitos autorais, a honra, a imagem, a privacidade de terceiros, a boa-fé, a ética, a verdade factual quando se tratar de informação jornalística ou comunitária, e as regras editoriais do portal.</p>
                <p>Comprometo-me a não publicar conteúdo ofensivo, discriminatório, calunioso, difamatório, injurioso, falso, enganoso, ilegal, de incitação à violência, de violação de direitos, propaganda irregular, spam ou material que possa prejudicar pessoas, instituições, empresas, comunidades ou o próprio portal.</p>
                <p>Reconheço que sou responsável civil, administrativa e criminalmente pelas informações e materiais que enviar, publicar ou solicitar publicação, especialmente quando atuar como colunista, comerciante, parceiro, anunciante ou participante da comunidade.</p>
                <p>Autorizo o portal Tem no Entorno Sul a revisar, moderar, editar formatação, recusar, ocultar ou remover conteúdos que estejam em desacordo com sua linha editorial, finalidade comunitária, segurança jurídica, qualidade informativa ou identidade institucional.</p>
                <p>Autorizo o uso do meu nome, biografia, marca, logotipo e informações fornecidas por mim exclusivamente para exibição no portal, redes sociais e materiais de divulgação relacionados ao Tem no Entorno Sul, enquanto meu cadastro estiver ativo ou enquanto houver conteúdo vinculado à minha participação.</p>
                <p>Ao marcar a opção de aceite e concluir o cadastro, confirmo que li, compreendi e concordo integralmente com este termo.</p>
            </div>
        `;
    }

    async function loadInvite() {
        if (!TOKEN) {
            alertBox('Convite inválido. O link não possui token.');
            return;
        }

        const supabase = db();
        if (!supabase) {
            alertBox('Configuração do Supabase não encontrada. Procure o administrador.');
            return;
        }

        loading('Carregando convite...');

        try {
            const { data, error } = await supabase.rpc('obter_convite_aceite', {
                p_token: TOKEN
            });

            if (error) throw error;

            const row = Array.isArray(data) ? data[0] : data;

            if (!row) {
                alertBox('Convite não encontrado, expirado ou já utilizado. Procure o administrador.');
                return;
            }

            convite = row;
            stepPassword();
        } catch (error) {
            console.error('[ACEITE CONVITE] loadInvite:', error);
            alertBox(error.message || 'Não foi possível carregar o convite.');
        }
    }

    function stepPassword() {
        set(`
            <span class="invite-kicker"><i class="fas fa-lock"></i>Aceite de convite</span>
            <h1>Bem-vindo ao Tem no Entorno Sul</h1>
            <p>Informe a senha inicial enviada pelo WhatsApp. A senha é o número de WhatsApp informado no convite, somente números.</p>

            <form class="invite-form" id="passwordForm" novalidate>
                <div class="invite-group">
                    <label for="invitePassword">Senha inicial</label>
                    <input id="invitePassword" name="password" inputmode="numeric" autocomplete="one-time-code" placeholder="Ex.: 61999999999" required>
                </div>

                <button class="invite-btn" type="submit">
                    <i class="fas fa-arrow-right"></i>
                    Continuar
                </button>
            </form>
        `);

        document.getElementById('passwordForm')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const values = formValues(event.currentTarget);
            const typed = onlyDigits(values.password);
            const expected = onlyDigits(convite.whatsapp);

            if (!typed || typed !== expected) {
                alertBox('Senha incorreta. Confira o WhatsApp informado no convite ou procure o administrador.');
                return;
            }

            stepName();
        });
    }

    function stepName() {
        const options = nameOptions(convite.nome_convidado);

        set(`
            <span class="invite-kicker"><i class="fas fa-user-check"></i>Confirmação</span>
            <h1>Confirme seu nome</h1>
            <p>Por segurança, selecione o nome correto para continuar o aceite.</p>

            <div class="invite-options">
                ${options.map((name) => `
                    <button type="button" class="invite-option" data-name="${esc(name)}">
                        ${esc(name)}
                    </button>
                `).join('')}
            </div>
        `);

        document.querySelectorAll('.invite-option').forEach((button) => {
            button.addEventListener('click', () => {
                selectedName = button.dataset.name || '';

                if (normalize(selectedName) !== normalize(convite.nome_convidado)) {
                    alertBox('Nome incorreto. Por segurança, procure o administrador.');
                    return;
                }

                stepTerms();
            });
        });
    }

    function stepTerms() {
        set(`
            <span class="invite-kicker"><i class="fas fa-file-signature"></i>Termo</span>
            <h1>Termo de colaboração</h1>
            <p>Leia com atenção antes de prosseguir.</p>
            ${termText()}

            <form class="invite-form" id="termsForm" novalidate>
                <label class="invite-check">
                    <input type="checkbox" name="agree" value="sim" required>
                    Li e concordo com o termo de colaboração não remunerada e responsabilidade.
                </label>

                <button class="invite-btn" type="submit">
                    <i class="fas fa-check"></i>
                    Concordar e preencher cadastro
                </button>
            </form>
        `);

        document.getElementById('termsForm')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const values = formValues(event.currentTarget);

            if (values.agree !== 'sim') {
                alertBox('Você precisa concordar com o termo para continuar.');
                return;
            }

            stepRegister();
        });
    }

    function commonFields() {
        return `
            <div class="invite-group">
                <label>Nome completo</label>
                <input name="nome" value="${esc(convite.nome_convidado || '')}" required>
            </div>

            <div class="invite-group">
                <label>E-mail de acesso</label>
                <input type="email" name="email" value="${esc(convite.email || '')}" placeholder="seuemail@exemplo.com" required>
            </div>

            <div class="invite-group full">
                <label>Data de nascimento</label>
                <div class="birth-select-grid" aria-label="Data de nascimento">
                    <select id="inviteBirthDay" required>
                        <option value="">Dia</option>
                    </select>

                    <select id="inviteBirthMonth" required>
                        <option value="">Mês</option>
                        <option value="01">Janeiro</option>
                        <option value="02">Fevereiro</option>
                        <option value="03">Março</option>
                        <option value="04">Abril</option>
                        <option value="05">Maio</option>
                        <option value="06">Junho</option>
                        <option value="07">Julho</option>
                        <option value="08">Agosto</option>
                        <option value="09">Setembro</option>
                        <option value="10">Outubro</option>
                        <option value="11">Novembro</option>
                        <option value="12">Dezembro</option>
                    </select>

                    <input id="inviteBirthYear" type="number" min="1900" max="2100" inputmode="numeric" autocomplete="bday-year" placeholder="Ano" required>
                </div>
                <input id="inviteDataNascimento" type="hidden" name="data_nascimento" required>
                <small>Informe dia, mês e digite o ano com 4 números. No celular, esse modelo evita erro ao escolher o ano.</small>
            </div>

            <div class="invite-group">
                <label>Cidade</label>
                <input name="cidade" placeholder="Ex.: Valparaíso de Goiás" required>
            </div>
        `;
    }

    function stepRegister() {
        const tipo = conviteTipo();
        let extra = '';

        if (tipo === 'colunista') {
            extra = `
                <div class="invite-group">
                    <label>Formação</label>
                    <input name="formacao" placeholder="Ex.: Jornalista, professor, advogado..." required>
                </div>

                <div class="invite-group full">
                    <label>Biografia</label>
                    <textarea name="biografia" rows="7" placeholder="Apresente sua trajetória e área de atuação." required></textarea>
                </div>

                <div class="invite-group">
                    <label>Instagram</label>
                    <input name="instagram" placeholder="https://instagram.com/...">
                </div>

                <div class="invite-group">
                    <label>Site</label>
                    <input name="site" placeholder="https://...">
                </div>

                <div class="permission-card full">
                    A foto de perfil poderá ser enviada depois, dentro do painel, para evitar erro de permissão de upload durante o aceite no smartphone.
                </div>
            `;
        }

        if (tipo === 'comerciante') {
            extra = `
                <div class="invite-group">
                    <label>Nome do negócio</label>
                    <input name="negocio_nome" placeholder="Nome público da empresa" required>
                </div>

                <div class="invite-group">
                    <label>Categoria</label>
                    <input name="categoria" value="${esc(convite.categoria_area || '')}" placeholder="Ex.: Alimentação, Comércio, Serviços" required>
                </div>

                <div class="invite-group full">
                    <label>Endereço</label>
                    <input name="endereco" placeholder="Endereço completo ou referência" required>
                </div>

                <div class="invite-group full">
                    <label>Descrição do negócio</label>
                    <textarea name="descricao" rows="7" placeholder="Descreva o que sua empresa oferece." required></textarea>
                </div>

                <div class="invite-group">
                    <label>Instagram</label>
                    <input name="instagram" placeholder="https://instagram.com/...">
                </div>

                <div class="invite-group">
                    <label>Site</label>
                    <input name="site" placeholder="https://...">
                </div>

                <div class="permission-card full">
                    A logo e a capa do negócio poderão ser enviadas depois, dentro do painel, para evitar erro de permissão de upload durante o aceite no smartphone.
                </div>
            `;
        }

        if (tipo === 'cliente') {
            extra = `
                <div class="invite-group full">
                    <label>Breve apresentação</label>
                    <textarea name="bio" rows="5" placeholder="Conte um pouco sobre você, se desejar."></textarea>
                </div>
            `;
        }

        set(`
            <span class="invite-kicker"><i class="fas fa-id-card"></i>Cadastro</span>
            <h1>Complete seu cadastro de ${esc(tipoLabel(tipo))}</h1>
            <p>A senha inicial será seu WhatsApp: <strong>${esc(onlyDigits(convite.whatsapp))}</strong>.</p>

            <form class="invite-form" id="registerForm" novalidate>
                <div class="invite-grid">
                    ${commonFields()}
                    ${extra}
                </div>

                <button class="invite-btn" type="submit">
                    <i class="fas fa-arrow-right"></i>
                    Revisar dados
                </button>
            </form>
        `);

        populateInviteBirthSelects();
        syncInviteBirthDate();
        ['inviteBirthDay', 'inviteBirthMonth', 'inviteBirthYear'].forEach((id) => {
            document.getElementById(id)?.addEventListener(id === 'inviteBirthYear' ? 'input' : 'change', syncInviteBirthDate);
        });

        document.getElementById('registerForm')?.addEventListener('submit', (event) => {
            event.preventDefault();
            syncInviteBirthDate();
            const values = formValues(event.currentTarget);
            const tipoAtual = conviteTipo();

            cadastro = {
                tipo: tipoAtual,
                nome: String(values.nome || '').trim(),
                email: String(values.email || '').trim(),
                slug: localSlug(values.nome, values.email),
                data_nascimento: String(values.data_nascimento || '').trim(),
                cidade: String(values.cidade || '').trim(),
                bio: String(values.bio || '').trim(),
                formacao: String(values.formacao || '').trim(),
                biografia: String(values.biografia || '').trim(),
                instagram: String(values.instagram || '').trim(),
                site: String(values.site || '').trim(),
                negocio_nome: String(values.negocio_nome || '').trim(),
                categoria: String(values.categoria || convite.categoria_area || '').trim(),
                endereco: String(values.endereco || '').trim(),
                descricao: String(values.descricao || '').trim()
            };

            const validation = validateCadastro(cadastro);
            if (validation) {
                set(`
                    <div class="invite-alert">
                        <i class="fas fa-triangle-exclamation"></i>
                        ${esc(validation)}
                    </div>
                    <button class="invite-secondary" type="button" id="backRegisterBtn">Voltar ao cadastro</button>
                `);

                document.getElementById('backRegisterBtn')?.addEventListener('click', stepRegister);
                return;
            }

            stepReview();
        });
    }

    function validateCadastro(data) {
        if (!data.nome) return 'Informe seu nome.';
        if (!data.email) return 'Informe seu e-mail.';
        if (!data.data_nascimento) return 'Informe sua data de nascimento.';
        if (!data.cidade) return 'Informe sua cidade.';

        if (data.tipo === 'colunista') {
            if (!data.formacao) return 'Informe sua formação.';
            if (!data.biografia) return 'Informe sua biografia.';
        }

        if (data.tipo === 'comerciante') {
            if (!data.negocio_nome) return 'Informe o nome do negócio.';
            if (!data.categoria) return 'Informe a categoria do negócio.';
            if (!data.endereco) return 'Informe o endereço.';
            if (!data.descricao) return 'Informe a descrição do negócio.';
        }

        return null;
    }

    function stepReview() {
        const rows = [
            ['Tipo', tipoLabel(cadastro.tipo)],
            ['Nome', cadastro.nome],
            ['E-mail', cadastro.email],
            ['Slug público', cadastro.slug],
            ['Data de nascimento', cadastro.data_nascimento],
            ['Cidade', cadastro.cidade]
        ];

        if (cadastro.tipo === 'colunista') {
            rows.push(['Formação', cadastro.formacao]);
            rows.push(['Biografia', cadastro.biografia]);
        }

        if (cadastro.tipo === 'comerciante') {
            rows.push(['Negócio', cadastro.negocio_nome]);
            rows.push(['Categoria', cadastro.categoria]);
            rows.push(['Endereço', cadastro.endereco]);
            rows.push(['Descrição', cadastro.descricao]);
        }

        set(`
            <span class="invite-kicker"><i class="fas fa-clipboard-check"></i>Revisão final</span>
            <h1>Confira seus dados</h1>
            <p>Revise antes de concluir. No celular, esta etapa evita perda de campos e erros de preenchimento.</p>

            <div class="invite-review">
                ${rows.map(([label, value]) => `
                    <div class="invite-review-row">
                        <strong>${esc(label)}</strong>
                        <span>${esc(value || '-')}</span>
                    </div>
                `).join('')}
            </div>

            <form class="invite-form" id="reviewForm" novalidate>
                <button class="invite-btn" type="submit">
                    <i class="fas fa-user-check"></i>
                    Confirmar cadastro
                </button>

                <button class="invite-secondary" type="button" id="editDataBtn">
                    Corrigir dados
                </button>
            </form>
        `);

        document.getElementById('editDataBtn')?.addEventListener('click', stepRegister);

        document.getElementById('reviewForm')?.addEventListener('submit', (event) => {
            event.preventDefault();
            finalizeCadastro();
        });
    }

    function friendlyAuthError(error) {
        const msg = String(error?.message || '').toLowerCase();

        if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
            return 'Este e-mail já possui cadastro. Exclua o usuário antigo no Supabase Auth ou use outro e-mail para testar o convite.';
        }

        if (msg.includes('password')) {
            return 'A senha inicial precisa ter pelo menos 6 caracteres. Confirme se o WhatsApp do convite possui DDD e número completos.';
        }

        return error?.message || 'Erro ao criar acesso no Supabase Auth.';
    }

    async function finalizeCadastro() {
        if (!cadastro) {
            alertBox('Os dados do cadastro não foram encontrados. Reabra o convite e tente novamente.');
            return;
        }

        loading('Criando seu acesso...');

        try {
            const supabase = db();
            const password = onlyDigits(convite.whatsapp);

            if (!supabase) throw new Error('Supabase não carregado.');
            if (!password || password.length < 6) {
                throw new Error('WhatsApp do convite inválido. A senha inicial precisa ter DDD e número.');
            }

            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: cadastro.email,
                password,
                options: {
                    data: {
                        nome: cadastro.nome,
                        data_nascimento: cadastro.data_nascimento,
                        convite_token: TOKEN,
                        tipo: cadastro.tipo,
                        slug: cadastro.slug,
                        whatsapp: password
                    },
                    emailRedirectTo: `${SITE_URL}/login.html?confirmed=1`
                }
            });

            if (authError) {
                throw new Error(friendlyAuthError(authError));
            }

            const userId = authData?.user?.id;

            if (!userId) {
                throw new Error('O Supabase não retornou o usuário criado. Verifique confirmação de e-mail ou cadastro duplicado.');
            }

            const { data: rpcData, error: rpcError } = await supabase.rpc('finalizar_aceite_convite', {
                p_token: TOKEN,
                p_whatsapp: password,
                p_user_id: userId,
                p_email: cadastro.email,
                p_nome: cadastro.nome,
                p_slug: cadastro.slug || null,
                p_data_nascimento: cadastro.data_nascimento || null,
                p_cidade: cadastro.cidade,
                p_tipo: cadastro.tipo,
                p_bio: cadastro.bio || null,
                p_formacao: cadastro.formacao || null,
                p_biografia: cadastro.biografia || null,
                p_instagram: cadastro.instagram || null,
                p_site: cadastro.site || null,
                p_negocio_nome: cadastro.negocio_nome || null,
                p_categoria: cadastro.categoria || convite.categoria_area || null,
                p_endereco: cadastro.endereco || null,
                p_descricao: cadastro.descricao || null
            });

            if (rpcError) throw rpcError;

            if (rpcData && rpcData.ok === false) {
                throw new Error(rpcData.message || 'Não foi possível concluir o convite.');
            }

            const slugFinal = rpcData?.slug || cadastro.slug || '';

            set(`
                <div class="invite-success">
                    <i class="fas fa-circle-check"></i>
                    Cadastro criado com sucesso.
                </div>
                <h1>Confirme seu e-mail</h1>
                <p>Enviamos uma confirmação para o e-mail informado. Clique no link recebido antes de tentar entrar no portal.</p>

                <div class="invite-review">
                    <div class="invite-review-row">
                        <strong>Tipo de usuário</strong>
                        <span>${esc(tipoLabel(cadastro.tipo))}</span>
                    </div>
                    <div class="invite-review-row">
                        <strong>E-mail de acesso</strong>
                        <span>${esc(cadastro.email)}</span>
                    </div>
                    <div class="invite-review-row">
                        <strong>Senha inicial</strong>
                        <span>${esc(password)}</span>
                    </div>
                    <div class="invite-review-row">
                        <strong>Slug público</strong>
                        <span>${esc(slugFinal)}</span>
                    </div>
                </div>

                <p>Se ao entrar aparecer a mensagem <strong>“Confirme seu e-mail antes de entrar”</strong>, isso não é erro de senha: falta confirmar o cadastro no e-mail.</p>

                <a class="invite-btn" href="login.html">
                    <i class="fas fa-right-to-bracket"></i>
                    Ir para o login
                </a>
            `);
        } catch (error) {
            console.error('[ACEITE CONVITE] finalizeCadastro:', error);
            set(`
                <div class="invite-alert">
                    <i class="fas fa-triangle-exclamation"></i>
                    ${esc(error.message || 'Erro ao concluir cadastro. Procure o administrador.')}
                </div>
                <button class="invite-secondary" type="button" id="retryReviewBtn">Voltar para revisão</button>
            `);

            document.getElementById('retryReviewBtn')?.addEventListener('click', stepReview);
        }
    }

    document.addEventListener('DOMContentLoaded', loadInvite);
})();
