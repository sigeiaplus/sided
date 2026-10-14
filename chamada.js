// SIDED+ — Chamada de Presença

// ── ESTADO LOCAL ─────────────────────────────────────────────────────────────
let dataChamadaAtiva = null;
let _modoInversoChamada = false;
let _faltasPorAlunoAtual = {};
let _justificativasTemp = {}; // { alunoId: { tipo, detalhes, observacoes } }
let _justAlunoAtivo = null; // aluno cuja justificativa está sendo editada no modal
let _abonadasTemp = {}; // { alunoId: true } — falta registrada mas fora do contador

// ── DIA DA SEMANA NA CHAMADA ─────────────────────────────────────────────────
function _atualizarDiaSemChamada(dataISO) {
  const el = document.getElementById('chamada-dia-semana');
  if (!el) return;
  if (!dataISO) { el.textContent = ''; return; }
  const diasSem = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
  const d = new Date(dataISO + 'T12:00:00');
  const nome = diasSem[d.getDay()] || '';
  el.textContent = nome.charAt(0).toUpperCase() + nome.slice(1);
}

function mudarDataChamada(delta) {
  const inp = document.getElementById('chamada-date-input');
  // parse DD/MM/AAAA or fallback to today
  let d;
  const m = (inp.value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    d = new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00`);
  } else {
    d = new Date();
  }
  d.setDate(d.getDate() + delta);
  const iso = d.toISOString().split('T')[0];
  const [y, mo, dy] = iso.split('-');
  inp.value = `${dy}/${mo}/${y}`;
  // sync calendar state
  calState['cal-chamada'] = { ano: parseInt(y), mes: parseInt(mo) - 1 };
  atualizarCalendario('cal-chamada');
  _atualizarDiaSemChamada(iso);
  // limpar seleção de aula ao trocar de data
  const btnWrap = document.getElementById('btn-salvar-chamada-wrap');
  if (btnWrap) btnWrap._aulaId = null;
  carregarChamadaPorData(iso);
}

function selecionarDataChamada(iso) {
  const [y, mo, dy] = iso.split('-');
  document.getElementById('chamada-date-input').value = `${dy}/${mo}/${y}`;
  calState['cal-chamada'] = { ano: parseInt(y), mes: parseInt(mo) - 1 };
  atualizarCalendario('cal-chamada');
  _atualizarDiaSemChamada(iso);
  // limpar seleção de aula ao trocar de data
  const btnWrap = document.getElementById('btn-salvar-chamada-wrap');
  if (btnWrap) btnWrap._aulaId = null;
  carregarChamadaPorData(iso);
}

async function carregarChamadaHoje() {
  const hoje = new Date().toISOString().split('T')[0];
  const [y, mo, dy] = hoje.split('-');
  const inp = document.getElementById('chamada-date-input');
  inp.value = `${dy}/${mo}/${y}`;
  calState['cal-chamada'] = { ano: parseInt(y), mes: parseInt(mo) - 1 };
  await atualizarCalendario('cal-chamada');
  _atualizarDiaSemChamada(hoje);
  await carregarChamadaPorData(hoje);
}

function irParaHojeChamada() {
  const hoje = new Date().toISOString().split('T')[0];
  selecionarDataChamada(hoje);
}

async function carregarChamadaPorData(dataISO) {
  dataChamadaAtiva = dataISO;
  chamadaTemp = {};
  const aviso = document.getElementById('chamada-aviso');
  const secao = document.getElementById('chamada-secao');
  const btnWrap = document.getElementById('btn-salvar-chamada-wrap');

  document.getElementById('chamada-status-label').textContent = '';
  if (typeof showLoading === 'function') showLoading('Carregando chamada...');

  try {

  // verificar calendário da escola — reutiliza feriadosCache (preenchido pelo calendário)
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const escolaId = profData.escolas?.id || profData.escola_id;
  let eventosDia = [];
  if (escolaId) {
    // Usa feriadosCache se já preenchido, senão busca uma única vez
    if (!feriadosCache.length) {
      feriadosCache = await api(`calendario_escolar?escola_id=eq.${escolaId}&select=*`) || [];
    }
    eventosDia = feriadosCache.filter(e => {
      const fim = e.data_fim || e.data;
      return dataISO >= e.data && dataISO <= fim;
    });
  }

  const semAula = eventosDia.find(e => ['feriado_municipal','feriado_estadual','recesso'].includes(e.tipo));
  const sabadoLetivo = eventosDia.find(e => e.tipo === 'sabado_letivo');
  const reposicao = eventosDia.find(e => e.tipo === 'reposicao');

  // se é feriado ou recesso — mostrar aviso e bloquear
  if (semAula) {
    // Recesso é exibido em cinza (como um feriado "neutro"); feriados seguem no âmbar padrão
    const isRecesso = semAula.tipo === 'recesso';
    const paleta = isRecesso
      ? { bg: '#F3F4F6', border: '#D1D5DB', texto: '#4B5563' }
      : { bg: '#FFFBEB', border: '#FCD34D', texto: '#92400E' };
    aviso.style.display = 'block';
    aviso.style.background = paleta.bg;
    aviso.style.borderColor = paleta.border;
    aviso.style.color = paleta.texto;
    const tipos = { feriado_municipal: 'Feriado Municipal', feriado_estadual: 'Feriado Estadual', recesso: 'Recesso' };
    document.getElementById('chamada-aviso').innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${paleta.texto}" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <strong>${tipos[semAula.tipo] || semAula.tipo}</strong>
      </div>
      <div>${semAula.descricao} — Não há aula neste dia.</div>`;
    secao.style.display = 'none';
    btnWrap.style.display = 'none';
    document.getElementById('chamada-list').innerHTML = '';
    document.getElementById('chamada-faltosos-wrap').innerHTML = '';
    return;
  }

  // avisar se é sábado letivo ou reposição
  const avisoExtra = sabadoLetivo
    ? `<div style="background:#DCFCE7;border:1px solid #86EFAC;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#166534;"><strong>Sábado Letivo</strong> — ${sabadoLetivo.descricao}</div>`
    : reposicao
    ? `<div style="background:#EDE8FF;border:1px solid #C8A8E8;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:var(--purple);"><strong>Reposição</strong> — ${reposicao.descricao}</div>`
    : '';
  aviso.style.display = 'none';

  // mostrar aviso de sábado letivo/reposição acima da seção
  const secaoEl = document.getElementById('chamada-secao');
  let avisoExtraEl = document.getElementById('chamada-aviso-extra');
  if (!avisoExtraEl) {
    avisoExtraEl = document.createElement('div');
    avisoExtraEl.id = 'chamada-aviso-extra';
    secaoEl.parentNode.insertBefore(avisoExtraEl, secaoEl);
  }
  avisoExtraEl.innerHTML = avisoExtra;

  // Buscar TODAS as aulas do dia (pode haver mais de uma)
  const aulasDoDia = aulasTurma
    .filter(a => dataAulaOnly(a.data) === dataISO)
    .sort((a, b) => (a.data > b.data ? 1 : -1)); // ordenar por hora/criação

  if (!aulasDoDia.length) {
    aviso.style.display = 'block';
    secao.style.display = 'none';
    btnWrap.style.display = 'none';
    document.getElementById('chamada-list').innerHTML = '';
    document.getElementById('chamada-faltosos-wrap').innerHTML = '';
    document.getElementById('chamada-seletor-aula-wrap').style.display = 'none';
    return;
  }

  aviso.style.display = 'none';

  // Seletor de aula — só exibir quando há 2+ aulas no mesmo dia
  const seletorWrap = document.getElementById('chamada-seletor-aula-wrap');
  const aulasDiaEl = document.getElementById('chamada-aulas-dia');
  const aulasOrdenadas = [...aulasTurma].sort((a,b) => dataAulaOnly(a.data).localeCompare(dataAulaOnly(b.data)));

  if (aulasDoDia.length > 1) {
    seletorWrap.style.display = 'block';
    // Determinar qual aula está selecionada (manter seleção ou pegar a 1ª)
    const aulaAtualId = btnWrap._aulaId && aulasDoDia.find(a => a.id === btnWrap._aulaId) ? btnWrap._aulaId : aulasDoDia[0].id;
    aulasDiaEl.innerHTML = aulasDoDia.map(aula => {
      const numAula = aulasOrdenadas.findIndex(a => a.id === aula.id) + 1;
      const ativa = aula.id === aulaAtualId;
      return `<button onclick="selecionarAulaChamada('${aula.id}')" id="btn-sel-aula-${aula.id}"
        style="padding:7px 16px;border-radius:20px;border:1.5px solid ${ativa ? 'var(--purple)' : 'var(--border)'};
        background:${ativa ? 'var(--purple)' : 'var(--white)'};color:${ativa ? '#fff' : 'var(--text-muted)'};
        font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;gap:6px;">
        <span>Aula ${numAula}</span>
        ${aula.nome ? `<span style="font-weight:400;opacity:0.8;">— ${aula.nome}</span>` : ''}
      </button>`;
    }).join('');
    // Carregar a aula ativa
    await carregarChamadaDeAulaEspecifica(aulaAtualId, aulasOrdenadas);
  } else {
    seletorWrap.style.display = 'none';
    await carregarChamadaDeAulaEspecifica(aulasDoDia[0].id, aulasOrdenadas);
  }
  } finally {
    if (typeof hideLoading === 'function') hideLoading();
  }
}

