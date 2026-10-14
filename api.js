// ═════════════════════════════════════════════════════════════════════════════
// SIDED+ — Módulo de API e Cache
// Contém: credenciais Supabase, função de API, cache de turma, cache de chamadas
// ═════════════════════════════════════════════════════════════════════════════

// ── CREDENCIAIS SUPABASE ─────────────────────────────────────────────────────
const SUPABASE_URL = 'https://biocjxggjjfeqmpuysik.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpb2NqeGdnampmZXFtcHV5c2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODUwOTQsImV4cCI6MjA4OTc2MTA5NH0.3bL3dKqiWGoHROE6vSzf-7Orp0GLcLpn4mHtUSwC0dU';

// ── FUNÇÃO DE API ────────────────────────────────────────────────────────────
// Dedup de chamadas idênticas em voo: protege contra clique duplo / re-render
// disparando a mesma leitura (GET) mais de uma vez em paralelo. Só dedupa GET
// (leitura), nunca POST/PATCH/DELETE — mutações não devem ser fundidas, pois
// duas chamadas de escrita "iguais" podem ser duas ações distintas do usuário
// (ex: criar duas aulas com os mesmos dados de propósito).
const _emVoo = {};
function _chaveEmVoo(path, opts) {
  const method = (opts.method || 'GET').toUpperCase();
  // Body e o header Prefer entram na chave: dois GETs iguais só são "a mesma
  // chamada" se pedirem exatamente a mesma coisa.
  const prefer = opts.headers?.Prefer || opts.headers?.prefer || '';
  return `${method} ${path} ${prefer} ${opts.body || ''}`;
}

const api = async (path, opts = {}) => {
  const { headers: extraHeaders, ...restOpts } = opts;
  const method = (restOpts.method || 'GET').toUpperCase();
  const dedupavel = method === 'GET';
  const chave = dedupavel ? _chaveEmVoo(path, restOpts) : null;

  if (dedupavel && _emVoo[chave]) return _emVoo[chave];

  const promessa = (async () => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...restOpts,
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation', ...extraHeaders },
    });
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) {
      const msg = data?.message || data?.hint || JSON.stringify(data);
      console.error(`[API] Erro ${res.status} em ${path}:`, msg, data);
      throw new Error(`Supabase erro ${res.status}: ${msg}`);
    }
    return data;
  })();

  if (dedupavel) {
    _emVoo[chave] = promessa;
    promessa.then(
      () => { delete _emVoo[chave]; },
      () => { delete _emVoo[chave]; }
    );
  }

  return promessa;
};

// ── CACHE DE TURMA ──────────────────────────────────────────────────────────
// Evita re-buscar dados já carregados ao alternar entre turmas
const _cache = {};
function _cacheKey(turmaId, tipo) { return `${turmaId}::${tipo}`; }
function cacheSalvar(turmaId, tipo, dados) { _cache[_cacheKey(turmaId, tipo)] = { dados, ts: Date.now() }; }
function cacheLer(turmaId, tipo, ttl = 60000) {
  const entry = _cache[_cacheKey(turmaId, tipo)];
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl) return null; // expirado
  return entry.dados;
}
function cacheInvalidar(turmaId) {
  Object.keys(_cache).forEach(k => { if (k.startsWith(turmaId + '::')) delete _cache[k]; });
}

// ── WRAPPER DE API COM CACHE PARA GET SIMPLES ────────────────────────────────
async function apiCached(path, turmaId, tipo, ttl = 60000) {
  const hit = cacheLer(turmaId, tipo, ttl);
  if (hit !== null) return hit;
  const dados = await api(path) || [];
  cacheSalvar(turmaId, tipo, dados);
  return dados;
}

// ── CACHE DE CHAMADAS ────────────────────────────────────────────────────────
// Rastreia se uma aula tem chamada salva (aula_id → booleano)
const _chamadaCache = {};
function chamadaCacheSet(aulaId, temChamada) { _chamadaCache[aulaId] = temChamada; }
function chamadaCacheGet(aulaId) { return _chamadaCache[aulaId]; }

// Expor ao window para acesso global
if (typeof window !== 'undefined') {
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_KEY = SUPABASE_KEY;
  window.api = api;
  window.apiCached = apiCached;
  window.cacheSalvar = cacheSalvar;
  window.cacheLer = cacheLer;
  window.cacheInvalidar = cacheInvalidar;
  window.chamadaCacheSet = chamadaCacheSet;
  window.chamadaCacheGet = chamadaCacheGet;
  // Expor também os internals usados diretamente no código
  window._cache = _cache;
  window._cacheKey = _cacheKey;
  window._chamadaCache = _chamadaCache;
  window._emVoo = _emVoo;
}
