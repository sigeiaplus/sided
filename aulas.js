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
  renderListaAulas();
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
  renderListaAulas();
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
  renderListaAulas();
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

function toggleOrdemAulas() {
  aulasOrdemDesc = !aulasOrdemDesc;
  const ico = document.getElementById('ico-ordem-aulas');
  const label = document.getElementById('label-ordem-aulas');
  const btn = document.getElementById('btn-ordem-aulas');
  if (aulasOrdemDesc) {
    ico.innerHTML = '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 19 19 12"/>';
    label.textContent = 'Mais recente';
    btn.style.borderColor = 'var(--border)';
    btn.style.color = 'var(--text)';
  } else {
    ico.innerHTML = '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>';
    label.textContent = 'Mais antigo';
    btn.style.borderColor = 'var(--purple)';
    btn.style.color = 'var(--purple)';
  }
  renderListaAulas();
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
  renderListaAulas();
  atualizarContadorAulas();
}

function renderListaAulas() {
  let lista = [...aulasTurma];

  if (aulasTriFiltro && aulasTriFiltro !== 'todos') {
    lista = lista.filter(a => trimestreDeAula(a.data) === parseInt(aulasTriFiltro));
  }
  if (aulasTipoFiltro && aulasTipoFiltro !== 'todos') {
    lista = lista.filter(a => {
      const tc = chamadaCacheGet(a.id);
      const se = a.status === 'futura' ? 'futura'
        : tc === true ? 'lecionada'
        : tc === false ? 'pendente'
        : a.status;
      return se === aulasTipoFiltro;
    });
  }
  if (aulasDiscFiltro) {
    lista = lista.filter(a => a.disciplina === aulasDiscFiltro);
  }
  if (aulasDiaSemFiltro !== null) {
    lista = lista.filter(a => {
      const iso = dataAulaOnly(a.data);
      if (!iso) return false;
      return new Date(iso + 'T12:00:00').getDay() === aulasDiaSemFiltro;
    });
  }

  lista.sort((a, b) => {
    const da = dataAulaOnly(a.data), db = dataAulaOnly(b.data);
    if (da < db) return aulasOrdemDesc ? 1 : -1;
    if (da > db) return aulasOrdemDesc ? -1 : 1;
    return 0;
  });

  const nomesTri = {1:'1º Tri', 2:'2º Tri', 3:'3º Tri'};
  const diasSem = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];

  function _card(a) {
    const tri = trimestreDeAula(a.data);
    const triBadge = tri ? `<span style="font-size:10px;font-weight:700;color:var(--orange);background:#FFF0E6;padding:2px 7px;border-radius:20px;">${nomesTri[tri]}</span>` : '';
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
      diaSem = diasSem[d.getDay()] || '';
    }

    const badgeCfg = {
      pendente:  { bg:'#FF8C38', label:'Chamada pendente' },
      lecionada: { bg:'#22C55E', label:'Frequência registrada' },
      futura:    { bg:'#3B82F6', label:'Aula futura' },
    };
    const statusEfetivo = a.status === 'futura' ? 'futura'
      : temChamada === true ? 'lecionada'
      : temChamada === false ? 'pendente'
      : a.status;
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

    const cardClick = modoSelecaoAulas ? `onclick="toggleSelecaoAula('${a.id}')"` : `onclick="abrirChamadaDeAula('${a.id}')"`;

    return `<div class="aula-card${selecionada ? ' selecionada' : ''}" ${cardClick}
      style="background:var(--white);border:1.5px solid var(--border);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all 0.15s;margin-bottom:8px;${selecionada ? 'border-color:var(--purple);background:#F8F6FF;' : ''}">
      ${checkboxHtml}
      <div class="aula-card-info" style="flex:1;min-width:0;">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">${diaSem}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:14px;font-weight:700;color:var(--text);">${dataFmt}</span>
          <span style="font-size:13px;color:var(--purple);font-weight:600;">${a.nome}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">
          ${triBadge}${chamadaTag}
        </div>
      </div>
      <span class="aula-card-status" style="background:${bc.bg};color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;white-space:nowrap;flex-shrink:0;">${bc.label}</span>
      ${acoesBtns}
    </div>`;
  }

  const grupos = { pendente: [], lecionada: [], futura: [] };
  lista.forEach(a => {
    const temChamada = chamadaCacheGet(a.id);
    const statusEfetivo = a.status === 'futura' ? 'futura'
      : temChamada === true ? 'lecionada'
      : temChamada === false ? 'pendente'
      : a.status;
    if (grupos[statusEfetivo]) grupos[statusEfetivo].push(a);
    else grupos['futura'].push(a);
  });

  const titulosGrupo = { pendente: 'Aulas pendentes', lecionada: 'Aulas lecionadas', futura: 'Aulas futuras' };
  const coresGrupo = { pendente: '#F59E0B', lecionada: '#22C55E', futura: '#3B82F6' };

  let html = '';
  const tiposFiltrados = (aulasTipoFiltro !== 'todos') ? [aulasTipoFiltro] : ['pendente','lecionada','futura'];

  tiposFiltrados.forEach(tipo => {
    const grupo = grupos[tipo] || [];
    if (grupo.length === 0) return;
    html += `<div style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${coresGrupo[tipo]};flex-shrink:0;"></div>
        <span style="font-size:13px;font-weight:700;color:var(--text);">${titulosGrupo[tipo]}</span>
        <span style="font-size:11px;color:var(--text-muted);font-weight:600;">(${grupo.length})</span>
        <div style="flex:1;height:1px;background:var(--border);"></div>
      </div>
      ${grupo.map(a => _card(a)).join('')}
    </div>`;
  });

  if (!html) {
    html = `<div style="text-align:center;padding:40px 20px;color:var(--text-muted);font-size:13px;">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="margin-bottom:12px;opacity:0.4;display:block;margin-inline:auto;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      Nenhuma aula encontrada com esse filtro.
    </div>`;
  }

  document.getElementById('aulas-list').innerHTML = html;
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