async function selecionarAulaChamada(aulaId) {
  const aulasOrdenadas = [...aulasTurma].sort((a,b) => dataAulaOnly(a.data).localeCompare(dataAulaOnly(b.data)));
  // Atualizar visual dos botões
  document.querySelectorAll('[id^="btn-sel-aula-"]').forEach(btn => {
    const isAtivo = btn.id === `btn-sel-aula-${aulaId}`;
    btn.style.background = isAtivo ? 'var(--purple)' : 'var(--white)';
    btn.style.borderColor = isAtivo ? 'var(--purple)' : 'var(--border)';
    btn.style.color = isAtivo ? '#fff' : 'var(--text-muted)';
  });
  await carregarChamadaDeAulaEspecifica(aulaId, aulasOrdenadas);
}

async function carregarChamadaDeAulaEspecifica(aulaId, aulasOrdenadas) {
  const aulaData = aulasTurma.find(a => a.id === aulaId);
  if (!aulaData) return;

  const secao = document.getElementById('chamada-secao');
  const btnWrap = document.getElementById('btn-salvar-chamada-wrap');

  chamadaTemp = {};
  _chamadaIdxFoco = -1; // resetar foco ao trocar de aula
  secao.style.display = 'block';

  // preencher descrição da aula
  document.getElementById('chamada-desc-aula').value = aulaData.descricao || '';

  // número da aula
  const numAula = aulasOrdenadas.findIndex(a => a.id === aulaData.id) + 1;
  document.getElementById('col-aula-label').textContent = `Aula ${numAula}`;
  document.getElementById('chamada-total-alunos').textContent = alunosTurma.length;

  const _tdId = turmaDisciplinaAtiva?.id;
  const _profId = JSON.parse(sessionStorage.getItem('prof_data') || '{}').id;
  let _aulasIds;
  if (_tdId) {
    const _comTd = aulasTurma.filter(a => a.turma_disciplina_id === _tdId).map(a => a.id);
    const _semTd = aulasTurma.filter(a => !a.turma_disciplina_id && a.professor_id === _profId).map(a => a.id);
    _aulasIds = [..._comTd, ..._semTd];
  } else {
    _aulasIds = aulasTurma.map(a => a.id);
  }

  const [chamadaSalva, todasFaltas] = await Promise.all([
    api(`chamadas?aula_id=eq.${aulaData.id}&select=*`),
    (alunosTurma.length && _aulasIds.length)
      ? api(`chamadas?aluno_id=in.(${alunosTurma.map(a=>a.id).join(',')})&aula_id=in.(${_aulasIds.join(',')})&presente=eq.false&select=aluno_id,falta_abonada`)
      : Promise.resolve([])
  ]);

  const mapSalvo = {};
  (chamadaSalva || []).forEach(c => { mapSalvo[c.aluno_id] = c.presente; });

  // Faltas abonadas são registradas normalmente mas não somam no contador.
  const faltasPorAluno = {};
  (todasFaltas || []).forEach(f => {
    if (f.falta_abonada) return;
    faltasPorAluno[f.aluno_id] = (faltasPorAluno[f.aluno_id] || 0) + 1;
  });
  _faltasPorAlunoAtual = faltasPorAluno;

  alunosTurma.forEach(a => { chamadaTemp[a.id] = mapSalvo[a.id] !== undefined ? mapSalvo[a.id] : true; });

  // Recarregar justificativas e abonos já salvos para esta aula
  _justificativasTemp = {};
  _abonadasTemp = {};
  (chamadaSalva || []).forEach(c => {
    if (c.falta_justificada) {
      _justificativasTemp[c.aluno_id] = {
        tipo: c.tipo_justificativa || '',
        detalhes: c.detalhes_justificativa || '',
        observacoes: c.observacoes_justificativa || ''
      };
    }
    if (c.falta_abonada) _abonadasTemp[c.aluno_id] = true;
  });

  const jaSalva = (chamadaSalva || []).length > 0;
  chamadaCacheSet(aulaData.id, jaSalva);
  document.getElementById('chamada-status-label').textContent = jaSalva ? '✓ Chamada já registrada anteriormente.' : 'Chamada ainda não foi salva.';

  renderListaChamada(faltasPorAluno);
  renderizarFaltosos();

  btnWrap.style.display = 'block';
  btnWrap._aulaId = aulaData.id;

  // atualizar toggle
  const todosPresentes = alunosTurma.every(a => chamadaTemp[a.id]);
  const toggle = document.getElementById('toggle-todos');
  toggle.checked = todosPresentes;
  atualizarToggleVisual(todosPresentes);
}

