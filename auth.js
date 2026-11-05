/* SIREDE+ — Autenticação e sessão (Supabase Auth)
   Único lugar que cria o cliente do Supabase. Os demais arquivos usam SIPRO.auth.
   Só a chave PÚBLICA (publishable) pode ficar aqui; a segurança real vem do RLS. */
(() => {
  'use strict';

  const SUPABASE_URL = 'https://jchulvfsrelekgtkgrxt.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rdnEh4GIQVHd0t0ZNgrzow_z5MdjcgY';
  const CPF_DOMINIO = 'sipro.app'; // CPF vira o e-mail "<cpf>@sipro.app" no Supabase Auth

  const SIPRO = (window.SIPRO = window.SIPRO || { modulos: {} });

  const client = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
    : null;

  function mensagemDeErro(err) {
    if (err.status === 429 || err.code === 'over_request_rate_limit')
      return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
    if (err.code === 'email_not_confirmed')
      return 'Acesso ainda não liberado. Procure o administrador.';
    if (err.code === 'invalid_credentials' || err.status === 400)
      return 'CPF ou senha incorretos.';
    return 'Não foi possível entrar agora. Tente novamente em instantes.';
  }

  /** Nome do usuário autenticado, lido de public.usuarios.
      Não envia id nem CPF: o RLS devolve só o registro de auth.uid(). */
  async function cadastro() {
    if (!client) return null;
    try {
      const { data, error } = await client.from('usuarios').select('nome').maybeSingle();
      const nome = data && typeof data.nome === 'string' ? data.nome.trim() : '';
      return error || !nome ? null : { nome };
    } catch (_) {
      return null;
    }
  }

  async function sessao() {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session;
  }

  async function autenticado() { return !!(await sessao()); }

  async function entrar(cpf, senha) {
    if (!client) return { erro: 'Não foi possível carregar o serviço de autenticação. Verifique a conexão e recarregue a página.' };
    try {
      const { error } = await client.auth.signInWithPassword({ email: `${cpf}@${CPF_DOMINIO}`, password: senha });
      return error ? { erro: mensagemDeErro(error) } : {};
    } catch (_) {
      return { erro: 'Sem conexão com o servidor. Verifique a internet e tente novamente.' };
    }
  }

  async function sair() {
    if (!client) return;
    try { await client.auth.signOut(); }
    catch (_) { await client.auth.signOut({ scope: 'local' }); }
  }

  /** Observa login, logout e renovação de sessão. Retorna função para parar de observar. */
  function aoMudar(callback) {
    if (!client) return () => {};
    // setTimeout: o Supabase não permite novas chamadas dentro do próprio callback de sessão.
    const { data } = client.auth.onAuthStateChange((evento, s) => setTimeout(() => callback(evento, s), 0));
    return () => data.subscription.unsubscribe();
  }

  SIPRO.auth = { disponivel: () => !!client, sessao, autenticado, entrar, sair, aoMudar, cadastro };

  /** Acesso controlado ao banco para os módulos: apenas tabelas e funções (RPC).
      Não expõe auth nem o cliente em si; a segurança real vem do RLS. */
  SIPRO.db = {
    from: (tabela) => client.from(tabela),
    rpc: (nome, args) => client.rpc(nome, args),
  };
})();
