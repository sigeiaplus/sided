// ═════════════════════════════════════════════════════════════════════════════
// SIDED+ — Módulo Planejamento
// Substitui completamente o antigo "Plano de Curso" (calendario_plano.js +
// plano-ia.js). Mantém upload de PDF/imagem (sem análise por IA) e adiciona
// cadastro manual de habilidades BNCC vinculáveis a aulas via aula_habilidades.
// ═════════════════════════════════════════════════════════════════════════════

// ── STORAGE: upload/listagem/remoção de arquivos (portado de calendario_plano.js) ──

function _planejamentoStorageDir() {
  const ano = new Date().getFullYear();
  const tdId = turmaDisciplinaAtiva?.id;
  const base = tdId ? `td_${tdId}` : (turmaAtiva?.id || 'turma');
  return `planejamento/${base}_${ano}`;
}

function _sanitizarNomeArquivoPlanejamento(nome) {
  return nome
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\//g, '-')
    .replace(/\\/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '_')  // só ASCII seguro
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .trim();
}

function _planejamentoStoragePath(fileName) {
  if (!fileName) return _planejamentoStorageDir();
  return `${_planejamentoStorageDir()}/${_sanitizarNomeArquivoPlanejamento(fileName)}`;
}

function _planejamentoRenderLista(files) {
  const lista = document.getElementById('planejamento-arquivos-lista');
  if (!lista) return;
  if (!files.length) {
    lista.style.display = 'none';
    lista.innerHTML = '';
    return;
  }

  lista.style.display = 'flex';
  lista.style.flexWrap = 'wrap';
  lista.innerHTML = files.map(file => {
    const safeName = String(file.name || file.path || '').replace(/'/g, "\\'");
    const displayName = safeName.replace(/^.*\/(.*)$/, '$1');
    return `<div style="display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:#F8FAFC;">
      <button onclick="planejamentoExibirArquivo('${safeName}')" style="padding:0;border:none;background:none;color:var(--text-muted);font-size:12px;cursor:pointer;white-space:nowrap;flex:1;text-align:left;">${displayName}</button>
      <button onclick="planejamentoRemoverArquivo('${safeName}')" style="padding:3px 6px;border:1px solid #FBBFBF;border-radius:5px;background:none;color:#DC2626;font-size:11px;font-weight:600;cursor:pointer;" onmouseover="this.style.background='#FEE2E2'" onmouseout="this.style.background='none'">✕</button>
    </div>`;
  }).join('');
}

// Carrega só a parte de arquivos (PDF/imagem) da tela "Plano de Curso e Habilidades".
// Usada após upload/remoção, para não reinicializar o resto da tela (turmas escolhidas, dias do plano semanal...).
async function _planejamentoCarregarArquivos() {
  document.getElementById('planejamento-empty').style.display = 'none';
  document.getElementById('planejamento-viewer').style.display = 'none';
  document.getElementById('planejamento-btn-trocar').style.display = 'none';
  document.getElementById('planejamento-arquivos-lista').style.display = 'none';

  mostrarToast('Verificando planejamento...');
  const files = await _storageList('documentos', `${_planejamentoStorageDir()}/`);
  if (files.length) {
    _planejamentoRenderLista(files);
    const first = files[0];
    const name = first.name || first.path;
    if (name) {
      planejamentoExibirArquivo(name);
    } else {
      document.getElementById('planejamento-empty').style.display = 'flex';
    }
  } else {
    document.getElementById('planejamento-empty').style.display = 'flex';
  }
}

// Tela antiga (plano de curso + habilidades BNCC). Agora é a visão secundária de Planejamento.
// Carrega uma vez por turma/disciplina; reabrir a visão só alterna a exibição (não perde estado).
let _cursoHabCarregadoKey = null;
async function iniciarPlanoCursoHabilidades(forcar = false) {
  const key = String(turmaDisciplinaAtiva?.id ?? turmaAtiva?.id ?? '');
  if (!forcar && _cursoHabCarregadoKey === key) return;
  _cursoHabCarregadoKey = key;

  await _planejamentoCarregarArquivos();
  await carregarHabilidadesPlanejamento();
  await pgInicializar();
}

function _planejamentoExibirUrl(url, isPdf = false) {
  document.getElementById('planejamento-empty').style.display = 'none';
  document.getElementById('planejamento-viewer').style.display = 'block';
  document.getElementById('planejamento-btn-trocar').style.display = 'flex';
  const iframe = document.getElementById('planejamento-iframe');
  const img    = document.getElementById('planejamento-img');
  const linkMob = document.getElementById('planejamento-link-mob');
  const linkMobA = document.getElementById('planejamento-link-mob-a');
  const urlNocache = url + '?t=' + Date.now();
  const isMobile = window.innerWidth <= 768;
  if (isPdf) {
    if (isMobile) {
      iframe.style.display = 'none'; img.style.display = 'none';
      if (linkMob) { linkMob.style.display = 'block'; linkMobA.href = urlNocache; }
    } else {
      if (linkMob) linkMob.style.display = 'none';
      iframe.style.display = 'block'; img.style.display = 'none';
      iframe.src = urlNocache;
    }
  } else {
    if (linkMob) linkMob.style.display = 'none';
    img.style.display = 'block'; iframe.style.display = 'none';
    img.src = urlNocache;
  }
}

function planejamentoExibirArquivo(fileName) {
  const url = _storagePublicUrl('documentos', _planejamentoStoragePath(fileName));
  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  _planejamentoExibirUrl(url, isPdf);
}

async function planejamentoRemoverArquivo(fileName) {
  if (!confirm(`Tem certeza que quer deletar "${fileName}"?`)) {
    return;
  }

  mostrarToast('Removendo arquivo...');
  try {
    const path = _planejamentoStoragePath(fileName);
    await _storageDelete('documentos', path);
    mostrarToast('✅ Arquivo removido!');
    await _planejamentoCarregarArquivos();
  } catch(err) {
    console.error('[PLANEJAMENTO] Erro ao remover:', err);
    mostrarToast('❌ Erro ao remover: ' + err.message);
  }
}

async function planejamentoHandleFile(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  const invalid = files.find(file => file.size > 50 * 1024 * 1024);
  if (invalid) {
    mostrarToast('Arquivo muito grande. Máx. 50 MB cada.');
    return;
  }

  mostrarToast(`Enviando ${files.length} arquivo${files.length > 1 ? 's' : ''}...`);
  try {
    await Promise.all(files.map(file => {
      const path = _planejamentoStoragePath(file.name);
      return _storageUpload('documentos', path, file);
    }));

    mostrarToast(`✅ ${files.length} arquivo${files.length > 1 ? 's' : ''} salvo${files.length > 1 ? 's' : ''}!`);
    await _planejamentoCarregarArquivos();
  } catch(err) {
    console.error('[PLANEJAMENTO] Erro upload:', err);
    mostrarToast('❌ Erro ao salvar: ' + err.message);
  }
  input.value = '';
}

window.iniciarPlanejamento = iniciarPlanejamento;
window.planejamentoExibirArquivo = planejamentoExibirArquivo;
window.planejamentoRemoverArquivo = planejamentoRemoverArquivo;
window.planejamentoHandleFile = planejamentoHandleFile;

// ── Planejamento: Plano de aula (tela principal) + Plano de Curso e Habilidades (secundária) ──
// Entrada padrão (router.js → iniciarPlanejamento): Plano de aula, montado inline dentro de
// #pagina-planejamento (mesmo layout/sidebar do SIDED+). O botão "Plano de Curso e Habilidades"
// alterna para a tela antiga. As duas visões ficam no DOM; alternar só mostra/esconde, então
// formulários, listas e seleções não são perdidos.

let _planoAulaMontadoKey = null;
let _planejamentoVisaoAtual = 'plano-aula';

function _planoAulaContexto() {
  const prof = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const disc = turmaDisciplinaAtiva?.disciplinas;
  const disciplinaId = disc?.id ?? turmaDisciplinaAtiva?.disciplina_id;
  if (!prof.id || !turmaDisciplinaAtiva || disciplinaId == null) return null;
  return {
    professorId: prof.id,
    professorNome: prof.nome || '',
    disciplinaId,
    disciplinaNome: disc?.nome || turmaAtiva?.disciplina || '',
    turmaId: turmaAtiva?.id ?? turmaDisciplinaAtiva?.turmas?.id ?? null,
    turmaDisciplinaId: turmaDisciplinaAtiva.id,
    anoEscolar: turmaAtiva?.ano ?? null
  };
}

// Monta o Plano de aula na própria página. Só remonta se mudou o professor/turma/disciplina.
function _planoAulaMontar() {
  const root = document.getElementById('planejamento-plano-aula-root');
  if (!root) return;
  const ctx = _planoAulaContexto();
  const key = ctx ? `${ctx.professorId}:${ctx.turmaDisciplinaId}` : 'sem-contexto';
  if (_planoAulaMontadoKey === key && root.childNodes.length) return; // já montado: preserva o estado

  root.innerHTML = '';
  _planoAulaMontadoKey = key;
  if (!ctx) {
    root.innerHTML = '<div style="padding:14px 16px;border-radius:10px;background:#FDF2F8;border:1.5px solid var(--border);font-size:12px;color:var(--text-muted);">Abra uma turma com componente curricular e faça login como professor para usar o Plano de aula.</div>';
    return;
  }
  if (!window.PlanosAula) {
    _planoAulaMontadoKey = null;
    root.innerHTML = '<div style="padding:14px 16px;border-radius:10px;background:#FEF2F2;border:1px solid #FCA5A5;font-size:12px;color:#B91C1C;">Módulo Plano de aula não carregou. Atualize a página (Ctrl+F5).</div>';
    return;
  }
  root.className = 'pa pa-embed';
  window.PlanosAula.montar(root, ctx);
}

// 'plano-aula' | 'curso-habilidades'
async function planejamentoMostrarVisao(qual) {
  const planoAula = document.getElementById('planejamento-view-plano-aula');
  const curso = document.getElementById('planejamento-view-curso');
  if (!planoAula || !curso) return;
  _planejamentoVisaoAtual = qual === 'curso-habilidades' ? 'curso-habilidades' : 'plano-aula';

  planoAula.style.display = _planejamentoVisaoAtual === 'plano-aula' ? 'block' : 'none';
  curso.style.display = _planejamentoVisaoAtual === 'curso-habilidades' ? 'block' : 'none';

  if (_planejamentoVisaoAtual === 'plano-aula') {
    _planoAulaMontar();
  } else {
    await iniciarPlanoCursoHabilidades();
  }
}

// Ponto de entrada chamado por router.js ao clicar em Planejamento na sidebar.
// Abre sempre o Plano de aula; a tela antiga fica acessível pelo botão secundário.
async function iniciarPlanejamento() {
  const discLabel = turmaDisciplinaAtiva?.disciplinas?.nome || turmaAtiva?.disciplina || '';
  const texto = turmaAtiva ? `${turmaAtiva.nome} · ${discLabel} · ${new Date().getFullYear()}` : '';
  ['planejamento-turma-label', 'planejamento-turma-label-pa'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = texto;
  });
  await planejamentoMostrarVisao('plano-aula');
}

