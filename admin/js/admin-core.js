// admin/js/admin-core.js

(function () {
    'use strict';

    const state = {
        currentUser: null,
        currentRoles: [],
        availableRoles: []
    };

    function getClient() {
        return window.supabaseClient || window.supabase?.client || null;
    }

    function normalize(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function slugify(value) {
        return normalize(value)
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    function escapeHTML(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function formatDate(value) {
        if (!value) return '-';

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return '-';

        return date.toLocaleDateString('pt-BR');
    }

    function formatDateTime(value) {
        if (!value) return '-';

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return '-';

        return date.toLocaleString('pt-BR');
    }

    function toDatetimeLocal(value) {
        if (!value) return '';

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return '';

        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - offset * 60000);

        return localDate.toISOString().slice(0, 16);
    }

    function getInputValue(id) {
        return document.getElementById(id)?.value.trim() || null;
    }

    function hasRole(roleName) {
        const role = normalize(roleName);

        return (state.currentRoles || []).some((item) => normalize(item) === role);
    }

    function isAdmin() {
        return hasRole('admin') || hasRole('administrador');
    }

    function isColunista() {
        return hasRole('colunista');
    }

    function isComerciante() {
        return hasRole('comerciante');
    }

    function isCliente() {
        return hasRole('cliente') || hasRole('usuario') || hasRole('usuário');
    }

    function canAccessDashboard() {
        return isAdmin() || isColunista() || isComerciante();
    }

    async function getUserProfile(authUserId) {
        const client = getClient();

        const { data: usuario, error: usuarioError } = await client
            .from('usuarios')
            .select('id, nome, email, status')
            .eq('id', authUserId)
            .maybeSingle();

        if (usuarioError) {
            console.error('[ADMIN CORE] usuarios:', usuarioError);
            throw new Error('Erro ao validar cadastro do usuário.');
        }

        if (!usuario) {
            throw new Error('Usuário autenticado sem perfil público vinculado.');
        }

        if (normalize(usuario.status) !== 'ativo') {
            throw new Error('Usuário inativo.');
        }

        const { data: roles, error: rolesError } = await client
            .from('usuarios_roles')
            .select(`
                role_id,
                roles (
                    id,
                    nome
                )
            `)
            .eq('usuario_id', authUserId);

        if (rolesError) {
            console.error('[ADMIN CORE] roles:', rolesError);
            throw new Error('Erro ao consultar permissões.');
        }

        const roleNames = (roles || [])
            .map((item) => normalize(item?.roles?.nome))
            .filter(Boolean);

        return {
            usuario,
            roles: roleNames
        };
    }

    async function requireAdmin() {
        const client = getClient();

        if (!client) {
            throw new Error('Supabase não carregado.');
        }

        const { data, error } = await client.auth.getSession();

        if (error || !data?.session) {
            window.location.replace('/login.html?redirect=admin/dashboard.html');
            return false;
        }

        const profile = await getUserProfile(data.session.user.id);

        state.currentUser = profile.usuario;
        state.currentRoles = profile.roles;

        if (!canAccessDashboard()) {
            window.location.replace('/index.html?acesso=restrito');
            return false;
        }

        const adminName = document.getElementById('adminName');
        const adminEmail = document.getElementById('adminEmail');
        const adminUserName = document.getElementById('adminUserName');

        if (adminName) adminName.textContent = state.currentUser.nome || 'Usuário';
        if (adminEmail) adminEmail.textContent = state.currentUser.email || '';
        if (adminUserName) adminUserName.textContent = state.currentUser.nome || state.currentUser.email || 'Usuário';

        logSystem('login_admin', {
            roles: state.currentRoles,
            email: state.currentUser.email || null
        });

        return true;
    }

    async function hydrateCurrentUser() {
        const client = getClient();

        if (!client) {
            throw new Error('Supabase não carregado.');
        }

        const { data, error } = await client.auth.getSession();

        if (error) throw error;

        const authUser = data?.session?.user || null;

        if (!authUser) {
            state.currentUser = null;
            state.currentRoles = [];
            return null;
        }

        const profile = await getUserProfile(authUser.id);

        state.currentUser = profile.usuario;
        state.currentRoles = profile.roles;

        return profile;
    }

    async function logout() {
        const client = getClient();

        try {
            await logSystem('logout_admin', {
                roles: state.currentRoles,
                email: state.currentUser?.email || null
            });
        } catch {
            // Não bloquear saída por falha de log.
        }

        if (client) {
            await client.auth.signOut();
        }

        window.location.replace('/index.html');
    }

    async function countTable(tableName) {
        const client = getClient();

        const { count, error } = await client
            .from(tableName)
            .select('*', {
                count: 'exact',
                head: true
            });

        if (error) {
            console.warn(`[ADMIN CORE] Erro ao contar ${tableName}:`, error);
            return 0;
        }

        return count || 0;
    }

    async function loadRoles() {
        const client = getClient();

        const { data, error } = await client
            .from('roles')
            .select('id, nome')
            .order('id', { ascending: true });

        if (error) {
            console.error('[ADMIN CORE] loadRoles:', error);
            throw new Error('Não foi possível carregar os perfis de acesso.');
        }

        state.availableRoles = data || [];

        return state.availableRoles;
    }

    async function ensureUserRole(userId, roleName) {
        const client = getClient();

        await loadRoles();

        const role = state.availableRoles.find((item) => {
            return normalize(item.nome) === normalize(roleName);
        });

        if (!role) {
            throw new Error(`Perfil ${roleName} não encontrado.`);
        }

        if (userId === state.currentUser?.id) {
            return;
        }

        const { data: currentRows, error: currentError } = await client
            .from('usuarios_roles')
            .select('id, role_id')
            .eq('usuario_id', userId);

        if (currentError) throw currentError;

        const alreadyHasTarget = (currentRows || []).some((item) => Number(item.role_id) === Number(role.id));

        if (!alreadyHasTarget) {
            const { error: insertError } = await client
                .from('usuarios_roles')
                .insert({
                    usuario_id: userId,
                    role_id: role.id
                });

            if (insertError) throw insertError;
        }

        const { error: deleteError } = await client
            .from('usuarios_roles')
            .delete()
            .eq('usuario_id', userId)
            .neq('role_id', role.id);

        if (deleteError) throw deleteError;
    }

    function makeWhatsappLink(whatsapp) {
        const digits = String(whatsapp || '').replace(/\D/g, '');

        if (!digits) return null;

        const withCountry = digits.startsWith('55') ? digits : `55${digits}`;

        return `https://wa.me/${withCountry}`;
    }



    async function logSystem(action, details = {}) {
        const client = getClient();

        if (!client) return false;

        try {
            const payload = {
                usuario_id: state.currentUser?.id || null,
                acao: String(action || 'evento_sistema'),
                detalhes: details || {},
                pagina: window.location.pathname + window.location.search,
                user_agent: navigator.userAgent,
                created_at: new Date().toISOString()
            };

            const { error } = await client
                .from('logs_sistema')
                .insert(payload);

            if (error) return false;

            return true;
        } catch (error) {
            console.warn('[ADMIN CORE] logSystem:', error);
            return false;
        }
    }

    async function safeTableCount(tableName) {
        try {
            return await countTable(tableName);
        } catch (error) {
            console.warn(`[ADMIN CORE] safeTableCount ${tableName}:`, error);
            return null;
        }
    }

    async function safeSelect(tableName, columns = '*', options = {}) {
        const client = getClient();

        try {
            let query = client
                .from(tableName)
                .select(columns, options.selectOptions || {});

            if (typeof options.limit === 'number') {
                query = query.limit(options.limit);
            }

            if (options.orderBy) {
                query = query.order(options.orderBy, {
                    ascending: options.ascending !== false
                });
            }

            const { data, error, count } = await query;

            if (error) throw error;

            return {
                ok: true,
                data: data || [],
                count: count ?? null,
                error: null
            };
        } catch (error) {
            console.warn(`[ADMIN CORE] safeSelect ${tableName}:`, error);

            return {
                ok: false,
                data: [],
                count: null,
                error
            };
        }
    }

    window.AdminCore = {
        state,
        getClient,
        normalize,
        slugify,
        escapeHTML,
        formatDate,
        formatDateTime,
        toDatetimeLocal,
        getInputValue,
        hasRole,
        isAdmin,
        isColunista,
        isComerciante,
        isCliente,
        canAccessDashboard,
        getUserProfile,
        hydrateCurrentUser,
        requireAdmin,
        logout,
        countTable,
        loadRoles,
        ensureUserRole,
        makeWhatsappLink,
        logSystem,
        safeTableCount,
        safeSelect
    };
})();