function renderListaChamada(faltasPorAluno) {
  document.getElementById('chamada-list').innerHTML = alunosTurma.map((a, i) => {
    const presente = chamadaTemp[a.id];
    const justificada = !presente && !!_justificativasTemp[a.id];
    const abonada = !presente && !!_abonadasTemp[a.id];
    const faltas = faltasPorAluno ? (faltasPorAluno[a.id] || 0) : 0;
    const corFundo = presente ? '#fff' : (abonada ? '#DBEAFE' : (justificada ? '#FEF3C7' : '#FEE2E2'));
    return `
    <div class="chamada-aluno-row ${presente ? '' : 'faltou'}" id="row-${a.id}" style="display:grid;grid-template-columns:1fr 90px 76px;align-items:center;padding:12px 18px;border-bottom:1px solid var(--border);background:${corFundo};">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:50%;background:#5A3480;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:13px;font-weight:400;color:var(--text);">${a.codigo_simade || ''}</span>
          <span onclick="abrirHistoricoPresenca('${a.id}','${a.nome_completo.replace(/'/g,"\\'")}');event.stopPropagation();" style="font-size:14px;font-weight:700;color:var(--purple);text-decoration:underline;cursor:pointer;">${a.nome_completo}${tagRemanejado(a)}</span>
          ${justificada ? `<span style="font-size:10px;font-weight:700;color:#92400E;background:#FDE68A;border-radius:10px;padding:2px 8px;">Justificada</span>` : ''}
          ${abonada ? `<span style="font-size:10px;font-weight:700;color:#1E40AF;background:#BFDBFE;border-radius:10px;padding:2px 8px;">Abonada</span>` : ''}
        </div>
      </div>
      <div style="text-align:center;font-size:13px;font-weight:700;color:${faltas > 0 ? '#E24B4A' : 'var(--text-muted)'};">${faltas}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
        <button onclick="togglePresenca('${a.id}')" id="btn-p-${a.id}" style="width:34px;height:34px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:${presente ? '#DCFCE7' : '#FEE2E2'};">
          ${presente
            ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'}
        </button>
        ${!presente ? `
        <button onclick="abrirJustificarFalta('${a.id}');event.stopPropagation();" id="btn-just-${a.id}" title="${justificada ? 'Editar justificativa' : 'Justificar falta'}"
          style="width:28px;height:28px;border-radius:50%;border:1.5px solid ${justificada ? '#F59E0B' : 'var(--border)'};cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:${justificada ? '#FEF3C7' : '#fff'};">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${justificada ? '#92400E' : 'var(--text-muted)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg>
        </button>` : ''}
      </div>
    </div>`;
  }).join('');
  // Restaurar foco visual se houver índice ativo
  _chamadaAplicarFoco();
}

// ── NAVEGAÇÃO POR TECLADO NA CHAMADA ────────────────────────────────────────
let _chamadaIdxFoco = -1; // índice do aluno com foco atual (-1 = nenhum)

function _chamadaAplicarFoco() {
  alunosTurma.forEach((a, i) => {
    const row = document.getElementById('row-' + a.id);
    if (!row) return;
    if (i === _chamadaIdxFoco) {
      row.style.outline = '2.5px solid var(--purple)';
      row.style.outlineOffset = '-2px';
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      row.style.outline = '';
      row.style.outlineOffset = '';
    }
  });
}

function _chamadaTeclado(e) {
  // Só age quando a seção de chamada está visível
  const secao = document.getElementById('chamada-secao');
  if (!secao || secao.style.display === 'none') return;
  // Ignorar se foco está em input/textarea/select
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  const total = alunosTurma.length;
  if (!total) return;

  const k = e.key;

  if (k === 'ArrowDown') {
    e.preventDefault();
    _chamadaIdxFoco = _chamadaIdxFoco < total - 1 ? _chamadaIdxFoco + 1 : 0;
    _chamadaAplicarFoco();
    return;
  }

  if (k === 'ArrowUp') {
    e.preventDefault();
    _chamadaIdxFoco = _chamadaIdxFoco > 0 ? _chamadaIdxFoco - 1 : total - 1;
    _chamadaAplicarFoco();
    return;
  }

  // Ações só se há um aluno focado
  if (_chamadaIdxFoco < 0 || _chamadaIdxFoco >= total) return;
  const alunoId = alunosTurma[_chamadaIdxFoco].id;

  if (k === 'Enter' || k === ' ') {
    e.preventDefault();
    // Marcar falta (força false)
    chamadaTemp[alunoId] = false;
    _chamadaAtualizarRow(alunoId, false);
    // Avançar para próximo automaticamente
    _chamadaIdxFoco = _chamadaIdxFoco < total - 1 ? _chamadaIdxFoco + 1 : total - 1;
    _chamadaAplicarFoco();
    return;
  }

  if (k === 'Shift' || k === 'Tab' || k === 'Control' || k === 'Alt') {
    e.preventDefault();
    // Marcar como presente (força true)
    chamadaTemp[alunoId] = true;
    _chamadaAtualizarRow(alunoId, true);
    // Avançar para próximo automaticamente
    _chamadaIdxFoco = _chamadaIdxFoco < total - 1 ? _chamadaIdxFoco + 1 : total - 1;
    _chamadaAplicarFoco();
    return;
  }
}

// Atualiza visualmente uma row sem re-renderizar a lista inteira
// Como o botão "Justificar" só existe na row quando o aluno está faltoso,
// não dá para só trocar estilos aqui — precisa re-renderizar a lista inteira.
function _chamadaAtualizarRow(alunoId, presente) {
  if (presente) { delete _justificativasTemp[alunoId]; delete _abonadasTemp[alunoId]; }
  renderListaChamada(_faltasPorAlunoAtual);
  renderizarFaltosos();
  const todosPresentes = alunosTurma.every(a => chamadaTemp[a.id]);
  const toggle = document.getElementById('toggle-todos');
  if (toggle) { toggle.checked = todosPresentes; atualizarToggleVisual(todosPresentes); }
}

// Resetar índice de foco ao carregar nova chamada
(function _inicializarTecladoChamada() {
  document.addEventListener('keydown', _chamadaTeclado);
})();

function renderizarFaltosos() {
  const faltosos = alunosTurma.filter(a => !chamadaTemp[a.id]);
  const wrap = document.getElementById('chamada-faltosos-wrap');
  
  if (faltosos.length === 0) {
    wrap.innerHTML = '';
    return;
  }

  wrap.innerHTML = faltosos.map(a => `
    <div id="chip-${a.id}" style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px;background:#FEE2E2;border-radius:20px;border:1px solid #FBBFBF;margin:4px;">
      <span style="font-size:12px;font-weight:600;color:#991B1B;">${a.nome_completo.split(' ')[0]} ${a.nome_completo.split(' ').slice(-1)[0]}</span>
      <button onclick="togglePresenca('${a.id}')" style="width:24px;height:24px;border-radius:50%;border:none;background:#DCFCE7;cursor:pointer;display:flex;align-items:center;justify-content:center;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
    </div>
  `).join('');
}

function toggleTodosPresentes(checked) {
  alunosTurma.forEach(a => { chamadaTemp[a.id] = checked; });
  atualizarToggleVisual(checked);
  // re-renderizar sem buscar faltas novamente
  renderListaChamada(null);
  renderizarFaltosos();
  // rebuscar faltas para exibir correto
  if (alunosTurma.length) {
    api(`chamadas?aluno_id=in.(${alunosTurma.map(a=>a.id).join(',')})&presente=eq.false&select=aluno_id,falta_abonada`).then(faltas => {
      const faltasPorAluno = {};
      (faltas||[]).forEach(f => { if (!f.falta_abonada) faltasPorAluno[f.aluno_id] = (faltasPorAluno[f.aluno_id]||0)+1; });
      _faltasPorAlunoAtual = faltasPorAluno;
      renderListaChamada(faltasPorAluno);
      renderizarFaltosos();
    });
  }
}

// Modo inverso: todos faltaram, professor marca só os presentes

function toggleModoInversoChamada() {
  _modoInversoChamada = !_modoInversoChamada;
  const btn = document.getElementById('btn-modo-inverso');
  if (btn) {
    btn.style.background = _modoInversoChamada ? '#FEF3C7' : 'var(--white)';
    btn.style.borderColor = _modoInversoChamada ? '#F59E0B' : 'var(--border)';
    btn.style.color = _modoInversoChamada ? '#92400E' : 'var(--text-muted)';
    btn.title = _modoInversoChamada
      ? 'Modo inverso ATIVO — todos faltaram. Clique para desativar.'
      : 'Modo inverso: todos faltaram, marcar só os presentes';
  }
  // Marcar todos como falta (inverso) ou todos presentes (normal)
  alunosTurma.forEach(a => { chamadaTemp[a.id] = !_modoInversoChamada; });
  atualizarToggleVisual(!_modoInversoChamada);
  renderListaChamada(null);
  renderizarFaltosos();
  if (alunosTurma.length) {
    api(`chamadas?aluno_id=in.(${alunosTurma.map(a=>a.id).join(',')})&presente=eq.false&select=aluno_id,falta_abonada`).then(faltas => {
      const faltasPorAluno = {};
      (faltas||[]).forEach(f => { if (!f.falta_abonada) faltasPorAluno[f.aluno_id] = (faltasPorAluno[f.aluno_id]||0)+1; });
      _faltasPorAlunoAtual = faltasPorAluno;
      renderListaChamada(faltasPorAluno);
      renderizarFaltosos();
    });
  }
}

function atualizarToggleVisual(checked) {
  const track = document.getElementById('toggle-track');
  const thumb = document.getElementById('toggle-thumb');
  if (!track || !thumb) return;
  track.style.background = checked ? '#6C4FD4' : '#ccc';
  thumb.style.transform = checked ? 'translateX(18px)' : 'translateX(0)';
}

// ── JUSTIFICAR FALTA (com opção de abonar) ───────────────────────────────────
function abrirJustificarFalta(alunoId) {
  const aluno = alunosTurma.find(a => a.id === alunoId);
  if (!aluno) return;
  _justAlunoAtivo = alunoId;

  const existente = _justificativasTemp[alunoId] || { tipo: '', detalhes: '', observacoes: '' };
  document.getElementById('just-aluno-nome').textContent = aluno.nome_completo;
  document.getElementById('just-tipo').value = existente.tipo;
  document.getElementById('just-detalhes').value = existente.detalhes;
  document.getElementById('just-observacoes').value = existente.observacoes;
  document.getElementById('just-abonar').checked = !!_abonadasTemp[alunoId];
  const alertEl = document.getElementById('just-alert');
  alertEl.style.display = 'none';
  alertEl.textContent = '';

  document.getElementById('modal-justificar-falta').classList.add('open');
}

function fecharJustificarFalta() {
  document.getElementById('modal-justificar-falta').classList.remove('open');
  _justAlunoAtivo = null;
}

function salvarJustificativaFalta() {
  const alunoId = _justAlunoAtivo;
  if (!alunoId) return;

  const tipo = document.getElementById('just-tipo').value;
  const detalhes = document.getElementById('just-detalhes').value.trim();
  const observacoes = document.getElementById('just-observacoes').value.trim();
  const abonar = document.getElementById('just-abonar').checked;
  const alertEl = document.getElementById('just-alert');

  if (!tipo) {
    alertEl.textContent = 'Selecione o tipo da justificativa.';
    alertEl.style.display = 'block';
    return;
  }
  if (!detalhes || detalhes.length < 5) {
    alertEl.textContent = 'Os detalhes devem ter ao menos 5 caracteres.';
    alertEl.style.display = 'block';
    return;
  }

  const jaAbonada = !!_abonadasTemp[alunoId];
  _justificativasTemp[alunoId] = { tipo, detalhes, observacoes };
  // Só pode abonar quando há justificativa — por isso o checkbox vive dentro
  // deste modal em vez de ser uma ação isolada na row.
  if (abonar) {
    _abonadasTemp[alunoId] = true;
  } else {
    delete _abonadasTemp[alunoId];
  }
  // Ajusta o contador local na hora, sem esperar recarregar do banco
  if (abonar && !jaAbonada) {
    _faltasPorAlunoAtual[alunoId] = Math.max(0, (_faltasPorAlunoAtual[alunoId] || 0) - 1);
  } else if (!abonar && jaAbonada) {
    _faltasPorAlunoAtual[alunoId] = (_faltasPorAlunoAtual[alunoId] || 0) + 1;
  }

  fecharJustificarFalta();

  renderListaChamada(_faltasPorAlunoAtual);
  renderizarFaltosos();
}

// Monta a linha de `chamadas` para um aluno, incluindo os campos de
// justificativa (só preenchidos quando o aluno está faltoso E tem
// justificativa registrada em _justificativasTemp) e o abono de falta
// (falta continua presente=false, só não soma no contador).
function _linhaChamadaAluno(aulaId, aluno) {
  const presente = chamadaTemp[aluno.id] !== false;
  const just = !presente ? _justificativasTemp[aluno.id] : null;
  const abonada = !presente && !!_abonadasTemp[aluno.id];
  return {
    aula_id: aulaId,
    aluno_id: aluno.id,
    presente,
    falta_justificada: !!just,
    tipo_justificativa: just ? just.tipo : null,
    detalhes_justificativa: just ? just.detalhes : null,
    observacoes_justificativa: just ? (just.observacoes || null) : null,
    falta_abonada: abonada
  };
}

async function salvarChamada() {
  const wrap = document.getElementById('btn-salvar-chamada-wrap');
  const btn = wrap?.querySelector('button');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');

  try {
  if (typeof showLoading === 'function') showLoading('Salvando chamada...');
  const tri = detectarTrimestreAtual().tri;
  if (await verificarBloqueio(tri)) return;
  const aulaId = wrap._aulaId;
  if (!aulaId || !alunosTurma.length) {
    if (typeof mostrarErro === 'function') mostrarErro('Não foi possível salvar: confira se a aula e os alunos estão carregados.');
    return;
  }
  const aulaAtual = aulasTurma.find(a => a.id === aulaId);
  const rows = alunosTurma.map(a => _linhaChamadaAluno(aulaId, a));

  // Salva a chamada de uma única aula: DELETE (limpa registros antigos) →
  // POST (grava os novos) → PATCH (marca status lecionada). Essas 3 etapas
  // têm que ser sequenciais entre si (não dá pra gravar antes de limpar),
  // mas aulas diferentes são independentes entre si e podem rodar em paralelo.
  async function _salvarChamadaDeAula(alvoId, linhas) {
    await api(`chamadas?aula_id=eq.${alvoId}`, { method: 'DELETE' });
    await api('chamadas', { method: 'POST', body: JSON.stringify(linhas) });
    await api(`aulas?id=eq.${alvoId}`, { method: 'PATCH', body: JSON.stringify({ status: 'lecionada' }) });
    chamadaCacheSet(alvoId, true);
    const idx = aulasTurma.findIndex(a => a.id === alvoId);
    if (idx !== -1) aulasTurma[idx] = { ...aulasTurma[idx], status: 'lecionada' };
  }

  try {
    // Descobre as outras aulas do mesmo dia (cópia automática) antes de salvar
    let outrasMesmoDia = [];
    if (aulaAtual) {
      const dataAtual = dataAulaOnly(aulaAtual.data);
      const _tdId = turmaDisciplinaAtiva?.id;
      outrasMesmoDia = aulasTurma.filter(a =>
        a.id !== aulaId &&
        dataAulaOnly(a.data) === dataAtual &&
        (_tdId ? a.turma_disciplina_id === _tdId : a.professor_id === aulaAtual.professor_id)
      );
    }

    // Todas as aulas (a atual + as do mesmo dia) são salvas em paralelo —
    // antes era um `for` sequencial, o que travava a tela por vários segundos
    // quando havia múltiplas aulas no mesmo dia.
    const tarefas = [_salvarChamadaDeAula(aulaId, rows)];
    outrasMesmoDia.forEach(outra => {
      const rowsOutra = alunosTurma.map(a => _linhaChamadaAluno(outra.id, a));
      tarefas.push(_salvarChamadaDeAula(outra.id, rowsOutra));
    });
    await Promise.all(tarefas);

    cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
    mostrarToastChamada(outrasMesmoDia.length);
  } catch (e) {
    console.error('[CHAMADA] Erro ao salvar:', e);
    if (typeof mostrarErro === 'function') mostrarErro('Erro ao salvar chamada. Tente novamente.');
  }
  } finally {
    if (typeof hideLoading === 'function') hideLoading();
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
  }
}

// ── Toast com mascote (base compartilhada) ──────────────────────────────────
// Usada por mostrarToastNotas e mostrarToastChamada — evita duplicar a
// imagem/CSS/timer em duas funções quase idênticas.
const _TOAST_MASCOTE_B64 = "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAEAAElEQVR4nOz9ebwk2VXfi373EBE5nXNq6FHqrq4epW6JwcwgJgmDbUBMxgbPz1z8nu/1dMEDXBs/Jl9ssMGAzTV+xs/YeLqAmTwKGZDAgLDBCISQ1N1qdbeGVnd1V50hp4jYe6/7x46IjMxzaugauqq79u/ziZMnMyMjdwwZa+21fuu3FAkJCdcdp06dEq01Sqm1RWsNgIh0j+0C4FzF009/SF23gSckJLxskW4cCQnXEA8+eL/0nyu1/pMLYf211vBvYtMBaNH4B0euC/DYY+9Pv/GEhIQjkW4OCQlXgPtO3yubs/bWgG8a875hvhjadTedgc1tbK63uX77PISA9566rnnqg0+n331CQkJyABISXgxOnTotWZbRhuvNeX5BqxC9AzjkIPQN81Gfa6GPmuKfB/0oQf9Ra00/vSAihBAIIVC5mieffDLdBxISbkKkH35CwgVw7733itYaY0xjRM2aASV44PAMvH08nwFfGemjZ+6b67U4HBHwa+9tphOqqjrS8WihrVmLDiRnICHh5kH6sSckbOD06VOS54PO6LcGP+bf1ZpRLjK7RszbJOldHNFB2DTcLS62nRDc2vNDBr4Z/1HbUkoREFoHRymF956yLPnABz6Q7g0JCa9wpB95QgJw7733SFEUaK0JIeBcnOEflVNvQ+paa8rFsnv9qMX7wxGC/jbb98+H80UGWlhrz1shICIXTCEopahcfWi/2u8UEd773veme0RCwisU6cedcNPi/vvvF62PnnErFWfEbY6+b0j7hja32aHX+kZ400D31wUwxhwaV3+mfqGKAFhxCC4WQTgfmVAZfd4oQwiB4XDIYrHg8ccfT/eKhIRXGNKPOuGmwwP33S9ZlqGUwvlq7b3NmfomSW8TEi78EzrfDLz9Hh/qC37+YhEA5MIkwYtVERz1ej9KUdc1eZ5jjKEsSx57f3IEEhJeKUg/5oSbBq958CFpZ+Tee7z3GHt5ZXqHyu5EI/hokFXonktQ3XOlBYUBFVaPFzHwF0sRdEJBzff0v0/wh76vP74+zkc2bKsGRKRziJITkJDwykD6ISe8onH61D1iraUt3evY+6yM2xpUWAvVr0L0R5frqbBKGcR19Nqj1halBNAoJU1qQbr1L1bmd7H3WwchkhP92iME4q7G8cSKgdVj/ILDKYruUCiFtZa6rgkh0B5H7z2z2SzpCSQkvMyRfsAJr1g8eP8Dkud5N+N3znUz2SzLMMZQ1/W6eI+WQ+Hw+HzlAKy9H+SQdG9fwrdl17fb6j+uNiIg6shHCRd4H9akgjcJgLByENoqhtYB6mb1NjtvGmNTN+Cosb/vsUfTPSQh4WWK9ONNeMXhtQ+9RrTWh8LnrWHuG8LWgHaGTUVD1xrQtszucC19NPy5tWvb7j+2IfMLpRZWzoU+8rGdyR/9/jqJ8EL5/U3jH0IAUdRBYrrgCOJha/z7okVtZYQxBmstLvh";

const _CADERNO_B64 = "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";

function _toastComMascote(id, extraHtml, imgB64) {
  const isMobile = window.innerWidth < 768;
  let t = document.getElementById(id);
  if (!t) { t = document.createElement('div'); t.id = id; document.body.appendChild(t); }
  t.style.cssText = isMobile
    ? 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(30px);z-index:999999;opacity:0;transition:all 0.4s cubic-bezier(.34,1.56,.64,1);pointer-events:none;'
    : 'position:fixed;bottom:0;right:32px;transform:translateY(110%);z-index:999999;opacity:0;transition:all 0.4s cubic-bezier(.34,1.56,.64,1);pointer-events:none;';
  // onerror garante que, se a imagem (base64) estiver corrompida ou não
  // carregar por qualquer motivo, o card de texto ainda assim apareça —
  // a imagem quebrada some em vez de impedir a exibição do toast inteiro.
  t.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;"><img src="data:image/png;base64,${imgB64 || _TOAST_MASCOTE_B64}" style="width:120px;" alt="" onerror="this.style.display='none'"/>${extraHtml || ''}</div>`;
  t.style.opacity = '1';
  t.style.transform = isMobile ? 'translateX(-50%) translateY(0)' : 'translateY(0)';
  clearTimeout(t._hide);
  t._hide = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = isMobile ? 'translateX(-50%) translateY(30px)' : 'translateY(110%)';
  }, 3000);
}