// Compatibilidade: o botão antigo "Plano de aula" chamava esta função.
function abrirPlanoDeAula() { return planejamentoMostrarVisao('plano-aula'); }

window.planejamentoMostrarVisao = planejamentoMostrarVisao;
window.iniciarPlanoCursoHabilidades = iniciarPlanoCursoHabilidades;
window.abrirPlanoDeAula = abrirPlanoDeAula;

// ═════════════════════════════════════════════════════════════════════════════
// CADASTRO MANUAL DE HABILIDADES BNCC
// Tabela: habilidades_planejamento (turma_disciplina_id, codigo, descricao,
// divisao_id, temas[]). CRUD completo: criar, listar, editar, deletar.
// Vínculo a múltiplas turmas: uma linha por turma_disciplina_id — "vincular a
// outra turma" cria uma nova linha (cópia dos dados) com outro
// turma_disciplina_id, e cada linha pode ser editada/deletada independente.
// ═════════════════════════════════════════════════════════════════════════════

let _habilidadesPlanejamentoCache = [];
let _editandoHabilidadeId = null; // null = criando nova

async function carregarHabilidadesPlanejamento() {
  const tdId = turmaDisciplinaAtiva?.id;
  if (!tdId) { _habilidadesPlanejamentoCache = []; _renderHabilidadesPlanejamento(); return; }
  try {
    _habilidadesPlanejamentoCache = await api(
      `habilidades_planejamento?turma_disciplina_id=eq.${tdId}&select=*&order=codigo.asc`
    ) || [];
  } catch (e) {
    console.error('[PLANEJAMENTO] Erro ao carregar habilidades:', e);
    _habilidadesPlanejamentoCache = [];
  }
  _renderHabilidadesPlanejamento();
  // Invalida o cache local usado pelo autocomplete do formulário de aula
  if (typeof window._habilidadesAulaInvalidarCache === 'function') window._habilidadesAulaInvalidarCache();
  // Atualiza o card "Habilidades BNCC" (habilidades_aulas.js)
  if (typeof window.iniciarCardHabilidadesBncc === 'function') window.iniciarCardHabilidadesBncc();
}

