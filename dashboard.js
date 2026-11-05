/* SIREDE+ — Dashboard principal */
(() => {
  'use strict';
  const SIPRO = window.SIPRO;
  const esc = SIPRO.ui.escapar;

  function saudacao() {
    const h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  }
  function dataAtual() {
    const t = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  SIPRO.modulos.dashboard = {
    render(el, ctx) {
      const u = ctx.usuario;
      const primeiroNome = u.nome.split(/\s+/)[0];

      el.innerHTML = `
        <div class="pagina">
          <section class="boas-vindas">
            <p class="boas-vindas__data">${esc(dataAtual())}</p>
            <h2>${saudacao()}${primeiroNome ? ', ' + esc(primeiroNome) : ''}!</h2>
            <p>Você está no ambiente administrativo do SIGEIA+. Use o menu para acessar os módulos.</p>
          </section>

          <section class="bloco-vazio bloco-vazio--grande">
            <h3>Nenhuma informação disponível</h3>
            <p>Indicadores e avisos administrativos aparecerão aqui quando houver registros cadastrados.</p>
          </section>
        </div>`;
    },
  };
})();
