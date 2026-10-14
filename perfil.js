function abaPerfilSwitch(aba) {
  ['dados','senha','aparencia'].forEach(a => {
    const painel = document.getElementById(`painel-perfil-${a}`);
    const btn = document.getElementById(`aba-perfil-${a}`);
    const ativo = a === aba;
    if(painel) painel.style.display = ativo ? 'flex' : 'none';
    if(btn) {
      btn.style.color = ativo ? 'var(--purple)' : 'var(--text-muted)';
      btn.style.borderBottom = ativo ? '2px solid var(--purple)' : '2px solid transparent';
    }
  });
}

function carregarFotoLocal(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('perfil-foto-img');
    const svg = document.getElementById('perfil-foto-svg');
    img.src = e.target.result;
    img.style.display = 'block';
    svg.style.display = 'none';
    localStorage.setItem('ded_prof_foto', e.target.result);
    atualizarAvatarSidebar(e.target.result);
  };
  reader.readAsDataURL(file);
}

function atualizarAvatarSidebar(fotoUrl) {
  const desktop = document.getElementById('btn-perfil-desktop');
  const mobile = document.getElementById('btn-perfil-mobile');
  [desktop, mobile].forEach(btn => {
    if (!btn) return;
    if (fotoUrl) {
      const wrap = btn.id === 'btn-perfil-mobile'
        ? btn.querySelector('.prof-avatar')
        : btn;
      if (wrap) wrap.innerHTML = `<img src="${fotoUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    }
  });
}

async function _atualizarPerfilComConfirmacao(tabela, id, dados) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?id=eq.${encodeURIComponent(id)}&select=id`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(dados)
  });
  const rows = await res.json().catch(() => null);
  if (!res.ok) throw new Error(rows?.message || `Supabase respondeu com HTTP ${res.status}.`);
  if (!Array.isArray(rows) || !rows.some(row => row?.id != null)) {
    throw new Error('Nenhum registro foi atualizado. Confira sua sessão e permissões.');
  }
  return rows[0];
}

window.abrirPerfil = async function() {
  try {
    let profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
    const session  = JSON.parse(sessionStorage.getItem('ded_user') || '{}');

    if (!profData.id && session.login) {
      if (typeof showLoading === 'function') showLoading('Carregando perfil...');
      try {
        const prof = await api(`professores?id_login=eq.${session.login}&select=*,escolas(*)&limit=1`);
        if (prof && prof[0]) {
          profData = prof[0];
          sessionStorage.setItem('prof_data', JSON.stringify(profData));
        }
      } catch(apiErr) {
        console.error('SIDED+: erro ao buscar prof:', apiErr);
      } finally {
        if (typeof hideLoading === 'function') hideLoading();
      }
    }

    const nomeHeader = document.getElementById('perfil-header-nome');
    const escolaHeader = document.getElementById('perfil-header-escola');
    if(nomeHeader) nomeHeader.textContent = profData.nome || '—';
    const escolaNome = (profData.escolas && profData.escolas.nome) || profData.escola_nome || '—';
    if(escolaHeader) escolaHeader.textContent = escolaNome;

    const foto = localStorage.getItem('ded_prof_foto');
    const img = document.getElementById('perfil-foto-img');
    const svg = document.getElementById('perfil-foto-svg');
    if (img && svg) {
      if (foto) { img.src = foto; img.style.display = 'block'; svg.style.display = 'none'; }
      else { img.style.display = 'none'; svg.style.display = 'block'; }
    }

    const inputNome = document.getElementById('perfil-nome-input');
    if(inputNome) inputNome.value = profData.nome || '';

    const displayLogin = document.getElementById('perfil-login-display');
    if(displayLogin) displayLogin.value = session.login || profData.id_login || '';

    const displayEscola = document.getElementById('perfil-escola-display');
    if(displayEscola) displayEscola.value = (profData.escolas && profData.escolas.nome) || profData.escola_nome || '';

    const displayEmail = document.getElementById('perfil-email-display');
    if(displayEmail) displayEmail.value = session.email || profData.email || '';
    const msgEmail = document.getElementById('perfil-email-msg');
    if(msgEmail) msgEmail.style.display = 'none';

    const msgDados = document.getElementById('perfil-dados-msg');
    if(msgDados) msgDados.style.display = 'none';

    ['perfil-senha-atual','perfil-senha-nova','perfil-senha-conf'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = '';
    });

    const msgSenha = document.getElementById('perfil-senha-msg');
    if(msgSenha) msgSenha.style.display = 'none';

    const tema = localStorage.getItem('ded_tema') || 'claro';
    if(typeof atualizarBotoesTema === 'function') atualizarBotoesTema(tema);

    if(typeof abaPerfilSwitch === 'function') abaPerfilSwitch('dados');

  } catch(e) {
    console.error('SIDED+: Erro ao abrir perfil:', e);
  } finally {
    const modalP = document.getElementById('modal-perfil');
    if(modalP) {
      if (modalP.parentElement !== document.body) document.body.appendChild(modalP);
      modalP.style.display = 'flex';
      modalP.classList.add('open');
    }
  }
};