const _NOMES_TRIMESTRE = { 1: '1º tri', 2: '2º tri', 3: '3º tri' };

function _nomeTrimestreDaHabilidade(h) {
  const div = (_divisoesCache || []).find(d => String(d.id) === String(h.divisao_id));
  if (!div) return '';
  return _NOMES_TRIMESTRE[div.ordem] || div.valor || '';
}

function _renderHabilidadesPlanejamento() {
  const wrap = document.getElementById('planejamento-habilidades-lista');
  if (!wrap) return;
  if (!_habilidadesPlanejamentoCache.length) {
    wrap.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Nenhuma habilidade cadastrada ainda.</div>`;
    return;
  }
  wrap.style.display = 'grid';
  wrap.style.gap = '10px';
  wrap.innerHTML = _habilidadesPlanejamentoCache.map(h => {
    const trimestre = _nomeTrimestreDaHabilidade(h);
    const temas = Array.isArray(h.temas) ? h.temas : [];
    return `<div style="background:var(--white);border:1.5px solid var(--border);border-radius:12px;padding:14px 16px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
        <div style="min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:#3B4FE4;">${h.codigo}</span>
            ${trimestre ? `<span style="font-size:12px;color:var(--text-muted);">${trimestre}</span>` : ''}
          </div>
          <p style="font-size:13px;color:var(--text);margin:0 0 8px;line-height:1.5;">${(h.descricao || '').replace(/</g, '&lt;')}</p>
          ${temas.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${temas.map(t => `<span style="font-size:11px;padding:3px 9px;border-radius:20px;background:#EEF2FF;color:#3B4FE4;">${String(t).replace(/</g, '&lt;')}</span>`).join('')}
          </div>` : ''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button onclick="abrirModalVincularHabilidade('${h.id}')" title="Vincular a outra turma" style="width:30px;height:30px;padding:0;border:1.5px solid var(--border);border-radius:8px;background:none;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
          <button onclick="abrirModalHabilidadePlanejamento('${h.id}')" title="Editar" style="width:30px;height:30px;padding:0;border:1.5px solid var(--border);border-radius:8px;background:none;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onclick="removerHabilidadePlanejamento('${h.id}')" title="Excluir" style="width:30px;height:30px;padding:0;border:1.5px solid #FBBFBF;border-radius:8px;background:none;color:#DC2626;cursor:pointer;display:flex;align-items:center;justify-content:center;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Criar / Editar (modal unificado) ──────────────────────────────────────────
let _turmasExtraCriacaoSelecionadas = new Set();

function abrirModalHabilidadePlanejamento(idParaEditar) {
  const modal = document.getElementById('modal-habilidade-planejamento');
  if (!modal) return;
  _editandoHabilidadeId = idParaEditar || null;
  _turmasExtraCriacaoSelecionadas = new Set();
  const existente = idParaEditar ? _habilidadesPlanejamentoCache.find(h => String(h.id) === String(idParaEditar)) : null;

  document.getElementById('modal-habilidade-planejamento-titulo').textContent = existente ? 'Editar habilidade BNCC' : 'Nova habilidade BNCC';
  document.getElementById('hab-plan-codigo').value = existente?.codigo || '';
  document.getElementById('hab-plan-descricao').value = existente?.descricao || '';
  document.getElementById('hab-plan-temas').value = (existente?.temas || []).join(', ');
  document.getElementById('hab-plan-alert').style.display = 'none';
  _preencherSelectDivisoesPlanejamento();
  if (existente?.divisao_id) document.getElementById('hab-plan-divisao').value = existente.divisao_id;
  document.getElementById('btn-salvar-habilidade-plan').textContent = existente ? 'Salvar alterações' : 'Salvar';

  // Seleção de turmas extras: só faz sentido ao criar (edição altera 1 linha só)
  const blocoTurmasExtra = document.getElementById('hab-plan-turmas-extra-bloco');
  if (blocoTurmasExtra) {
    blocoTurmasExtra.style.display = existente ? 'none' : 'block';
    if (!existente) _carregarTurmasExtraCriacao();
  }

  modal.classList.add('open');
}

async function _carregarTurmasExtraCriacao() {
  const wrap = document.getElementById('hab-plan-turmas-extra-lista');
  if (!wrap) return;
  wrap.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Carregando turmas...</span>';
  try {
    const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
    const tds = await api(`turma_disciplinas?professor_id=eq.${profData.id}&select=id,turmas(nome),disciplinas(nome)`) || [];
    const tdAtualId = turmaDisciplinaAtiva?.id;
    const outras = tds.filter(td => String(td.id) !== String(tdAtualId));
    if (!outras.length) {
      wrap.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Nenhuma outra turma disponível.</span>';
      return;
    }
    wrap.innerHTML = outras.map(td => `
      <span class="turma-extra-chip" data-td="${td.id}" onclick="_toggleTurmaExtraCriacao(this)"
        style="display:inline-flex;align-items:center;padding:6px 11px;border-radius:20px;border:1.5px solid var(--border);font-size:11px;cursor:pointer;margin:0 5px 5px 0;">
        ${td.turmas?.nome || '(turma)'} — ${td.disciplinas?.nome || ''}
      </span>
    `).join('');
  } catch (e) {
    console.error('[PLANEJAMENTO] Erro ao carregar turmas extras:', e);
    wrap.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Erro ao carregar turmas.</span>';
  }
}

function _toggleTurmaExtraCriacao(el) {
  const td = el.dataset.td;
  if (_turmasExtraCriacaoSelecionadas.has(td)) {
    _turmasExtraCriacaoSelecionadas.delete(td);
    el.style.background = 'none'; el.style.borderColor = 'var(--border)'; el.style.color = 'var(--text)';
  } else {
    _turmasExtraCriacaoSelecionadas.add(td);
    el.style.background = '#3B4FE4'; el.style.borderColor = '#3B4FE4'; el.style.color = '#fff';
  }
}

function _preencherSelectDivisoesPlanejamento() {
  const sel = document.getElementById('hab-plan-divisao');
  if (!sel) return;
  const divisoes = _divisoesCache || [];
  sel.innerHTML = '<option value="">Selecione a divisão...</option>' +
    divisoes.map(d => `<option value="${d.id}">${_NOMES_TRIMESTRE[d.ordem] || d.valor || ('Divisão ' + d.ordem)}</option>`).join('');
}

async function salvarHabilidadePlanejamento() {
  const alEl = document.getElementById('hab-plan-alert');
  alEl.style.display = 'none';

  const codigo = document.getElementById('hab-plan-codigo').value.trim();
  const descricao = document.getElementById('hab-plan-descricao').value.trim();
  const divisaoId = document.getElementById('hab-plan-divisao').value;
  const temasRaw = document.getElementById('hab-plan-temas').value.trim();
  const temas = temasRaw.split(',').map(t => t.trim()).filter(Boolean);

  if (!codigo) { alEl.textContent = 'O código é obrigatório.'; alEl.style.display = 'block'; return; }
  if (!descricao) { alEl.textContent = 'A descrição é obrigatória.'; alEl.style.display = 'block'; return; }
  if (!divisaoId) { alEl.textContent = 'Selecione a divisão.'; alEl.style.display = 'block'; return; }
  if (!temas.length) { alEl.textContent = 'Informe ao menos um tema (separado por vírgula).'; alEl.style.display = 'block'; return; }

  const btn = document.getElementById('btn-salvar-habilidade-plan');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  try {
    if (_editandoHabilidadeId) {
      const payload = { codigo, descricao, divisao_id: divisaoId, temas };
      const original = _habilidadesPlanejamentoCache.find(x => String(x.id) === String(_editandoHabilidadeId));
      let irmas = [];
      try { irmas = await _buscarHabilidadesIrmas(original); }
      catch (e) { console.warn('[PLANEJAMENTO] Não foi possível buscar habilidades em outras turmas; salvando só nesta.', e); }
      if (irmas.length) { _abrirEscopoEdicaoHabilidade(_editandoHabilidadeId, payload, original, irmas); return; }
      await _patchHabilidadePlanejamento(_editandoHabilidadeId, payload);
      mostrarToast('✅ Habilidade atualizada!');
    } else {
      const tdId = turmaDisciplinaAtiva?.id;
      if (!tdId) { alEl.textContent = 'Nenhuma turma/disciplina ativa.'; alEl.style.display = 'block'; return; }
      const tdIds = [tdId, ...Array.from(_turmasExtraCriacaoSelecionadas)];
      const payload = tdIds.map(id => ({ turma_disciplina_id: id, codigo, descricao, divisao_id: divisaoId, temas }));
      await api('habilidades_planejamento', { method: 'POST', body: JSON.stringify(payload) });
      mostrarToast(tdIds.length > 1 ? `✅ Habilidade cadastrada em ${tdIds.length} turmas!` : '✅ Habilidade cadastrada!');
    }
    fecharModal('modal-habilidade-planejamento');
    await carregarHabilidadesPlanejamento();
  } catch (e) {
    console.error('[PLANEJAMENTO] Erro ao salvar habilidade:', e);
    alEl.textContent = 'Erro ao salvar. Tente novamente.';
    alEl.style.display = 'block';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = _editandoHabilidadeId ? 'Salvar alterações' : 'Salvar'; }
  }
}

async function removerHabilidadePlanejamento(id) {
  if (!confirm('Remover esta habilidade? Ela também será desvinculada de qualquer aula.')) return;
  try {
    await api(`habilidades_planejamento?id=eq.${id}`, { method: 'DELETE' });
    mostrarToast('✅ Habilidade removida!');
    await carregarHabilidadesPlanejamento();
  } catch (e) {
    console.error('[PLANEJAMENTO] Erro ao remover habilidade:', e);
    mostrarToast('❌ Erro ao remover.');
  }
}

// ── Vincular a outra turma (cria uma cópia independente com outro td_id) ─────
let _vinculandoHabilidadeId = null;
let _turmasParaVincularSelecionadas = new Set();

async function abrirModalVincularHabilidade(habilidadeId) {
  const modal = document.getElementById('modal-vincular-habilidade');
  if (!modal) return;
  _vinculandoHabilidadeId = habilidadeId;
  _turmasParaVincularSelecionadas = new Set();
  const h = _habilidadesPlanejamentoCache.find(x => String(x.id) === String(habilidadeId));
  document.getElementById('vincular-hab-codigo').textContent = h?.codigo || '';
  document.getElementById('vincular-hab-alert').style.display = 'none';

  const wrap = document.getElementById('vincular-turmas-lista');
  wrap.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Carregando turmas...</span>';
  modal.classList.add('open');

  try {
    const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
    const tds = await api(`turma_disciplinas?professor_id=eq.${profData.id}&select=id,turmas(nome),disciplinas(nome)`) || [];
    const tdAtualId = turmaDisciplinaAtiva?.id;
    const outras = tds.filter(td => String(td.id) !== String(tdAtualId));
    if (!outras.length) {
      wrap.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Nenhuma outra turma disponível.</span>';
      return;
    }
    wrap.innerHTML = outras.map(td => `
      <span class="vincular-turma-chip" data-td="${td.id}" onclick="_toggleTurmaVincular(this)"
        style="display:inline-flex;align-items:center;padding:7px 12px;border-radius:20px;border:1.5px solid var(--border);font-size:12px;cursor:pointer;margin:0 6px 6px 0;">
        ${td.turmas?.nome || '(turma)'} — ${td.disciplinas?.nome || ''}
      </span>
    `).join('');
  } catch (e) {
    console.error('[PLANEJAMENTO] Erro ao carregar turmas para vincular:', e);
    wrap.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Erro ao carregar turmas.</span>';
  }
}

function _toggleTurmaVincular(el) {
  const td = el.dataset.td;
  if (_turmasParaVincularSelecionadas.has(td)) {
    _turmasParaVincularSelecionadas.delete(td);
    el.style.background = 'none'; el.style.borderColor = 'var(--border)'; el.style.color = 'var(--text)';
  } else {
    _turmasParaVincularSelecionadas.add(td);
    el.style.background = '#3B4FE4'; el.style.borderColor = '#3B4FE4'; el.style.color = '#fff';
  }
}

async function confirmarVincularHabilidade() {
  const alEl = document.getElementById('vincular-hab-alert');
  alEl.style.display = 'none';
  if (!_turmasParaVincularSelecionadas.size) {
    alEl.textContent = 'Selecione ao menos uma turma.';
    alEl.style.display = 'block';
    return;
  }
  const h = _habilidadesPlanejamentoCache.find(x => String(x.id) === String(_vinculandoHabilidadeId));
  if (!h) return;

  const btn = document.getElementById('btn-confirmar-vincular-habilidade');
  if (btn) { btn.disabled = true; btn.textContent = 'Vinculando...'; }
  try {
    const payload = Array.from(_turmasParaVincularSelecionadas).map(tdId => ({
      turma_disciplina_id: tdId,
      codigo: h.codigo,
      descricao: h.descricao,
      divisao_id: h.divisao_id,
      temas: h.temas,
    }));
    await api('habilidades_planejamento', { method: 'POST', body: JSON.stringify(payload) });
    mostrarToast(`✅ Vinculada a ${payload.length} turma${payload.length > 1 ? 's' : ''}!`);
    fecharModal('modal-vincular-habilidade');
  } catch (e) {
    console.error('[PLANEJAMENTO] Erro ao vincular habilidade:', e);
    alEl.textContent = 'Erro ao vincular. Tente novamente.';
    alEl.style.display = 'block';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Vincular'; }
  }
}

// ── Editar habilidade: oferecer aplicar também em outras turmas ──────────────
// "Irmãs" = habilidades com o MESMO CÓDIGO (antes da edição) em outras turmas
// do mesmo professor. Não há vínculo no banco entre as cópias; a busca é por código.
let _edicaoHabPendente = null;
let _irmasEscopoSelecionadas = new Set();

function _patchHabilidadePlanejamento(id, body) {
  return api(`habilidades_planejamento?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

async function _buscarHabilidadesIrmas(original) {
  if (!original?.codigo) return [];
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  if (!profData.id) return [];
  const tds = await api(`turma_disciplinas?professor_id=eq.${profData.id}&select=id,turmas(nome),disciplinas(nome)`) || [];
  const tdAtualId = turmaDisciplinaAtiva?.id;
  const outras = tds.filter(td => String(td.id) !== String(tdAtualId));
  if (!outras.length) return [];
  const rows = await api(
    `habilidades_planejamento?codigo=eq.${encodeURIComponent(original.codigo)}` +
    `&turma_disciplina_id=in.(${outras.map(td => td.id).join(',')})&select=id,turma_disciplina_id,descricao,divisao_id`
  ) || [];
  const porTd = {};
  rows.forEach(r => { porTd[r.turma_disciplina_id] = (porTd[r.turma_disciplina_id] || 0) + 1; });
  return rows.map(r => {
    const td = outras.find(x => String(x.id) === String(r.turma_disciplina_id));
    let label = `${td?.turmas?.nome || '(turma)'} — ${td?.disciplinas?.nome || ''}`;
    if (porTd[r.turma_disciplina_id] > 1) label += ` · ${(r.descricao || '').slice(0, 25)}`;
    return { id: r.id, divisao_id: r.divisao_id, label };
  });
}

function _abrirEscopoEdicaoHabilidade(id, payload, original, irmas) {
  _edicaoHabPendente = { id, payload, original, irmas };
  _irmasEscopoSelecionadas = new Set();
  document.getElementById('escopo-hab-codigo').textContent = original?.codigo || '';
  document.getElementById('escopo-hab-alert').style.display = 'none';
  document.getElementById('escopo-hab-lista').innerHTML = irmas.map(i => `
      <span class="escopo-hab-chip" data-id="${i.id}" onclick="_toggleIrmaEscopo(this)"
        style="display:inline-flex;align-items:center;padding:7px 12px;border-radius:20px;border:1.5px solid var(--border);font-size:12px;cursor:pointer;margin:0 6px 6px 0;">
        ${i.label}
      </span>
    `).join('');
  _atualizarBotaoEscopoHabilidade();
  document.getElementById('modal-escopo-edicao-habilidade').classList.add('open');
}

function _toggleIrmaEscopo(el) {
  const id = String(el.dataset.id);
  if (_irmasEscopoSelecionadas.has(id)) {
    _irmasEscopoSelecionadas.delete(id);
    el.style.background = 'none'; el.style.borderColor = 'var(--border)'; el.style.color = 'var(--text)';
  } else {
    _irmasEscopoSelecionadas.add(id);
    el.style.background = '#3B4FE4'; el.style.borderColor = '#3B4FE4'; el.style.color = '#fff';
  }
  _atualizarBotaoEscopoHabilidade();
}

function _atualizarBotaoEscopoHabilidade() {
  const btn = document.getElementById('escopo-hab-btn-selecionadas');
  if (!btn) return;
  const n = _irmasEscopoSelecionadas.size;
  btn.disabled = n === 0;
  btn.style.opacity = n === 0 ? '0.5' : '1';
  btn.textContent = n === 0 ? 'Aplicar às selecionadas' : `Aplicar também em ${n} turma${n > 1 ? 's' : ''}`;
}

function cancelarEscopoEdicaoHabilidade() {
  _edicaoHabPendente = null;
  fecharModal('modal-escopo-edicao-habilidade');
}

async function confirmarEscopoEdicaoHabilidade(aplicarNasSelecionadas) {
  const p = _edicaoHabPendente;
  if (!p) return;
  const ids = aplicarNasSelecionadas ? Array.from(_irmasEscopoSelecionadas) : [];
  if (aplicarNasSelecionadas && !ids.length) return;
  const alEl = document.getElementById('escopo-hab-alert');
  alEl.style.display = 'none';
  const btnSel = document.getElementById('escopo-hab-btn-selecionadas');
  const btnUma = document.getElementById('escopo-hab-btn-uma');
  if (btnSel) btnSel.disabled = true;
  if (btnUma) btnUma.disabled = true;
  try {
    await _patchHabilidadePlanejamento(p.id, p.payload); // esta turma primeiro
    const resultados = await Promise.allSettled(ids.map(irmaId => {
      const irma = p.irmas.find(x => String(x.id) === String(irmaId));
      const body = { codigo: p.payload.codigo, descricao: p.payload.descricao, temas: p.payload.temas };
      // A divisão só acompanha se a cópia ainda estava na mesma divisão da original
      if (irma && String(irma.divisao_id) === String(p.original?.divisao_id)) body.divisao_id = p.payload.divisao_id;
      return _patchHabilidadePlanejamento(irmaId, body);
    }));
    const falhas = resultados.filter(r => r.status === 'rejected').length;
    if (falhas) {
      mostrarToast(`⚠️ Atualizada nesta turma; ${falhas} de ${ids.length} outras turmas falharam.`);
    } else {
      mostrarToast(ids.length ? `✅ Habilidade atualizada em ${ids.length + 1} turmas!` : '✅ Habilidade atualizada!');
    }
    _edicaoHabPendente = null;
    fecharModal('modal-escopo-edicao-habilidade');
    fecharModal('modal-habilidade-planejamento');
    await carregarHabilidadesPlanejamento();
  } catch (e) {
    console.error('[PLANEJAMENTO] Erro ao salvar habilidade (escopo):', e);
    alEl.textContent = 'Erro ao salvar. Tente novamente.';
    alEl.style.display = 'block';
  } finally {
    if (btnUma) btnUma.disabled = false;
    _atualizarBotaoEscopoHabilidade();
  }
}

window.carregarHabilidadesPlanejamento = carregarHabilidadesPlanejamento;
window.abrirModalHabilidadePlanejamento = abrirModalHabilidadePlanejamento;
window._toggleTurmaExtraCriacao = _toggleTurmaExtraCriacao;
window.salvarHabilidadePlanejamento = salvarHabilidadePlanejamento;
window.removerHabilidadePlanejamento = removerHabilidadePlanejamento;
window.abrirModalVincularHabilidade = abrirModalVincularHabilidade;
window._toggleTurmaVincular = _toggleTurmaVincular;
window.confirmarVincularHabilidade = confirmarVincularHabilidade;
window._toggleIrmaEscopo = _toggleIrmaEscopo;
window.cancelarEscopoEdicaoHabilidade = cancelarEscopoEdicaoHabilidade;
window.confirmarEscopoEdicaoHabilidade = confirmarEscopoEdicaoHabilidade;

// ═════════════════════════════════════════════════════════════════════════════
// GERAR PLANO DE AULA / PLANO SEMANAL — integrado à aba Planejamento
// Reaproveita planos_gerador.js (jsPDF) e planos_assets.js (logo/brasão).
// Diferente do gerador standalone: usa turmaAtiva/turmaDisciplinaAtiva e a
// api() já disponíveis no dashboard, sem depender de sessionStorage próprio.
// ═════════════════════════════════════════════════════════════════════════════

let _pgTurmasProfessor = [];
let _pgTurmasSelecionadasAula = new Set();
let _pgTurmasSelecionadasSem = new Set();
let _pgDiaContador = 0;

function pgMudarAba(aba) {
  document.getElementById('pg-tab-aula').classList.toggle('pg-tab-active', aba === 'aula');
  document.getElementById('pg-tab-semanal').classList.toggle('pg-tab-active', aba === 'semanal');
  document.getElementById('pg-tab-aula').style.background = aba === 'aula' ? '#BE185D' : 'none';
  document.getElementById('pg-tab-aula').style.color = aba === 'aula' ? '#fff' : 'var(--text-muted)';
  document.getElementById('pg-tab-aula').style.borderColor = aba === 'aula' ? '#BE185D' : 'var(--border)';
  document.getElementById('pg-tab-semanal').style.background = aba === 'semanal' ? '#BE185D' : 'none';
  document.getElementById('pg-tab-semanal').style.color = aba === 'semanal' ? '#fff' : 'var(--text-muted)';
  document.getElementById('pg-tab-semanal').style.borderColor = aba === 'semanal' ? '#BE185D' : 'var(--border)';
  document.getElementById('pg-painel-aula').style.display = aba === 'aula' ? 'block' : 'none';
  document.getElementById('pg-painel-semanal').style.display = aba === 'semanal' ? 'block' : 'none';
}

async function pgInicializar() {
  await _garantirJsPDFPlanos();
  _pgTurmasSelecionadasAula = new Set();
  _pgTurmasSelecionadasSem = new Set();

  // Preenche professor com o nome da sessão, se disponível
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const campoProf = document.getElementById('pg-pa-professor');
  if (campoProf && !campoProf.value) campoProf.value = profData.nome || '';

  // Turma(s) de destino: todas as turma_disciplinas do professor
  try {
    const tds = await api(`turma_disciplinas?professor_id=eq.${profData.id}&select=id,turmas(nome),disciplinas(nome)`) || [];
    _pgTurmasProfessor = tds.map(td => ({
      tdId: td.id,
      turmaNome: td.turmas?.nome || '(turma)',
      componente: td.disciplinas?.nome || '',
    }));
  } catch (e) {
    console.error('[PLANOS] Erro ao carregar turmas do professor:', e);
    _pgTurmasProfessor = [];
  }

  ['aula', 'sem'].forEach(sufixo => {
    const wrap = document.getElementById(`pg-turmas-lista-${sufixo}`);
    if (!wrap) return;
    if (!_pgTurmasProfessor.length) {
      wrap.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Nenhuma turma encontrada.</span>';
      return;
    }
    wrap.innerHTML = _pgTurmasProfessor.map(t => `
      <span class="pg-turma-chip" data-td="${t.tdId}" data-sufixo="${sufixo}" onclick="pgToggleTurmaChip(this)"
        style="display:inline-flex;align-items:center;padding:7px 12px;border-radius:20px;border:1.5px solid var(--border);font-size:12px;cursor:pointer;margin:0 6px 6px 0;">
        ${t.turmaNome}
      </span>
    `).join('');
  });

  // Preenche campos de turma/componente texto com a turma ativa atual, como default
  const discLabel = turmaDisciplinaAtiva?.disciplinas?.nome || turmaAtiva?.disciplina || '';
  const campoTurmaAula = document.getElementById('pg-pa-turma');
  const campoCompAula = document.getElementById('pg-pa-componente');
  const campoTurmaSem = document.getElementById('pg-ps-turma');
  const campoCompSem = document.getElementById('pg-ps-componente');
  if (campoTurmaAula && !campoTurmaAula.value) campoTurmaAula.value = turmaAtiva?.nome || '';
  if (campoCompAula && !campoCompAula.value) campoCompAula.value = discLabel;
  if (campoTurmaSem && !campoTurmaSem.value) campoTurmaSem.value = turmaAtiva?.nome || '';
  if (campoCompSem && !campoCompSem.value) campoCompSem.value = discLabel;

  // Habilidades cadastradas na turma ativa, para os dois selects de atalho
  const selAula = document.getElementById('pg-hab-select-aula');
  const selSem = document.getElementById('pg-hab-select-sem');
  const opcoes = '<option value="">Selecionar habilidade cadastrada...</option>' +
    (_habilidadesPlanejamentoCache || []).map(h => `<option value="${h.codigo} — ${h.descricao}">${h.codigo}</option>`).join('');
  if (selAula) selAula.innerHTML = opcoes;
  if (selSem) selSem.innerHTML = opcoes;

  // Ao menos 2 dias por padrão no plano semanal, só na primeira vez
  const diasLista = document.getElementById('pg-dias-lista');
  if (diasLista && !diasLista.children.length) {
    pgAdicionarDiaSemanal({ titulo: 'SEGUNDA-FEIRA (AULA 01)' });
    pgAdicionarDiaSemanal({ titulo: 'TERÇA-FEIRA (AULA 02)' });
  }
}

function pgToggleTurmaChip(el) {
  const sufixo = el.dataset.sufixo;
  const set = sufixo === 'aula' ? _pgTurmasSelecionadasAula : _pgTurmasSelecionadasSem;
  const td = el.dataset.td;
  if (set.has(td)) {
    set.delete(td);
    el.style.background = 'none'; el.style.borderColor = 'var(--border)'; el.style.color = 'var(--text)';
  } else {
    set.add(td);
    el.style.background = '#BE185D'; el.style.borderColor = '#BE185D'; el.style.color = '#fff';
  }
}

function pgAdicionarDiaSemanal(valores) {
  _pgDiaContador++;
  const id = `pg-dia-${_pgDiaContador}`;
  const wrap = document.createElement('div');
  wrap.className = 'field';
  wrap.id = id;
  wrap.style.cssText = 'border:1.5px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px;position:relative;';
  wrap.innerHTML = `
    <button type="button" onclick="document.getElementById('${id}').remove()" title="Remover dia"
      style="position:absolute;top:8px;right:8px;border:none;background:none;color:#DC2626;cursor:pointer;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <div class="field"><label>Título da coluna (dia + aula)</label><input class="pg-dia-titulo" placeholder="Ex: SEGUNDA-FEIRA (AULA 01)" value="${valores?.titulo || ''}"></div>
    <div class="field"><label>Tema</label><input class="pg-dia-tema" placeholder="Tema da aula deste dia" value="${valores?.tema || ''}"></div>
    <div class="field"><label>Objetivo</label><textarea class="pg-dia-objetivo" style="min-height:40px;">${valores?.objetivo || ''}</textarea></div>
    <div class="field"><label>Metodologia</label><textarea class="pg-dia-metodologia" style="min-height:40px;">${valores?.metodologia || ''}</textarea></div>
    <div class="field"><label>Conteúdo</label><textarea class="pg-dia-conteudo" style="min-height:40px;">${valores?.conteudo || ''}</textarea></div>
    <div class="field" style="margin-bottom:0;"><label>Observações</label><textarea class="pg-dia-obs" style="min-height:32px;">${valores?.obs || ''}</textarea></div>
  `;
  document.getElementById('pg-dias-lista').appendChild(wrap);
}

async function pgGerarPlanoAula() {
  const statusEl = document.getElementById('pg-status-aula');
  statusEl.style.display = 'none';
  const dados = {
    professor: document.getElementById('pg-pa-professor').value.trim(),
    periodo: document.getElementById('pg-pa-periodo').value.trim(),
    turma: document.getElementById('pg-pa-turma').value.trim(),
    componente: document.getElementById('pg-pa-componente').value.trim(),
    tema: document.getElementById('pg-pa-tema').value.trim(),
    habilidades: document.getElementById('pg-pa-habilidades').value.trim(),
    objetivo: document.getElementById('pg-pa-objetivo').value.trim(),
    metodologia: document.getElementById('pg-pa-metodologia').value.trim(),
    recursos: document.getElementById('pg-pa-recursos').value.trim(),
    conteudo: document.getElementById('pg-pa-conteudo').value.trim(),
    avaliacao: document.getElementById('pg-pa-avaliacao').value.trim(),
    observacoes: document.getElementById('pg-pa-observacoes').value.trim(),
  };
  if (!dados.tema) {
    statusEl.className = 'err'; statusEl.style.cssText += 'background:#FEF2F2;color:#B91C1C;border:1px solid #FCA5A5;display:block;';
    statusEl.textContent = 'Informe ao menos o Tema para gerar o PDF.';
    return;
  }
  try {
    const turmasNomes = _pgTurmasSelecionadasAula.size
      ? _pgTurmasProfessor.filter(t => _pgTurmasSelecionadasAula.has(String(t.tdId))).map(t => t.turmaNome)
      : [];
    await gerarPlanoAulaMultiTurma(dados, turmasNomes);
    statusEl.style.cssText += 'background:#F0FDF4;color:#166534;border:1px solid #BBF7D0;display:block;';
    statusEl.textContent = `✅ PDF gerado${turmasNomes.length > 1 ? ` (${turmasNomes.length} turmas)` : ''}!`;
  } catch (e) {
    console.error('[PLANOS] Erro ao gerar plano de aula:', e);
    statusEl.style.cssText += 'background:#FEF2F2;color:#B91C1C;border:1px solid #FCA5A5;display:block;';
    statusEl.textContent = 'Erro ao gerar PDF.';
  }
}

async function pgGerarPlanoSemanal() {
  const statusEl = document.getElementById('pg-status-sem');
  statusEl.style.display = 'none';
  const diasEls = document.querySelectorAll('#pg-dias-lista > div');
  const dias = Array.from(diasEls).map(el => ({
    titulo: el.querySelector('.pg-dia-titulo').value.trim(),
    tema: el.querySelector('.pg-dia-tema').value.trim(),
    objetivo: el.querySelector('.pg-dia-objetivo').value.trim(),
    metodologia: el.querySelector('.pg-dia-metodologia').value.trim(),
    conteudo: el.querySelector('.pg-dia-conteudo').value.trim(),
    obs: el.querySelector('.pg-dia-obs').value.trim(),
  }));
  const dados = {
    componente: document.getElementById('pg-ps-componente').value.trim(),
    turma: document.getElementById('pg-ps-turma').value.trim(),
    trimestre: document.getElementById('pg-ps-trimestre').value.trim(),
    ano: document.getElementById('pg-ps-ano').value.trim() || new Date().getFullYear(),
    periodoInicio: document.getElementById('pg-ps-inicio').value.trim(),
    periodoFim: document.getElementById('pg-ps-fim').value.trim(),
    habilidades: document.getElementById('pg-ps-habilidades').value.trim(),
    dias,
  };
  if (!dados.componente) {
    statusEl.style.cssText += 'background:#FEF2F2;color:#B91C1C;border:1px solid #FCA5A5;display:block;';
    statusEl.textContent = 'Informe ao menos o Componente curricular.';
    return;
  }
  if (!dias.length) {
    statusEl.style.cssText += 'background:#FEF2F2;color:#B91C1C;border:1px solid #FCA5A5;display:block;';
    statusEl.textContent = 'Adicione ao menos um dia/aula.';
    return;
  }
  try {
    const turmasNomes = _pgTurmasSelecionadasSem.size
      ? _pgTurmasProfessor.filter(t => _pgTurmasSelecionadasSem.has(String(t.tdId))).map(t => t.turmaNome)
      : [];
    await gerarPlanoSemanalMultiTurma(dados, turmasNomes);
    statusEl.style.cssText += 'background:#F0FDF4;color:#166534;border:1px solid #BBF7D0;display:block;';
    statusEl.textContent = `✅ PDF gerado${turmasNomes.length > 1 ? ` (${turmasNomes.length} turmas)` : ''}!`;
  } catch (e) {
    console.error('[PLANOS] Erro ao gerar plano semanal:', e);
    statusEl.style.cssText += 'background:#FEF2F2;color:#B91C1C;border:1px solid #FCA5A5;display:block;';
    statusEl.textContent = 'Erro ao gerar PDF.';
  }
}

window.pgMudarAba = pgMudarAba;
window.pgInicializar = pgInicializar;
window.pgToggleTurmaChip = pgToggleTurmaChip;
window.pgAdicionarDiaSemanal = pgAdicionarDiaSemanal;
window.pgGerarPlanoAula = pgGerarPlanoAula;
window.pgGerarPlanoSemanal = pgGerarPlanoSemanal;
