// Dashboard page logic

async function init() {
  aplicarPreferenciaSidebarDesktop();
  const prof = await api(`professores?id_login=eq.${session.login}&select=*,escolas(*)&limit=1`);
  if (!prof || !prof[0]) { sair(); return; }
  const p = prof[0];

  // Busca todas as escolas vinculadas ao professor (multi-escola).
  // professor_escolas é a fonte de verdade; p.escolas (join direto) é a escola
  // "principal" legada e sempre está incluída no vínculo (ver SQL de migração).
  const vinculos = await api(`professor_escolas?professor_id=eq.${p.id}&select=escolas(*)`);
  const escolasProfessor = (vinculos || [])
    .map(v => v.escolas)
    .filter(Boolean)
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  // Se por algum motivo o vínculo ainda não existir (ex: SQL de migração não rodou
  // pra esse professor), cai no fallback da escola única já trazida no join.
  if (!escolasProfessor.length && p.escolas) escolasProfessor.push(p.escolas);

  p.escolasDisponiveis = escolasProfessor;
  sessionStorage.setItem('prof_data', JSON.stringify(p));

  // Escola ativa: tenta reaproveitar a última escolhida nesta sessão; senão,
  // usa a escola principal (p.escola_id) se ainda estiver na lista; senão, a primeira.
  let escolaAtivaId = sessionStorage.getItem('escola_ativa_id');
  const idsDisponiveis = new Set(escolasProfessor.map(e => e.id));
  if (!escolaAtivaId || !idsDisponiveis.has(escolaAtivaId)) {
    escolaAtivaId = idsDisponiveis.has(p.escola_id) ? p.escola_id : (escolasProfessor[0]?.id || p.escola_id);
  }
  sessionStorage.setItem('escola_ativa_id', escolaAtivaId);

  aplicarEscolaAtivaUI();
  await carregarTurmas(p.id);

  // Suporte a ?turma_id=...&aba=... (links diretos via query string)
  const _params = new URLSearchParams(window.location.search);
  const _turmaId = _params.get('turma_id');
  const _aba     = _params.get('aba');
  if (_turmaId && todasTurmas) {
    const _t = todasTurmas.find(t => String(t.id) === String(_turmaId));
    if (_t) {
      await abrirTurma(_t.id);
      if (_aba) await abrirPagina(_aba);
      window.history.replaceState({}, '', window.location.pathname);
      return; // roteadorInicializar não precisa rodar, já navegamos
    }
  }

  // Inicializa o roteador APÓS as turmas estarem carregadas.
  // Isso garante que F5 em /turma/.../relatorio restaure a página corretamente,
  // pois _carregarContextoTurma já encontra todasTurmas preenchido.
  if (typeof roteadorInicializar === 'function') {
    await roteadorInicializar();
  }
}

// Escola atualmente selecionada (objeto completo, ou null se não encontrada)
function getEscolaAtiva() {
  const p = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const escolaAtivaId = sessionStorage.getItem('escola_ativa_id');
  return (p.escolasDisponiveis || []).find(e => e.id === escolaAtivaId) || p.escolas || null;
}

// Atualiza cabeçalho, sidebar mobile/desktop e o texto do seletor com a escola ativa
function aplicarEscolaAtivaUI() {
  const p = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const escolaAtiva = getEscolaAtiva();

  document.getElementById('prof-nome-side').textContent = p.nome;
  document.getElementById('prof-escola-side').textContent = escolaAtiva?.nome || '—';
  document.getElementById('sidebar-prof-nome-display').textContent = p.nome;
  document.getElementById('sidebar-escola-display').textContent = escolaAtiva?.nome || '—';
  atualizarCabecalho({
    info: escolaAtiva?.codigo_escola ? `Código: ${escolaAtiva.codigo_escola}` : '',
    titulo: escolaAtiva?.nome || '—',
    detalhe: `Bem-vindo(a), ${p.nome.split(' ')[0]}!`,
    cor: 'var(--purple-dark)'
  });
  atualizarHeaderMobile('SIDED+', escolaAtiva?.nome || 'Sistema Inteligente de Diário Escolar Digital', false, false);

  // Botão/label "Trocar escola" só aparece se o professor tiver mais de uma
  const temMultiplasEscolas = (p.escolasDisponiveis || []).length > 1;
  document.querySelectorAll('.btn-trocar-escola').forEach(el => {
    el.style.display = temMultiplasEscolas ? 'flex' : 'none';
  });
}