const _renderListaAulasOriginal = renderListaAulas;
renderListaAulas = function() {
  _renderListaAulasOriginal();
  if (_layoutAulas === 'grade') _aplicarLayoutGradeAulas();
};

function _aplicarLayoutGradeAulas() {
  const el = document.getElementById('aulas-list');
  if (!el) return;
  el.querySelectorAll('.aula-card').forEach(card => {
    const parent = card.parentElement;
    if (parent && !parent.dataset.gradeAplicada) {
      parent.style.display = 'grid';
      parent.style.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))';
      parent.style.gap = '10px';
      parent.dataset.gradeAplicada = '1';
    }
    card.style.flexDirection = 'column';
    card.style.alignItems = 'flex-start';
    card.style.minHeight = '110px';
  });
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
    abrirModalAula(aula);
  } else {
    api(`aulas?id=eq.${aulaId}&select=*`).then(res => {
      if (res && res[0]) abrirModalAula(res[0]);
    });
  }
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
    cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
    fecharModal('modal-aula');
    renderListaAulas();
    atualizarContadorAulas();
    atualizarCalendario('cal-aula');
    if (typeof mostrarToast === 'function') mostrarToast('Aula salva com sucesso!');
  } catch (e) {
    alEl.textContent = `Erro ao salvar: ${e?.message || 'Tente novamente.'}`;
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
let _calAulasDiaSel = null;      // 'YYYY-MM-DD' do dia clicado no calendário
let _calAulasDatasNovaAula = []; // datas marcadas p/ criar aula, quando painel aberto
let _calAulasModo = 'mesmo';     // 'mesmo' | 'individual'

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

  // Garante que o calendário escolar (feriados/recessos) esteja carregado
  if (!feriadosCache.length) {
    const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
    const escolaId = profData.escolas?.id || profData.escola_id;
    if (escolaId) {
      feriadosCache = await api(`calendario_escolar?escola_id=eq.${escolaId}&select=*`) || [];
    }
  }

  const ano = _calAulasRef.getFullYear();
  const mes = _calAulasRef.getMonth();
  label.textContent = `${MESES_PT[mes]} ${ano}`;

  const statusPorData = _calAulasStatusPorData();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  let html = ['D','S','T','Q','Q','S','S'].map(d =>
    `<span style="font-size:10px;font-weight:700;color:var(--text-muted);">${d}</span>`
  ).join('');

  for (let i = 0; i < primeiroDiaSemana; i++) html += '<span></span>';

  for (let dia = 1; dia <= totalDias; dia++) {
    const iso = `${ano}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    const st = statusPorData[iso];
    const selecionado = _calAulasDiaSel === iso;
    const marcado = _calAulasDatasNovaAula.includes(iso);
    const evento = _calAulasEventoDoDia(iso);
    let bg = 'transparent', color = 'var(--text)', titulo = '';
    // Aula lançada tem prioridade visual; senão, mostra feriado/recesso do calendário escolar
    if (st?.lecionada) { bg = '#DCFCE7'; color = '#166534'; }
    else if (st?.pendente) { bg = '#FEF3C7'; color = '#92400E'; }
    else if (evento?.tipo === 'recesso') { bg = '#E5E7EB'; color = '#4B5563'; titulo = `Recesso — ${evento.descricao || ''}`; }
    else if (evento?.tipo === 'feriado_municipal' || evento?.tipo === 'feriado_estadual') { bg = '#FEE2E2'; color = '#DC2626'; titulo = `Feriado — ${evento.descricao || ''}`; }
    let outline = '';
    if (marcado) outline = 'outline:2px solid var(--purple);outline-offset:-1px;';
    else if (selecionado) outline = 'box-shadow:0 0 0 1.5px var(--purple);';
    html += `<span onclick="calAulasClicarDia('${iso}')" title="${escHtmlAttr(titulo)}" style="cursor:pointer;font-size:11px;font-weight:600;padding:5px 0;border-radius:50%;background:${bg};color:${color};${outline}">${dia}</span>`;
  }

  grid.innerHTML = html;
}

function escHtmlAttr(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function calAulasMudarMes(delta) {
  _calAulasRef = new Date(_calAulasRef.getFullYear(), _calAulasRef.getMonth() + delta, 1);
  renderCalendarioAulas();
}

function calAulasClicarDia(iso) {
  const painelAberto = document.getElementById('painel-nova-aula-cal')?.style.display === 'flex';
  if (painelAberto) {
    const idx = _calAulasDatasNovaAula.indexOf(iso);
    if (idx === -1) _calAulasDatasNovaAula.push(iso);
    else _calAulasDatasNovaAula.splice(idx, 1);
    _calAulasDatasNovaAula.sort();
    renderCalendarioAulas();
    _renderChipsNovaAulaCal();
    _renderFormNovaAulaCal();
  } else {
    _calAulasDiaSel = iso;
    renderCalendarioAulas();
    _renderListaDiaCal(iso);
  }
}

function _formatarDataLabel(iso) {
  const [ano, mes, dia] = iso.split('-');
  return `${parseInt(dia)} de ${MESES_PT[parseInt(mes)-1].toLowerCase()}`;
}

function _renderListaDiaCal(iso) {
  const label = document.getElementById('cal-aulas-dia-label');
  const lista = document.getElementById('cal-aulas-dia-lista');
  if (!label || !lista) return;
  const busca = document.getElementById('cal-aulas-busca')?.value.trim();
  if (busca) return; // busca ativa tem prioridade sobre o dia selecionado
  label.textContent = iso ? _formatarDataLabel(iso) : 'Selecione um dia';
  const aulasDoDia = (aulasTurma || []).filter(a => {
    const d = a.data?.includes('T') ? a.data.split('T')[0] : a.data;
    return d === iso;
  });
  if (!aulasDoDia.length) {
    lista.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Nenhuma aula nesse dia.</div>`;
    return;
  }
  lista.innerHTML = aulasDoDia.map(a => {
    const bncc = _habilidadesTextoPorAula[a.id] || a.habilidade_bncc || '';
    return `
    <div onclick="editarAula('${a.id}')" style="cursor:pointer;padding:9px 11px;border-radius:8px;background:#F8F6FF;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">
        <span style="font-size:12px;font-weight:700;color:var(--text);min-width:0;overflow-wrap:anywhere;">${a.nome || 'Sem tema'}</span>
      </div>
      ${bncc ? `<div style="font-size:10px;color:var(--text-muted);margin-top:3px;overflow-wrap:anywhere;">${bncc}</div>` : ''}
    </div>`;
  }).join('');
}

