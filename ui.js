// UI helpers moved to ui.js

// ── TOAST GLOBAL (sucesso / erro) ────────────────────────────────────────────
// tipo: 'sucesso' (padrão, verde) | 'erro' (vermelho)
function mostrarToast(msg, tipo = 'sucesso') {
  let t = document.getElementById('toast-global');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast-global';
    t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(20px);background:#1E1248;color:#fff;padding:13px 24px;border-radius:12px;font-family:Sora,sans-serif;font-size:14px;font-weight:600;z-index:9999;opacity:0;pointer-events:none;transition:all 0.3s ease;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.2);display:flex;align-items:center;gap:10px;';
    document.body.appendChild(t);
  }
  const isErro = tipo === 'erro';
  const icone = isErro
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  t.innerHTML = `${icone}${msg}`;
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(t._hide);
  t._hide = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(20px)';
  }, isErro ? 3500 : 2500);
}

// Atalho semântico para erro — usar no lugar de mostrarToast('...', 'erro')
function mostrarErro(msg) { mostrarToast(msg, 'erro'); }

// Tira o foco de qualquer input/textarea/select ativo, forçando o teclado
// virtual do celular a fechar de verdade. Sem isso, em iOS Safari e em vários
// WebViews Android, o teclado pode ficar "preso" (visualmente já sumiu, mas o
// layout/viewport continua recolhido) depois que um modal fecha via JS — daí
// os toques seguintes caem fora da posição real dos botões até o usuário
// tocar várias vezes ou a tela ser forçada a reajustar.
function liberarFoco() {
  if (document.activeElement && typeof document.activeElement.blur === 'function' && document.activeElement !== document.body) {
    document.activeElement.blur();
  }
}

function fecharModal(id) { liberarFoco(); document.getElementById(id).classList.remove('open'); }
function fecharModalOutside(e, id) { if (e.target === document.getElementById(id)) fecharModal(id); }

// Rede de segurança global: qualquer toque em botão/link enquanto um campo de
// texto (input/textarea/select) ainda está com foco libera esse foco ANTES do
// onclick do botão rodar (fase de captura). Cobre todos os botões de
// Salvar/Confirmar/Cancelar do app de uma vez, sem precisar editar cada um.
document.addEventListener('pointerdown', (e) => {
  const ativo = document.activeElement;
  if (!ativo || ativo === document.body) return;
  const editavel = ativo.matches?.('input, textarea, select, [contenteditable="true"]');
  if (!editavel) return;
  const alvoBtn = e.target.closest?.('button, a, [onclick], [role="button"]');
  if (alvoBtn && alvoBtn !== ativo) liberarFoco();
}, true);

// ── SISTEMA GLOBAL DE LOADING ────────────────────────────────────────────────
// Overlay único reutilizado por toda troca de turma/tela/contexto.
// Só fica visível de fato se o carregamento durar mais que _LOADING_DELAY_MS,
// evitando "flash" de loading em trocas rápidas (cache hit).
const _LOADING_DELAY_MS = 150;
const _LOADING_FADE_MS = 180;
let _loadingDepth = 0;      // suporta chamadas aninhadas (ex: showLoading dentro de showLoading)
let _loadingTimer = null;
let _loadingHideTimer = null;
let _loadingEl = null;

