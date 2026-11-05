/* SIREDE+ — Tela de login (interface). A autenticação fica em auth.js. */
(() => {
  'use strict';
  const SIPRO = (window.SIPRO = window.SIPRO || { modulos: {} });

  const form = document.getElementById('form-login');
  const cpf = document.getElementById('cpf');
  const senha = document.getElementById('senha');
  const olho = document.getElementById('btn-olho');
  const aviso = document.getElementById('aviso');
  const btn = document.getElementById('btn-entrar');

  document.getElementById('ano').textContent = new Date().getFullYear();

  const soDigitos = (v) => v.replace(/\D/g, '').slice(0, 11);
  const mascara = (d) => d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');

  function cpfValido(d) {
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    for (const tam of [9, 10]) {
      let soma = 0;
      for (let i = 0; i < tam; i++) soma += Number(d[i]) * (tam + 1 - i);
      if (((soma * 10) % 11) % 10 !== Number(d[tam])) return false;
    }
    return true;
  }

  function mostrarAviso(msg, tipo) {
    aviso.textContent = msg;
    aviso.classList.remove('info', 'erro');
    if (msg && tipo) aviso.classList.add(tipo);
  }
  function erro(nome, msg) {
    const campo = form.querySelector(`[data-field="${nome}"]`);
    campo.classList.remove('erro');
    void campo.offsetWidth;
    campo.classList.add('erro');
    campo.querySelector('.field__erro').textContent = msg;
    campo.querySelector('input').setAttribute('aria-invalid', 'true');
  }
  function limpar(nome) {
    const campo = form.querySelector(`[data-field="${nome}"]`);
    campo.classList.remove('erro');
    campo.querySelector('.field__erro').textContent = '';
    campo.querySelector('input').removeAttribute('aria-invalid');
    mostrarAviso('');
  }
  function carregando(sim) {
    btn.disabled = sim;
    btn.textContent = sim ? 'Entrando...' : 'Entrar';
  }
  function ocultarSenha() {
    senha.type = 'password';
    olho.setAttribute('aria-pressed', 'false');
    olho.setAttribute('aria-label', 'Mostrar senha');
  }

  cpf.addEventListener('input', () => { cpf.value = mascara(soDigitos(cpf.value)); limpar('cpf'); });
  senha.addEventListener('input', () => limpar('senha'));

  olho.addEventListener('click', () => {
    const mostrar = senha.type === 'password';
    senha.type = mostrar ? 'text' : 'password';
    olho.setAttribute('aria-pressed', String(mostrar));
    olho.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
    senha.focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    mostrarAviso('');
    const digitos = soDigitos(cpf.value);
    let primeiro = null;

    if (!digitos) { erro('cpf', 'Informe o seu CPF.'); primeiro = cpf; }
    else if (!cpfValido(digitos)) { erro('cpf', 'CPF inválido. Confira os números.'); primeiro = cpf; }
    if (!senha.value) { erro('senha', 'Informe a sua senha.'); primeiro = primeiro || senha; }
    if (primeiro) { primeiro.focus(); return; }

    carregando(true);
    const r = await SIPRO.auth.entrar(digitos, senha.value);
    carregando(false);

    if (r.erro) { mostrarAviso(r.erro, 'erro'); senha.focus(); return; }
    // Sucesso: o app.js troca de tela ao receber a mudança de sessão.
    senha.value = '';
  });

  /** Chamado pelo app.js ao voltar para o login (ex.: após sair). */
  SIPRO.login = {
    resetar() {
      form.reset();
      ocultarSenha();
      limpar('cpf'); limpar('senha');
      carregando(false);
    },
  };
})();