// ---- Modal "Trocar Escola" ----
function abrirTrocarEscola() {
  const p = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const escolaAtivaId = sessionStorage.getItem('escola_ativa_id');
  const lista = p.escolasDisponiveis || [];

  if (lista.length <= 1) {
    mostrarToast('Você está vinculado a apenas uma escola.');
    return;
  }

  const listaEl = document.getElementById('trocar-escola-lista');
  if (!listaEl) return;

  listaEl.innerHTML = lista.map(e => `
    <button onclick="selecionarEscolaAtiva('${e.id}')"
      style="width:100%;text-align:left;padding:12px 14px;border-radius:10px;border:1.5px solid ${e.id === escolaAtivaId ? '#3B4FE4' : '#E2E8F0'};background:${e.id === escolaAtivaId ? '#EEF2FF' : '#fff'};margin-bottom:8px;cursor:pointer;font-family:'Sora',sans-serif;">
      <div style="font-weight:700;font-size:14px;color:#1B2550;">${e.nome}${e.id === escolaAtivaId ? ' ✓' : ''}</div>
      ${e.codigo_escola ? `<div style="font-size:11px;color:#64748B;margin-top:2px;">Código: ${e.codigo_escola}</div>` : ''}
    </button>`).join('');

  document.getElementById('modal-trocar-escola').classList.add('open');
}

async function selecionarEscolaAtiva(escolaId) {
  const atual = sessionStorage.getItem('escola_ativa_id');
  if (escolaId === atual) { fecharModal('modal-trocar-escola'); return; }

  sessionStorage.setItem('escola_ativa_id', escolaId);
  fecharModal('modal-trocar-escola');
  aplicarEscolaAtivaUI();

  // Limpa contexto de turma ativa (pertencia à escola anterior) e recarrega turmas
  turmaAtiva = null;
  turmaDisciplinaAtiva = null;
  if (typeof _cache === 'object') Object.keys(_cache).forEach(k => delete _cache[k]);
  window.history.replaceState({}, '', window.location.pathname.split('/turma/')[0] || '/');

  const p = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  await carregarTurmas(p.id);
  if (typeof fecharTurmaUI === 'function') fecharTurmaUI();
  mostrarToast('Escola alterada com sucesso.');
}

let todasTurmaDisciplinas = []; // <-- Nova variável: armazena todas as turma_disciplinas do professor!

async function carregarTurmas(profId) {
  const escolaAtivaId = sessionStorage.getItem('escola_ativa_id');

  const tdResult = await api(`turma_disciplinas?professor_id=eq.${profId}&turmas.escola_id=eq.${escolaAtivaId}&select=id,disciplinas(id,nome,nivel),turmas!inner(id,nome,ano,turno,nivel,codigo,escola_id,periodo_letivo_id,escolas(nome,codigo_escola))`);

  if (tdResult && tdResult.length) {
    todasTurmaDisciplinas = tdResult; // <-- Armazena todas as turma_disciplinas!
    
    // Agrupa por turma para renderizar
    const turmaMap = {};
    tdResult.forEach(td => {
      const t = td.turmas;
      if (!t) return;
      if (!turmaMap[t.id]) {
        turmaMap[t.id] = { ...t, turmaDisciplinas: [] };
      }
      turmaMap[t.id].turmaDisciplinas.push(td);
    });
    todasTurmas = Object.values(turmaMap);
  } else {
    const pt = await api(`professor_turmas?professor_id=eq.${profId}&select=turma_id,disciplina,turmas!inner(escola_id)&turmas.escola_id=eq.${escolaAtivaId}`);
    if (!pt || !pt.length) {
      document.getElementById('turmas-grid').innerHTML = '<div class="turma-empty">Nenhuma turma associada nesta escola.</div>';
      todasTurmas = [];
      renderTurmas(todasTurmas);
      return;
    }
    const ids = pt.map(r => r.turma_id).join(',');
    todasTurmas = await api(`turmas?id=in.(${ids})&select=*,escolas(nome,codigo_escola)&order=nome`) || [];
    const ptMap = {};
    pt.forEach(r => { ptMap[r.turma_id] = r.disciplina; });
    todasTurmas = todasTurmas.map(t => ({ ...t, disciplina: t.disciplina || ptMap[t.id] || null }));
  }

  renderTurmas(todasTurmas);
}