function _criarLoadingEl() {
  if (_loadingEl) return _loadingEl;
  const el = document.createElement('div');
  el.id = 'global-loading-overlay';
  el.innerHTML = `
    <div class="gl-card">
      <div class="gl-badge">
        <img class="gl-logo" src="sided_logo.png" alt="SIDED" onerror="this.style.display='none'">
      </div>
      <div id="global-loading-msg" class="gl-msg">Carregando...</div>
      <div class="gl-bar"><span></span></div>
    </div>
  `;
  if (!document.getElementById('global-loading-style')) {
    const style = document.createElement('style');
    style.id = 'global-loading-style';
    style.textContent = `
      #global-loading-overlay {
        position: fixed; inset: 0; z-index: 99998;
        display: none; align-items: center; justify-content: center;
        background: #F3F6FE;
        font-family: 'Sora', sans-serif;
        opacity: 0; transition: opacity ${_LOADING_FADE_MS}ms ease;
        -webkit-tap-highlight-color: transparent;
      }
      #global-loading-overlay.gl-on { opacity: 1; }
      #global-loading-overlay .gl-card {
        display: flex; flex-direction: column; align-items: center; gap: 16px;
        min-width: 236px; max-width: 84vw;
        padding: 32px 40px 28px;
        background: #FFFFFF;
        border: 1px solid #E4EAF8; border-radius: 22px;
        box-shadow: 0 18px 45px rgba(37, 99, 235, .10), 0 2px 6px rgba(27, 37, 80, .05);
        transform: translateY(10px) scale(.98);
        transition: transform 240ms cubic-bezier(.22, 1, .36, 1);
      }
      #global-loading-overlay.gl-on .gl-card { transform: translateY(0) scale(1); }
      .gl-badge {
        display: flex; align-items: center; justify-content: center;
        width: 64px; height: 64px; border-radius: 18px;
        background: #F5F8FF; border: 1px solid #EAF0FE;
        animation: global-loading-pulse 2s ease-in-out infinite;
      }
      .gl-logo { width: 46px; height: 46px; object-fit: contain; border-radius: 10px; }
      .gl-msg {
        font-size: 13.5px; font-weight: 600; line-height: 1.4;
        color: #1B2550; letter-spacing: .1px; text-align: center;
      }
      .gl-bar {
        width: 168px; height: 4px; border-radius: 99px;
        background: #E8EEFC; overflow: hidden;
      }
      .gl-bar span {
        display: block; width: 42%; height: 100%; border-radius: inherit;
        background: linear-gradient(90deg, #2563EB, #7C5CFA);
        animation: global-loading-bar 1.2s ease-in-out infinite;
      }
      @keyframes global-spin { to { transform: rotate(360deg); } }
      @keyframes global-loading-bar {
        0% { transform: translateX(-115%); }
        100% { transform: translateX(290%); }
      }
      @keyframes global-loading-pulse {
        0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(37, 99, 235, .18); }
        50% { transform: scale(1.03); box-shadow: 0 0 0 7px rgba(37, 99, 235, 0); }
      }
      @media (prefers-reduced-motion: reduce) {
        #global-loading-overlay .gl-card { transition: none; transform: none; }
        .gl-badge, .gl-bar span { animation: none; }
        .gl-bar span { width: 100%; opacity: .6; }
      }
    `;
    document.head.appendChild(style);
  }
  document.body.appendChild(el);
  _loadingEl = el;
  return el;
}

// Chamar no início de qualquer operação que carregue dados (troca de turma,
// troca de tela, salvar, etc). Pode ser chamada várias vezes empilhadas —
// só esconde de fato quando todas as chamadas correspondentes de hideLoading
// tiverem ocorrido.
function showLoading(msg = 'Carregando...') {
  _loadingDepth++;
  const el = _criarLoadingEl();
  const msgEl = document.getElementById('global-loading-msg');
  if (msgEl) msgEl.textContent = msg;
  clearTimeout(_loadingTimer);
  clearTimeout(_loadingHideTimer);
  _loadingTimer = setTimeout(() => {
    if (_loadingDepth > 0) {
      el.style.display = 'flex';
      void el.offsetWidth; // força o reflow para a transição de entrada rodar
      el.classList.add('gl-on');
    }
  }, _LOADING_DELAY_MS);
}

function hideLoading() {
  _loadingDepth = Math.max(0, _loadingDepth - 1);
  if (_loadingDepth === 0) {
    clearTimeout(_loadingTimer);
    if (!_loadingEl) return;
    _loadingEl.classList.remove('gl-on');
    clearTimeout(_loadingHideTimer);
    _loadingHideTimer = setTimeout(() => {
      if (_loadingDepth === 0 && _loadingEl) _loadingEl.style.display = 'none';
    }, _LOADING_FADE_MS);
  }
}

// Força o loading a fechar imediatamente, ignorando o depth.
// Usar apenas em tratamento de erro fatal (catch de nível superior).
function forcarFecharLoading() {
  _loadingDepth = 0;
  clearTimeout(_loadingTimer);
  clearTimeout(_loadingHideTimer);
  if (_loadingEl) {
    _loadingEl.classList.remove('gl-on');
    _loadingEl.style.display = 'none';
  }
}

// ── PLACEHOLDER DE SKELETON PARA CONTAINERS DE LISTA ─────────────────────────
// Usar no lugar de innerHTML='' ao trocar de contexto, para nunca deixar o
// container em estado "vazio" (que pareceria "Nenhum dado encontrado")
// enquanto os dados de verdade ainda estão sendo buscados.
function skeletonHtml(linhas = 3) {
  const linha = `<div style="height:52px;border-radius:12px;background:linear-gradient(90deg,#EEF2FF 25%,#F8FAFF 37%,#EEF2FF 63%);background-size:400% 100%;animation:global-skeleton 1.4s ease infinite;margin-bottom:10px;"></div>`;
  if (!document.getElementById('global-skeleton-style')) {
    const style = document.createElement('style');
    style.id = 'global-skeleton-style';
    style.textContent = '@keyframes global-skeleton { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }';
    document.head.appendChild(style);
  }
  return linha.repeat(linhas);
}

if (typeof window !== 'undefined') {
  window.mostrarToast = mostrarToast;
  window.mostrarErro = mostrarErro;
  window.showLoading = showLoading;
  window.hideLoading = hideLoading;
  window.forcarFecharLoading = forcarFecharLoading;
  window.skeletonHtml = skeletonHtml;
}