window.salvarEmailPerfil = async function() {
  const emailInput = document.getElementById('perfil-email-display');
  const msgEl = document.getElementById('perfil-email-msg');
  const email = emailInput?.value.trim();
  msgEl.style.display = 'none';

  if (!email || !email.includes('@')) {
    msgEl.textContent = 'Informe um e-mail válido.';
    msgEl.style.color = '#EF4444';
    msgEl.style.background = '#FEF2F2';
    msgEl.style.display = 'block';
    return;
  }

  const session = JSON.parse(sessionStorage.getItem('ded_user') || '{}');
  if (!session.id) {
    msgEl.textContent = 'Sessão expirada. Faça login novamente.';
    msgEl.style.color = '#EF4444';
    msgEl.style.background = '#FEF2F2';
    msgEl.style.display = 'block';
    return;
  }

  const btn = document.querySelector('button[onclick="salvarEmailPerfil()"]');
  if (btn?.disabled) return;
  if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
  try {
    await _atualizarPerfilComConfirmacao('users', session.id, { email });
    session.email = email;
    sessionStorage.setItem('ded_user', JSON.stringify(session));
    msgEl.textContent = 'E-mail salvo com sucesso!';
    msgEl.style.color = '#16A34A';
    msgEl.style.background = '#F0FDF4';
    msgEl.style.display = 'block';
    if (typeof mostrarToast === 'function') mostrarToast('E-mail salvo com sucesso!');
    setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
  } catch(e) {
    msgEl.textContent = 'Erro ao salvar e-mail. Tente novamente.';
    msgEl.style.color = '#EF4444';
    msgEl.style.background = '#FEF2F2';
    msgEl.style.display = 'block';
    if (typeof mostrarErro === 'function') mostrarErro('Erro ao salvar e-mail. Tente novamente.');
  } finally {
    if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
  }
};

window.fecharPerfil = function() {
  const modal = document.getElementById('modal-perfil');
  if(modal) modal.style.display = 'none';
};

window.setTema = function(tema) {
  localStorage.setItem('ded_tema', tema);
  if(typeof aplicarTema === 'function') aplicarTema(tema);
  if(typeof atualizarBotoesTema === 'function') atualizarBotoesTema(tema);
};

;(function() {
  const tema = localStorage.getItem('ded_tema') || 'claro';
  if(typeof aplicarTema === 'function') aplicarTema(tema);
})();