function mostrarToastNotas() {
  _toastComMascote('toast-notas');
}

// Pílula branca arredondada com texto grande e destacado, usada como
// "extraHtml" nos toasts fofos (chamada/avaliação/aula) para padronizar
// o visual entre os três.
function _pilulaTexto(texto, cor) {
  return `<div style="background:#fff;border-radius:16px;padding:10px 18px;margin-top:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);">
    <span style="font-size:16px;font-weight:800;color:${cor || '#166534'};white-space:nowrap;">${texto}</span>
  </div>`;
}

function mostrarToastChamada(copiadas) {
  const linhaExtra = copiadas > 0
    ? `<div style="font-size:12px;color:#A78BFA;margin-top:4px;font-weight:600;text-align:center;">+${copiadas} aula${copiadas>1?'s':''} do mesmo dia preenchida${copiadas>1?'s':''} automaticamente</div>`
    : '';
  const extra = _pilulaTexto('Chamada registrada com sucesso') + linhaExtra;
  _toastComMascote('toast-chamada', extra);
}

// Toast fofo pro salvamento de avaliação — reaproveita a mesma base com
// mascote usada em mostrarToastChamada/mostrarToastNotas, apenas trocando
// o texto de apoio abaixo da imagem.
function mostrarToastAvaliacao() {
  const extra = _pilulaTexto('Avaliação salva!');
  _toastComMascote('toast-avaliacao', extra);
}
window.mostrarToastAvaliacao = mostrarToastAvaliacao;