function popularChips() {
  // Disciplina agora usa select fixo no filtro; não são mais necessários chips dinâmicos.
}

function toggleChip(el) {
  const grupo = el.dataset.grupo;
  const val = el.dataset.val;
  const isActive = el.classList.contains('active');
  document.querySelectorAll(`.chip[data-grupo="${grupo}"]`).forEach(c => c.classList.remove('active'));
  if (!isActive) { el.classList.add('active'); filtrosAtivos[grupo] = val; }
  else filtrosAtivos[grupo] = null;
  aplicarFiltros();
}

function atualizarFiltroAno() {
  const selAno = document.getElementById('sel-ano');
  filtrosAtivos.ano = selAno.value || null;
  aplicarFiltros();
}

function aplicarFiltros() {
  const q = document.getElementById('search-turma').value.toLowerCase();
  let lista = todasTurmas;
  if (filtrosAtivos.ano) lista = lista.filter(t => t.ano === filtrosAtivos.ano);
  if (filtrosAtivos.turno) lista = lista.filter(t => t.turno === filtrosAtivos.turno);
  if (q) lista = lista.filter(t => JSON.stringify(t).toLowerCase().includes(q));
  renderTurmas(lista);
}

async function abrirTurmaDisciplina(tdId) {
  const td = todasTurmaDisciplinas.find(x => String(x.id) === String(tdId));
  if (!td) {
    mostrarToast('Turma/Disciplina não encontrada!');
    return;
  }
  // Vamos chamar a função do router para abrir!
  if (typeof abrirTurmaViaDisciplina === 'function') {
    await abrirTurmaViaDisciplina(td);
  }
}

function renderTurmas(lista) {
  const grid = document.getElementById('turmas-grid');

  lista = [...lista].sort((a, b) => {
    const nomeA = (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    if (nomeA !== 0) return nomeA;
    return 0;
  });

  document.getElementById('turmas-header').textContent = `Minhas turmas (${lista.length})`;
  grid.innerHTML = lista.length
    ? lista.map((t, i) => {
        // Se tem múltiplas disciplinas, mostra uma lista de botões
        if (t.turmaDisciplinas && t.turmaDisciplinas.length > 1) {
          return `
            <div class="turma-card" style="animation-delay:${i * 0.04}s">
              <div class="turma-ano">${t.ano}</div>
              <div class="turma-codigo">${t.codigo ? `${t.codigo} — ` : ''}${t.nome}</div>
              <div class="turma-endereco">${t.escolas?.nome || ''}</div>
              <div class="turma-disciplina">
                ${t.turmaDisciplinas.map(td => `
                  <button class="btn-disc-turma" onclick="event.stopPropagation(); abrirTurmaDisciplina('${td.id}')">${td.disciplinas?.nome || '—'}</button>
                `).join('')}
              </div>
              <div class="turma-turno">${t.turno || '—'}</div>
            </div>`;
        } else {
          // Se só tem uma disciplina, abre diretamente a turma_disciplina
          const td = t.turmaDisciplinas ? t.turmaDisciplinas[0] : null;
          const discLabel = td ? td.disciplinas?.nome : (t.disciplina || '—');
          const onclickHandler = td ? `abrirTurmaDisciplina('${td.id}')` : `abrirTurma('${t.id}')`;
          return `
            <div class="turma-card" style="animation-delay:${i * 0.04}s" onclick="${onclickHandler}">
              <div class="turma-ano">${t.ano}</div>
              <div class="turma-codigo">${t.codigo ? `${t.codigo} — ` : ''}${t.nome}</div>
              <div class="turma-endereco">${t.escolas?.nome || ''}</div>
              <div class="turma-disciplina">${discLabel}</div>
              <div class="turma-turno">${t.turno || '—'}</div>
            </div>`;
        }
      }).join('')
    : '<div class="turma-empty">Nenhuma turma encontrada com esses filtros.</div>';
}