function calAulasBuscar(termo) {
  const lista = document.getElementById('cal-aulas-dia-lista');
  const label = document.getElementById('cal-aulas-dia-label');
  if (!lista || !label) return;
  const t = termo.trim().toLowerCase();
  if (!t) {
    label.textContent = _calAulasDiaSel ? _formatarDataLabel(_calAulasDiaSel) : 'Selecione um dia';
    _renderListaDiaCal(_calAulasDiaSel);
    return;
  }
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
  lista.innerHTML = resultados.map(a => {
    const d = a.data?.includes('T') ? a.data.split('T')[0] : a.data;
    const bncc = _habilidadesTextoPorAula[a.id] || a.habilidade_bncc || '';
    return `
    <div onclick="editarAula('${a.id}')" style="cursor:pointer;padding:9px 11px;border-radius:8px;background:#F8F6FF;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;">
        <span style="font-size:12px;font-weight:700;color:var(--text);min-width:0;overflow-wrap:anywhere;">${a.nome || 'Sem tema'}</span>
        <span style="font-size:10px;color:var(--text-muted);white-space:nowrap;flex-shrink:0;">${d ? _formatarDataLabel(d) : ''}</span>
      </div>
      ${bncc ? `<div style="font-size:10px;color:var(--text-muted);margin-top:3px;overflow-wrap:anywhere;">${bncc}</div>` : ''}
    </div>`;
  }).join('');
}

function abrirPainelNovaAulaCal() {
  _calAulasDatasNovaAula = _calAulasDiaSel ? [_calAulasDiaSel] : [];
  _calAulasModo = 'mesmo';
  document.getElementById('cal-aulas-busca-wrap').style.display = 'none';
  document.getElementById('cal-aulas-dia-header').style.display = 'none';
  document.getElementById('cal-aulas-dia-lista').style.display = 'none';
  document.getElementById('painel-nova-aula-cal').style.display = 'flex';
  document.getElementById('painel-nova-aula-alert').style.display = 'none';
  setModoNovaAulaCal('mesmo');
  renderCalendarioAulas();
  _renderChipsNovaAulaCal();
}

