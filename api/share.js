const SUPABASE_URL = 'https://flidbkfrfosuahgphiza.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_mCBYSpZc45Pw345wZ1coEA_rYL61Ea8';
const SITE_URL = 'https://www.temnoentornosul.com.br';
const DEFAULT_IMAGE = `${SITE_URL}/assets/logo-tem-no-entorno-sul.png`;

function escapeHTML(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function stripHTML(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function isValidSlug(value) {
  return /^[a-z0-9][a-z0-9-]{0,159}$/i.test(value);
}

function safeImageUrl(value) {
  try {
    const url = new URL(String(value || ''), SITE_URL);
    return url.protocol === 'https:' ? url.toString() : DEFAULT_IMAGE;
  } catch {
    return DEFAULT_IMAGE;
  }
}

async function fetchFromSupabase(tipo, slug) {
  const table = tipo === 'evento' ? 'eventos' : 'publicacoes';
  const select = tipo === 'evento'
    ? 'id,nome,descricao,slug,imagem_banner_url'
    : 'id,titulo,subtitulo,conteudo,slug,imagem_capa_url';
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&slug=eq.${encodeURIComponent(slug)}&limit=1`;

  const response = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

module.exports = async function handler(req, res) {
  const tipo = req.query.tipo === 'evento' ? 'evento' : 'publicacao';
  const slug = String(req.query.slug || '').trim();
  const fallbackUrl = `${SITE_URL}/${tipo === 'evento' ? 'eventos.html' : 'publicacoes.html'}`;

  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (!isValidSlug(slug)) {
    res.writeHead(302, { Location: fallbackUrl });
    res.end();
    return;
  }

  let item = null;
  try {
    item = await fetchFromSupabase(tipo, slug);
  } catch (error) {
    console.error('[SHARE] Supabase:', error);
  }

  if (!item) {
    res.writeHead(302, { Location: fallbackUrl });
    res.end();
    return;
  }

  const title = tipo === 'evento' ? (item.nome || 'Evento') : (item.titulo || 'Publicação');
  const description = tipo === 'evento'
    ? stripHTML(item.descricao || '').slice(0, 180)
    : stripHTML(item.subtitulo || item.conteudo || '').slice(0, 180);
  const image = safeImageUrl(tipo === 'evento' ? item.imagem_banner_url : item.imagem_capa_url);
  const target = `${SITE_URL}/${tipo === 'evento' ? 'evento.html' : 'publicacao.html'}?slug=${encodeURIComponent(slug)}`;

  const html = `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHTML(title)} | Tem no Entorno Sul</title>
<meta name="description" content="${escapeHTML(description)}">
<link rel="canonical" href="${escapeHTML(target)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Tem no Entorno Sul">
<meta property="og:title" content="${escapeHTML(title)}">
<meta property="og:description" content="${escapeHTML(description)}">
<meta property="og:image" content="${escapeHTML(image)}">
<meta property="og:image:secure_url" content="${escapeHTML(image)}">
<meta property="og:url" content="${escapeHTML(target)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHTML(title)}">
<meta name="twitter:description" content="${escapeHTML(description)}">
<meta name="twitter:image" content="${escapeHTML(image)}">
<script>setTimeout(function(){location.replace(${JSON.stringify(target)});},500);</script>
</head><body style="font-family:Arial,sans-serif;padding:24px"><h1>${escapeHTML(title)}</h1><p>${escapeHTML(description)}</p><p><a href="${escapeHTML(target)}">Abrir conteúdo</a></p></body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
  res.status(200).send(html);
};
