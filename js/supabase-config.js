// js/supabase-config.js

(function () {
    'use strict';

    const SUPABASE_URL = 'https://flidbkfrfosuahgphiza.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_mCBYSpZc45Pw345wZ1coEA_rYL61Ea8';

    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        console.error('[SUPABASE] Biblioteca supabase-js não foi carregada.');
        return;
    }

    if (!SUPABASE_URL) {
        console.error('[SUPABASE] SUPABASE_URL não configurada.');
        return;
    }

    if (!SUPABASE_ANON_KEY) {
        console.error('[SUPABASE] SUPABASE_ANON_KEY não configurada.');
        return;
    }

    if (window.supabaseClient) {
        console.warn('[SUPABASE] Cliente já inicializado. Reutilizando instância existente.');
        return;
    }

    const supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storage: window.localStorage
            },
            global: {
                headers: {
                    'X-Client-Info': 'tem-no-entorno-sul-web'
                }
            }
        }
    );

    window.supabaseClient = supabaseClient;
    window.supabase.client = supabaseClient;

    console.log('[SUPABASE] Conectado com sucesso.');
})();