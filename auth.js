// ── Redirecionamento para o login ──────────────────────────────────────────
// URL ABSOLUTA de propósito: um caminho relativo ('index.html') é resolvido pelo
// navegador a partir da rota atual e, em /turma/<nome>/..., virava
// /turma/<nome>/index.html — que o vercel.json reescreve de volta para o
// professor_dashboard.html (sem sessão → novo redirect relativo → carregamento infinito).
const SIDED_URL_LOGIN = 'https://sidedplus.vercel.app/';

function irParaLogin() {
  // replace(): não deixa a rota sem sessão no histórico (o botão Voltar não reabre o loop)
  window.location.replace(SIDED_URL_LOGIN);
}

// ── Verificação de sessão ──────────────────────────────────────────────────
const session = JSON.parse(sessionStorage.getItem('ded_user') || 'null');
if (!session || !session.role || !['professor','admin'].includes(session.role)) {
  // Sinaliza aos demais scripts (init.js) que não há sessão: nada deve ser carregado
  window.__semSessao = true;
  irParaLogin();
}

// ── Logout ─────────────────────────────────────────────────────────────────
function sair() { sessionStorage.clear(); irParaLogin(); }