// Toast fofo pro salvamento de aula(s) — usa o ícone de caderno no lugar
// do mascote padrão, em vez de reaproveitar o mesmo personagem dos toasts
// de chamada/notas/avaliação.
function mostrarToastAula(qtd) {
  qtd = qtd || 1;
  const texto = qtd > 1 ? `${qtd} aulas criadas!` : 'Aula criada!';
  const extra = _pilulaTexto(texto);
  _toastComMascote('toast-aula', extra, _CADERNO_B64);
}
window.mostrarToastAula = mostrarToastAula;

function togglePresenca(alunoId) {
  chamadaTemp[alunoId] = !chamadaTemp[alunoId];
  const presente = chamadaTemp[alunoId];
  // Se voltou a ficar presente, justificativa/abono de falta não fazem mais sentido
  if (presente) { delete _justificativasTemp[alunoId]; delete _abonadasTemp[alunoId]; }
  // Re-renderiza a lista inteira: o botão "Justificar" só existe quando
  // o aluno está faltoso, então não dá pra só trocar estilos da row.
  renderListaChamada(_faltasPorAlunoAtual);
  renderizarFaltosos();

  // Atualizar toggle todos
  const todosPresentes = alunosTurma.every(a => chamadaTemp[a.id]);
  const toggle = document.getElementById('toggle-todos');
  if (toggle) {
    toggle.checked = todosPresentes;
    atualizarToggleVisual(todosPresentes);
  }
}

