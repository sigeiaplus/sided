// SIDED+ — Aula listagem, filtros, layout e seleção

// Filtros ativos nas aulas
let aulasTriFiltro = 'todos';
let aulasTipoFiltro = 'todos'; // pendente | lecionada | futura | todos
let aulasDiscFiltro = null; // disciplina ativa no filtro de aulas (Fundamental I)
let _disciplinasAulasFundI = []; // disciplinas encontradas nas avaliações da turma (Fund I)
let aulasDiaSemFiltro = null; // 0=dom,1=seg,...,6=sab | null=todos

function filtrarAulasDiaSem(dia, btn) {
  aulasDiaSemFiltro = dia;
  document.querySelectorAll('[id^="chip-diasem-"]').forEach(c => {
    const ativo = (dia === null && c.id === 'chip-diasem-todos') || (dia !== null && c.dataset.dia === String(dia));
    c.style.background = ativo ? 'var(--purple)' : 'transparent';
    c.style.color = ativo ? '#fff' : 'var(--text)';
    c.style.borderColor = ativo ? 'var(--purple)' : 'var(--border)';
  });
  _calAulasAplicarFiltro();
}
window.filtrarAulasDiaSem = filtrarAulasDiaSem;

function _inicializarFiltroDiaSemAulas() {
  const box = document.getElementById('aulas-diasem-filtro');
  if (!box) return;
  const diasLabels = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const diasPresentes = new Set(
    (aulasTurma || []).map(a => {
      const iso = dataAulaOnly(a.data);
      if (!iso) return null;
      return new Date(iso + 'T12:00:00').getDay();
    }).filter(d => d !== null)
  );
  if (diasPresentes.size === 0) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  const chips = box.querySelector('#aulas-diasem-chips');
  if (!chips) return;
  chips.innerHTML = [
    `<button id="chip-diasem-todos" onclick="filtrarAulasDiaSem(null,this)" style="padding:6px 14px;border-radius:20px;border:1.5px solid ${aulasDiaSemFiltro===null?'var(--purple)':'var(--border)'};background:${aulasDiaSemFiltro===null?'var(--purple)':'transparent'};color:${aulasDiaSemFiltro===null?'#fff':'var(--text)'};font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;">Todos</button>`,
    ...[1,2,3,4,5,6,0].filter(d => diasPresentes.has(d)).map(d =>
      `<button id="chip-diasem-${d}" data-dia="${d}" onclick="filtrarAulasDiaSem(${d},this)" style="padding:6px 14px;border-radius:20px;border:1.5px solid ${aulasDiaSemFiltro===d?'var(--purple)':'var(--border)'};background:${aulasDiaSemFiltro===d?'var(--purple)':'transparent'};color:${aulasDiaSemFiltro===d?'#fff':'var(--text)'};font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;">${diasLabels[d]}</button>`
    )
  ].join('');
}
window._inicializarFiltroDiaSemAulas = _inicializarFiltroDiaSemAulas;

async function _inicializarFiltroDiscAulas() {
  const box = document.getElementById('aulas-disciplina-filtro');
  const chips = document.getElementById('aulas-disciplina-chips');
  if (!box || !chips) return;

  if (!isFundamentalI()) {
    box.style.display = 'none';
    aulasDiscFiltro = null;
    _disciplinasAulasFundI = [];
    return;
  }

  const avais = await api(`avaliacoes?turma_id=eq.${turmaAtiva.id}&tipo=eq.normal&select=disciplina`) || [];
  const discs = [...new Set(avais.map(a => a.disciplina).filter(Boolean))].sort();
  _disciplinasAulasFundI = discs;

  if (discs.length === 0) { box.style.display = 'none'; return; }

  box.style.display = 'block';
  chips.innerHTML = [
    `<button onclick="filtrarAulasDisc(null,this)" style="padding:6px 14px;border-radius:20px;border:1.5px solid var(--purple);background:${!aulasDiscFiltro?'var(--purple)':'transparent'};color:${!aulasDiscFiltro?'#fff':'var(--purple)'};font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;" id="chip-disc-todas">Todas</button>`,
    ...discs.map(d => `<button onclick="filtrarAulasDisc('${d}',this)" style="padding:6px 14px;border-radius:20px;border:1.5px solid var(--border);background:${aulasDiscFiltro===d?'var(--purple)':'transparent'};color:${aulasDiscFiltro===d?'#fff':'var(--text)'};font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;" id="chip-disc-${d.replace(/\s+/g,'-')}">${d}</button>`)
  ].join('');
}

function filtrarAulasDisc(disc, btn) {
  aulasDiscFiltro = disc;
  document.querySelectorAll('[id^="chip-disc-"]').forEach(c => {
    const ativo = (disc === null && c.id === 'chip-disc-todas') || c.textContent === disc;
    c.style.background = ativo ? 'var(--purple)' : 'transparent';
    c.style.color = ativo ? '#fff' : (c.id === 'chip-disc-todas' ? 'var(--purple)' : 'var(--text)');
    c.style.borderColor = ativo ? 'var(--purple)' : 'var(--border)';
  });
  _calAulasAplicarFiltro();
}

let aulasOrdemDesc = true;

function filtrarAulasTipo(el) {
  if (!el) return;
  aulasTipoFiltro = el.dataset.tipo || 'todos';
  ['todos','pendentes','lecionadas','futuras'].forEach(v => {
    const chip = document.getElementById('aulas-chip-' + v);
    if (chip) chip.classList.remove('active');
  });
  el.classList.add('active');
  _calAulasAplicarFiltro();
}

// ------------------------------------------------------------
// DIVISÕES DO ANO LETIVO (trimestres/bimestres) — substituindo
// o antigo TRI_DATAS hardcoded. As datas agora vêm do banco:
// turma → periodo_letivo_id → matrizes_curriculares (mesma
// escola + periodo_letivo) → parametro_id → parametro_divisoes
// (com data_inicio/data_fim, cadastradas na tela do SIPRO).
//
// Carregado uma vez por turma (cache em memória) para manter
// trimestreDeAula() síncrona — ela é chamada dentro de vários
// .filter() no código, então não pode virar async sem quebrar
// esses pontos de chamada.
// ------------------------------------------------------------
let _divisoesCache = null;       // [{ id, ordem, dataIni, dataFim }, ...] ordenado por ordem_divisao
let _divisoesCacheTurmaId = null; // turma_id para o qual o cache acima é válido

async function carregarDivisoesDaTurma(turma) {
  if (!turma?.id) { _divisoesCache = null; _divisoesCacheTurmaId = null; return; }
  if (_divisoesCacheTurmaId === turma.id && _divisoesCache) return; // já carregado

  _divisoesCache = [];
  _divisoesCacheTurmaId = turma.id;

  if (!turma.periodo_letivo_id) return; // turma ainda sem vínculo de ano letivo — fica sem divisões

  const matrizes = await api(
    `matrizes_curriculares?escola_id=eq.${turma.escola_id}&periodo_letivo_id=eq.${turma.periodo_letivo_id}&select=id,parametro_id&limit=1`
  ) || [];
  const parametroId = matrizes[0]?.parametro_id;
  if (!parametroId) return; // escola ainda não cadastrou matriz/parâmetro para este ano letivo

  const divisoes = await api(
    `parametro_divisoes?parametro_id=eq.${parametroId}&select=divisao_id,ordem_divisao,valor_divisao,data_inicio,data_fim&order=ordem_divisao.asc`
  ) || [];

  _divisoesCache = divisoes
    .filter(d => d.data_inicio && d.data_fim) // ignora divisão sem data cadastrada ainda
    .map(d => ({
      id: d.divisao_id,
      ordem: d.ordem_divisao,
      valor: d.valor_divisao,
      dataIni: d.data_inicio,
      dataFim: d.data_fim
    }));
}

function dataAulaOnly(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  if (s.includes('T')) return s.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s.slice(0, 10);
}

function trimestreDeAula(dataISO) {
  if (!dataISO) return 0;
  dataISO = dataAulaOnly(dataISO);
  if (!_divisoesCache || _divisoesCache.length === 0) return 0; // divisões não carregadas/cadastradas ainda
  for (const div of _divisoesCache) {
    if (dataISO >= div.dataIni && dataISO <= div.dataFim) return div.ordem;
  }
  return 0;
}

function filtrarAulasTri(el) {
  if (el) {
    aulasTriFiltro = el.dataset.tri;
    ['tri-todos','1','2','3'].forEach(v => {
      const chip = document.getElementById('aulas-chip-' + v);
      if (chip) chip.classList.remove('active');
    });
    el.classList.add('active');
  }
  _calAulasAplicarFiltro();
  atualizarContadorAulas();
}

const _NOMES_TRI_AULA = { 1: '1º Tri', 2: '2º Tri', 3: '3º Tri' };
const _DIAS_SEMANA_AULA = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];

function _escAulaTxt(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Status efetivo da aula (a chamada lançada tem prioridade sobre o status gravado)
function _statusEfetivoAula(a) {
  const tc = chamadaCacheGet(a.id);
  return a.status === 'futura' ? 'futura'
    : tc === true ? 'lecionada'
    : tc === false ? 'pendente'
    : a.status;
}

// Filtros ativos da tela de aulas (trimestre, tipo, disciplina, dia da semana).
// Continuam valendo para os cards exibidos ao lado do calendário.
function _aulaPassaFiltros(a) {
  if (aulasTriFiltro && aulasTriFiltro !== 'todos' && trimestreDeAula(a.data) !== parseInt(aulasTriFiltro)) return false;
  if (aulasTipoFiltro && aulasTipoFiltro !== 'todos' && _statusEfetivoAula(a) !== aulasTipoFiltro) return false;
  if (aulasDiscFiltro && a.disciplina !== aulasDiscFiltro) return false;
  if (aulasDiaSemFiltro !== null) {
    const iso = dataAulaOnly(a.data);
    if (!iso) return false;
    if (new Date(iso + 'T12:00:00').getDay() !== aulasDiaSemFiltro) return false;
  }
  return true;
}

// Card comum de aula (único padrão do sistema). Com { detalhado: true } acrescenta
// componente curricular, turma, descrição/conteúdo completos e habilidades BNCC.
function _aulaCardHtml(a, opts = {}) {
  const detalhado = !!opts.detalhado;
  const tri = trimestreDeAula(a.data);
  const triBadge = tri ? `<span style="font-size:10px;font-weight:700;color:var(--orange);background:#FFF0E6;padding:2px 7px;border-radius:20px;">${_NOMES_TRI_AULA[tri]}</span>` : '';
  const temChamada = chamadaCacheGet(a.id);
  const temChamadaEfetivo = temChamada === true;
  const chamadaTag = a.status === 'futura'
    ? ''
    : temChamadaEfetivo
    ? `<span style="font-size:10px;font-weight:700;color:#166534;background:#DCFCE7;padding:2px 8px;border-radius:20px;display:inline-flex;align-items:center;gap:3px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>Chamada lançada</span>`
    : `<span style="font-size:10px;font-weight:700;color:#92400E;background:#FEF3C7;padding:2px 8px;border-radius:20px;display:inline-flex;align-items:center;gap:3px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Chamada pendente</span>`;

  const iso = dataAulaOnly(a.data);
  let diaSem = '', dataFmt = formatarData(a.data);
  if (iso) {
    const d = new Date(iso + 'T12:00:00');
    diaSem = _DIAS_SEMANA_AULA[d.getDay()] || '';
  }

  const badgeCfg = {
    pendente:  { bg:'#FF8C38', label:'Chamada pendente' },
    lecionada: { bg:'#22C55E', label:'Frequência registrada' },
    futura:    { bg:'#3B82F6', label:'Aula futura' },
  };
  const statusEfetivo = _statusEfetivoAula(a);
  const bc = badgeCfg[statusEfetivo] || { bg:'#9A8FC0', label: statusEfetivo };

  const selecionada = aulasSelecionadas.has(a.id);
  const checkboxHtml = modoSelecaoAulas ? `
    <div onclick="event.stopPropagation();toggleSelecaoAula('${a.id}')"
      style="width:22px;height:22px;border-radius:6px;border:2px solid ${selecionada ? 'var(--purple)' : 'var(--border)'};background:${selecionada ? 'var(--purple)' : 'var(--white)'};flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;">
      ${selecionada ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
    </div>` : '';

  const acoesBtns = modoSelecaoAulas ? '' : `
    <div class="aula-actions" onclick="event.stopPropagation()" style="display:flex;gap:5px;align-items:center;flex-shrink:0;">
      <button class="btn-icon" onclick="event.stopPropagation();editarAula('${a.id}')" title="Editar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="btn-icon" onclick="event.stopPropagation();duplicarAula('${a.id}')" title="Copiar para outra turma">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      </button>
      <button class="btn-icon" onclick="event.stopPropagation();exportarAulaPDF('${a.id}')" title="Exportar em PDF" style="color:#7C3AED;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
      <button class="btn-icon" onclick="event.stopPropagation();window.abrirModalTransferirAulas('${a.id}')" title="Transferir para outro professor" style="color:#0F766E;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </button>
      <button class="btn-icon danger" onclick="event.stopPropagation();excluirAula('${a.id}')" title="Excluir">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
      </button>
    </div>`;

  // Informações completas do cadastro da aula (somente no card exibido ao lado do calendário)
  let detalhesHtml = '';
  if (detalhado) {
    const componente = a.disciplina || turmaDisciplinaAtiva?.disciplinas?.nome || '';
    const turmaNome = turmaAtiva?.nome || '';
    const descricao = String(a.descricao || '').trim();
    const bncc = (typeof _habilidadesTextoPorAula !== 'undefined' && _habilidadesTextoPorAula[a.id]) || a.habilidade_bncc || '';
    const meta = [
      componente ? `<span><b>Componente:</b> ${_escAulaTxt(componente)}</span>` : '',
      turmaNome ? `<span><b>Turma:</b> ${_escAulaTxt(turmaNome)}</span>` : '',
    ].filter(Boolean).join('');
    detalhesHtml = `
      <div class="aula-card-detalhes" style="margin-top:8px;display:flex;flex-direction:column;gap:5px;">
        ${meta ? `<div style="font-size:11px;color:var(--text-muted);display:flex;flex-wrap:wrap;gap:2px 14px;">${meta}</div>` : ''}
        ${descricao ? `<div style="font-size:12px;color:var(--text);line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;"><b style="color:var(--text-muted);font-size:11px;">Descrição:</b> ${_escAulaTxt(descricao)}</div>` : ''}
        ${bncc ? `<div style="font-size:11px;color:var(--text-muted);line-height:1.5;overflow-wrap:anywhere;"><b>Habilidades BNCC:</b> ${_escAulaTxt(bncc)}</div>` : ''}
      </div>`;
  }

  const cardClick = modoSelecaoAulas ? `onclick="toggleSelecaoAula('${a.id}')"` : `onclick="abrirChamadaDeAula('${a.id}')"`;

  return `<div class="aula-card${detalhado ? ' aula-card-cal' : ''}${selecionada ? ' selecionada' : ''}" ${cardClick}
    style="background:var(--white);border:1.5px solid var(--border);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all 0.15s;margin-bottom:8px;${selecionada ? 'border-color:var(--purple);background:#F8F6FF;' : ''}">
    ${checkboxHtml}
    <div class="aula-card-info" style="flex:1;min-width:0;">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">${diaSem}</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:14px;font-weight:700;color:var(--text);">${dataFmt}</span>
        <span style="font-size:13px;color:var(--purple);font-weight:600;overflow-wrap:anywhere;">${a.nome}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">
        ${triBadge}${chamadaTag}
      </div>
      ${detalhesHtml}
    </div>
    <span class="aula-card-status" style="background:${bc.bg};color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;white-space:nowrap;flex-shrink:0;">${bc.label}</span>
    ${acoesBtns}
  </div>`;
}

// A listagem de aulas é exibida somente ao lado do calendário (cards das datas
// selecionadas). Esta função segue como ponto único de atualização, chamado por
// filtros, seleção, criação, edição e exclusão.
function renderListaAulas() {
  _renderPainelAulasCal();
  Promise.resolve(renderCalendarioAulas()).catch(e => console.error('[AULAS] Erro ao renderizar calendário:', e));
}

function toggleModoSelecao() {
  modoSelecaoAulas = !modoSelecaoAulas;
  aulasSelecionadas.clear();
  const btn = document.getElementById('btn-modo-selecao');
  const barra = document.getElementById('barra-selecao');
  document.getElementById('pagina-aulas')?.classList.toggle('modo-selecao-ativo', modoSelecaoAulas);
  if (modoSelecaoAulas) {
    btn.style.background = 'var(--purple)';
    btn.style.color = '#fff';
    btn.style.borderColor = 'var(--purple)';
    barra.style.display = 'flex';
    _inicializarBotaoExportarSelecao();
  } else {
    btn.style.background = 'var(--white)';
    btn.style.color = 'var(--text-muted)';
    btn.style.borderColor = 'var(--border)';
    barra.style.display = 'none';
  }
  atualizarContadorSelecao();
  renderListaAulas();
}

// Sai do modo de seleção sem renderizar (usado ao trocar de turma/voltar ao dashboard,
// para a barra e o botão "Selecionar" não ficarem ativos com estado antigo).
function resetarModoSelecaoAulas() {
  modoSelecaoAulas = false;
  aulasSelecionadas.clear();
  document.getElementById('pagina-aulas')?.classList.remove('modo-selecao-ativo');
  const barra = document.getElementById('barra-selecao');
  if (barra) barra.style.display = 'none';
  const btn = document.getElementById('btn-modo-selecao');
  if (btn) { btn.style.background = 'var(--white)'; btn.style.color = 'var(--text-muted)'; btn.style.borderColor = 'var(--border)'; }
  atualizarContadorSelecao();
}

function toggleSelecaoAula(id) {
  if (aulasSelecionadas.has(id)) aulasSelecionadas.delete(id);
  else aulasSelecionadas.add(id);
  atualizarContadorSelecao();
  const card = document.querySelector(`.aula-card[onclick*="${id}"]`);
  if (card) {
    const sel = aulasSelecionadas.has(id);
    card.style.borderColor = sel ? 'var(--purple)' : '';
    card.style.background = sel ? '#F8F6FF' : '';
    const checkbox = card.querySelector('div[onclick]');
    if (checkbox) {
      checkbox.style.borderColor = sel ? 'var(--purple)' : 'var(--border)';
      checkbox.style.background = sel ? 'var(--purple)' : 'var(--white)';
      checkbox.innerHTML = sel ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '';
    }
  }
}

function selecionarTodasAulas() {
  let lista = [...aulasTurma];
  if (aulasTriFiltro && aulasTriFiltro !== 'todos') {
    lista = lista.filter(a => trimestreDeAula(a.data) === parseInt(aulasTriFiltro));
  }
  const todasSelecionadas = lista.every(a => aulasSelecionadas.has(a.id));
  if (todasSelecionadas) {
    lista.forEach(a => aulasSelecionadas.delete(a.id));
  } else {
    lista.forEach(a => aulasSelecionadas.add(a.id));
  }
  atualizarContadorSelecao();
  renderListaAulas();
}

function atualizarContadorSelecao() {
  const n = aulasSelecionadas.size;
  const el = document.getElementById('selecao-count');
  if (el) el.textContent = `${n} selecionada${n !== 1 ? 's' : ''}`;
}

function limparSelecaoAulas() {
  aulasSelecionadas.clear();
  if (modoSelecaoAulas) toggleModoSelecao();
  else renderListaAulas();
}

function toggleMenuStatusSelecao() {
  const menu = document.getElementById('menu-status-selecao');
  if (!menu) return;
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', function(e) {
  const menu = document.getElementById('menu-status-selecao');
  const btn = document.getElementById('btn-mudar-status-sel');
  if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
    menu.style.display = 'none';
  }
});