function fecharPainelNovaAulaCal() {
  document.getElementById('painel-nova-aula-cal').style.display = 'none';
  document.getElementById('cal-aulas-busca-wrap').style.display = 'block';
  document.getElementById('cal-aulas-dia-header').style.display = 'flex';
  document.getElementById('cal-aulas-dia-lista').style.display = 'flex';
  _calAulasDatasNovaAula = [];
  renderCalendarioAulas();
  _renderListaDiaCal(_calAulasDiaSel);
}

function _renderChipsNovaAulaCal() {
  const wrap = document.getElementById('painel-nova-aula-chips');
  if (!wrap) return;
  if (!_calAulasDatasNovaAula.length) {
    wrap.innerHTML = `<span style="font-size:11px;color:var(--text-muted);">Clique nos dias do calendário para marcar as datas.</span>`;
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
  if (!_calAulasDatasNovaAula.length) {
    wrap.innerHTML = `<span style="font-size:11px;color:var(--text-muted);">Marque ao menos uma data.</span>`;
    return;
  }
  wrap.innerHTML = _calAulasDatasNovaAula.map(iso => `
    <div data-iso="${iso}" style="border:1.5px solid var(--border);border-radius:8px;padding:10px;">
      <p style="font-size:12px;font-weight:700;color:var(--text);margin:0 0 6px;">${_formatarDataLabel(iso)}</p>
      <input class="nac-ind-tema" placeholder="Tema" style="width:100%;box-sizing:border-box;margin-bottom:6px;">
      <textarea class="nac-ind-conteudo" rows="2" placeholder="Conteúdo, estratégias, recursos..."
        style="width:100%;padding:8px 10px;background:#F8F6FF;border:1.5px solid var(--border);border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;color:var(--text);outline:none;resize:vertical;box-sizing:border-box;margin-bottom:6px;"></textarea>
      <input class="nac-ind-bncc" placeholder="Código(s) BNCC, separados por vírgula (opcional)" style="width:100%;box-sizing:border-box;">
    </div>
  `).join('');
}

async function salvarNovaAulaCal() {
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
  const bnccTextoPorIndice = []; // mesmo índice de bodies — resolvido após o insert

  if (_calAulasModo === 'mesmo') {
    const tema = document.getElementById('nac-tema').value.trim();
    const conteudo = document.getElementById('nac-conteudo').value.trim();
    const bncc = document.getElementById('nac-bncc').value.trim();
    if (!tema) { alertEl.textContent = 'Informe o tema da aula.'; alertEl.style.display = 'block'; return; }
    _calAulasDatasNovaAula.forEach(iso => {
      bodies.push({
        data: iso, nome: tema, descricao: conteudo, status: 'pendente',
        turma_id: turmaAtiva.id, turma_disciplina_id: turmaDisciplinaAtiva?.id || null,
        professor_id: profData.id
      });
      bnccTextoPorIndice.push(bncc);
    });
  } else {
    const cards = document.querySelectorAll('#painel-nova-aula-form-individual [data-iso]');
    let algumVazio = false;
    cards.forEach(card => {
      const iso = card.dataset.iso;
      const tema = card.querySelector('.nac-ind-tema').value.trim();
      const conteudo = card.querySelector('.nac-ind-conteudo').value.trim();
      const bncc = card.querySelector('.nac-ind-bncc').value.trim();
      if (!tema) { algumVazio = true; return; }
      bodies.push({
        data: iso, nome: tema, descricao: conteudo, status: 'pendente',
        turma_id: turmaAtiva.id, turma_disciplina_id: turmaDisciplinaAtiva?.id || null,
        professor_id: profData.id
      });
      bnccTextoPorIndice.push(bncc);
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

    // Resolve e vincula habilidades BNCC informadas por código (opcional)
    for (let i = 0; i < novas.length; i++) {
      const idsHabilidades = await _resolverHabilidadesTextoParaIds(bnccTextoPorIndice[i]);
      if (idsHabilidades.length) {
        await api('aula_habilidades', {
          method: 'POST',
          body: JSON.stringify(idsHabilidades.map(id => ({ aula_id: novas[i].id, habilidade_id: id }))),
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
    alertEl.textContent = 'Erro ao criar aula(s). Tente novamente.';
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
    if (!_calAulasDiaSel) {
      const hoje = new Date();
      _calAulasDiaSel = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
    }
    renderCalendarioAulas();
    _renderListaDiaCal(_calAulasDiaSel);
  };
  window.carregarAulas = carregarAulas;
})();
