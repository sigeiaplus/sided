// ═════════════════════════════════════════════════════════════════════════════
// SIDED+ — Card "Habilidades BNCC" (Planejamento) + vínculo com várias aulas
// Reaproveita habilidades_planejamento (fonte) e aula_habilidades (vínculo N:N).
// Não altera schema de dados existentes. Carregado depois de planejamento.js.
// ═════════════════════════════════════════════════════════════════════════════
(function () {
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  let _tds = [];            // turma_disciplinas do professor (com turma.ano e disciplina)
  let _habs = [];           // habilidades_planejamento do professor (todas as tds)
  let _sel = [];            // habilidades selecionadas no card [{id,codigo,descricao,turma_disciplina_id}]
  let _aulasTd = [];        // aulas da turma_disciplina ativa
  let _vinculos = [];       // [{aula_id, habilidade_id}] da td ativa
  let _modalAulasSel = new Set();

  const profId = () => JSON.parse(sessionStorage.getItem('prof_data') || '{}').id;

  // ── Carga ────────────────────────────────────────────────────────────────
  async function iniciarCardHabilidadesBncc() {
    if (!document.getElementById('card-hab-bncc')) return;
    const pid = profId();
    if (!pid) return;
    try {
      _tds = await api(`turma_disciplinas?professor_id=eq.${pid}&select=id,turmas(id,nome,ano),disciplinas(id,nome)`) || [];
      const ids = _tds.map(t => t.id);
      _habs = ids.length
        ? await api(`habilidades_planejamento?turma_disciplina_id=in.(${ids.join(',')})&select=id,turma_disciplina_id,codigo,descricao,divisao_id,temas&order=codigo.asc&limit=1000`) || []
        : [];
    } catch (e) { console.error('[HAB BNCC] carga', e); _tds = []; _habs = []; }
    _sel = _sel.filter(s => _habs.some(h => String(h.id) === String(s.id)));
    _preencherFiltros();
    await _carregarAulasEVinculos();
    _renderChips();
    _renderVinculos();
  }

  async function _carregarAulasEVinculos() {
    const td = turmaDisciplinaAtiva?.id;
    try {
      _aulasTd = td
        ? await api(`aulas?turma_disciplina_id=eq.${td}&select=id,data,nome&order=data`) || []
        : await api(`aulas?turma_id=eq.${turmaAtiva?.id}&professor_id=eq.${profId()}&select=id,data,nome&order=data`) || [];
      const ids = _aulasTd.map(a => a.id);
      _vinculos = ids.length ? await api(`aula_habilidades?aula_id=in.(${ids.join(',')})&select=aula_id,habilidade_id`) || [] : [];
    } catch (e) { console.error('[HAB BNCC] aulas/vínculos', e); _aulasTd = []; _vinculos = []; }
  }

  // ── Filtros (componente + ano) ───────────────────────────────────────────
  function _preencherFiltros() {
    const selC = document.getElementById('hab-bncc-componente');
    const selA = document.getElementById('hab-bncc-ano');
    if (!selC || !selA) return;
    const comps = new Map(), anos = new Set();
    _tds.forEach(t => {
      if (t.disciplinas) comps.set(String(t.disciplinas.id), t.disciplinas.nome);
      if (t.turmas?.ano != null) anos.add(String(t.turmas.ano));
    });
    const compAtual = String(turmaDisciplinaAtiva?.disciplinas?.id ?? turmaDisciplinaAtiva?.disciplina_id ?? '');
    const anoAtual = String(turmaAtiva?.ano ?? '');
    selC.innerHTML = '<option value="">Todos os componentes</option>' +
      [...comps].sort((a, b) => a[1].localeCompare(b[1])).map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join('');
    selA.innerHTML = '<option value="">Todos os anos</option>' +
      [...anos].sort().map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
    if (comps.has(compAtual)) selC.value = compAtual;
    if (anos.has(anoAtual)) selA.value = anoAtual;
  }

  function _habilidadesFiltradas(termo) {
    const comp = document.getElementById('hab-bncc-componente')?.value || '';
    const ano = document.getElementById('hab-bncc-ano')?.value || '';
    const tdsOk = new Set(_tds.filter(t =>
      (!comp || String(t.disciplinas?.id) === comp) && (!ano || String(t.turmas?.ano) === ano)
    ).map(t => String(t.id)));
    const t = norm(termo);
    const vistos = new Map(); // dedupe por código (prefere a da td ativa)
    _habs.filter(h => tdsOk.has(String(h.turma_disciplina_id)))
      .filter(h => !t || norm(h.codigo).includes(t) || norm(h.descricao).includes(t))
      .forEach(h => {
        const k = norm(h.codigo);
        const ativa = String(h.turma_disciplina_id) === String(turmaDisciplinaAtiva?.id);
        if (!vistos.has(k) || ativa) vistos.set(k, h);
      });
    return [...vistos.values()].slice(0, 60);
  }

  // ── Combobox de busca ────────────────────────────────────────────────────
  window.habBnccBuscar = function (termo) {
    const dd = document.getElementById('hab-bncc-dropdown');
    if (!dd) return;
    const lista = _habilidadesFiltradas(termo).filter(h => !_sel.some(s => norm(s.codigo) === norm(h.codigo)));
    dd.innerHTML = lista.length
      ? lista.map(h => `<div class="hab-bncc-opt" onmousedown="habBnccAdicionar('${h.id}')" style="padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer;">
          <div style="font-family:'Space Mono',monospace;font-size:12px;font-weight:700;color:#3B4FE4;">${esc(h.codigo)}</div>
          <div style="font-size:12px;color:var(--text);line-height:1.45;margin-top:2px;">${esc(h.descricao)}</div></div>`).join('')
      : '<div style="padding:12px;font-size:12px;color:var(--text-muted);">Nenhuma habilidade encontrada para os filtros.</div>';
    dd.style.display = 'block';
  };
  window.habBnccFecharDropdown = function () {
    setTimeout(() => { const dd = document.getElementById('hab-bncc-dropdown'); if (dd) dd.style.display = 'none'; }, 150);
  };
  window.habBnccAdicionar = function (id) {
    const h = _habs.find(x => String(x.id) === String(id));
    if (!h || _sel.some(s => norm(s.codigo) === norm(h.codigo))) return;
    _sel.push({ id: h.id, codigo: h.codigo, descricao: h.descricao, turma_disciplina_id: h.turma_disciplina_id, divisao_id: h.divisao_id, temas: h.temas });
    const inp = document.getElementById('hab-bncc-busca'); if (inp) inp.value = '';
    _renderChips(); _renderVinculos();
  };
  window.habBnccRemoverSelecao = function (id) {
    _sel = _sel.filter(s => String(s.id) !== String(id));
    _renderChips(); _renderVinculos();
  };
  window.habBnccFiltroMudou = function () {
    const inp = document.getElementById('hab-bncc-busca');
    if (inp && document.activeElement === inp) window.habBnccBuscar(inp.value);
  };

  function _renderChips() {
    const w = document.getElementById('hab-bncc-selecionadas');
    const btn = document.getElementById('hab-bncc-btn-vincular');
    if (btn) { btn.disabled = !_sel.length; btn.style.opacity = _sel.length ? '1' : '.5'; }
    if (!w) return;
    w.innerHTML = _sel.length ? _sel.map(s => `
      <div style="display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;background:#EEF2FF;">
        <div style="flex:1;min-width:0;"><span style="font-family:'Space Mono',monospace;font-size:12px;font-weight:700;color:#3B4FE4;">${esc(s.codigo)}</span>
          <div style="font-size:12px;color:var(--text);line-height:1.45;margin-top:2px;">${esc(s.descricao)}</div></div>
        <button onclick="habBnccRemoverSelecao('${s.id}')" title="Remover da seleção" style="border:none;background:none;color:#DC2626;font-size:14px;cursor:pointer;padding:0 4px;">✕</button>
      </div>`).join('') : '<div style="font-size:12px;color:var(--text-muted);">Nenhuma habilidade selecionada.</div>';
  }

  // ── Habilidade local na td ativa (reusa por código ou clona) ─────────────
  async function _idLocal(s) {
    const td = turmaDisciplinaAtiva?.id;
    if (String(s.turma_disciplina_id) === String(td)) return s.id;
    const ja = _habs.find(h => String(h.turma_disciplina_id) === String(td) && norm(h.codigo) === norm(s.codigo));
    if (ja) return ja.id;
    const novo = await api('habilidades_planejamento', { method: 'POST', body: JSON.stringify({
      turma_disciplina_id: td, codigo: s.codigo, descricao: s.descricao, divisao_id: s.divisao_id, temas: s.temas }) });
    const row = Array.isArray(novo) ? novo[0] : novo;
    if (row) _habs.push(row);
    return row?.id;
  }
  function _idsLocaisSelecionados() {
    const td = String(turmaDisciplinaAtiva?.id);
    return _sel.map(s => {
      if (String(s.turma_disciplina_id) === td) return s.id;
      return _habs.find(h => String(h.turma_disciplina_id) === td && norm(h.codigo) === norm(s.codigo))?.id || null;
    });
  }

  // ── Modal: vincular a várias aulas ───────────────────────────────────────
  window.habBnccAbrirModalAulas = async function () {
    if (!_sel.length) return;
    if (!turmaDisciplinaAtiva?.id) { mostrarToast('❌ Selecione uma turma/disciplina.'); return; }
    await _carregarAulasEVinculos();
    _modalAulasSel = new Set();
    document.getElementById('hab-bncc-modal-busca').value = '';
    document.getElementById('hab-bncc-modal-alert').style.display = 'none';
    document.getElementById('hab-bncc-modal-resumo').innerHTML = _sel.map(s => `<span style="font-family:'Space Mono',monospace;font-size:11px;font-weight:700;color:#3B4FE4;background:#EEF2FF;border-radius:20px;padding:3px 9px;margin:0 6px 6px 0;display:inline-block;">${esc(s.codigo)}</span>`).join('');
    _renderModalAulas('');
    document.getElementById('modal-hab-bncc-aulas').classList.add('open');
  };

  function _fmtData(d) { return d ? String(d).split('-').reverse().join('/') : ''; }

  function _renderModalAulas(termo) {
    const t = norm(termo);
    const locais = _idsLocaisSelecionados();
    const lista = _aulasTd.filter(a => !t || norm(a.nome).includes(t) || _fmtData(a.data).includes(t));
    document.getElementById('hab-bncc-modal-aulas').innerHTML = lista.length ? lista.map(a => {
      const jaTem = locais.length && locais.every(hid => hid && _vinculos.some(v => String(v.aula_id) === String(a.id) && String(v.habilidade_id) === String(hid)));
      const marc = _modalAulasSel.has(String(a.id));
      return `<label style="display:flex;align-items:center;gap:10px;padding:9px 10px;border:1.5px solid var(--border);border-radius:9px;margin-bottom:6px;cursor:pointer;${jaTem ? 'opacity:.55;' : ''}">
        <input type="checkbox" ${marc ? 'checked' : ''} ${jaTem ? 'disabled' : ''} onchange="habBnccToggleAula('${a.id}',this.checked)">
        <span style="font-size:12px;color:var(--text-muted);white-space:nowrap;">${_fmtData(a.data)}</span>
        <span style="font-size:13px;color:var(--text);flex:1;min-width:0;">${esc(a.nome || '(sem tema)')}</span>
        ${jaTem ? '<span style="font-size:10px;color:#16A34A;font-weight:700;">já vinculada</span>' : ''}</label>`;
    }).join('') : '<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Nenhuma aula encontrada nesta turma/disciplina.</div>';
    document.getElementById('hab-bncc-modal-contador').textContent = `${_modalAulasSel.size} aula(s) selecionada(s)`;
  }
  window.habBnccModalBuscar = v => _renderModalAulas(v);
  window.habBnccToggleAula = function (id, on) {
    on ? _modalAulasSel.add(String(id)) : _modalAulasSel.delete(String(id));
    document.getElementById('hab-bncc-modal-contador').textContent = `${_modalAulasSel.size} aula(s) selecionada(s)`;
  };
  window.habBnccSelecionarTodasVisiveis = function () {
    document.querySelectorAll('#hab-bncc-modal-aulas input[type=checkbox]:not(:disabled)').forEach(c => { c.checked = true; c.onchange(); });
  };

  window.habBnccConfirmarVinculo = async function () {
    const alEl = document.getElementById('hab-bncc-modal-alert');
    alEl.style.display = 'none';
    if (!_modalAulasSel.size) { alEl.textContent = 'Selecione ao menos uma aula.'; alEl.style.display = 'block'; return; }
    const btn = document.getElementById('hab-bncc-modal-confirmar');
    btn.disabled = true; btn.textContent = 'Vinculando...';
    try {
      const hids = [];
      for (const s of _sel) { const id = await _idLocal(s); if (id) hids.push(id); }
      const existentes = new Set(_vinculos.map(v => `${v.aula_id}|${v.habilidade_id}`));
      const novos = [];
      _modalAulasSel.forEach(aid => hids.forEach(hid => {
        const k = `${aid}|${hid}`;
        if (!existentes.has(k)) { existentes.add(k); novos.push({ aula_id: aid, habilidade_id: hid }); }
      }));
      if (novos.length) await api('aula_habilidades', { method: 'POST', body: JSON.stringify(novos) });
      mostrarToast(novos.length ? `✅ ${novos.length} vínculo(s) criado(s)!` : 'ℹ️ Todos os vínculos já existiam.');
      fecharModal('modal-hab-bncc-aulas');
      if (typeof window._habilidadesAulaInvalidarCache === 'function') window._habilidadesAulaInvalidarCache();
      await _carregarAulasEVinculos();
      _renderVinculos();
    } catch (e) {
      console.error('[HAB BNCC] vincular', e);
      alEl.textContent = 'Erro ao vincular. Tente novamente.'; alEl.style.display = 'block';
    } finally { btn.disabled = false; btn.textContent = 'Vincular'; }
  };

  // ── Aulas vinculadas (por habilidade selecionada), remoção independente ──
  function _renderVinculos() {
    const w = document.getElementById('hab-bncc-vinculos');
    if (!w) return;
    const locais = _idsLocaisSelecionados();
    const itens = _sel.map((s, i) => ({ s, hid: locais[i] })).filter(x => x.hid);
    if (!itens.length) { w.innerHTML = ''; return; }
    w.innerHTML = '<div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin:14px 0 8px;">Aulas vinculadas nesta turma</div>' +
      itens.map(({ s, hid }) => {
        const vs = _vinculos.filter(v => String(v.habilidade_id) === String(hid));
        const chips = vs.map(v => {
          const a = _aulasTd.find(x => String(x.id) === String(v.aula_id));
          if (!a) return '';
          return `<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:20px;border:1.5px solid var(--border);font-size:11px;margin:0 6px 6px 0;">
            ${_fmtData(a.data)} · ${esc((a.nome || '').slice(0, 30))}
            <button onclick="habBnccDesvincular('${a.id}','${hid}')" title="Desvincular só desta aula" style="border:none;background:none;color:#DC2626;cursor:pointer;padding:0;">✕</button></span>`;
        }).join('');
        return `<div style="margin-bottom:10px;"><span style="font-family:'Space Mono',monospace;font-size:12px;font-weight:700;color:#3B4FE4;">${esc(s.codigo)}</span>
          <div style="margin-top:6px;">${chips || '<span style="font-size:12px;color:var(--text-muted);">Nenhuma aula vinculada ainda.</span>'}</div></div>`;
      }).join('');
  }

  window.habBnccDesvincular = async function (aulaId, habId) {
    try {
      await api(`aula_habilidades?aula_id=eq.${aulaId}&habilidade_id=eq.${habId}`, { method: 'DELETE' });
      _vinculos = _vinculos.filter(v => !(String(v.aula_id) === String(aulaId) && String(v.habilidade_id) === String(habId)));
      if (typeof window._habilidadesAulaInvalidarCache === 'function') window._habilidadesAulaInvalidarCache();
      _renderVinculos();
      mostrarToast('✅ Vínculo removido desta aula.');
    } catch (e) { console.error('[HAB BNCC] desvincular', e); mostrarToast('❌ Erro ao desvincular.'); }
  };

  window.iniciarCardHabilidadesBncc = iniciarCardHabilidadesBncc;
})();