async function alterarStatusSelecionadas(novoStatus) {
  const menu = document.getElementById('menu-status-selecao');
  if (menu) menu.style.display = 'none';
  const n = aulasSelecionadas.size;
  if (n === 0) return;
  const labels = { lecionada: 'Lecionada', pendente: 'Pendente', futura: 'Futura' };
  if (!confirm(`Alterar status de ${n} aula${n > 1 ? 's' : ''} para "${labels[novoStatus]}"?`)) return;
  const ids = Array.from(aulasSelecionadas);
  await Promise.all(ids.map(id =>
    api(`aulas?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status: novoStatus }) })
  ));
  ids.forEach(id => {
    const aula = aulasTurma.find(a => String(a.id) === String(id));
    if (aula) aula.status = novoStatus;
  });
  cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
  mostrarToast(`✓ ${n} aula${n > 1 ? 's' : ''} marcada${n > 1 ? 's' : ''} como ${labels[novoStatus]}!`);
  limparSelecaoAulas();
  renderListaAulas();
  atualizarContadorAulas();
  atualizarCalendario('cal-aula');
}

async function excluirAulasSelecionadas() {
  const n = aulasSelecionadas.size;
  if (n === 0) return;
  if (!confirm(`Excluir ${n} aula${n > 1 ? 's' : ''} selecionada${n > 1 ? 's' : ''}? Esta ação não pode ser desfeita.`)) return;
  const ids = Array.from(aulasSelecionadas);
  await Promise.all(ids.map(id => api(`aulas?id=eq.${id}`, { method: 'DELETE' })));
  const idSet = new Set(ids.map(String));
  window.aulasTurma = aulasTurma = aulasTurma.filter(a => !idSet.has(String(a.id)));
  ids.forEach(id => delete _chamadaCache[id]);
  cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
  mostrarToast(`✓ ${n} aula${n > 1 ? 's' : ''} excluída${n > 1 ? 's' : ''}!`);
  limparSelecaoAulas();
  renderListaAulas();
  atualizarContadorAulas();
  atualizarCalendario('cal-aula');
}

async function duplicarAulasSelecionadas() {
  if (aulasSelecionadas.size === 0) return;
  const aulasIds = Array.from(aulasSelecionadas);
  window.aulasParaCopiar = aulasIds;
  await garantirTodasTurmas();
  if (!todasTurmas || todasTurmas.length === 0) {
    alert('Erro: Não foi possível carregar as turmas. Tente recarregar a página.');
    return;
  }
  const lista = document.getElementById('copiar-turmas-lista');
  const turmaAtualLabel = turmaAtiva ? `
    <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1.5px solid var(--purple);border-radius:8px;background:#F8F6FF;cursor:pointer;margin-bottom:6px;">
        <input type="checkbox" value="_self" style="margin:0;">
        <div>
            <div style="font-size:13px;font-weight:600;color:var(--purple);">↩ Mesma turma (${turmaAtiva.nome})</div>
            <div style="font-size:11px;color:var(--text-muted);">Duplicar dentro desta turma</div>
        </div>
    </label>` : '';
  const turmasOutras = todasTurmas.filter(t => String(t.id) !== String(turmaAtiva.id));
  lista.innerHTML = turmaAtualLabel + turmasOutras.map(t => `
    <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--white);cursor:pointer;margin-bottom:6px;">
        <input type="checkbox" value="${t.id}" style="margin:0;">
        <div>
            <div style="font-size:13px;font-weight:600;color:var(--text);">${t.nome}</div>
            <div style="font-size:11px;color:var(--text-muted);">${t.disciplina} - ${t.ano}º ano</div>
        </div>
    </label>
  `).join('');
  document.getElementById('copiar-aula-nome').textContent = `${aulasSelecionadas.size} aula${aulasSelecionadas.size > 1 ? 's' : ''} selecionada${aulasSelecionadas.size > 1 ? 's' : ''}`;
  const modalElSel = document.getElementById('modal-copiar-aula');
  if (modalElSel) {
    if (modalElSel.parentElement !== document.body) document.body.appendChild(modalElSel);
    modalElSel.classList.add('open');
  }
}

const _metaAulasCache = {};

async function _getMetaAulas(turmaId, tri) {
  const key = `${turmaId}::${tri}`;
  if (_metaAulasCache[key] !== undefined) return _metaAulasCache[key];
  const padrao = { 1: 67, 2: 67, 3: 66 };
  let v = padrao[tri];
  try {
    const meta = await api(`metas_aulas?turma_id=eq.${turmaId}&trimestre=eq.${tri}&select=total_aulas&limit=1`);
    if (meta && meta[0]) v = meta[0].total_aulas;
  } catch(e) { }
  _metaAulasCache[key] = v;
  return v;
}

async function atualizarContadorAulas() {
  let lista = [...aulasTurma];
  if (aulasTriFiltro && aulasTriFiltro !== 'todos') {
    lista = lista.filter(a => trimestreDeAula(a.data) === parseInt(aulasTriFiltro));
  }
  if (aulasDiscFiltro) {
    lista = lista.filter(a => a.disciplina === aulasDiscFiltro);
  }
  const lecionadas = lista.filter(a => {
    const temChamada = chamadaCacheGet(a.id);
    if (temChamada === true) return true;
    if (temChamada === false) return false;
    return a.status === 'lecionada';
  }).length;
  const totalCriadas = lista.length;
  const el = document.getElementById('counter-aulas');
  if (el) el.textContent = `${lecionadas} de ${totalCriadas}`;
}

function calcularStatusAuto(dataISO, aulaId) {
  if (!dataISO) return 'futura';
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const dataAula = new Date(dataAulaOnly(dataISO) + 'T00:00:00');
  if (dataAula > hoje) return 'futura';
  if (aulaId && chamadaCacheGet(aulaId) === true) return 'lecionada';
  if (aulaId && chamadaCacheGet(aulaId) === false) return 'pendente';
  if (aulaId) {
    const aulaLocal = aulasTurma.find(a => a.id === aulaId);
    if (aulaLocal && (aulaLocal.status === 'lecionada' || aulaLocal.status === 'pendente')) return aulaLocal.status;
  }
  return 'pendente';
}

function recalcularStatusLocal() {
  let mudou = false;
  aulasTurma.forEach(a => {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const dataAula = new Date(dataAulaOnly(a.data) + 'T00:00:00');
    let s;
    if (dataAula > hoje) {
      s = 'futura';
    } else if (chamadaCacheGet(a.id) === true) {
      s = 'lecionada';
    } else if (chamadaCacheGet(a.id) === false) {
      s = 'pendente';
    } else {
      s = (a.status === 'lecionada' || a.status === 'pendente') ? a.status : 'pendente';
    }
    if (a.status !== s) { a.status = s; mudou = true; }
  });
  if (mudou && turmaAtiva) cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
}

// ═══════════════════════════════════════════════════════
// TOGGLE LAYOUT AULAS (lista ↔ grade)
// ═══════════════════════════════════════════════════════
let _layoutAulas = 'lista'; // 'lista' | 'grade'

function setLayoutAulas(modo) {
  _layoutAulas = modo;
  const btnLista = document.getElementById('btn-layout-lista-aulas');
  const btnGrade = document.getElementById('btn-layout-grade-aulas');
  if (btnLista) {
    btnLista.style.background = modo === 'lista' ? 'var(--purple)' : 'none';
    btnLista.style.color = modo === 'lista' ? '#fff' : 'var(--text-muted)';
  }
  if (btnGrade) {
    btnGrade.style.background = modo === 'grade' ? 'var(--purple)' : 'none';
    btnGrade.style.color = modo === 'grade' ? '#fff' : 'var(--text-muted)';
  }
  renderListaAulas();
}

// Aplica a visualização em grade aos cards exibidos ao lado do calendário.
// Chamada ao final de cada render do painel (_renderPainelAulasCal / calAulasBuscar).
function _aplicarLayoutGradeAulas() {
  const el = document.getElementById('cal-aulas-dia-lista');
  if (!el) return;
  el.querySelectorAll('.cal-aulas-cards').forEach(wrap => {
    if (_layoutAulas === 'grade') {
      wrap.style.display = 'grid';
      wrap.style.gridTemplateColumns = 'repeat(auto-fill, minmax(260px, 1fr))';
      wrap.style.gap = '10px';
    }
  });
  if (_layoutAulas === 'grade') {
    el.querySelectorAll('.aula-card').forEach(card => {
      card.style.flexDirection = 'column';
      card.style.alignItems = 'flex-start';
      card.style.minHeight = '110px';
      card.style.marginBottom = '0';
    });
  }
}

// ══════════════════════════════════════════
// RESTAURADO DO professor_dashboard.html
// ══════════════════════════════════════════

function _atualizarInfoStatusModal() {
  const infoEl = document.getElementById('aula-status-info');
  const statusEl = document.getElementById('aula-status');
  const dataStr = document.getElementById('aula-data')?.value || '';
  const dataISO = parseDateBR(dataStr);
  const status = calcularStatusAuto(dataISO, editandoAulaId);

  if (statusEl) statusEl.value = status;
  if (!infoEl) return;

  const configs = {
    futura:   { bg: '#EFF6FF', border: '#BFDBFE', color: '#1E40AF', icone: '📅', texto: 'Aula <b>futura</b> — a data ainda não chegou.' },
    pendente: { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', icone: '⏳', texto: 'Aula <b>pendente</b> — data passada sem chamada lançada.' },
    lecionada:{ bg: '#F0FDF4', border: '#BBF7D0', color: '#166534', icone: '✅', texto: 'Aula <b>lecionada</b> — chamada já registrada.' },
  };

  if (!dataISO) {
    infoEl.style.cssText = 'background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:10px 14px;font-size:12px;color:#166534;line-height:1.6;margin-bottom:4px;';
    infoEl.innerHTML = '<strong>Classificação automática:</strong><br>• <b>Futura</b> — data após hoje<br>• <b>Pendente</b> — já passou, sem chamada lançada<br>• <b>Lecionada</b> — chamada lançada';
    return;
  }

  const c = configs[status] || configs.futura;
  infoEl.style.cssText = `background:${c.bg};border:1px solid ${c.border};border-radius:8px;padding:10px 14px;font-size:12px;color:${c.color};line-height:1.6;margin-bottom:4px;`;
  infoEl.innerHTML = `${c.icone} ${c.texto}`;
}

async function criarAulaParaData() {
  const dataISO = dataChamadaAtiva;
  if (!dataISO) return;
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const [ano, mes, dia] = dataISO.split('-');
  const body = {
    data: dataISO,
    nome: `Aula de ${dia}/${mes}/${ano}`,
    descricao: '',
    status: 'lecionada',
    turma_id: turmaAtiva.id,
    turma_disciplina_id: turmaDisciplinaAtiva?.id || null,
    professor_id: profData.id
  };
  const res = await api('aulas', { method: 'POST', body: JSON.stringify(body) });
  const nova = (res && res[0]) ? res[0] : { ...body, id: Date.now() };
  aulasTurma.push(nova);
  chamadaCacheSet(nova.id, false);
  cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
  await carregarChamadaPorData(dataISO);
}

// Alias para compatibilidade com onclick gerado no HTML
window.editarAula = function(aulaId) {
  const aula = aulasTurma.find(a => String(a.id) === String(aulaId));
  if (aula) {
    abrirPainelEditarAulaCal(aula);
  } else {
    api(`aulas?id=eq.${aulaId}&select=*`).then(res => {
      if (res && res[0]) abrirPainelEditarAulaCal(res[0]);
    });
  }
};

// Excluir uma aula pelo card (usado pelos cards ao lado do calendário)
window.excluirAula = async function(id) {
  if (!confirm('Excluir esta aula?')) return;
  try {
    await api(`aulas?id=eq.${id}`, { method: 'DELETE' });
  } catch (e) {
    console.error('[AULAS] Erro ao excluir aula:', e);
    alert('Não foi possível excluir a aula. Tente novamente.');
    return;
  }
  window.aulasTurma = aulasTurma = aulasTurma.filter(a => String(a.id) !== String(id));
  delete _chamadaCache[id];
  cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
  renderListaAulas();
  atualizarContadorAulas();
  atualizarCalendario('cal-aula');
};

// Garante que todasTurmas está preenchido (recarrega se vazio)
async function garantirTodasTurmas() {
  if (todasTurmas && todasTurmas.length > 0) return;
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  if (!profData.id) return;
  if (typeof carregarTurmas === 'function') {
    await carregarTurmas(profData.id);
  }
}

let aulaParaCopiar = null;

// duplicarAula e confirmarCopiarAula são definidos no professor_dashboard.html
// para terem acesso a _buscarTurmaDisciplinaId e turma_disciplina_id correto.
// NÃO redefinir aqui para evitar sobrescrever a versão correta.

window.aulaParaCopiar = window.aulaParaCopiar || null;

// ── carregarAulas ────────────────────────────────────────────────────────────
// Mapa em memória aula_id -> "COD1, COD2" (habilidades vinculadas via
// aula_habilidades), usado pelo calendário lateral (lista do dia e busca)
// para exibir/filtrar sem precisar de fetch síncrono por aula.
let _habilidadesTextoPorAula = {};

async function _carregarHabilidadesTextoPorAula() {
  const ids = (aulasTurma || []).map(a => a.id);
  _habilidadesTextoPorAula = ids.length ? await _buscarHabilidadesTextoParaAulas(ids) : {};
}

async function carregarAulas(forcarReload = false) {
  if (forcarReload) cacheInvalidar(turmaAtiva.id);
  await carregarDivisoesDaTurma(turmaAtiva); // garante _divisoesCache pronto antes de qualquer trimestreDeAula()
  const _tdIdAulas = turmaDisciplinaAtiva?.id;
  window.aulasTurma = aulasTurma = await apiCached(
    _tdIdAulas
      ? `aulas?turma_disciplina_id=eq.${_tdIdAulas}&select=*&order=data`
      : `aulas?turma_id=eq.${turmaAtiva.id}&professor_id=eq.${JSON.parse(sessionStorage.getItem('prof_data')||'{}').id}&select=*&order=data`,
    turmaAtiva.id, 'aulas', 30000
  );
  await sincronizarCachesChamada();
  await _carregarHabilidadesTextoPorAula();
  recalcularStatusLocal();
  _inicializarFiltroDiaSemAulas();
  renderListaAulas();
  atualizarContadorAulas();
  atualizarCalendario('cal-aula');
}

// ── sincronizarCachesChamada ─────────────────────────────────────────────────
let _syncChamadaPromise = null;
async function sincronizarCachesChamada() {
  if (_syncChamadaPromise) return _syncChamadaPromise;
  _syncChamadaPromise = _sincronizarCachesChamadaExec().finally(() => { _syncChamadaPromise = null; });
  return _syncChamadaPromise;
}
async function _sincronizarCachesChamadaExec() {
  if (!aulasTurma.length) return;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const aulasPassadas = aulasTurma.filter(a => {
    const d = new Date(dataAulaOnly(a.data) + 'T00:00:00');
    return d <= hoje;
  });
  if (!aulasPassadas.length) return;
  const ids = aulasPassadas.map(a => a.id);
  const LOTE = 25;
  try {
    for (let i = 0; i < ids.length; i += LOTE) {
      const loteIds = ids.slice(i, i + LOTE);
      const registros = await api(`chamadas?aula_id=in.(${loteIds.join(',')})&select=aula_id&limit=5000`) || [];
      const comChamada = new Set(registros.map(r => r.aula_id));
      loteIds.forEach(id => { chamadaCacheSet(id, comChamada.has(id) ? true : false); });
    }
  } catch(e) { /* sem cache, não bloqueia */ }
}
// ═══════════════════════════════════════════════════════════════════════════
// PATCH aulas.js  — Multi Aulas + Renomear campos (TEMA / DESCRIÇÃO / BNCC)
// Aplique este bloco ao final do seu aulas.js (ou substitua as funções indicadas)
// ═══════════════════════════════════════════════════════════════════════════

// ─── 1. PATCH: abrirModalAula — renomeia labels e adiciona campo BNCC ───────
//  Substitua a função abrirModalAula original por esta:
window.abrirModalAula = function(data) {
  editandoAulaId = data?.id || null;
  document.getElementById('modal-aula-title').textContent = editandoAulaId ? 'Editar aula' : 'Nova aula';
  document.getElementById('aula-data').value = data ? formatarData(data.data) : '';
  document.getElementById('aula-nome').value = data?.nome || '';
  document.getElementById('aula-desc').value = data?.descricao || '';
  document.getElementById('aula-status').value = data ? calcularStatusAuto(data.data, data.id) : 'futura';
  document.getElementById('aula-alert').style.display = 'none';

  // Plano de aula (opcional): restaura o vínculo na edição SEM sobrescrever tema/habilidades salvos
  _aulaModalTemColunaPlano = !!(data && Object.prototype.hasOwnProperty.call(data, 'plano_doc_id'));
  PlanoVinculoAula.preencherSelect(document.getElementById('aula-plano'), data?.plano_doc_id ?? '', true);

  // Campo de habilidades BNCC — multi-seleção via chips
  _habilidadesAulaSelecionadas = [];
  const bnccInput = document.getElementById('aula-bncc');
  if (bnccInput) bnccInput.value = '';
  _renderChipsHabilidadesAula();
  _fecharDropdownHabilidadesAula();
  if (editandoAulaId) {
    _carregarHabilidadesDaAula(editandoAulaId);
  }

  const campoDisc = document.getElementById('aula-campo-disciplina');
  const selDisc = document.getElementById('aula-disciplina');
  if (isFundamentalI() && campoDisc && selDisc) {
    campoDisc.style.display = 'block';
    const discs = _disciplinasAulasFundI || [];
    selDisc.innerHTML = '<option value="">Selecione a disciplina...</option>' +
      discs.map(d => `<option value="${d}"${data?.disciplina === d ? ' selected' : ''}>${d}</option>`).join('');
    if (!data && aulasDiscFiltro) selDisc.value = aulasDiscFiltro;
  } else if (campoDisc) {
    campoDisc.style.display = 'none';
  }

  _atualizarInfoStatusModal();
  const inp = document.getElementById('aula-data');
  if (inp) inp.oninput = function() {
    _atualizarInfoStatusModal();
    if (typeof onDateInput === 'function') onDateInput(this, 'cal-aula');
  };
  document.getElementById('modal-aula').classList.add('open');
  atualizarCalendario('cal-aula');
};

// ─── 2. PATCH: salvarAula — vínculos de habilidades via aula_habilidades ────
//  Substitua a função salvarAula original por esta:
window.salvarAula = async function() {
  const btn = document.getElementById('btn-salvar-aula');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  const textoOriginalBtn = btn.textContent;
  btn.textContent = 'Salvando...';
  const alEl = document.getElementById('aula-alert');
  alEl.style.display = 'none';

  try {
  const tri = detectarTrimestreAtual().tri;
  if (await verificarBloqueio(tri)) return;

  const dataStr = document.getElementById('aula-data').value;
  const nome = document.getElementById('aula-nome').value.trim(); // TEMA → salvo como nome
  if (!dataStr || !nome) {
    alEl.textContent = 'Data e tema são obrigatórios.';
    alEl.style.display = 'block';
    return;
  }
  const descricao = document.getElementById('aula-desc').value.trim(); // DESCRIÇÃO → salvo como descricao
  if (!descricao) {
    alEl.textContent = 'A descrição é obrigatória.';
    alEl.style.display = 'block';
    return;
  }
  const dataISO = parseDateBR(dataStr);
  if (!dataISO) {
    alEl.textContent = 'Data inválida. Use DD/MM/AAAA.';
    alEl.style.display = 'block';
    return;
  }
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const statusAuto = calcularStatusAuto(dataISO, editandoAulaId);
  const discVal = isFundamentalI() ? (document.getElementById('aula-disciplina')?.value || null) : null;

  const body = {
    data: dataISO,
    nome,
    descricao,
    status: statusAuto,
    turma_id: turmaAtiva.id,
    turma_disciplina_id: turmaDisciplinaAtiva?.id || null,
    professor_id: profData.id,
    ...(discVal ? { disciplina: discVal } : {}),
  };

  // Vínculo com plano_docs. A chave só vai no corpo quando há plano escolhido, ou quando
  // se está desvinculando uma aula que já tinha a coluna: assim, criar aula sem plano
  // continua idêntico ao comportamento anterior (e funciona mesmo antes da migração SQL).
  const planoSel = document.getElementById('aula-plano')?.value || '';
  if (planoSel) body.plano_doc_id = planoSel;
  else if (editandoAulaId && _aulaModalTemColunaPlano) body.plano_doc_id = null;

    let aulaId = editandoAulaId;
    if (editandoAulaId) {
      const atualizadas = await api(`aulas?id=eq.${editandoAulaId}`, { method: 'PATCH', body: JSON.stringify(body) });
      if (!atualizadas?.length) throw new Error('A aula não foi encontrada ou você não tem permissão para alterá-la.');
      const idx = aulasTurma.findIndex(a => a.id === editandoAulaId);
      if (idx !== -1) aulasTurma[idx] = { ...aulasTurma[idx], ...body };
    } else {
      const res = await api('aulas', { method: 'POST', body: JSON.stringify(body) });
      const nova = res?.[0];
      if (!nova?.id) throw new Error('O Supabase não confirmou a criação da aula. Verifique sua conexão e tente novamente.');
      aulaId = nova.id;
      editandoAulaId = nova.id;
      aulasTurma.push(nova);
      chamadaCacheSet(nova.id, false);
    }
    await _salvarVinculosHabilidadesAula(aulaId, _habilidadesAulaSelecionadas);
    await _carregarHabilidadesTextoPorAula(); // cards ao lado do calendário refletem as habilidades editadas
    cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
    fecharModal('modal-aula');
    renderListaAulas();
    atualizarContadorAulas();
    atualizarCalendario('cal-aula');
    if (typeof mostrarToast === 'function') mostrarToast('Aula salva com sucesso!');
  } catch (e) {
    alEl.textContent = `Erro ao salvar: ${PlanoVinculoAula.mensagemErro(e)}`;
    alEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginalBtn;
  }
};

// ─── 3. HABILIDADES BNCC — multi-seleção via chips ─────────────────────────
// Substitui o antigo autocomplete/busca semântica por texto livre. Agora as
// habilidades vêm da tabela habilidades_planejamento (cadastradas manualmente
// no módulo Planejamento) e o vínculo aula↔habilidade é many-to-many via
// aula_habilidades.

let _habilidadesAulaSelecionadas = []; // [{id, codigo, descricao}, ...]

// ── Cache local das habilidades cadastradas na turma_disciplina ativa ────────
let _habilidadesAulaCache = null;
let _habilidadesAulaCacheTd = null;

async function _habilidadesAulaCarregarCache() {
  const tdId = turmaDisciplinaAtiva?.id;
  if (_habilidadesAulaCache && _habilidadesAulaCacheTd === tdId) return _habilidadesAulaCache;
  try {
    const rows = await api(`habilidades_planejamento?turma_disciplina_id=eq.${tdId}&order=codigo.asc&limit=200`);
    _habilidadesAulaCache = rows || [];
    _habilidadesAulaCacheTd = tdId;
  } catch (_) {
    _habilidadesAulaCache = [];
  }
  return _habilidadesAulaCache;
}

window._habilidadesAulaInvalidarCache = function() {
  _habilidadesAulaCache = null;
  _habilidadesAulaCacheTd = null;
};

// ── Carrega os vínculos já existentes de uma aula (modo edição) ──────────────
async function _carregarHabilidadesDaAula(aulaId) {
  try {
    const rows = await api(
      `aula_habilidades?aula_id=eq.${aulaId}&select=habilidade_id,habilidades_planejamento(id,codigo,descricao)`
    ) || [];
    _habilidadesAulaSelecionadas = rows
      .map(r => r.habilidades_planejamento)
      .filter(Boolean)
      .map(h => ({ id: h.id, codigo: h.codigo, descricao: h.descricao }));
  } catch (e) {
    console.error('[HABILIDADES AULA] Erro ao carregar vínculos:', e);
    _habilidadesAulaSelecionadas = [];
  }
  _renderChipsHabilidadesAula();
}

// ── Chips das habilidades selecionadas no formulário ──────────────────────────
function _renderChipsHabilidadesAula() {
  const wrap = document.getElementById('aula-bncc-chips');
  if (!wrap) return;
  if (!_habilidadesAulaSelecionadas.length) {
    wrap.innerHTML = '';
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'flex';
  wrap.style.flexWrap = 'wrap';
  wrap.style.gap = '6px';
  wrap.innerHTML = _habilidadesAulaSelecionadas.map(h => `
    <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 6px 4px 10px;border-radius:20px;background:#EEF2FF;color:#3B4FE4;font-size:11px;font-weight:700;font-family:'Space Mono',monospace;">
      ${h.codigo}
      <button type="button" onclick="_removerHabilidadeAula('${h.id}')" style="border:none;background:none;color:#3B4FE4;cursor:pointer;padding:0;display:flex;align-items:center;">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </span>
  `).join('');
}

window._removerHabilidadeAula = function(habilidadeId) {
  _habilidadesAulaSelecionadas = _habilidadesAulaSelecionadas.filter(h => String(h.id) !== String(habilidadeId));
  _renderChipsHabilidadesAula();
};

function _adicionarHabilidadeAula(h) {
  if (_habilidadesAulaSelecionadas.some(sel => String(sel.id) === String(h.id))) return;
  _habilidadesAulaSelecionadas.push({ id: h.id, codigo: h.codigo, descricao: h.descricao });
  _renderChipsHabilidadesAula();
}

// ── Autocomplete dropdown (busca entre as habilidades cadastradas) ───────────
let _habilidadesAulaDropdownEl = null;

function _criarDropdownHabilidadesAula() {
  if (_habilidadesAulaDropdownEl) return _habilidadesAulaDropdownEl;
  const inp = document.getElementById('aula-bncc');
  if (!inp) return null;
  const d = document.createElement('div');
  d.id = 'habilidades-aula-dropdown';
  d.style.cssText = `
    position:absolute;z-index:9999;background:var(--white);
    border:1.5px solid var(--border);border-radius:10px;
    box-shadow:0 8px 24px rgba(0,0,0,0.12);
    max-height:220px;overflow-y:auto;min-width:100%;
    top:calc(100% + 4px);left:0;
  `;
  const wrap = inp.parentElement;
  if (wrap && getComputedStyle(wrap).position === 'static') {
    wrap.style.position = 'relative';
  }
  wrap?.appendChild(d);
  _habilidadesAulaDropdownEl = d;
  return d;
}

window._fecharDropdownHabilidadesAula = function() {
  if (_habilidadesAulaDropdownEl) {
    _habilidadesAulaDropdownEl.remove();
    _habilidadesAulaDropdownEl = null;
  }
};

function _renderDropdownHabilidadesAula(itens) {
  const d = _criarDropdownHabilidadesAula();
  if (!d) return;
  if (!itens.length) { _fecharDropdownHabilidadesAula(); return; }
  d.innerHTML = itens.map(h => `
    <div style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.1s;"
      onmouseenter="this.style.background='#F0F4FF'"
      onmouseleave="this.style.background=''"
      onclick="_selecionarHabilidadeAulaDropdown('${h.id}')">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="padding:2px 8px;border-radius:20px;background:#EEF2FF;color:#3B4FE4;font-size:11px;font-weight:700;font-family:'Space Mono',monospace;flex-shrink:0;">${h.codigo||'—'}</span>
        <span style="font-size:12px;color:var(--text);line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${(h.descricao||'').replace(/</g,'&lt;')}</span>
      </div>
    </div>`).join('');
}

window._selecionarHabilidadeAulaDropdown = async function(habilidadeId) {
  const habs = await _habilidadesAulaCarregarCache();
  const h = habs.find(x => String(x.id) === String(habilidadeId));
  if (h) _adicionarHabilidadeAula(h);
  const inp = document.getElementById('aula-bncc');
  if (inp) inp.value = '';
  _fecharDropdownHabilidadesAula();
};

function _filtrarHabilidadesAulaLocal(habs, query) {
  const q = query.toLowerCase();
  return habs
    .filter(h => !_habilidadesAulaSelecionadas.some(sel => String(sel.id) === String(h.id)))
    .filter(h =>
      (h.codigo||'').toLowerCase().includes(q) ||
      (h.descricao||'').toLowerCase().includes(q)
    ).slice(0, 8);
}

// ── Debounce autocomplete ─────────────────────────────────────────────────────
let _habilidadesAulaDebounce = null;

window.onBnccInput = async function() {
  clearTimeout(_habilidadesAulaDebounce);
  const query = (document.getElementById('aula-bncc')?.value || '').trim();
  if (query.length < 1) { _fecharDropdownHabilidadesAula(); return; }
  _habilidadesAulaDebounce = setTimeout(async () => {
    const habs = await _habilidadesAulaCarregarCache();
    const filtrados = _filtrarHabilidadesAulaLocal(habs, query);
    _renderDropdownHabilidadesAula(filtrados);
  }, 250);
};

// ── Fechar dropdown ao clicar fora ────────────────────────────────────────────
document.addEventListener('click', function(e) {
  if (!e.target.closest('#aula-bncc') && !e.target.closest('#habilidades-aula-dropdown')) {
    _fecharDropdownHabilidadesAula();
  }
}, true);

// ── Persiste os vínculos aula↔habilidades (delete-then-insert) ───────────────
async function _salvarVinculosHabilidadesAula(aulaId, habilidadesSelecionadas) {
  if (!aulaId) return;
  try {
    await api(`aula_habilidades?aula_id=eq.${aulaId}`, { method: 'DELETE' });
  } catch (e) {
    console.error('[HABILIDADES AULA] Erro ao limpar vínculos antigos:', e);
  }
  if (!habilidadesSelecionadas || !habilidadesSelecionadas.length) return;
  const payload = habilidadesSelecionadas.map(h => ({ aula_id: aulaId, habilidade_id: h.id }));
  try {
    await api('aula_habilidades', { method: 'POST', body: JSON.stringify(payload) });
  } catch (e) {
    console.error('[HABILIDADES AULA] Erro ao salvar vínculos novos:', e);
  }
}
window._salvarVinculosHabilidadesAula = _salvarVinculosHabilidadesAula;

// ─── PLANO DE AULA ↔ AULA (vínculo opcional com plano_docs) ─────────────────
// O módulo Plano de aula grava em plano_docs (tema, valores, turmas, habilidades).
// Aqui só LEMOS os planos do professor (a RLS de plano_docs garante o isolamento) e
// gravamos aulas.plano_doc_id. Nada de plano_docs é alterado por este código.
let _aulaModalTemColunaPlano = false; // a aula aberta no modal já veio com a coluna plano_doc_id?

const PlanoVinculoAula = (function () {
  const TTL_MS = 20000;
  let _lista = null;      // [{id, tema, turmas, habilidades}]
  let _prof = null;       // professor para o qual _lista vale
  let _quando = 0;
  let _promessa = null;
  let _falhou = false;

  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const _profId = () => String(JSON.parse(sessionStorage.getItem('prof_data') || '{}').id || '');

  function _json(v) {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t[0] === '[' || t[0] === '{') { try { return JSON.parse(t); } catch (_) {} }
    }
    return v;
  }

  // tema/turmas podem vir como texto, array de textos ou array de objetos
  function _txt(v) {
    v = _json(v);
    if (v == null) return '';
    if (Array.isArray(v)) return v.map(_txt).filter(Boolean).join(', ');
    if (typeof v === 'object') return String(v.nome ?? v.name ?? v.label ?? v.titulo ?? v.tema ?? v.codigo ?? '').trim();
    return String(v).trim();
  }

  // Códigos de habilidade do plano, só para mostrar nos cartões do seletor
  function _codigosExibicao(bruto) {
    const out = [];
    (function col(x) {
      x = _json(x);
      if (x == null) return;
      if (Array.isArray(x)) { x.forEach(col); return; }
      if (typeof x === 'object') { const c = x.codigo ?? x.code ?? x.cod; if (c) out.push(String(c).trim()); return; }
      String(x).split(/[\n;,]+/).forEach(t => {
        t = t.trim(); if (!t) return;
        const m = t.match(/\b(?:EI|EF|EM)\d{2,4}[A-Z]{2,3}\d{2,3}\b/gi);
        if (m) m.forEach(c => out.push(c.toUpperCase())); else if (t.length <= 20) out.push(t);
      });
    })(bruto);
    return [...new Set(out)];
  }

  async function carregar(forcar) {
    const prof = _profId();
    const fresco = _lista && _prof === prof && (Date.now() - _quando) < TTL_MS;
    if (fresco && !forcar) return _lista;
    if (_promessa) return _promessa;
    _promessa = (async () => {
      let rows = null;
      try {
        rows = await api('plano_docs?select=id,tema,turmas,habilidades&limit=500');
      } catch (_) {
        try { rows = await api('plano_docs?select=*&limit=500'); }
        catch (e2) { console.error('[PLANO↔AULA] Erro ao carregar plano_docs:', e2); rows = null; }
      }
      if (!Array.isArray(rows)) {
        _falhou = true;
        _lista = (_prof === prof && _lista) ? _lista : [];
        return _lista;
      }
      _falhou = false;
      _prof = prof;
      _quando = Date.now();
      _lista = rows.map(r => ({ id: r.id, tema: _txt(r.tema), turmas: _txt(r.turmas), habilidades: r.habilidades, codigos: _codigosExibicao(r.habilidades) }));
      return _lista;
    })();
    try { return await _promessa; } finally { _promessa = null; }
  }

  function _rotulo(p) {
    let t = p.tema || '(sem tema)';
    if (p.turmas) t += ' — ' + p.turmas;
    return t.length > 80 ? t.slice(0, 77) + '...' : t;
  }

  function opcoesHtml(selecionado) {
    const s = selecionado == null ? '' : String(selecionado);
    let achou = !s;
    let h = `<option value="">${_falhou && !(_lista || []).length ? 'Sem plano vinculado (planos não carregaram)' : 'Sem plano vinculado'}</option>`;
    (_lista || []).forEach(p => {
      const marcado = String(p.id) === s;
      if (marcado) achou = true;
      h += `<option value="${esc(p.id)}"${marcado ? ' selected' : ''}>${esc(_rotulo(p))}</option>`;
    });
    // O vínculo salvo aponta para um plano que não está (mais) visível: preserva o valor
    // para não desvincular sem querer ao salvar a aula.
    if (!achou) h += `<option value="${esc(s)}" selected>Plano vinculado (indisponível)</option>`;
    return h;
  }

  // Preenche um <select> de planos. Enquanto a lista carrega, mantém o valor atual
  // selecionado — assim salvar rápido nunca desvincula a aula por engano.
  async function preencherSelect(el, valor, forcar) {
    if (!el) return;
    melhorar(el);
    el._pvW.fechar();
    const tok = (el._pvTok = (el._pvTok || 0) + 1);
    const v = valor == null ? '' : String(valor);
    const fresco = _lista && _prof === _profId() && (Date.now() - _quando) < TTL_MS;
    if (fresco && !forcar) { el.innerHTML = opcoesHtml(v); el.value = v; el._pvW.atualizar(); return; }
    el.innerHTML = v
      ? `<option value="">Sem plano vinculado</option><option value="${esc(v)}" selected>Carregando plano...</option>`
      : '<option value="">Carregando planos...</option>';
    el.value = v;
    el._pvW.atualizar();
    await carregar(forcar);
    if (el._pvTok !== tok) return; // outro preenchimento mais novo assumiu
    const atual = el.value; // se o usuário já escolheu algo durante o carregamento, respeita
    el.innerHTML = opcoesHtml(atual || v);
    el.value = atual || v;
    el._pvW.atualizar();
  }

  // ── Seletor visual (busca + cartões) sobre o <select> ─────────────────────
  // O <select> continua no DOM, oculto, como fonte da verdade: .value e o evento
  // 'change' seguem funcionando para todo o código de salvar/preencher.
  const _norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const _widgets = new Set();

  function _injetarCss() {
    if (document.getElementById('pv-css')) return;
    const st = document.createElement('style');
    st.id = 'pv-css';
    st.textContent = `
      .pv{position:relative;width:100%;box-sizing:border-box;}
      .pv-linha{display:flex;gap:6px;align-items:stretch;}
      .pv-btn{flex:1;min-width:0;display:flex;align-items:center;gap:8px;min-height:44px;padding:7px 10px;box-sizing:border-box;text-align:left;background:#F8F6FF;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;font-family:'Sora',sans-serif;color:var(--text);transition:border-color .2s;}
      .pv.aberto .pv-btn,.pv-btn:focus-visible{border-color:var(--purple);outline:none;}
      .pv-btn-txt{flex:1;min-width:0;display:block;}
      .pv-t{display:block;font-size:13px;font-weight:700;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pv-s{display:block;margin-top:1px;font-size:11px;color:var(--text-muted);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .pv-vazio{font-size:13px;color:var(--text-muted);}
      .pv-seta{flex:0 0 auto;color:var(--text-muted);display:flex;transition:transform .15s;}
      .pv.aberto .pv-seta{transform:rotate(180deg);}
      .pv-x{flex:0 0 44px;border:1.5px solid var(--border);background:#fff;border-radius:8px;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;}
      .pv-x[hidden]{display:none;}
      .pv-panel{margin-top:6px;background:var(--white);border:1.5px solid var(--border);border-radius:10px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.08);}
      .pv-panel[hidden]{display:none;}
      .pv-busca{display:block;width:100%;box-sizing:border-box;margin:0;padding:11px 12px;border:none;border-bottom:1px solid var(--border);border-radius:0;background:#fff;outline:none;box-shadow:none;font-family:'Sora',sans-serif;font-size:13px;color:var(--text);}
      .pv-lista{max-height:min(46vh,280px);overflow-y:auto;overscroll-behavior:contain;}
      .pv-item{display:block;width:100%;box-sizing:border-box;text-align:left;padding:10px 12px;border:none;border-bottom:1px solid var(--border);background:#fff;cursor:pointer;font-family:'Sora',sans-serif;color:var(--text);}
      .pv-item:last-child{border-bottom:none;}
      .pv-item:hover,.pv-item.ativo{background:#F0F4FF;}
      .pv-item[aria-selected="true"]{background:#EEF2FF;box-shadow:inset 3px 0 0 var(--purple);}
      .pv-item-t{display:block;font-size:13px;font-weight:700;line-height:1.35;overflow-wrap:anywhere;}
      .pv-item-m{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center;margin-top:4px;}
      .pv-turmas{font-size:11px;color:var(--text-muted);}
      .pv-tag{font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;background:#DCFCE7;color:#166534;}
      .pv-hab{font-family:'Space Mono',monospace;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;background:#EEF2FF;color:#3B4FE4;}
      .pv-msg{padding:14px 12px;font-size:12px;line-height:1.5;color:var(--text-muted);}
      .pv-item-limpar{color:var(--text-muted);font-size:12px;font-weight:600;}
    `;
    document.head.appendChild(st);
  }

  function _daTurmaAtiva(p) {
    const n = _norm(typeof turmaAtiva !== 'undefined' && turmaAtiva ? turmaAtiva.nome : '').replace(/\s+/g, '');
    return !!n && _norm(p.turmas).replace(/\s+/g, '').includes(n);
  }

  function melhorar(sel) {
    if (!sel) return null;
    if (sel._pvW) return sel._pvW;
    _injetarCss();
    sel.style.display = 'none';
    const wrap = document.createElement('div');
    wrap.className = 'pv';
    wrap.innerHTML = `
      <div class="pv-linha">
        <button type="button" class="pv-btn" aria-haspopup="listbox" aria-expanded="false">
          <span class="pv-btn-txt"></span>
          <span class="pv-seta"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
        </button>
        <button type="button" class="pv-x" aria-label="Remover plano vinculado" title="Remover plano" hidden>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="pv-panel" hidden>
        <input type="search" class="pv-busca" placeholder="Buscar por tema, turma ou habilidade..." autocomplete="off" aria-label="Buscar plano de aula">
        <div class="pv-lista" role="listbox"></div>
      </div>`;
    sel.insertAdjacentElement('afterend', wrap);

    const btn = wrap.querySelector('.pv-btn');
    const txt = wrap.querySelector('.pv-btn-txt');
    const btnX = wrap.querySelector('.pv-x');
    const panel = wrap.querySelector('.pv-panel');
    const busca = wrap.querySelector('.pv-busca');
    const lista = wrap.querySelector('.pv-lista');
    let visiveis = [];
    let ativo = -1;
    let aberto = false;

    function atualizar() {
      const v = sel.value;
      const p = v ? (_lista || []).find(x => String(x.id) === String(v)) : null;
      if (p) {
        txt.innerHTML = `<span class="pv-t">${esc(p.tema || '(sem tema)')}</span>` + (p.turmas ? `<span class="pv-s">${esc(p.turmas)}</span>` : '');
      } else {
        const rotulo = sel.selectedOptions[0]?.textContent || 'Sem plano vinculado';
        txt.innerHTML = v ? `<span class="pv-t">${esc(rotulo)}</span>` : `<span class="pv-vazio">${esc(rotulo === 'Sem plano vinculado' ? 'Escolher plano de aula...' : rotulo)}</span>`;
      }
      btnX.hidden = !v;
      if (aberto) renderLista();
    }

    function renderLista() {
      const todos = (_lista || []).slice().sort((a, b) => (_daTurmaAtiva(b) ? 1 : 0) - (_daTurmaAtiva(a) ? 1 : 0));
      const q = _norm(busca.value.trim());
      visiveis = q ? todos.filter(p => _norm(p.tema + ' ' + p.turmas + ' ' + (p.codigos || []).join(' ')).includes(q)) : todos;
      ativo = q && visiveis.length ? 0 : -1;
      const atual = String(sel.value || '');
      let h = '';
      if (atual) h += `<button type="button" class="pv-item pv-item-limpar" data-id="">Sem plano vinculado</button>`;
      if (!visiveis.length) {
        h += `<div class="pv-msg">${(_lista || []).length
          ? `Nenhum plano encontrado para "${esc(busca.value.trim())}".`
          : 'Você ainda não tem planos de aula. Crie um em Planejamento → Plano de aula.'}</div>`;
      } else {
        h += visiveis.map((p, i) => {
          const cods = p.codigos || [];
          return `<button type="button" class="pv-item${i === ativo ? ' ativo' : ''}" role="option" data-id="${esc(p.id)}" aria-selected="${String(p.id) === atual}">
            <span class="pv-item-t">${esc(p.tema || '(sem tema)')}</span>
            <span class="pv-item-m">
              ${_daTurmaAtiva(p) ? '<span class="pv-tag">Desta turma</span>' : ''}
              ${p.turmas ? `<span class="pv-turmas">${esc(p.turmas)}</span>` : ''}
              ${cods.slice(0, 3).map(c => `<span class="pv-hab">${esc(c)}</span>`).join('')}
              ${cods.length > 3 ? `<span class="pv-turmas">+${cods.length - 3}</span>` : ''}
            </span>
          </button>`;
        }).join('');
      }
      lista.innerHTML = h;
    }

    function abrir() {
      if (aberto) return;
      aberto = true;
      wrap.classList.add('aberto');
      btn.setAttribute('aria-expanded', 'true');
      panel.hidden = false;
      busca.value = '';
      renderLista();
      // Planos recém-criados aparecem sem precisar reabrir o formulário
      carregar(false).then(() => { if (aberto) { renderLista(); atualizar(); } });
      busca.focus({ preventScroll: true });
      panel.scrollIntoView({ block: 'nearest' });
    }
    function fechar() {
      if (!aberto) return;
      aberto = false;
      wrap.classList.remove('aberto');
      btn.setAttribute('aria-expanded', 'false');
      panel.hidden = true;
    }
    function escolher(id) {
      const novo = id == null ? '' : String(id);
      const mudou = String(sel.value || '') !== novo;
      if (mudou) {
        if (novo && ![...sel.options].some(o => o.value === novo)) return;
        sel.value = novo;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      atualizar();
      fechar();
      btn.focus({ preventScroll: true });
    }
    function realcar(n) {
      if (!visiveis.length) return;
      ativo = Math.max(0, Math.min(n, visiveis.length - 1));
      lista.querySelectorAll('.pv-item[role="option"]').forEach((it, i) => it.classList.toggle('ativo', i === ativo));
      const el = lista.querySelectorAll('.pv-item[role="option"]')[ativo];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }

    btn.addEventListener('click', () => (aberto ? fechar() : abrir()));
    btnX.addEventListener('click', () => escolher(''));
    busca.addEventListener('input', renderLista);
    busca.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); realcar(ativo + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); realcar(ativo - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (visiveis[ativo]) escolher(visiveis[ativo].id); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(); btn.focus({ preventScroll: true }); }
    });
    lista.addEventListener('click', e => {
      const it = e.target.closest('.pv-item');
      if (it) escolher(it.dataset.id);
    });

    const w = { el: wrap, atualizar, fechar };
    _widgets.add(w);
    sel._pvW = w;
    atualizar();
    return w;
  }

  // Clique fora fecha qualquer seletor aberto
  document.addEventListener('click', e => {
    _widgets.forEach(w => {
      if (!document.body.contains(w.el)) { _widgets.delete(w); return; }
      if (!w.el.contains(e.target)) w.fechar();
    });
  }, true);

  // ── habilidades do plano → habilidades cadastradas na turma (habilidades_planejamento) ──
  const _normCod = s => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const _BNCC_RE = /\b(?:EI|EF|EM)\d{2,4}[A-Z]{2,3}\d{2,3}\b/gi;

  function _resolverHabilidades(bruto, cache) {
    const ids = new Set();
    const itens = [];
    (function coletar(x) {
      x = _json(x);
      if (x == null) return;
      if (Array.isArray(x)) { x.forEach(coletar); return; }
      if (typeof x === 'object') {
        if (x.id != null) ids.add(String(x.id));
        const c = x.codigo ?? x.code ?? x.cod;
        if (c) itens.push(String(c));
        return;
      }
      String(x).split(/[\n;,]+/).forEach(t => { t = t.trim(); if (t) itens.push(t); });
    })(bruto);

    const porCodigo = new Map();
    (cache || []).forEach(h => porCodigo.set(_normCod(h.codigo), h));

    const achadas = new Map();
    (cache || []).forEach(h => { if (ids.has(String(h.id))) achadas.set(String(h.id), h); });

    const naoEncontradas = [];
    itens.forEach(item => {
      const tokens = [_normCod(item), ...item.split(/[^A-Za-z0-9]+/).filter(Boolean).map(_normCod)];
      let casou = false;
      tokens.forEach(t => { const h = porCodigo.get(t); if (h) { achadas.set(String(h.id), h); casou = true; } });
      if (casou) return;
      const codigos = item.match(_BNCC_RE);
      if (codigos) codigos.forEach(c => { if (!porCodigo.has(_normCod(c))) naoEncontradas.push(c.toUpperCase()); });
      else if (item.length <= 20) naoEncontradas.push(item);
    });

    // mantém a ordem do cadastro da turma
    const encontradas = (cache || []).filter(h => achadas.has(String(h.id)))
      .map(h => ({ id: h.id, codigo: h.codigo, descricao: h.descricao }));
    return { encontradas, naoEncontradas: [...new Set(naoEncontradas)] };
  }

  // Dados que o plano escolhido preenche no formulário
  async function dadosDoPlano(planoId) {
    const lista = await carregar(false);
    const p = lista.find(x => String(x.id) === String(planoId));
    if (!p) return null;
    const cache = await _habilidadesAulaCarregarCache();
    const r = _resolverHabilidades(p.habilidades, cache);
    return { tema: p.tema, habilidades: r.encontradas, naoEncontradas: r.naoEncontradas };
  }

  function avisar(dados) {
    if (!dados || typeof mostrarToast !== 'function') return;
    if (dados.naoEncontradas.length) {
      const n = dados.naoEncontradas.length;
      mostrarToast(`${n} habilidade${n > 1 ? 's' : ''} do plano (${dados.naoEncontradas.slice(0, 3).join(', ')}${n > 3 ? '...' : ''}) não ${n > 1 ? 'estão cadastradas' : 'está cadastrada'} nesta turma e não ${n > 1 ? 'foram adicionadas' : 'foi adicionada'}.`);
    }
  }

  function mensagemErro(e) {
    const m = String(e?.message || '');
    if (/plano_doc_id/i.test(m) && /(column|coluna|schema cache|PGRST204)/i.test(m)) {
      return 'a coluna aulas.plano_doc_id ainda não existe no banco. Execute a migração SQL do vínculo com plano de aula no Supabase.';
    }
    return m || 'Tente novamente.';
  }

  return { carregar, preencherSelect, melhorar, dadosDoPlano, avisar, mensagemErro, invalidar() { _lista = null; _quando = 0; } };
})();
window.PlanoVinculoAula = PlanoVinculoAula;

// Escolheu um plano no modal de aula → preenche tema e habilidades BNCC (editáveis depois)
window.aulaPlanoAlterado = async function (sel) {
  const id = sel?.value || '';
  if (!id) return; // desvincular não apaga o que já está preenchido
  let dados = null;
  try { dados = await PlanoVinculoAula.dadosDoPlano(id); }
  catch (e) { console.error('[PLANO↔AULA] Erro ao ler o plano:', e); }
  if (sel.value !== id) return; // o usuário trocou de plano enquanto carregava
  if (!dados) return;
  if (dados.tema) document.getElementById('aula-nome').value = dados.tema;
  if (dados.habilidades.length) {
    _habilidadesAulaSelecionadas = dados.habilidades;
    _renderChipsHabilidadesAula();
  }
  PlanoVinculoAula.avisar(dados);
};

// ─── 4. MULTI AULAS ─────────────────────────────────────────────────────────
window.abrirMultiAulas = async function() {
  try {
    if (typeof window._fecharMenuPontinhos === 'function') window._fecharMenuPontinhos('aulas');
    if (!turmaAtiva) {
      if (typeof mostrarToast === 'function') mostrarToast('Selecione uma turma primeiro.');
      return;
    }
    // Garantir que aulasTurma está populado (pode estar vazio se veio direto pelo menu ⋮)
    if (!aulasTurma || aulasTurma.length === 0) {
      if (typeof mostrarToast === 'function') mostrarToast('Carregando aulas...');
      await carregarAulas();
    }
    const modal = document.getElementById('modal-multi-aulas');
    if (!modal) return;
    document.getElementById('multi-aulas-tema').value = '';
    document.getElementById('multi-aulas-desc').value = '';
    document.getElementById('multi-aulas-bncc').value = '';
    _habilidadesMultiAulaSelecionadas = [];
    _renderChipsHabilidadesMultiAula();
    document.getElementById('multi-aulas-datas').innerHTML = '';
    document.getElementById('multi-aulas-alert').style.display = 'none';
    window._adicionarLinhaDataMulti();
    modal.classList.add('open');
  } catch(e) {
    console.error('[MultiAulas] abrirMultiAulas:', e);
    if (typeof mostrarErro === 'function') mostrarErro('Erro ao abrir multi aulas: ' + e.message);
  }
};

window._adicionarLinhaDataMulti = function() {
  const container = document.getElementById('multi-aulas-datas');
  if (!container) return;

  // Verificar limite fixo de datas
  const linhas = container.querySelectorAll('.multi-data-row');
  const LIMITE_MAXIMO = 100;
  if (linhas.length >= LIMITE_MAXIMO) {
    if (typeof mostrarToast === 'function') mostrarToast(`Limite de ${LIMITE_MAXIMO} datas atingido.`);
    return;
  }

  const idx = Date.now();
  const row = document.createElement('div');
  row.className = 'multi-data-row';
  row.dataset.id = idx;
  row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
  row.innerHTML = `
    <input type="text" placeholder="DD/MM/AAAA" maxlength="10"
      oninput="this.value=this.value.replace(/[^0-9\/]/g,'');if(this.value.length===2&&!this.value.includes('/'))this.value+='/';if(this.value.length===5&&this.value.split('/').length<3)this.value+='/';"
      style="flex:1;padding:9px 12px;background:#F8F6FF;border:1.5px solid var(--border);border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;color:var(--text);outline:none;transition:border-color 0.2s;"
      onfocus="this.style.borderColor='var(--purple)'" onblur="this.style.borderColor='var(--border)'"/>
    <button onclick="this.closest('.multi-data-row').remove()"
      style="width:30px;height:30px;border-radius:7px;border:1px solid var(--border);background:none;color:var(--danger);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;"
      title="Remover">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  container.appendChild(row);
};

window.salvarMultiAulas = async function() {
  const alEl = document.getElementById('multi-aulas-alert');
  if (!alEl) return;
  alEl.style.display = 'none';

  try {
    // Validações de campos
    const tema = document.getElementById('multi-aulas-tema').value.trim();
    const desc = document.getElementById('multi-aulas-desc').value.trim();

    if (!tema) { alEl.textContent = 'O tema é obrigatório.'; alEl.style.display = 'block'; return; }
    if (!desc) { alEl.textContent = 'A descrição é obrigatória.'; alEl.style.display = 'block'; return; }
    if (!turmaAtiva) { alEl.textContent = 'Nenhuma turma selecionada.'; alEl.style.display = 'block'; return; }

    const inputs = document.querySelectorAll('#multi-aulas-datas .multi-data-row input');
    const datasISO = [];
    for (const inp of inputs) {
      const iso = parseDateBR(inp.value.trim());
      if (!iso) { alEl.textContent = `Data inválida: "${inp.value}". Use DD/MM/AAAA.`; alEl.style.display = 'block'; return; }
      datasISO.push(iso);
    }
    if (datasISO.length === 0) { alEl.textContent = 'Adicione pelo menos uma data.'; alEl.style.display = 'block'; return; }

    const btn = document.getElementById('btn-salvar-multi-aulas');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
    const aulasPayload = datasISO.map(dataISO => ({
      data: dataISO,
      nome: tema,
      descricao: desc,
      status: calcularStatusAuto(dataISO, null),
      turma_id: turmaAtiva.id,
      turma_disciplina_id: turmaDisciplinaAtiva?.id || null,
      professor_id: profData.id,
    }));

    const res = await api('aulas', { method: 'POST', body: JSON.stringify(aulasPayload) });
    const criadas = Array.isArray(res) ? res : aulasPayload.map((a, i) => ({ ...a, id: Date.now() + i }));
    criadas.forEach(a => {
      aulasTurma.push(a);
      if (typeof chamadaCacheSet === 'function') chamadaCacheSet(a.id, false);
    });
    if (_habilidadesMultiAulaSelecionadas.length) {
      await Promise.all(criadas.map(a => _salvarVinculosHabilidadesAula(a.id, _habilidadesMultiAulaSelecionadas)));
    }
    if (typeof cacheSalvar === 'function') cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
    fecharModal('modal-multi-aulas');
    if (typeof renderListaAulas === 'function') renderListaAulas();
    if (typeof atualizarContadorAulas === 'function') atualizarContadorAulas();
    if (typeof atualizarCalendario === 'function') atualizarCalendario('cal-aula');
    if (typeof mostrarToast === 'function') mostrarToast(`✓ ${criadas.length} aula${criadas.length > 1 ? 's' : ''} criada${criadas.length > 1 ? 's' : ''}!`);

    btn.disabled = false;
    btn.textContent = 'Criar aulas';
  } catch(e) {
    console.error('[MultiAulas] salvarMultiAulas:', e);
    alEl.textContent = 'Erro ao salvar as aulas: ' + e.message;
    alEl.style.display = 'block';
    const btn = document.getElementById('btn-salvar-multi-aulas');
    if (btn) { btn.disabled = false; btn.textContent = 'Criar aulas'; }
  }
};

// ── Multi-seleção de habilidades no modal de Multi Aulas ──────────────────────
// Reaproveita o cache de _habilidadesAulaCarregarCache(); mantém seleção própria
// (aplicada a todas as datas de uma vez ao salvar).
let _habilidadesMultiAulaSelecionadas = [];

function _renderChipsHabilidadesMultiAula() {
  const wrap = document.getElementById('multi-aulas-bncc-chips');
  if (!wrap) return;
  if (!_habilidadesMultiAulaSelecionadas.length) {
    wrap.innerHTML = '';
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'flex';
  wrap.style.flexWrap = 'wrap';
  wrap.style.gap = '6px';
  wrap.innerHTML = _habilidadesMultiAulaSelecionadas.map(h => `
    <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 6px 4px 10px;border-radius:20px;background:#EEF2FF;color:#3B4FE4;font-size:11px;font-weight:700;font-family:'Space Mono',monospace;">
      ${h.codigo}
      <button type="button" onclick="_removerHabilidadeMultiAula('${h.id}')" style="border:none;background:none;color:#3B4FE4;cursor:pointer;padding:0;display:flex;align-items:center;">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </span>
  `).join('');
}

window._removerHabilidadeMultiAula = function(habilidadeId) {
  _habilidadesMultiAulaSelecionadas = _habilidadesMultiAulaSelecionadas.filter(h => String(h.id) !== String(habilidadeId));
  _renderChipsHabilidadesMultiAula();
};

let _multiAulaBnccDropdownEl = null;

function _criarDropdownHabilidadesMultiAula() {
  if (_multiAulaBnccDropdownEl) return _multiAulaBnccDropdownEl;
  const inp = document.getElementById('multi-aulas-bncc');
  if (!inp) return null;
  const d = document.createElement('div');
  d.id = 'habilidades-multi-aula-dropdown';
  d.style.cssText = `
    position:absolute;z-index:9999;background:var(--white);
    border:1.5px solid var(--border);border-radius:10px;
    box-shadow:0 8px 24px rgba(0,0,0,0.12);
    max-height:220px;overflow-y:auto;min-width:100%;
    top:calc(100% + 4px);left:0;
  `;
  const wrap = inp.parentElement;
  if (wrap && getComputedStyle(wrap).position === 'static') {
    wrap.style.position = 'relative';
  }
  wrap?.appendChild(d);
  _multiAulaBnccDropdownEl = d;
  return d;
}

window._fecharDropdownHabilidadesMultiAula = function() {
  if (_multiAulaBnccDropdownEl) {
    _multiAulaBnccDropdownEl.remove();
    _multiAulaBnccDropdownEl = null;
  }
};

function _renderDropdownHabilidadesMultiAula(itens) {
  const d = _criarDropdownHabilidadesMultiAula();
  if (!d) return;
  if (!itens.length) { window._fecharDropdownHabilidadesMultiAula(); return; }
  d.innerHTML = itens.map(h => `
    <div style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border);"
      onmouseenter="this.style.background='#F0F4FF'" onmouseleave="this.style.background=''"
      onclick="_selecionarHabilidadeMultiAulaDropdown('${h.id}')">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="padding:2px 8px;border-radius:20px;background:#EEF2FF;color:#3B4FE4;font-size:11px;font-weight:700;font-family:'Space Mono',monospace;flex-shrink:0;">${h.codigo||'—'}</span>
        <span style="font-size:12px;color:var(--text);line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${(h.descricao||'').replace(/</g,'&lt;')}</span>
      </div>
    </div>`).join('');
}

window._selecionarHabilidadeMultiAulaDropdown = async function(habilidadeId) {
  const habs = await _habilidadesAulaCarregarCache();
  const h = habs.find(x => String(x.id) === String(habilidadeId));
  if (h && !_habilidadesMultiAulaSelecionadas.some(sel => String(sel.id) === String(h.id))) {
    _habilidadesMultiAulaSelecionadas.push({ id: h.id, codigo: h.codigo, descricao: h.descricao });
    _renderChipsHabilidadesMultiAula();
  }
  const inp = document.getElementById('multi-aulas-bncc');
  if (inp) inp.value = '';
  window._fecharDropdownHabilidadesMultiAula();
};

let _multiAulaBnccDebounce = null;
window.onMultiAulaBnccInput = async function() {
  clearTimeout(_multiAulaBnccDebounce);
  const query = (document.getElementById('multi-aulas-bncc')?.value || '').trim();
  if (query.length < 1) { window._fecharDropdownHabilidadesMultiAula(); return; }
  _multiAulaBnccDebounce = setTimeout(async () => {
    const habs = await _habilidadesAulaCarregarCache();
    const q = query.toLowerCase();
    const filtrados = habs
      .filter(h => !_habilidadesMultiAulaSelecionadas.some(sel => String(sel.id) === String(h.id)))
      .filter(h => (h.codigo||'').toLowerCase().includes(q) || (h.descricao||'').toLowerCase().includes(q))
      .slice(0, 8);
    _renderDropdownHabilidadesMultiAula(filtrados);
  }, 250);
};

document.addEventListener('click', function(e) {
  if (!e.target.closest('#multi-aulas-bncc') && !e.target.closest('#habilidades-multi-aula-dropdown')) {
    window._fecharDropdownHabilidadesMultiAula();
  }
}, true);

// ─── 5. MENU ⋯ (três pontinhos) ─────────────────────────────────────────────
window.toggleMenuPontinhos = function(secao, btn) {
  const menuId = `menu-pontinhos-${secao}`;
  let menu = document.getElementById(menuId);
  if (!menu) return;
  if (secao === 'aulas') _inicializarItemImportarMenu(menu);
  const aberto = menu.style.display === 'block';
  // Fechar todos
  document.querySelectorAll('[id^="menu-pontinhos-"]').forEach(m => m.style.display = 'none');
  if (!aberto) {
    menu.style.display = 'block';
    // posicionar abaixo do botão
    const rect = btn.getBoundingClientRect();
    menu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    menu.style.left = (rect.left + window.scrollX - menu.offsetWidth + btn.offsetWidth) + 'px';
  }
};

window._fecharMenuPontinhos = function(secao) {
  const menu = document.getElementById(`menu-pontinhos-${secao}`);
  if (menu) menu.style.display = 'none';
};

// Fechar menus ao clicar fora
document.addEventListener('click', function(e) {
  document.querySelectorAll('[id^="menu-pontinhos-"]').forEach(menu => {
    const btnId = menu.dataset.btnId;
    const btn = btnId ? document.getElementById(btnId) : null;
    if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
      menu.style.display = 'none';
    }
  });
});

// ─── 6. EXPORTAR / IMPORTAR AULAS EM PDF ───────────────────────────────────
// Exportar: gera um PDF com os dados de uma ou várias aulas (botão no card
// de cada aula e botão "Exportar PDF" na barra de seleção múltipla).
// Importar: lê um PDF gerado por este mesmo exportador e recria as aulas
// na turma ativa (item "Importar aulas (PDF)" no menu ⋯).

function _carregarScriptExterno(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = url;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Falha ao carregar biblioteca de PDF.'));
    document.head.appendChild(s);
  });
}

async function _garantirJsPDF() {
  if (window.jspdf && window.jspdf.jsPDF) return;
  await _carregarScriptExterno('https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.3/jspdf.umd.min.js');
}

async function _garantirPdfJs() {
  if (window.pdfjsLib) return;
  await _carregarScriptExterno('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// Marcadores que delimitam cada aula dentro do PDF gerado — usados depois
// para reconhecer os dados na importação. Não remova nem traduza.
const _AULA_PDF_INICIO = '### AULA-SIDED ###';
const _AULA_PDF_FIM = '### FIM-AULA-SIDED ###';

function _camposBlocoAula(a) {
  // a._habilidadesTexto é pré-carregado por exportarAulasPDF (aula_habilidades),
  // com fallback ao campo texto antigo (aulas históricas sem vínculo novo).
  const bncc = a._habilidadesTexto || a.habilidade_bncc || '';
  return [
    _AULA_PDF_INICIO,
    `ID: ${a.id}`,
    `DATA: ${formatarData(a.data)}`,
    `NOME: ${a.nome || ''}`,
    `STATUS: ${a.status || ''}`,
    `DISCIPLINA: ${a.disciplina || ''}`,
    `BNCC: ${bncc}`,
    `DESCRICAO: ${(a.descricao || '').replace(/\s*\n\s*/g, ' ')}`,
    _AULA_PDF_FIM,
  ];
}

// Busca os códigos de habilidades vinculadas (aula_habilidades) para um lote
// de aulas e retorna um mapa aula_id -> "COD1, COD2".
async function _buscarHabilidadesTextoParaAulas(aulaIds) {
  if (!aulaIds || !aulaIds.length) return {};
  try {
    const rows = await api(
      `aula_habilidades?aula_id=in.(${aulaIds.join(',')})&select=aula_id,habilidades_planejamento(codigo)`
    ) || [];
    const mapa = {};
    rows.forEach(r => {
      const cod = r.habilidades_planejamento?.codigo;
      if (!cod) return;
      mapa[r.aula_id] = mapa[r.aula_id] ? `${mapa[r.aula_id]}, ${cod}` : cod;
    });
    return mapa;
  } catch (e) {
    console.error('[EXPORTAR PDF] Erro ao buscar habilidades:', e);
    return {};
  }
}

async function exportarAulasPDF(lista, nomeArquivo) {
  if (!lista || lista.length === 0) {
    if (typeof mostrarToast === 'function') mostrarToast('Nenhuma aula para exportar.');
    return;
  }
  try {
    const habilidadesTextoMap = await _buscarHabilidadesTextoParaAulas(lista.map(a => a.id));
    lista.forEach(a => { a._habilidadesTexto = habilidadesTextoMap[a.id] || ''; });

    await _garantirJsPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margemX = 14;
    const limiteY = doc.internal.pageSize.getHeight() - 14;
    const alturaLinha = 5.6;
    let y = 18;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('SIDED+ — Exportação de Aulas', margemX, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Turma: ${turmaAtiva?.nome || '-'}   |   Gerado em: ${new Date().toLocaleString('pt-BR')}`, margemX, y);
    y += 9;

    lista.forEach(a => {
      const linhas = _camposBlocoAula(a);
      const linhasRenderizadas = [];
      linhas.forEach(l => {
        if (l.startsWith('DESCRICAO:')) linhasRenderizadas.push(...doc.splitTextToSize(l, 180));
        else linhasRenderizadas.push(l);
      });
      if (y + linhasRenderizadas.length * alturaLinha > limiteY) { doc.addPage(); y = 18; }
      linhasRenderizadas.forEach(l => {
        if (y > limiteY) { doc.addPage(); y = 18; }
        doc.text(l, margemX, y);
        y += alturaLinha;
      });
      y += 3;
    });

    const nome = nomeArquivo
      || `aulas_${(turmaAtiva?.nome || 'turma').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(nome);
    if (typeof mostrarToast === 'function') mostrarToast(`✓ ${lista.length} aula${lista.length > 1 ? 's' : ''} exportada${lista.length > 1 ? 's' : ''} em PDF!`);
  } catch (e) {
    console.error('[ExportarAulasPDF]', e);
    if (typeof mostrarErro === 'function') mostrarErro('Erro ao exportar PDF: ' + e.message);
  }
}
window.exportarAulasPDF = exportarAulasPDF;

// Exporta uma única aula (botão no card / "balão" de ações da aula)
window.exportarAulaPDF = function(aulaId) {
  const aula = aulasTurma.find(a => String(a.id) === String(aulaId));
  if (!aula) { if (typeof mostrarToast === 'function') mostrarToast('Aula não encontrada.'); return; }
  exportarAulasPDF([aula], `aula_${(aula.nome || 'aula').replace(/\s+/g, '_')}_${dataAulaOnly(aula.data)}.pdf`);
};

// Exporta todas as aulas marcadas no modo de seleção múltipla
window.exportarAulasSelecionadasPDF = function() {
  if (!aulasSelecionadas || aulasSelecionadas.size === 0) {
    if (typeof mostrarToast === 'function') mostrarToast('Selecione ao menos uma aula para exportar.');
    return;
  }
  const lista = aulasTurma.filter(a => aulasSelecionadas.has(a.id));
  exportarAulasPDF(lista);
};

// Cria (se ainda não existir) o botão "Exportar PDF" dentro da barra de
// seleção múltipla (#barra-selecao), clonando o estilo de um botão vizinho
// para se encaixar visualmente sem precisar editar o HTML.
function _inicializarBotaoExportarSelecao() {
  const barra = document.getElementById('barra-selecao');
  if (!barra || document.getElementById('btn-exportar-selecao-pdf')) return;
  const modelo = barra.querySelector('button');
  const btn = modelo ? modelo.cloneNode(true) : document.createElement('button');
  btn.id = 'btn-exportar-selecao-pdf';
  btn.removeAttribute('onclick');
  btn.title = 'Exportar selecionadas em PDF';
  btn.onclick = function(e) { e.stopPropagation(); exportarAulasSelecionadasPDF(); };
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Exportar PDF';
  if (!modelo) {
    btn.style.cssText = "padding:7px 14px;border-radius:8px;border:1.5px solid var(--purple);background:var(--white);color:var(--purple);font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;";
  }
  barra.appendChild(btn);
}

// ── Importação ───────────────────────────────────────────────────────────

async function _extrairTextoDePDF(file) {
  await _garantirPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let texto = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    let lastY = null;
    content.items.forEach(item => {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 0.5) texto += '\n';
      texto += item.str;
      lastY = y;
    });
    texto += '\n';
  }
  return texto;
}

const _MAPA_ROTULOS_AULA_PDF = {
  'DATA:': 'data', 'NOME:': 'nome', 'STATUS:': 'status',
  'DISCIPLINA:': 'disciplina', 'BNCC:': 'habilidades_bncc_texto', 'DESCRICAO:': 'descricao',
};

function _parsearAulasDoTextoPDF(texto) {
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
  const aulas = [];
  let atual = null;
  let campoAtual = null;

  linhas.forEach(linha => {
    if (linha === _AULA_PDF_INICIO) {
      atual = { id_origem: null, data: '', nome: '', status: '', disciplina: '', habilidades_bncc_texto: '', descricao: '' };
      campoAtual = null;
      return;
    }
    if (linha === _AULA_PDF_FIM) {
      if (atual) aulas.push(atual);
      atual = null;
      campoAtual = null;
      return;
    }
    if (!atual) return;
    if (linha.startsWith('ID:')) { atual.id_origem = linha.slice(3).trim(); campoAtual = null; return; }
    const rotulo = Object.keys(_MAPA_ROTULOS_AULA_PDF).find(r => linha.startsWith(r));
    if (rotulo) {
      atual[_MAPA_ROTULOS_AULA_PDF[rotulo]] = linha.slice(rotulo.length).trim();
      campoAtual = _MAPA_ROTULOS_AULA_PDF[rotulo];
      return;
    }
    if (campoAtual) atual[campoAtual] += ' ' + linha;
  });

  return aulas.filter(a => a.data && a.nome);
}

// Abre o seletor de arquivo e dispara a importação do PDF
window.importarAulasPDF = function() {
  if (typeof window._fecharMenuPontinhos === 'function') window._fecharMenuPontinhos('aulas');
  if (!turmaAtiva) {
    if (typeof mostrarToast === 'function') mostrarToast('Selecione uma turma primeiro.');
    return;
  }
  let input = document.getElementById('input-importar-aulas-pdf');
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.id = 'input-importar-aulas-pdf';
    input.accept = 'application/pdf';
    input.style.display = 'none';
    document.body.appendChild(input);
  }
  input.value = '';
  input.onchange = function() {
    const file = input.files[0];
    if (file) _processarImportacaoAulasPDF(file);
  };
  input.click();
};

// Casa os códigos de texto (separados por vírgula) do BNCC do PDF com as
// habilidades cadastradas na turma_disciplina ativa. Códigos que não existirem
// em habilidades_planejamento são ignorados silenciosamente (não bloqueiam a
// importação — o professor cadastra depois se quiser vincular).
async function _resolverHabilidadesTextoParaIds(textoBncc) {
  if (!textoBncc) return [];
  const codigos = textoBncc.split(',').map(c => c.trim()).filter(Boolean);
  if (!codigos.length) return [];
  const habs = await _habilidadesAulaCarregarCache();
  return codigos
    .map(cod => habs.find(h => (h.codigo || '').toLowerCase() === cod.toLowerCase()))
    .filter(Boolean)
    .map(h => h.id);
}

async function _processarImportacaoAulasPDF(file) {
  if (typeof mostrarToast === 'function') mostrarToast('Lendo PDF...');
  try {
    const texto = await _extrairTextoDePDF(file);
    const aulasEncontradas = _parsearAulasDoTextoPDF(texto);
    if (aulasEncontradas.length === 0) {
      if (typeof mostrarErro === 'function') mostrarErro('Nenhuma aula reconhecida nesse PDF. Use um PDF exportado pelo próprio sistema.');
      return;
    }
    if (!confirm(`Foram encontradas ${aulasEncontradas.length} aula${aulasEncontradas.length > 1 ? 's' : ''} no PDF. Importar para a turma "${turmaAtiva.nome}"?`)) return;

    const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
    const payload = aulasEncontradas.map(a => {
      const dataISO = parseDateBR(a.data) || dataAulaOnly(a.data);
      return {
        data: dataISO,
        nome: a.nome,
        descricao: a.descricao || '',
        status: calcularStatusAuto(dataISO, null),
        turma_id: turmaAtiva.id,
        turma_disciplina_id: turmaDisciplinaAtiva?.id || null,
        professor_id: profData.id,
        ...(a.disciplina ? { disciplina: a.disciplina } : {}),
      };
    });

    const res = await api('aulas', { method: 'POST', body: JSON.stringify(payload) });
    const criadas = Array.isArray(res) ? res : payload.map((a, i) => ({ ...a, id: Date.now() + i }));
    criadas.forEach(a => {
      aulasTurma.push(a);
      if (typeof chamadaCacheSet === 'function') chamadaCacheSet(a.id, false);
    });

    // Vincula habilidades reconhecidas (por código) a cada aula importada
    for (let i = 0; i < criadas.length; i++) {
      const idsHabilidades = await _resolverHabilidadesTextoParaIds(aulasEncontradas[i]?.habilidades_bncc_texto);
      if (idsHabilidades.length) {
        await api('aula_habilidades', {
          method: 'POST',
          body: JSON.stringify(idsHabilidades.map(id => ({ aula_id: criadas[i].id, habilidade_id: id }))),
        });
      }
    }

    if (typeof cacheSalvar === 'function') cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
    if (typeof renderListaAulas === 'function') renderListaAulas();
    if (typeof atualizarContadorAulas === 'function') atualizarContadorAulas();
    if (typeof atualizarCalendario === 'function') atualizarCalendario('cal-aula');
    if (typeof mostrarToast === 'function') mostrarToast(`✓ ${criadas.length} aula${criadas.length > 1 ? 's' : ''} importada${criadas.length > 1 ? 's' : ''}!`);
  } catch (e) {
    console.error('[ImportarAulasPDF]', e);
    if (typeof mostrarErro === 'function') mostrarErro('Erro ao importar PDF: ' + e.message);
  }
}

// Cria (se ainda não existir) o item "Importar aulas (PDF)" dentro do menu
// ⋯ das aulas (#menu-pontinhos-aulas), clonando o item "Multi aulas" para
// herdar o mesmo estilo, sem precisar editar o HTML manualmente.
function _inicializarItemImportarMenu(menu) {
  if (!menu || document.getElementById('btn-importar-aulas-pdf')) return;
  const modelo = menu.querySelector('[onclick*="abrirMultiAulas"]') || menu.querySelector('button, div[onclick], a[onclick]');
  const item = modelo ? modelo.cloneNode(true) : document.createElement('button');
  item.id = 'btn-importar-aulas-pdf';
  item.removeAttribute('onclick');
  item.onclick = function(e) { e.stopPropagation(); importarAulasPDF(); };
  const textNode = Array.from(item.childNodes).find(n => n.nodeType === 3 && n.textContent.trim());
  if (textNode) textNode.textContent = ' Importar aulas (PDF)';
  else if (!item.querySelector('svg, img')) item.textContent = 'Importar aulas (PDF)';
  if (!modelo) {
    item.style.cssText = "display:block;width:100%;text-align:left;padding:9px 14px;border:none;background:none;font-family:'Sora',sans-serif;font-size:13px;color:var(--text);cursor:pointer;";
  }
  menu.appendChild(item);
}

// ═══════════════════════════════════════════════════════════════════════════
// CALENDÁRIO LATERAL DE AULAS — filtro visual + busca + criação de aula
// ═══════════════════════════════════════════════════════════════════════════
let _calAulasRef = new Date();
let _calAulasDatasSel = [];      // datas 'YYYY-MM-DD' selecionadas no calendário (sem limite)
let _calAulasDiaSel = null;      // última data selecionada/adicionada (padrão p/ nova aula)
let _calAulasInicializado = false; // seleção inicial (hoje) aplicada uma única vez
let _calAulasDatasNovaAula = []; // datas marcadas p/ criar aula, quando painel aberto
let _calAulasModo = 'mesmo';     // 'mesmo' | 'individual'
let _calAulasCliqueTimer = null; // aguarda um possível 2º clique rápido na mesma data
let _calAulasCliqueIso = null;
const _CAL_AULAS_DUPLO_CLIQUE_MS = 280;
let _calAulasFeriadosEscola = null; // escola cujo calendário escolar já foi consultado

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function _calAulasStatusPorData() {
  // Agrupa aulasTurma por data ISO -> { lecionada: bool, pendente: bool }
  const mapa = {};
  (aulasTurma || []).forEach(a => {
    const d = a.data?.includes('T') ? a.data.split('T')[0] : a.data;
    if (!d) return;
    if (!mapa[d]) mapa[d] = { lecionada: false, pendente: false };
    const chamadaOk = typeof chamadaCacheGet === 'function' ? chamadaCacheGet(a.id) : null;
    if (chamadaOk === true || a.status === 'lecionada') mapa[d].lecionada = true;
    else mapa[d].pendente = true;
  });
  return mapa;
}

// Retorna o evento do calendário escolar (feriado/recesso/etc.) que cobre a data ISO, se houver
function _calAulasEventoDoDia(iso) {
  if (!feriadosCache || !feriadosCache.length) return null;
  return feriadosCache.find(e => {
    const fim = e.data_fim || e.data;
    return iso >= e.data && iso <= fim;
  }) || null;
}

async function renderCalendarioAulas() {
  const grid = document.getElementById('cal-aulas-grid');
  const label = document.getElementById('cal-aulas-mes-ano');
  if (!grid || !label) return;

  // Garante que o calendário escolar (feriados/recessos) esteja carregado (uma consulta por escola)
  if (!feriadosCache.length) {
    const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
    const escolaId = profData.escolas?.id || profData.escola_id;
    if (escolaId && _calAulasFeriadosEscola !== escolaId) {
      _calAulasFeriadosEscola = escolaId;
      feriadosCache = await api(`calendario_escolar?escola_id=eq.${escolaId}&select=*`) || [];
    }
  }

  const ano = _calAulasRef.getFullYear();
  const mes = _calAulasRef.getMonth();
  label.textContent = `${MESES_PT[mes]} ${ano}`;

  const ctx = _calAulasContexto();
  const statusPorData = ctx.porData;
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  // Setas: com filtro ativo pulam para o próximo mês que tem dias visíveis
  const ym = _calAulasYM(ano, mes);
  const btnPrev = document.getElementById('cal-aulas-prev');
  const btnNext = document.getElementById('cal-aulas-next');
  const semAnt = !!ctx.meses && !ctx.meses.some(k => k < ym);
  const semProx = !!ctx.meses && !ctx.meses.some(k => k > ym);
  if (btnPrev) { btnPrev.style.opacity = semAnt ? '0.25' : '1'; btnPrev.style.pointerEvents = semAnt ? 'none' : 'auto'; }
  if (btnNext) { btnNext.style.opacity = semProx ? '0.25' : '1'; btnNext.style.pointerEvents = semProx ? 'none' : 'auto'; }
  const aviso = document.getElementById('cal-aulas-aviso');
  if (aviso) {
    const vazio = !!ctx.meses && ctx.meses.length === 0;
    aviso.style.display = vazio ? 'block' : 'none';
    aviso.textContent = vazio ? 'Nenhum dia corresponde aos filtros ativos.' : '';
  }

  let html = ['D','S','T','Q','Q','S','S'].map(d =>
    `<span style="font-size:12px;font-weight:700;color:var(--text-muted);">${d}</span>`
  ).join('');

  for (let i = 0; i < primeiroDiaSemana; i++) html += '<span></span>';

  for (let dia = 1; dia <= totalDias; dia++) {
    const iso = `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    // Dia fora do filtro: célula em branco (sem número, sem clique)
    if (!ctx.diaVisivel(iso)) { html += '<span></span>'; continue; }
    const st = statusPorData[iso];
    const selecionado = _calAulasDatasSel.includes(iso);
    const marcado = _calAulasDatasNovaAula.includes(iso);
    const evento = _calAulasEventoDoDia(iso);
    let bg = 'transparent', color = 'var(--text)', titulo = '';
    // Aula lançada tem prioridade visual; senão, mostra feriado/recesso do calendário escolar
    if (st?.lecionada) { bg = '#DCFCE7'; color = '#166534'; }
    else if (st?.pendente) { bg = '#FEF3C7'; color = '#92400E'; }
    else if (st?.futura) { bg = '#DBEAFE'; color = '#1D4ED8'; }
    else if (evento?.tipo === 'recesso') { bg = '#E5E7EB'; color = '#4B5563'; titulo = `Recesso — ${evento.descricao || ''}`; }
    else if (evento?.tipo === 'feriado_municipal' || evento?.tipo === 'feriado_estadual') { bg = '#FEE2E2'; color = '#DC2626'; titulo = `Feriado — ${evento.descricao || ''}`; }
    let outline = '';
    if (marcado) outline = 'outline:2px solid var(--purple);outline-offset:-1px;';
    else if (selecionado) outline = 'box-shadow:0 0 0 2px var(--purple);font-weight:800;';
    html += `<span class="cal-aulas-dia" aria-pressed="${selecionado}" onclick="calAulasClicarDia('${iso}')" title="${escHtmlAttr(titulo)}" style="cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:manipulation;display:flex;align-items:center;justify-content:center;aspect-ratio:1/1;width:100%;max-width:54px;justify-self:center;font-size:15px;font-weight:600;border-radius:50%;background:${bg};color:${color};${outline}">${dia}</span>`;
  }

  grid.innerHTML = html;
}

// ── Contexto de filtros do calendário ────────────────────────────────────────
// Com filtro ativo: dias fora do trimestre ou sem aula que passe nos filtros
// ficam em branco, e meses sem nenhum dia visível não aparecem na navegação.
// Com o painel "Nova aula / Editar aula" aberto, nenhum filtro se aplica
// (é preciso poder marcar qualquer data).
function _calAulasPainelAberto() {
  return document.getElementById('painel-nova-aula-cal')?.style.display === 'flex';
}

function _calAulasYM(ano, mes) {
  return `${ano}-${String(mes + 1).padStart(2, '0')}`;
}

function _calAulasContexto() {
  const painel = _calAulasPainelAberto();
  const tri = painel || !aulasTriFiltro || aulasTriFiltro === 'todos' ? 0 : parseInt(aulasTriFiltro);
  const filtraAulas = !painel && ((aulasTipoFiltro && aulasTipoFiltro !== 'todos') || !!aulasDiscFiltro || aulasDiaSemFiltro !== null);
  const ctx = { restrito: tri > 0 || filtraAulas, faixa: null, porData: {}, meses: null };

  if (tri > 0) {
    const div = (_divisoesCache || []).find(d => d.ordem === tri);
    ctx.faixa = div
      ? { ini: dataAulaOnly(div.dataIni), fim: dataAulaOnly(div.dataFim) }
      : { ini: '9999-12-31', fim: '0000-01-01' }; // trimestre sem datas cadastradas: nada aparece
  }

  // Status por data considerando só as aulas que passam nos filtros
  (aulasTurma || []).forEach(a => {
    const iso = dataAulaOnly(a.data);
    if (!iso) return;
    if (!painel && !_aulaPassaFiltros(a)) return;
    const st = _statusEfetivoAula(a);
    const k = st === 'lecionada' || st === 'futura' ? st : 'pendente';
    (ctx.porData[iso] = ctx.porData[iso] || { lecionada: false, pendente: false, futura: false })[k] = true;
  });

  ctx.diaVisivel = iso => {
    if (!ctx.restrito) return true;
    if (ctx.faixa && (iso < ctx.faixa.ini || iso > ctx.faixa.fim)) return false;
    if (filtraAulas) return !!ctx.porData[iso];
    return true;
  };

  if (filtraAulas) {
    ctx.meses = [...new Set(Object.keys(ctx.porData).map(iso => iso.slice(0, 7)))].sort();
  } else if (ctx.faixa) {
    const meses = [];
    if (ctx.faixa.ini <= ctx.faixa.fim) {
      let y = parseInt(ctx.faixa.ini.slice(0, 4)), m = parseInt(ctx.faixa.ini.slice(5, 7)) - 1;
      const yf = parseInt(ctx.faixa.fim.slice(0, 4)), mf = parseInt(ctx.faixa.fim.slice(5, 7)) - 1;
      while (y < yf || (y === yf && m <= mf)) {
        meses.push(_calAulasYM(y, m));
        m++; if (m > 11) { m = 0; y++; }
      }
    }
    ctx.meses = meses;
  }
  return ctx;
}

// Se o mês exibido não tem dias visíveis, vai para o mais próximo que tem
function _calAulasAjustarMes(ctx) {
  if (!ctx.meses || !ctx.meses.length) return;
  const atual = _calAulasYM(_calAulasRef.getFullYear(), _calAulasRef.getMonth());
  if (ctx.meses.includes(atual)) return;
  const idx = k => parseInt(k.slice(0, 4)) * 12 + parseInt(k.slice(5, 7)) - 1;
  const alvo = idx(atual);
  let melhor = ctx.meses[0];
  ctx.meses.forEach(k => {
    const d = Math.abs(idx(k) - alvo), db = Math.abs(idx(melhor) - alvo);
    if (d < db || (d === db && idx(k) > idx(melhor))) melhor = k;
  });
  _calAulasRef = new Date(parseInt(melhor.slice(0, 4)), parseInt(melhor.slice(5, 7)) - 1, 1);
}

// Chamada por todos os filtros (tipo, trimestre, disciplina, dia da semana)
function _calAulasAplicarFiltro() {
  const ctx = _calAulasContexto();
  if (ctx.restrito) {
    _calAulasDatasSel = _calAulasDatasSel.filter(ctx.diaVisivel);
    if (!_calAulasDatasSel.includes(_calAulasDiaSel)) {
      _calAulasDiaSel = _calAulasDatasSel[_calAulasDatasSel.length - 1] || null;
    }
  }
  _calAulasAjustarMes(ctx);
  renderListaAulas();
}

function escHtmlAttr(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function calAulasMudarMes(delta) {
  const ctx = _calAulasContexto();
  if (ctx.meses) {
    // Com filtro: pula direto para o mês anterior/seguinte que tem dias visíveis
    const atual = _calAulasYM(_calAulasRef.getFullYear(), _calAulasRef.getMonth());
    const alvo = delta > 0
      ? ctx.meses.find(k => k > atual)
      : [...ctx.meses].reverse().find(k => k < atual);
    if (!alvo) return;
    _calAulasRef = new Date(parseInt(alvo.slice(0, 4)), parseInt(alvo.slice(5, 7)) - 1, 1);
  } else {
    _calAulasRef = new Date(_calAulasRef.getFullYear(), _calAulasRef.getMonth() + delta, 1);
  }
  renderCalendarioAulas();
}

// Clique simples: seleciona somente a data. Dois cliques rápidos na mesma data:
// adiciona à seleção (ou remove, se já estava selecionada). Sem limite de datas.
function calAulasClicarDia(iso) {
  const painelAberto = document.getElementById('painel-nova-aula-cal')?.style.display === 'flex';
  if (painelAberto && _nacEditandoId) {
    // Editando: a aula tem uma única data; clicar em outro dia muda a data
    _calAulasDatasNovaAula = [iso];
    renderCalendarioAulas();
    _renderChipsNovaAulaCal();
    return;
  }
  if (painelAberto) {
    const idx = _calAulasDatasNovaAula.indexOf(iso);
    if (idx === -1) _calAulasDatasNovaAula.push(iso);
    else _calAulasDatasNovaAula.splice(idx, 1);
    _calAulasDatasNovaAula.sort();
    renderCalendarioAulas();
    _renderChipsNovaAulaCal();
    _renderFormNovaAulaCal();
    return;
  }

  if (_calAulasCliqueTimer && _calAulasCliqueIso === iso) {
    // 2º clique rápido na mesma data
    clearTimeout(_calAulasCliqueTimer);
    _calAulasCliqueTimer = null;
    _calAulasCliqueIso = null;
    calAulasAlternarData(iso);
    return;
  }

  if (_calAulasCliqueTimer) {
    // Clique em outra data antes do prazo: conclui o clique simples pendente
    clearTimeout(_calAulasCliqueTimer);
    const pendente = _calAulasCliqueIso;
    _calAulasCliqueTimer = null;
    _calAulasCliqueIso = null;
    calAulasSelecionarUnica(pendente);
  }

  _calAulasCliqueIso = iso;
  _calAulasCliqueTimer = setTimeout(() => {
    const d = _calAulasCliqueIso;
    _calAulasCliqueTimer = null;
    _calAulasCliqueIso = null;
    calAulasSelecionarUnica(d);
  }, _CAL_AULAS_DUPLO_CLIQUE_MS);
}

function _calAulasAtualizarSelecao() {
  _calAulasDatasSel.sort();
  _calAulasDiaSel = _calAulasDatasSel.includes(_calAulasDiaSel)
    ? _calAulasDiaSel
    : (_calAulasDatasSel[_calAulasDatasSel.length - 1] || null);
  renderCalendarioAulas();
  _renderPainelAulasCal();
}

function calAulasSelecionarUnica(iso) {
  _calAulasDatasSel = [iso];
  _calAulasDiaSel = iso;
  _calAulasAtualizarSelecao();
}

function calAulasAlternarData(iso) {
  const idx = _calAulasDatasSel.indexOf(iso);
  if (idx === -1) {
    _calAulasDatasSel.push(iso);
    _calAulasDiaSel = iso;
  } else {
    _calAulasDatasSel.splice(idx, 1);
  }
  _calAulasAtualizarSelecao();
}

function calAulasRemoverData(iso) {
  const idx = _calAulasDatasSel.indexOf(iso);
  if (idx !== -1) _calAulasDatasSel.splice(idx, 1);
  _calAulasAtualizarSelecao();
}

function calAulasLimparSelecao() {
  _calAulasDatasSel = [];
  _calAulasDiaSel = null;
  _calAulasAtualizarSelecao();
}

function _formatarDataLabel(iso) {
  const [ano, mes, dia] = iso.split('-');
  return `${parseInt(dia)} de ${MESES_PT[parseInt(mes)-1].toLowerCase()}`;
}

// Chips das datas selecionadas (2 ou mais), com opção de desmarcar cada uma
function _renderChipsDatasSelCal() {
  const wrap = document.getElementById('cal-aulas-datas-sel');
  if (!wrap) return;
  const datas = [..._calAulasDatasSel].sort();
  if (datas.length < 2) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
  wrap.style.display = 'flex';
  wrap.innerHTML = datas.map(iso => `
    <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:3px 4px 3px 10px;border-radius:20px;background:#EDE8FF;color:var(--purple);">
      ${formatarData(iso)}
      <button type="button" onclick="calAulasRemoverData('${iso}')" title="Desmarcar ${formatarData(iso)}" aria-label="Desmarcar ${formatarData(iso)}"
        style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;border:none;background:rgba(108,79,212,0.15);color:var(--purple);font-size:12px;line-height:1;cursor:pointer;padding:0;">×</button>
    </span>`).join('') +
    `<button type="button" onclick="calAulasLimparSelecao()" style="font-family:'Sora',sans-serif;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;border:1.5px solid var(--border);background:none;color:var(--text-muted);cursor:pointer;">Limpar seleção</button>`;
}

// Cards das aulas das datas selecionadas (ou resultado da busca), ao lado do calendário.
// Usa o card comum do sistema (_aulaCardHtml) com as informações completas da aula.
function _renderPainelAulasCal() {
  const label = document.getElementById('cal-aulas-dia-label');
  const lista = document.getElementById('cal-aulas-dia-lista');
  if (!label || !lista) return;
  _renderChipsDatasSelCal();

  const busca = document.getElementById('cal-aulas-busca')?.value.trim();
  if (busca) { calAulasBuscar(busca); return; } // busca ativa tem prioridade sobre as datas

  const datas = [..._calAulasDatasSel].sort();
  if (aulasOrdemDesc) datas.reverse();
  label.textContent = !datas.length ? 'Selecione um dia'
    : datas.length === 1 ? _formatarDataLabel(datas[0])
    : `${datas.length} datas selecionadas`;

  if (!datas.length) {
    lista.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Selecione uma data no calendário para ver as aulas. Para marcar várias datas, dê dois cliques rápidos em cada uma.</div>`;
    return;
  }

  const porData = {};
  (aulasTurma || []).forEach(a => {
    const d = dataAulaOnly(a.data);
    if (d) (porData[d] = porData[d] || []).push(a);
  });

  lista.innerHTML = datas.map(iso => {
    const todas = porData[iso] || [];
    const visiveis = todas.filter(_aulaPassaFiltros);
    const ocultas = todas.length - visiveis.length;
    const d = new Date(iso + 'T12:00:00');
    const cabecalho = datas.length > 1 ? `
      <div style="display:flex;align-items:center;gap:8px;margin:2px 0 8px;">
        <span style="font-size:12px;font-weight:700;color:var(--text);">${formatarData(iso)} <span style="font-weight:600;color:var(--text-muted);">· ${_DIAS_SEMANA_AULA[d.getDay()]}</span></span>
        <span style="font-size:11px;color:var(--text-muted);font-weight:600;">(${visiveis.length})</span>
        <div style="flex:1;height:1px;background:var(--border);"></div>
      </div>` : '';
    const avisoOcultas = ocultas > 0
      ? `<div style="font-size:11px;color:var(--text-muted);padding:2px 0 8px;">${ocultas} aula${ocultas > 1 ? 's' : ''} oculta${ocultas > 1 ? 's' : ''} pelos filtros ativos.</div>` : '';
    const corpo = visiveis.length
      ? `<div class="cal-aulas-cards">${visiveis.map(a => _aulaCardHtml(a, { detalhado: true })).join('')}</div>`
      : (todas.length ? '' : `<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Nenhuma aula nesse dia.</div>`);
    return `<div class="cal-aulas-grupo" data-iso="${iso}">${cabecalho}${corpo}${avisoOcultas}</div>`;
  }).join('');

  _aplicarLayoutGradeAulas();
}

// Compatibilidade: nome antigo da função de renderização da lista do dia
function _renderListaDiaCal() { _renderPainelAulasCal(); }

function calAulasBuscar(termo) {
  const lista = document.getElementById('cal-aulas-dia-lista');
  const label = document.getElementById('cal-aulas-dia-label');
  if (!lista || !label) return;
  const t = termo.trim().toLowerCase();
  if (!t) { _renderPainelAulasCal(); return; }
  label.textContent = 'Resultados da busca';
  const resultados = (aulasTurma || []).filter(a => {
    const nome = (a.nome || '').toLowerCase();
    const desc = (a.descricao || '').toLowerCase();
    const bncc = (_habilidadesTextoPorAula[a.id] || a.habilidade_bncc || '').toLowerCase();
    return nome.includes(t) || desc.includes(t) || bncc.includes(t);
  });
  if (!resultados.length) {
    lista.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Nenhuma aula encontrada.</div>`;
    return;
  }
  resultados.sort((x, y) => {
    const dx = dataAulaOnly(x.data), dy = dataAulaOnly(y.data);
    return dx < dy ? (aulasOrdemDesc ? 1 : -1) : dx > dy ? (aulasOrdemDesc ? -1 : 1) : 0;
  });
  lista.innerHTML = `<div class="cal-aulas-cards">${resultados.map(a => _aulaCardHtml(a, { detalhado: true })).join('')}</div>`;
  _aplicarLayoutGradeAulas();
}

// ═══════════════════════════════════════════════════════════════════════════
// SELETOR MÚLTIPLO DE HABILIDADES BNCC (lista suspensa com busca + caixas)
// Usado no painel "Nova aula" do calendário: no modo "Mesmo conteúdo" e em cada
// data do modo "Individual por data". As opções vêm do cache de
// habilidades_planejamento (_habilidadesAulaCarregarCache). Ao digitar, a lista
// é filtrada por código ou descrição (sem diferenciar acentos/maiúsculas); cada
// item tem uma caixa de seleção e a lista continua aberta para marcar várias.
// Teclado: ↓/↑ navegam, Enter marca/desmarca, Esc fecha, Backspace remove a última.
// ═══════════════════════════════════════════════════════════════════════════
const BnccMultiSelect = (function () {
  const instancias = new Set();

  const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function injetarCss() {
    if (document.getElementById('bms-css')) return;
    const st = document.createElement('style');
    st.id = 'bms-css';
    st.textContent = `
      .bms{position:relative;width:100%;box-sizing:border-box;}
      .bms-box{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-height:40px;box-sizing:border-box;padding:5px 30px 5px 8px;background:#F8F6FF;border:1.5px solid var(--border);border-radius:8px;cursor:text;transition:border-color .2s;position:relative;}
      .bms.aberto .bms-box,.bms-box:focus-within{border-color:var(--purple);}
      .bms .bms-input{flex:1 1 90px;min-width:90px;width:auto;margin:0;padding:4px 2px;border:none;background:transparent;outline:none;box-shadow:none;font-family:'Sora',sans-serif;font-size:13px;color:var(--text);}
      .bms .bms-input:focus{border:none;}
      .bms-seta{position:absolute;right:9px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none;display:flex;transition:transform .15s;}
      .bms.aberto .bms-seta{transform:translateY(-50%) rotate(180deg);}
      .bms-chip{display:inline-flex;align-items:center;gap:6px;padding:3px 5px 3px 9px;border-radius:20px;background:#EEF2FF;color:#3B4FE4;font-size:11px;font-weight:700;font-family:'Space Mono',monospace;}
      .bms-chip button{border:none;background:none;color:#3B4FE4;cursor:pointer;padding:0;display:flex;align-items:center;}
      .bms-panel{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:60;background:var(--white);border:1.5px solid var(--border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);max-height:220px;overflow-y:auto;}
      .bms-panel[hidden]{display:none;}
      .bms-item{display:flex;align-items:flex-start;gap:10px;padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border);}
      .bms-item:last-child{border-bottom:none;}
      .bms-item:hover,.bms-item.ativo{background:#F0F4FF;}
      .bms-check{flex:0 0 16px;width:16px;height:16px;margin-top:1px;border:1.5px solid #B8C4EE;border-radius:4px;background:#fff;display:flex;align-items:center;justify-content:center;box-sizing:border-box;}
      .bms-check svg{display:none;}
      .bms-item[aria-selected="true"] .bms-check{background:var(--purple);border-color:var(--purple);}
      .bms-item[aria-selected="true"] .bms-check svg{display:block;}
      .bms-txt{min-width:0;flex:1;}
      .bms-cod{display:block;margin-bottom:2px;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:#3B4FE4;}
      .bms-desc{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;font-size:12px;line-height:1.4;color:var(--text);}
      .bms-msg{padding:12px;font-size:12px;line-height:1.5;color:var(--text-muted);}
    `;
    document.head.appendChild(st);
  }

  function montar(container, opcoes) {
    opcoes = opcoes || {};
    injetarCss();
    container.classList.add('bms');
    container.innerHTML = `
      <div class="bms-box">
        <span class="bms-chips" style="display:contents;"></span>
        <input type="text" class="bms-input" placeholder="${esc(opcoes.placeholder || 'Buscar código ou descrição...')}" autocomplete="off" role="combobox" aria-expanded="false" aria-label="Habilidades BNCC">
        <span class="bms-seta"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
      </div>
      <div class="bms-panel" role="listbox" aria-multiselectable="true" hidden></div>`;

    const box = container.querySelector('.bms-box');
    const chipsEl = container.querySelector('.bms-chips');
    const input = container.querySelector('.bms-input');
    const panel = container.querySelector('.bms-panel');

    let selecionadas = [];   // [{id, codigo, descricao}]
    let lista = null;        // habilidades cadastradas (null = ainda não carregou)
    let visiveis = [];       // habilidades listadas no momento (após o filtro)
    let ativo = -1;          // item destacado pelo teclado
    let aberto = false;
    let destruido = false;

    function renderChips() {
      chipsEl.innerHTML = selecionadas.map(h => `
        <span class="bms-chip">${esc(h.codigo)}
          <button type="button" data-rm="${esc(h.id)}" aria-label="Remover ${esc(h.codigo)}">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </span>`).join('');
    }

    function atualizarMarcas() {
      panel.querySelectorAll('.bms-item').forEach(it => {
        const marcada = selecionadas.some(h => String(h.id) === it.dataset.id);
        it.setAttribute('aria-selected', marcada ? 'true' : 'false');
      });
    }

    function renderLista() {
      if (lista === null) { visiveis = []; panel.innerHTML = '<div class="bms-msg">Carregando habilidades...</div>'; return; }
      if (!lista.length) {
        visiveis = [];
        panel.innerHTML = '<div class="bms-msg">Nenhuma habilidade cadastrada para esta turma. Cadastre em Planejamento → Plano de Curso e Habilidades.</div>';
        return;
      }
      const termo = input.value.trim();
      const q = norm(termo);
      visiveis = q ? lista.filter(h => norm(h.codigo).includes(q) || norm(h.descricao).includes(q)) : lista.slice();
      ativo = q && visiveis.length ? 0 : -1;
      if (!visiveis.length) {
        panel.innerHTML = `<div class="bms-msg">Nenhuma habilidade encontrada para "${esc(termo)}".</div>`;
        return;
      }
      panel.innerHTML = visiveis.map((h, i) => `
        <div class="bms-item${i === ativo ? ' ativo' : ''}" role="option" data-id="${esc(h.id)}" aria-selected="${selecionadas.some(s => String(s.id) === String(h.id))}">
          <span class="bms-check"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
          <span class="bms-txt"><span class="bms-cod">${esc(h.codigo || '—')}</span><span class="bms-desc">${esc(h.descricao)}</span></span>
        </div>`).join('');
    }

    function realcar(novo) {
      if (!visiveis.length) return;
      ativo = Math.max(0, Math.min(novo, visiveis.length - 1));
      panel.querySelectorAll('.bms-item').forEach((it, i) => it.classList.toggle('ativo', i === ativo));
      const el = panel.querySelectorAll('.bms-item')[ativo];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }

    function alternar(id) {
      const sid = String(id);
      const idx = selecionadas.findIndex(h => String(h.id) === sid);
      if (idx >= 0) {
        selecionadas.splice(idx, 1);
      } else {
        const h = (lista || []).find(x => String(x.id) === sid);
        if (!h) return;
        selecionadas.push({ id: h.id, codigo: h.codigo, descricao: h.descricao });
      }
      renderChips();
      atualizarMarcas();
    }

    function remover(id) {
      const sid = String(id);
      selecionadas = selecionadas.filter(h => String(h.id) !== sid);
      renderChips();
      atualizarMarcas();
    }

    async function abrir() {
      if (aberto || destruido) return;
      aberto = true;
      container.classList.add('aberto');
      input.setAttribute('aria-expanded', 'true');
      panel.hidden = false;
      renderLista();
      panel.scrollIntoView({ block: 'nearest' });
      // Sempre relê do cache compartilhado: reflete habilidades recém-cadastradas
      try { lista = await _habilidadesAulaCarregarCache(); } catch (_) { lista = lista || []; }
      if (destruido || !aberto) return;
      renderLista();
      panel.scrollIntoView({ block: 'nearest' });
    }

    function fechar() {
      if (!aberto) return;
      aberto = false;
      container.classList.remove('aberto');
      input.setAttribute('aria-expanded', 'false');
      panel.hidden = true;
      input.value = '';
    }

    // ── Eventos ──────────────────────────────────────────────────────────────
    box.addEventListener('click', e => {
      if (e.target.closest('[data-rm]')) return;
      input.focus();
      abrir();
    });
    chipsEl.addEventListener('click', e => {
      const b = e.target.closest('[data-rm]');
      if (!b) return;
      e.stopPropagation();
      remover(b.dataset.rm);
    });
    panel.addEventListener('click', e => {
      const it = e.target.closest('.bms-item');
      if (!it) return;
      alternar(it.dataset.id);
      input.focus();
    });
    input.addEventListener('focus', abrir);
    input.addEventListener('input', () => { if (!aberto) abrir(); else renderLista(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (!aberto) abrir(); else realcar(ativo + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (aberto) realcar(ativo - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (aberto && visiveis[ativo]) alternar(visiveis[ativo].id); }
      else if (e.key === 'Escape') { if (aberto) { e.preventDefault(); e.stopPropagation(); fechar(); } }
      else if (e.key === 'Tab') { fechar(); }
      else if (e.key === 'Backspace' && !input.value && selecionadas.length) { remover(selecionadas[selecionadas.length - 1].id); }
    });

    const api = {
      el: container,
      fechar,
      getSelecionadas: () => selecionadas.map(h => ({ ...h })),
      setSelecionadas(arr) {
        selecionadas = (arr || []).map(h => ({ id: h.id, codigo: h.codigo, descricao: h.descricao }));
        renderChips();
        atualizarMarcas();
      },
      limpar() { selecionadas = []; renderChips(); atualizarMarcas(); input.value = ''; fechar(); },
      destruir() { destruido = true; instancias.delete(api); container.innerHTML = ''; container.classList.remove('bms', 'aberto'); },
    };
    instancias.add(api);
    renderChips();
    return api;
  }

  // Fecha a lista ao clicar fora (captura: roda antes dos handlers dos itens)
  document.addEventListener('click', e => {
    instancias.forEach(i => {
      if (!document.body.contains(i.el)) { instancias.delete(i); return; }
      if (!i.el.contains(e.target)) i.fechar();
    });
  }, true);

  return { montar };
})();
window.BnccMultiSelect = BnccMultiSelect;

let _nacMesmoBncc = null; // seletor do modo "Mesmo conteúdo"
let _nacIndBncc = {};     // iso -> seletor de cada data (modo "Individual por data")

function _nacLimparSeletoresIndividual() {
  Object.values(_nacIndBncc).forEach(s => s.destruir());
  _nacIndBncc = {};
}

let _nacEditandoId = null;            // aula em edição no painel (null = criando)
let _nacEditandoTemColunaPlano = false;

// Volta o painel ao modo "Nova aula" (e limpa o que veio de uma edição)
function _nacSairModoEdicao() {
  const estavaEditando = _nacEditandoId !== null;
  _nacEditandoId = null;
  _nacEditandoTemColunaPlano = false;
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  set('painel-nova-aula-titulo', el => el.textContent = 'Nova aula');
  set('painel-nova-aula-modos', el => el.style.display = 'flex');
  set('nac-campo-disciplina', el => el.style.display = 'none');
  set('btn-salvar-nova-aula-cal', el => el.textContent = 'Criar aula');
  if (estavaEditando) {
    set('nac-tema', el => el.value = '');
    set('nac-conteudo', el => el.value = '');
    set('nac-disciplina', el => el.value = '');
  }
}

function abrirPainelNovaAulaCal() {
  _nacSairModoEdicao();
  if (_calAulasCliqueTimer) { clearTimeout(_calAulasCliqueTimer); _calAulasCliqueTimer = null; _calAulasCliqueIso = null; }
  _calAulasDatasNovaAula = [..._calAulasDatasSel].sort();
  _calAulasModo = 'mesmo';
  document.getElementById('cal-aulas-busca-wrap').style.display = 'none';
  document.getElementById('cal-aulas-dia-header').style.display = 'none';
  document.getElementById('cal-aulas-datas-sel').style.display = 'none';
  document.getElementById('cal-aulas-dia-lista').style.display = 'none';
  document.getElementById('painel-nova-aula-cal').style.display = 'flex';
  document.getElementById('painel-nova-aula-alert').style.display = 'none';
  setModoNovaAulaCal('mesmo');
  renderCalendarioAulas();
  _renderChipsNovaAulaCal();

  // Seletor de habilidades BNCC: monta uma vez e começa sempre vazio. O formulário
  // individual é zerado para não herdar o que ficou de uma criação anterior.
  const boxMesmo = document.getElementById('nac-bncc-box');
  if (boxMesmo) {
    if (!_nacMesmoBncc || _nacMesmoBncc.el !== boxMesmo) _nacMesmoBncc = BnccMultiSelect.montar(boxMesmo);
    _nacMesmoBncc.limpar();
  }
  _nacLimparSeletoresIndividual();
  const formInd = document.getElementById('painel-nova-aula-form-individual');
  if (formInd) formInd.innerHTML = '';

  // Plano de aula do modo "Mesmo conteúdo": sempre começa sem plano
  PlanoVinculoAula.preencherSelect(document.getElementById('nac-plano'), '', true);
}

// Modo "Mesmo conteúdo": escolheu um plano → preenche tema e habilidades do painel
window.nacPlanoMesmoAlterado = async function (sel) {
  const id = sel?.value || '';
  if (!id) return;
  let dados = null;
  try { dados = await PlanoVinculoAula.dadosDoPlano(id); }
  catch (e) { console.error('[PLANO↔AULA] Erro ao ler o plano:', e); }
  if (sel.value !== id || !dados) return;
  if (dados.tema) document.getElementById('nac-tema').value = dados.tema;
  if (dados.habilidades.length && _nacMesmoBncc) _nacMesmoBncc.setSelecionadas(dados.habilidades);
  PlanoVinculoAula.avisar(dados);
};

// Modo "Individual por data": plano escolhido em um card preenche só aquele card
async function _nacPlanoIndividualAlterado(card, sel) {
  const id = sel?.value || '';
  if (!id) return;
  let dados = null;
  try { dados = await PlanoVinculoAula.dadosDoPlano(id); }
  catch (e) { console.error('[PLANO↔AULA] Erro ao ler o plano:', e); }
  if (sel.value !== id || !dados) return;
  const iso = card.dataset.iso;
  if (dados.tema) card.querySelector('.nac-ind-tema').value = dados.tema;
  if (dados.habilidades.length && _nacIndBncc[iso]) _nacIndBncc[iso].setSelecionadas(dados.habilidades);
  PlanoVinculoAula.avisar(dados);
}

function fecharPainelNovaAulaCal() {
  _nacSairModoEdicao();
  document.getElementById('painel-nova-aula-cal').style.display = 'none';
  document.getElementById('cal-aulas-busca-wrap').style.display = 'block';
  document.getElementById('cal-aulas-dia-header').style.display = 'flex';
  document.getElementById('cal-aulas-dia-lista').style.display = 'flex';
  _calAulasDatasNovaAula = [];
  if (_nacMesmoBncc) _nacMesmoBncc.limpar();
  _nacLimparSeletoresIndividual();
  _calAulasAjustarMes(_calAulasContexto()); // filtros voltam a valer ao fechar o painel
  renderCalendarioAulas();
  _renderPainelAulasCal();
}

// Editar aula: usa o mesmo painel de "Nova aula", já preenchido com a aula
async function abrirPainelEditarAulaCal(aula) {
  if (!aula) return;
  abrirPainelNovaAulaCal(); // abre e zera o painel
  const iso = dataAulaOnly(aula.data);
  _nacEditandoId = aula.id;
  _nacEditandoTemColunaPlano = Object.prototype.hasOwnProperty.call(aula, 'plano_doc_id');
  _calAulasDatasNovaAula = iso ? [iso] : [];
  if (iso) _calAulasRef = new Date(parseInt(iso.slice(0, 4)), parseInt(iso.slice(5, 7)) - 1, 1);

  document.getElementById('painel-nova-aula-titulo').textContent = 'Editar aula';
  document.getElementById('painel-nova-aula-modos').style.display = 'none';
  document.getElementById('btn-salvar-nova-aula-cal').textContent = 'Salvar alterações';
  setModoNovaAulaCal('mesmo');

  document.getElementById('nac-tema').value = aula.nome || '';
  document.getElementById('nac-conteudo').value = aula.descricao || '';
  PlanoVinculoAula.preencherSelect(document.getElementById('nac-plano'), aula.plano_doc_id ?? '', true);

  const campoDisc = document.getElementById('nac-campo-disciplina');
  const selDisc = document.getElementById('nac-disciplina');
  if (campoDisc && selDisc && isFundamentalI()) {
    campoDisc.style.display = 'block';
    selDisc.innerHTML = '<option value="">Selecione a disciplina...</option>' +
      (_disciplinasAulasFundI || []).map(d => `<option value="${d}"${aula.disciplina === d ? ' selected' : ''}>${d}</option>`).join('');
  }

  renderCalendarioAulas();
  _renderChipsNovaAulaCal();
  document.getElementById('painel-nova-aula-cal')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

  // Habilidades BNCC já vinculadas à aula
  try {
    const rows = await api(`aula_habilidades?aula_id=eq.${aula.id}&select=habilidade_id,habilidades_planejamento(id,codigo,descricao)`) || [];
    const hs = rows.map(r => r.habilidades_planejamento).filter(Boolean)
      .map(h => ({ id: h.id, codigo: h.codigo, descricao: h.descricao }));
    if (_nacEditandoId === aula.id && _nacMesmoBncc) _nacMesmoBncc.setSelecionadas(hs);
  } catch (e) {
    console.error('[AULAS] Erro ao carregar habilidades da aula:', e);
  }
}
window.abrirPainelEditarAulaCal = abrirPainelEditarAulaCal;

async function salvarEdicaoAulaCal() {
  const alertEl = document.getElementById('painel-nova-aula-alert');
  alertEl.style.display = 'none';
  const id = _nacEditandoId;
  const iso = _calAulasDatasNovaAula[0];
  const tema = document.getElementById('nac-tema').value.trim();
  const descricao = document.getElementById('nac-conteudo').value.trim();
  if (!iso) { alertEl.textContent = 'Marque a data da aula no calendário.'; alertEl.style.display = 'block'; return; }
  if (!tema) { alertEl.textContent = 'Informe o tema da aula.'; alertEl.style.display = 'block'; return; }

  const btn = document.getElementById('btn-salvar-nova-aula-cal');
  btn.disabled = true;
  btn.textContent = 'Salvando...';
  try {
    const tri = detectarTrimestreAtual().tri;
    if (await verificarBloqueio(tri)) return;

    const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
    const body = {
      data: iso,
      nome: tema,
      descricao,
      status: calcularStatusAuto(iso, id),
      turma_id: turmaAtiva.id,
      turma_disciplina_id: turmaDisciplinaAtiva?.id || null,
      professor_id: profData.id,
    };
    if (isFundamentalI()) {
      const disc = document.getElementById('nac-disciplina')?.value || null;
      if (disc) body.disciplina = disc;
    }
    const planoSel = document.getElementById('nac-plano')?.value || '';
    if (planoSel) body.plano_doc_id = planoSel;
    else if (_nacEditandoTemColunaPlano) body.plano_doc_id = null;

    const atualizadas = await api(`aulas?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    if (!atualizadas?.length) throw new Error('A aula não foi encontrada ou você não tem permissão para alterá-la.');
    const idx = aulasTurma.findIndex(a => String(a.id) === String(id));
    if (idx !== -1) aulasTurma[idx] = { ...aulasTurma[idx], ...body };

    await _salvarVinculosHabilidadesAula(id, _nacMesmoBncc ? _nacMesmoBncc.getSelecionadas() : []);
    await _carregarHabilidadesTextoPorAula();
    cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);

    _calAulasDatasSel = [iso];
    _calAulasDiaSel = iso;
    fecharPainelNovaAulaCal();
    renderListaAulas();
    atualizarContadorAulas();
    if (typeof mostrarToast === 'function') mostrarToast('Aula salva com sucesso!');
  } catch (e) {
    alertEl.textContent = `Erro ao salvar: ${PlanoVinculoAula.mensagemErro(e)}`;
    alertEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = _nacEditandoId ? 'Salvar alterações' : 'Criar aula';
  }
}

function _renderChipsNovaAulaCal() {
  const wrap = document.getElementById('painel-nova-aula-chips');
  if (!wrap) return;
  if (!_calAulasDatasNovaAula.length) {
    wrap.innerHTML = `<span style="font-size:11px;color:var(--text-muted);">${_nacEditandoId ? 'Clique em um dia do calendário para definir a data.' : 'Clique nos dias do calendário para marcar as datas.'}</span>`;
    return;
  }
  wrap.innerHTML = _calAulasDatasNovaAula.map(iso => {
    const [, mes, dia] = iso.split('-');
    return `<span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;background:#EDE8FF;color:var(--purple);">${dia} ${MESES_PT[parseInt(mes)-1].slice(0,3).toLowerCase()}</span>`;
  }).join('');
}

function setModoNovaAulaCal(modo) {
  _calAulasModo = modo;
  const btnMesmo = document.getElementById('btn-modo-mesmo-conteudo');
  const btnInd = document.getElementById('btn-modo-individual');
  const formMesmo = document.getElementById('painel-nova-aula-form-mesmo');
  const formInd = document.getElementById('painel-nova-aula-form-individual');
  if (modo === 'mesmo') {
    btnMesmo.style.background = 'var(--purple)'; btnMesmo.style.color = '#fff'; btnMesmo.style.fontWeight = '700';
    btnInd.style.background = 'none'; btnInd.style.color = 'var(--text-muted)'; btnInd.style.fontWeight = '600';
    formMesmo.style.display = 'flex';
    formInd.style.display = 'none';
  } else {
    btnInd.style.background = 'var(--purple)'; btnInd.style.color = '#fff'; btnInd.style.fontWeight = '700';
    btnMesmo.style.background = 'none'; btnMesmo.style.color = 'var(--text-muted)'; btnMesmo.style.fontWeight = '600';
    formInd.style.display = 'flex';
    formMesmo.style.display = 'none';
    _renderFormNovaAulaCal();
  }
}

function _renderFormNovaAulaCal() {
  if (_calAulasModo !== 'individual') return;
  const wrap = document.getElementById('painel-nova-aula-form-individual');
  if (!wrap) return;
  // Guarda o que já foi preenchido para não perder ao marcar/desmarcar datas
  // ou ao alternar entre "Mesmo conteúdo" e "Individual por data".
  const estado = {};
  wrap.querySelectorAll('[data-iso]').forEach(card => {
    const iso = card.dataset.iso;
    estado[iso] = {
      tema: card.querySelector('.nac-ind-tema')?.value || '',
      conteudo: card.querySelector('.nac-ind-conteudo')?.value || '',
      habilidades: _nacIndBncc[iso] ? _nacIndBncc[iso].getSelecionadas() : [],
      plano: card.querySelector('.nac-ind-plano')?.value || '',
    };
  });
  _nacLimparSeletoresIndividual();

  if (!_calAulasDatasNovaAula.length) {
    wrap.innerHTML = `<span style="font-size:11px;color:var(--text-muted);">Marque ao menos uma data.</span>`;
    return;
  }

  // Cada campo fica dentro de .field (+ label): é daí que vem o estilo dos
  // inputs do dashboard — sem esse wrapper os campos apareciam sem CSS.
  wrap.innerHTML = _calAulasDatasNovaAula.map(iso => `
    <div data-iso="${iso}" style="border:1.5px solid var(--border);border-radius:8px;padding:10px;">
      <p style="font-size:12px;font-weight:700;color:var(--text);margin:0 0 8px;">${_formatarDataLabel(iso)}</p>
      <div class="field" style="margin-bottom:8px;">
        <label style="font-size:11px;">Plano de aula <span style="font-weight:400;color:var(--text-muted);">(opcional)</span></label>
        <select class="nac-ind-plano" style="width:100%;box-sizing:border-box;"><option value="">Sem plano vinculado</option></select>
      </div>
      <div class="field" style="margin-bottom:8px;">
        <label style="font-size:11px;">Tema</label>
        <input class="nac-ind-tema" placeholder="Ex: Revolução Industrial" style="width:100%;box-sizing:border-box;">
      </div>
      <div class="field" style="margin-bottom:8px;">
        <label style="font-size:11px;">Conteúdo</label>
        <textarea class="nac-ind-conteudo" rows="2" placeholder="Conteúdos, estratégias, recursos..."
          style="width:100%;padding:9px 10px;background:#F8F6FF;border:1.5px solid var(--border);border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;color:var(--text);outline:none;resize:vertical;box-sizing:border-box;"></textarea>
      </div>
      <div class="field" style="margin-bottom:0;">
        <label style="font-size:11px;">Habilidade BNCC <span style="font-weight:400;color:var(--text-muted);">(opcional)</span></label>
        <div class="nac-ind-bncc-box"></div>
      </div>
    </div>
  `).join('');

  wrap.querySelectorAll('[data-iso]').forEach(card => {
    const iso = card.dataset.iso;
    const seletor = BnccMultiSelect.montar(card.querySelector('.nac-ind-bncc-box'));
    _nacIndBncc[iso] = seletor;
    const anterior = estado[iso];
    if (anterior) {
      card.querySelector('.nac-ind-tema').value = anterior.tema;
      card.querySelector('.nac-ind-conteudo').value = anterior.conteudo;
      seletor.setSelecionadas(anterior.habilidades);
    }
    const selPlano = card.querySelector('.nac-ind-plano');
    selPlano.addEventListener('change', () => _nacPlanoIndividualAlterado(card, selPlano));
    PlanoVinculoAula.preencherSelect(selPlano, anterior ? anterior.plano : '', false);
  });
}

async function salvarNovaAulaCal() {
  if (_nacEditandoId) return salvarEdicaoAulaCal();
  const alertEl = document.getElementById('painel-nova-aula-alert');
  alertEl.style.display = 'none';
  if (!_calAulasDatasNovaAula.length) {
    alertEl.textContent = 'Marque ao menos uma data no calendário.';
    alertEl.style.display = 'block';
    return;
  }
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const btn = document.getElementById('btn-salvar-nova-aula-cal');
  const bodies = [];
  const habilidadesPorIndice = []; // mesmo índice de bodies — vinculadas após o insert

  if (_calAulasModo === 'mesmo') {
    const tema = document.getElementById('nac-tema').value.trim();
    const conteudo = document.getElementById('nac-conteudo').value.trim();
    const habilidades = _nacMesmoBncc ? _nacMesmoBncc.getSelecionadas() : [];
    const planoId = document.getElementById('nac-plano')?.value || '';
    if (!tema) { alertEl.textContent = 'Informe o tema da aula.'; alertEl.style.display = 'block'; return; }
    _calAulasDatasNovaAula.forEach(iso => {
      bodies.push({
        data: iso, nome: tema, descricao: conteudo, status: 'pendente',
        turma_id: turmaAtiva.id, turma_disciplina_id: turmaDisciplinaAtiva?.id || null,
        professor_id: profData.id,
        ...(planoId ? { plano_doc_id: planoId } : {})
      });
      habilidadesPorIndice.push(habilidades);
    });
  } else {
    const cards = document.querySelectorAll('#painel-nova-aula-form-individual [data-iso]');
    let algumVazio = false;
    cards.forEach(card => {
      const iso = card.dataset.iso;
      const tema = card.querySelector('.nac-ind-tema').value.trim();
      const conteudo = card.querySelector('.nac-ind-conteudo').value.trim();
      const habilidades = _nacIndBncc[iso] ? _nacIndBncc[iso].getSelecionadas() : [];
      const planoId = card.querySelector('.nac-ind-plano')?.value || '';
      if (!tema) { algumVazio = true; return; }
      bodies.push({
        data: iso, nome: tema, descricao: conteudo, status: 'pendente',
        turma_id: turmaAtiva.id, turma_disciplina_id: turmaDisciplinaAtiva?.id || null,
        professor_id: profData.id,
        ...(planoId ? { plano_doc_id: planoId } : {})
      });
      habilidadesPorIndice.push(habilidades);
    });
    if (algumVazio || !bodies.length) {
      alertEl.textContent = 'Informe o tema de cada data.';
      alertEl.style.display = 'block';
      return;
    }
  }

  btn.disabled = true;
  btn.textContent = 'Criando...';
  try {
    const res = await api('aulas', { method: 'POST', body: JSON.stringify(bodies) }) || [];
    const novas = res.length ? res : bodies.map((b, i) => ({ ...b, id: `${Date.now()}_${i}` }));
    novas.forEach(n => { aulasTurma.push(n); chamadaCacheSet(n.id, false); });

    // Vincula as habilidades BNCC escolhidas no seletor (opcional)
    for (let i = 0; i < novas.length; i++) {
      const escolhidas = habilidadesPorIndice[i] || [];
      if (escolhidas.length) {
        await api('aula_habilidades', {
          method: 'POST',
          body: JSON.stringify(escolhidas.map(h => ({ aula_id: novas[i].id, habilidade_id: h.id }))),
        });
      }
    }
    await _carregarHabilidadesTextoPorAula();

    cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
    if (typeof mostrarToastAula === 'function') mostrarToastAula(novas.length);
    else if (typeof mostrarToast === 'function') mostrarToast(`${novas.length} aula(s) criada(s)!`);
    fecharPainelNovaAulaCal();
    renderCalendarioAulas();
    renderListaAulas();
    atualizarContadorAulas();
  } catch (e) {
    alertEl.textContent = /plano_doc_id/i.test(String(e?.message || ''))
      ? `Erro ao criar aula(s): ${PlanoVinculoAula.mensagemErro(e)}`
      : 'Erro ao criar aula(s). Tente novamente.';
    alertEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Criar aula';
  }
}

// Inicializa o calendário assim que a lista de aulas é (re)carregada
(function _hookCalendarioAulas() {
  const _origCarregarAulas = carregarAulas;
  carregarAulas = async function(...args) {
    await _origCarregarAulas.apply(this, args);
    if (!_calAulasInicializado) {
      _calAulasInicializado = true;
      const hoje = new Date();
      _calAulasDiaSel = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
      _calAulasDatasSel = [_calAulasDiaSel];
    }
    renderCalendarioAulas();
    _renderPainelAulasCal();
  };
  window.carregarAulas = carregarAulas;
})();