async function abrirChamadaDeAula(aulaId) {
  // Resetar modo inverso ao abrir nova chamada
  _modoInversoChamada = false;
  const btnInv = document.getElementById('btn-modo-inverso');
  if (btnInv) { btnInv.style.background='var(--white)'; btnInv.style.borderColor='var(--border)'; btnInv.style.color='var(--text-muted)'; }
  await abrirPagina('chamada');
  const aula = aulasTurma.find(a => a.id === aulaId);
  if (!aula) return;
  const dataISO = dataAulaOnly(aula.data);
  // Setar a data no input e calendário
  const [y, mo, dy] = dataISO.split('-');
  document.getElementById('chamada-date-input').value = `${dy}/${mo}/${y}`;
  calState['cal-chamada'] = { ano: parseInt(y), mes: parseInt(mo) - 1 };
  atualizarCalendario('cal-chamada');
  _atualizarDiaSemChamada(dataISO);
  // Verificar eventos do calendário escolar (reusa lógica do carregarChamadaPorData)
  // mas forçar que o seletor selecione a aula específica após carregar
  const btnWrap = document.getElementById('btn-salvar-chamada-wrap');
  btnWrap._aulaId = aulaId; // pré-seleciona esta aula antes de carregar
  await carregarChamadaPorData(dataISO);
  // Se o seletor estiver visível, garantir que esta aula está marcada
  const btnSel = document.getElementById(`btn-sel-aula-${aulaId}`);
  if (btnSel) selecionarAulaChamada(aulaId);
}