// ── salvarDadosPerfil ────────────────────────────────────────────────────────
window.salvarDadosPerfil = async function() {
  const nomeInput = document.getElementById('perfil-nome-input');
  const msgEl = document.getElementById('perfil-dados-msg');
  const nome = nomeInput?.value.trim();
  msgEl.style.display = 'none';

  if (!nome) {
    msgEl.textContent = 'Informe seu nome completo.';
    msgEl.style.color = '#EF4444';
    msgEl.style.background = '#FEF2F2';
    msgEl.style.display = 'block';
    return;
  }

  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  if (!profData.id) {
    msgEl.textContent = 'Sessão expirada. Faça login novamente.';
    msgEl.style.color = '#EF4444';
    msgEl.style.background = '#FEF2F2';
    msgEl.style.display = 'block';
    return;
  }

  const btn = document.querySelector('button[onclick="salvarDadosPerfil()"]');
  if (btn?.disabled) return;
  if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
  try {
    await _atualizarPerfilComConfirmacao('professores', profData.id, { nome });
    profData.nome = nome;
    sessionStorage.setItem('prof_data', JSON.stringify(profData));
    const nomeHeader = document.getElementById('perfil-header-nome');
    if (nomeHeader) nomeHeader.textContent = nome;
    const nomesSide = ['prof-nome-side','sidebar-prof-nome-display'];
    nomesSide.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = nome; });
    msgEl.textContent = 'Dados salvos com sucesso!';
    msgEl.style.color = '#16A34A';
    msgEl.style.background = '#F0FDF4';
    msgEl.style.display = 'block';
    if (typeof mostrarToast === 'function') mostrarToast('Dados salvos com sucesso!');
    setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
  } catch(e) {
    msgEl.textContent = 'Erro ao salvar. Tente novamente.';
    msgEl.style.color = '#EF4444';
    msgEl.style.background = '#FEF2F2';
    msgEl.style.display = 'block';
    if (typeof mostrarErro === 'function') mostrarErro('Erro ao salvar dados. Tente novamente.');
  } finally {
    if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
  }
};

// ── salvarSenhaPerfil ────────────────────────────────────────────────────────
window.salvarSenhaPerfil = async function() {
  const atualEl = document.getElementById('perfil-senha-atual');
  const novaEl  = document.getElementById('perfil-senha-nova');
  const confEl  = document.getElementById('perfil-senha-conf');
  const msgEl   = document.getElementById('perfil-senha-msg');
  msgEl.style.display = 'none';

  const atual = atualEl?.value || '';
  const nova  = novaEl?.value  || '';
  const conf  = confEl?.value  || '';

  if (!atual || !nova || !conf) {
    msgEl.textContent = 'Preencha todos os campos de senha.';
    msgEl.style.color = '#EF4444';
    msgEl.style.background = '#FEF2F2';
    msgEl.style.display = 'block';
    return;
  }
  if (nova.length < 4) {
    msgEl.textContent = 'A nova senha deve ter no mínimo 4 caracteres.';
    msgEl.style.color = '#EF4444';
    msgEl.style.background = '#FEF2F2';
    msgEl.style.display = 'block';
    return;
  }
  if (nova !== conf) {
    msgEl.textContent = 'A confirmação não coincide com a nova senha.';
    msgEl.style.color = '#EF4444';
    msgEl.style.background = '#FEF2F2';
    msgEl.style.display = 'block';
    return;
  }

  const session = JSON.parse(sessionStorage.getItem('ded_user') || '{}');
  if (!session.id) {
    msgEl.textContent = 'Sessão expirada. Faça login novamente.';
    msgEl.style.color = '#EF4444';
    msgEl.style.background = '#FEF2F2';
    msgEl.style.display = 'block';
    return;
  }

  try {
    // Verifica senha atual
    const check = await api(`users?id=eq.${session.id}&password=eq.${encodeURIComponent(atual)}&select=id&limit=1`);
    if (!check || !check.length) {
      msgEl.textContent = 'Senha atual incorreta.';
      msgEl.style.color = '#EF4444';
      msgEl.style.background = '#FEF2F2';
      msgEl.style.display = 'block';
      return;
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${session.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ password: nova })
    });
    if (!res.ok) throw new Error('Erro ao salvar');
    [atualEl, novaEl, confEl].forEach(el => { if (el) el.value = ''; });
    msgEl.textContent = 'Senha alterada com sucesso!';
    msgEl.style.color = '#16A34A';
    msgEl.style.background = '#F0FDF4';
    msgEl.style.display = 'block';
    if (typeof mostrarToast === 'function') mostrarToast('Senha alterada com sucesso!');
    setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
  } catch(e) {
    msgEl.textContent = 'Erro ao alterar senha. Tente novamente.';
    msgEl.style.color = '#EF4444';
    msgEl.style.background = '#FEF2F2';
    msgEl.style.display = 'block';
    if (typeof mostrarErro === 'function') mostrarErro('Erro ao alterar senha. Tente novamente.');
  }
};
