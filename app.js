/* SIREDE+ — Inicialização geral: troca entre login e ambiente administrativo,
   cabeçalho, menu móvel, logout e utilitários compartilhados (SIPRO.ui).
   O código de cada tela fica no arquivo do seu módulo. */
(() => {
  'use strict';
  const SIPRO = (window.SIPRO = window.SIPRO || { modulos: {} });
  const $ = (id) => document.getElementById(id);

  /* Campos personalizados (caixa suspensa, data e hora): campos.js é carregado aqui, ao lado deste arquivo,
     para não depender do index.html. Ele troca sozinho todo select/date/time, inclusive em telas criadas depois. */
  (() => {
    const atual = document.currentScript && document.currentScript.src;
    const s = document.createElement('script');
    s.src = (atual ? atual.replace(/[^/]*(\?.*)?$/, '') : '') + 'campos.js';
    s.defer = true;
    document.head.appendChild(s);
  })();

  /* ---------- Utilitários compartilhados ---------- */
  const escapar = (t) => String(t).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Loader padrão (anel laranja girando). Use SIPRO.ui.carregando() em qualquer tela que esteja buscando dados. */
  const carregando = (titulo = 'Carregando informações...', texto = 'Aguarde um momento enquanto o sistema processa os dados.') => `
    <div class="carregando" role="status" aria-live="polite">
      <span class="carregando__anel" aria-hidden="true">
        <svg class="carregando__ico" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
      </span>
      <strong class="carregando__titulo">${escapar(titulo)}</strong>
      <span class="carregando__texto">${escapar(texto)}</span>
    </div>`;

  /** Layout padrão das telas estruturais (módulos ainda sem funcionalidades). */
  function telaEstrutural({ titulo, descricao, secoes }) {
    return `
      <div class="pagina">
        <div class="pagina__cab">
          <div><h2>${escapar(titulo)}</h2><p>${escapar(descricao)}</p></div>
          <span class="selo">Tela estrutural</span>
        </div>
        <div class="grade grade--2">
          ${secoes.map((s) => `
            <section class="bloco-vazio">
              <h3>${escapar(s)}</h3>
              <p>Em desenvolvimento.</p>
            </section>`).join('')}
        </div>
      </div>`;
  }

  const raiz = $('view-app');
  function fecharMenu() {
    raiz.classList.remove('menu-aberto');
    $('scrim').hidden = true;
    $('btn-menu').setAttribute('aria-expanded', 'false');
  }
  function abrirMenu() {
    raiz.classList.add('menu-aberto');
    $('scrim').hidden = false;
    $('btn-menu').setAttribute('aria-expanded', 'true');
  }

  /* ---------- Máscaras e validações compartilhadas (SIPRO.util) ----------
     Usadas pelo cadastro de Pessoas e por futuros módulos. O banco valida CPF/CNPJ de novo (nunca só o frontend). */
  const soDigitos = (t) => String(t || '').replace(/\D/g, '');

  function mascaraCpf(t) {
    const d = soDigitos(t).slice(0, 11);
    let r = d.slice(0, 3);
    if (d.length > 3) r += '.' + d.slice(3, 6);
    if (d.length > 6) r += '.' + d.slice(6, 9);
    if (d.length > 9) r += '-' + d.slice(9);
    return r;
  }
  function mascaraCnpj(t) {
    const d = soDigitos(t).slice(0, 14);
    let r = d.slice(0, 2);
    if (d.length > 2) r += '.' + d.slice(2, 5);
    if (d.length > 5) r += '.' + d.slice(5, 8);
    if (d.length > 8) r += '/' + d.slice(8, 12);
    if (d.length > 12) r += '-' + d.slice(12);
    return r;
  }
  function mascaraTelefone(t) {
    const d = soDigitos(t).slice(0, 11);
    if (d.length <= 2) return d;
    const corte = d.length === 11 ? 5 : 4;
    const resto = d.slice(2);
    return `(${d.slice(0, 2)}) ` + (resto.length <= corte ? resto : `${resto.slice(0, corte)}-${resto.slice(corte)}`);
  }
  const mascaraCep = (t) => {
    const d = soDigitos(t).slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };
  function cpfValido(c) {
    if (!/^\d{11}$/.test(c) || /^(\d)\1+$/.test(c)) return false;
    const digito = (n) => {
      let soma = 0;
      for (let i = 0; i < n; i++) soma += Number(c[i]) * (n + 1 - i);
      const r = (soma * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return digito(9) === Number(c[9]) && digito(10) === Number(c[10]);
  }
  function cnpjValido(c) {
    if (!/^\d{14}$/.test(c) || /^(\d)\1+$/.test(c)) return false;
    const digito = (n) => {
      const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      let soma = 0;
      for (let i = 0; i < n; i++) soma += Number(c[i]) * pesos[i];
      const resto = soma % 11;
      return resto < 2 ? 0 : 11 - resto;
    };
    return digito(12) === Number(c[12]) && digito(13) === Number(c[13]);
  }
  const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

  SIPRO.util = { soDigitos, mascaraCpf, mascaraCnpj, mascaraTelefone, mascaraCep, cpfValido, cnpjValido, emailValido };
  SIPRO.ui = { escapar, telaEstrutural, fecharMenu, carregando };
  SIPRO.estado = { redeId: null }; // rede selecionada (ID no banco), compartilhada entre as seções do ambiente da rede

  /* ---------- Troca de telas ---------- */
  let usuarioAtual = null;

  function mostrar(qual) {
    $('splash').hidden = true;
    $('view-login').hidden = qual !== 'login';
    $('view-app').hidden = qual !== 'app';
  }

  let carregandoId = null;

  async function entrarNoApp(sessao) {
    const id = sessao.user.id;
    if ((usuarioAtual && usuarioAtual.id === id) || carregandoId === id) return; // renovação de sessão ou busca em andamento
    carregandoId = id;
    const cadastro = await SIPRO.auth.cadastro(); // nome vem de public.usuarios
    if (carregandoId !== id) return; // saiu enquanto carregava
    carregandoId = null;

    const u = { id, nome: cadastro ? cadastro.nome : '' };
    usuarioAtual = u;
    // Sem nome cadastrado: não mostra nome (nunca usa o CPF no lugar) e o avatar fica neutro.
    $('topo-nome').textContent = u.nome;
    $('topo-avatar').innerHTML = u.nome
      ? escapar(u.nome.charAt(0).toUpperCase())
      : '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-3.6 3.5-5.5 7-5.5s6.4 1.9 7 5.5"/></svg>';
    mostrar('app');
    SIPRO.router.ativar({ usuario: u });
  }

  function irParaLogin() {
    usuarioAtual = null;
    SIPRO.estado.redeId = null;
    carregandoId = null;
    SIPRO.router.desativar();
    fecharMenu();
    SIPRO.login.resetar();
    mostrar('login');
  }

  /* ---------- Eventos do ambiente administrativo ---------- */
  $('btn-menu').addEventListener('click', () => (raiz.classList.contains('menu-aberto') ? fecharMenu() : abrirMenu()));
  $('scrim').addEventListener('click', fecharMenu);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMenu(); });

  $('btn-sair').addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    await SIPRO.auth.sair(); // a mudança de sessão leva de volta ao login
    e.currentTarget.disabled = false;
  });

  /* ---------- Início ---------- */
  async function iniciar() {
    if (!SIPRO.auth.disponivel()) { irParaLogin(); return; }
    SIPRO.auth.aoMudar((_evento, sessao) => (sessao ? entrarNoApp(sessao) : irParaLogin()));
    const sessao = await SIPRO.auth.sessao(); // recupera a sessão salva ao atualizar a página
    if (sessao) entrarNoApp(sessao); else irParaLogin();
  }
  iniciar();
})();
