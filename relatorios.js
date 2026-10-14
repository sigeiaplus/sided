// RELATÓRIO
let _relatorioCargaToken = 0;

async function carregarRelatorio(tri) {
  tri = parseInt(tri) || 1;
  const token = ++_relatorioCargaToken;
  if (!await garantirContextoCompleto()) { mostrarToast('Selecione uma turma para continuar.'); return; }
  try {
    await garantirAlunosTurma();
    if (token !== _relatorioCargaToken) return;
    if (!avaliacoesTurma.length) await carregarAvaliacoes();
    if (token !== _relatorioCargaToken) return;
    if (!aulasTurma.length) await carregarAulas();
    if (token !== _relatorioCargaToken) return;
    document.getElementById('relatorio-total-alunos').textContent = `Total de alunos: ${alunosTurma.length}`;

    const avalTri = avaliacoesTurma.filter(a => a.trimestre === tri && a.tipo !== 'recuperacao' && !_isNotaFinal(a));
    const media = tri === 3 ? 24 : 18;
    const totalEsperado = tri === 3 ? 40 : 30;

    // Buscar notas (avaliações normais + recuperação trimestral)
    let notasTri = [];
    const avalRecup = avaliacoesTurma.filter(a => a.trimestre === tri && a.tipo === 'recuperacao');
    const idsNormais = avalTri.length ? avalTri.map(a => a.id) : [];
    const idsRecup   = avalRecup.length ? avalRecup.map(a => a.id) : [];
    const todosIds   = [...idsNormais, ...idsRecup];
    if (todosIds.length && alunosTurma.length) {
      notasTri = await api(`notas?avaliacao_id=in.(${todosIds.join(',')})&select=*`) || [];
      if (token !== _relatorioCargaToken) return;
    }

    // Buscar faltas
    let faltas = [];
    if (alunosTurma.length) {
      const ids = alunosTurma.map(a => a.id).join(',');
      const _tdId = turmaDisciplinaAtiva?.id;
      const profData2 = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
      let _aulasRelIds;
      if (_tdId) {
        const _comTd = aulasTurma.filter(a => a.turma_disciplina_id === _tdId).map(a => a.id);
        const _semTd = aulasTurma.filter(a => !a.turma_disciplina_id && a.professor_id === profData2.id).map(a => a.id);
        _aulasRelIds = [..._comTd, ..._semTd];
      } else {
        _aulasRelIds = aulasTurma.map(a => a.id);
      }
      faltas = (_aulasRelIds.length)
        ? await api(`chamadas?aluno_id=in.(${ids})&aula_id=in.(${_aulasRelIds.join(',')})&presente=eq.false&select=aluno_id,falta_abonada`) || []
        : [];
      if (token !== _relatorioCargaToken) return;
    }
    const faltasPorAluno = {};
    faltas.forEach(f => { if (!f.falta_abonada) faltasPorAluno[f.aluno_id] = (faltasPorAluno[f.aluno_id] || 0) + 1; });

    // Mapa notas
    const notasMap = {};
    notasTri.forEach(n => {
      if (!notasMap[n.aluno_id]) notasMap[n.aluno_id] = {};
      notasMap[n.aluno_id][n.avaliacao_id] = n;
    });

    // Buscar notas confirmadas para este trimestre (todas de uma vez)
    let notasConfirmadasMap = {};
    if (alunosTurma.length) {
      try {
        const idsAlunos = alunosTurma.map(a => a.id).join(',');
        const _tdFilterRel = turmaDisciplinaAtiva?.id ? `&turma_disciplina_id=eq.${turmaDisciplinaAtiva.id}` : '';
        const confRes = await api(`notas_confirmadas?aluno_id=in.(${idsAlunos})&trimestre=eq.${tri}${_tdFilterRel}&select=aluno_id,nota_final`) || [];
        if (token !== _relatorioCargaToken) return;
        confRes.forEach(c => { notasConfirmadasMap[c.aluno_id] = Number(c.nota_final); });
      } catch(e) { console.warn('[Relatório] Erro ao buscar notas confirmadas:', e); }
    }

    const thead = document.getElementById('relatorio-thead');
    const isFundI = isFundamentalI();

    if (isFundI) {
      // Fundamental I: colunas por disciplina
      const discsSet = [...new Set(avalTri.map(a => a.disciplina).filter(Boolean))].sort();
      thead.innerHTML = `<th>Aluno</th>` +
        discsSet.map(d => `<th style="white-space:nowrap;">${d}</th>`).join('') +
        `<th>Total</th><th style="white-space:nowrap;color:#7C3AED;">Nota Final</th><th>Faltas</th>`;

      relatorioCache = alunosTurma.map(a => {
        const notasPorDisc = {};
        discsSet.forEach(d => {
          const avalsDisc = avalTri.filter(av => av.disciplina === d);
          const soma = avalsDisc.reduce((s, av) => {
            const n = notasMap[a.id]?.[av.id];
            return s + (n && !n.nao_realizado && n.nota !== null ? Number(n.nota) : 0);
          }, 0);
          notasPorDisc[d] = soma;
        });
        // Em Fundamental I, limitar cada disciplina a 30 pts
        const somaCalc = Object.values(notasPorDisc).reduce((s, v) => s + Math.min(v, 30), 0);
        // Usar nota confirmada se existir
        const notaFechada = notasConfirmadasMap.hasOwnProperty(a.id) ? notasConfirmadasMap[a.id] : null;
        const total = notaFechada !== null ? notaFechada : somaCalc;
        return { aluno: a, notasPorDisc, discsSet, total, notaFechada, faltas: faltasPorAluno[a.id] || 0, abaixo: total < media, media, totalEsperado };
      });
    } else {
      // Fundamental II: colunas por avaliação (comportamento original)
      thead.innerHTML = `<th>Aluno</th>` +
        avalTri.map(a => { const nm = _nomeExibicaoAval(a); return `<th style="white-space:nowrap;">${nm.length > 18 ? nm.substring(0,18)+'…' : nm}<br><span style="font-weight:400;color:var(--text-muted);font-size:10px;">${a.pontos}pts</span></th>`; }).join('') +
        `<th>Total de Notas</th><th style="white-space:nowrap;color:#7C3AED;">Nota Final</th><th>Faltas</th>`;

      relatorioCache = alunosTurma.map(a => {
        const notasAluno = avalTri.map(av => {
          const n = notasMap[a.id]?.[av.id];
          if (!n) return { nota: null, naoRealizado: false, recuperacaoParalela: null };
          return { nota: n.nota, naoRealizado: n.nao_realizado, recuperacaoParalela: n.recuperacao_paralela };
        });
        // "Não realizado" zera apenas a nota; a recuperação paralela sempre conta.
        const somaBase = notasAluno.reduce((s, n) => s + (!n.naoRealizado ? Number(n.nota || 0) : 0), 0);
        const somaRecPar = notasAluno.reduce((s, n) => s + Number(n.recuperacaoParalela || 0), 0);
        // Soma das notas da avaliação de recuperação trimestral
        const somaRecup = avalRecup.reduce((s, av) => {
          const n = notasMap[a.id]?.[av.id];
          return s + (n && !n.nao_realizado && n.nota !== null ? Number(n.nota) : 0)
                   + (n && n.recuperacao_paralela !== null ? Number(n.recuperacao_paralela || 0) : 0);
        }, 0);
        const somaCalc = somaBase + somaRecPar + somaRecup;
        // Usar nota confirmada se existir
        const notaFechada = notasConfirmadasMap.hasOwnProperty(a.id) ? notasConfirmadasMap[a.id] : null;
        const total = notaFechada !== null ? notaFechada : somaCalc;
        return { aluno: a, notasAluno, total, notaFechada, faltas: faltasPorAluno[a.id] || 0, abaixo: total < media, media, totalEsperado };
      });
    }

    renderRelatorio(relatorioCache, avalTri);
  } catch(e) {
    if (token !== _relatorioCargaToken) return; // corrida cancelada, não é erro real pro usuário
    console.error('[Relatório] Erro ao carregar relatório:', e);
    if (typeof mostrarErro === 'function') mostrarErro('Erro ao carregar o relatório. Tente novamente.');
    else mostrarToast('Erro ao carregar o relatório. Tente novamente.');
  }
}

function renderRelatorio(dados, avalTri) {
  if (!dados.length) {
    document.getElementById('relatorio-body').innerHTML = '<tr><td colspan="20" style="text-align:center;padding:24px;color:var(--text-muted);">Nenhum aluno cadastrado</td></tr>';
    return;
  }
  const isFundI = isFundamentalI();
  document.getElementById('relatorio-body').innerHTML = dados.map(r => `
    <tr style="cursor:pointer;${r.abaixo ? 'background:#FFF8F8;' : ''}" onclick="abrirFichaAluno('${r.aluno.id}')" title="Ver ficha do aluno">
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:26px;height:26px;border-radius:50%;background:${r.abaixo?'#FEE2E2':'var(--purple-light)'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${r.abaixo?'#C0392B':'var(--purple)'};flex-shrink:0;">${r.aluno.nome_completo.charAt(0)}</div>
          <span style="font-weight:600;color:${r.abaixo?'#C0392B':'var(--text)'};">${r.aluno.nome_completo}${tagRemanejado(r.aluno)}</span>
        </div>
      </td>
      ${isFundI
        ? r.discsSet.map(d => `<td style="font-weight:600;color:var(--text);">${(r.notasPorDisc[d]||0).toFixed(1)}</td>`).join('')
        : r.notasAluno.map(n => `<td style="color:${n.nota===null?'var(--text-muted)':'var(--text)'};">${n.naoRealizado ? '<span style="font-size:11px;color:var(--text-muted);">N.R.</span>' : (n.nota !== null && n.nota !== undefined ? Number(n.nota).toFixed(1) : '—')}</td>`).join('')
      }
      <td style="font-weight:700;color:${r.abaixo?'#C0392B':'var(--success)'};">
        ${r.total.toFixed(1)}<span style="font-weight:400;font-size:11px;color:var(--text-muted);"> / ${r.totalEsperado}</span>
        <div style="font-size:10px;margin-top:2px;color:${r.abaixo?'#C0392B':'#15803D'};">${r.abaixo?'⚠ Abaixo da média ('+r.media+')':'✓ Acima da média'}</div>
      </td>
      <td style="font-weight:700;color:${r.notaFechada !== null ? '#7C3AED' : 'var(--text-muted)'};text-align:center;">
        ${r.notaFechada !== null
          ? `<span style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;"><strong style="font-size:14px;">${Number(r.notaFechada).toFixed(1)}</strong><span style="font-size:9px;background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;border-radius:4px;padding:1px 5px;font-weight:700;">✎ confirmada</span></span>`
          : '<span style="font-size:12px;color:var(--text-muted);">—</span>'}
      </td>
      <td style="color:${r.faltas>0?'#C0392B':'var(--text-muted)'};">${r.faltas}</td>
    </tr>`).join('');

  if (!_relatorioModoAplicado) {
    _relatorioModoAplicado = true;
    toggleRelatorioModo(window.matchMedia('(max-width: 768px)').matches ? 'grade' : 'lista');
  }
}

function ordenarRelatorio(modo) {
  if (!relatorioCache.length) return;
  const tri = parseInt(document.getElementById('sel-rel-tri').value);
  const avalTri = avaliacoesTurma.filter(a => a.trimestre === tri);
  let sorted = [...relatorioCache];
  if (modo === 'alfa') sorted.sort((a,b) => a.aluno.nome_completo.localeCompare(b.aluno.nome_completo));
  else if (modo === 'nota') sorted.sort((a,b) => b.total - a.total);
  else if (modo === 'faltas') sorted.sort((a,b) => b.faltas - a.faltas);
  renderRelatorio(sorted, avalTri);
}

// ── ALERTAS DE RISCO ─────────────────────────────────────────────────────────
async function abrirAlertasRisco(event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  if (!turmaAtiva?.id) {
    const ok = await garantirContextoCompleto();
    if (!ok) { mostrarToast('Selecione uma turma para continuar.'); return; }
  }

  try {
    await garantirAlunosTurma();
    if (!alunosTurma.length) { mostrarToast('Nenhum aluno encontrado nesta turma.'); return; }
    if (!avaliacoesTurma.length) await carregarAvaliacoes();
    if (!aulasTurma.length) await carregarAulas();

    const tri = parseInt(document.getElementById('sel-rel-tri')?.value || '1') || 1;

    // Sempre recarregar para garantir dados do trimestre atual
    await carregarRelatorio(tri);

    if (!relatorioCache?.length) {
      mostrarToast('Nenhum dado encontrado para este trimestre.');
      return;
    }
  } catch(e) {
    console.error('[Alertas] Erro ao carregar dados:', e);
    if (typeof mostrarErro === 'function') mostrarErro('Erro ao carregar dados. Tente novamente.');
    else mostrarToast('Erro ao carregar dados. Tente novamente.');
    return;
  }

  document.getElementById('modal-ficha-aluno')?.classList.remove('open');

  const tri = parseInt(document.getElementById('sel-rel-tri')?.value || '1') || 1;
  const totalAulas = aulasTurma?.length ?? 0;

  const emRisco = relatorioCache.map(r => {
    const pctFreq = totalAulas > 0 ? (((totalAulas - r.faltas) / totalAulas) * 100) : 100;
    const notaAbaixo = r.abaixo;
    const freqCritica = pctFreq < 75;
    if (!notaAbaixo && !freqCritica) return null;
    return { ...r, pctFreq, notaAbaixo, freqCritica };
  }).filter(Boolean);

  document.getElementById('alertas-subtitulo').textContent =
    `${emRisco.length} aluno${emRisco.length !== 1 ? 's' : ''} em risco — ${tri}º Trimestre`;

  const lista = document.getElementById('alertas-lista');

  if (!emRisco.length) {
    lista.innerHTML = `<div style="text-align:center;padding:40px 20px;">
      <div style="font-size:32px;margin-bottom:12px;">🎉</div>
      <div style="font-size:14px;font-weight:700;color:var(--success);">Nenhum aluno em risco!</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Todos com nota e frequência adequadas neste trimestre.</div>
    </div>`;
  } else {
    lista.innerHTML = emRisco.map(r => {
      let badgeLabel, badgeColor, badgeBg;
      if (r.notaAbaixo && r.freqCritica) {
        badgeLabel = 'Ambos'; badgeColor = '#7C3AED'; badgeBg = '#F3F0FF';
      } else if (r.notaAbaixo) {
        badgeLabel = 'Risco de reprovação'; badgeColor = '#DC2626'; badgeBg = '#FEF2F2';
      } else {
        badgeLabel = 'Frequência crítica'; badgeColor = '#D97706'; badgeBg = '#FFFBEB';
      }
      const freqColor = r.freqCritica ? '#DC2626' : '#16A34A';
      const notaColor = r.notaAbaixo ? '#DC2626' : '#16A34A';
      return `
      <div style="border:1.5px solid ${r.notaAbaixo && r.freqCritica ? '#DDD6FE' : (r.notaAbaixo ? '#FBBFBF' : '#FDE68A')};border-radius:10px;padding:14px 16px;background:var(--white);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:50%;background:#FEE2E2;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#C0392B;flex-shrink:0;">${r.aluno.nome_completo.charAt(0)}</div>
            <div style="font-size:13px;font-weight:700;color:var(--text);">${r.aluno.nome_completo}</div>
          </div>
          <span style="font-size:11px;font-weight:700;color:${badgeColor};background:${badgeBg};border:1px solid ${badgeColor}22;border-radius:20px;padding:3px 10px;white-space:nowrap;">${badgeLabel}</span>
        </div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;">
          <div style="flex:1;min-width:120px;padding:8px 12px;background:#F8FAFF;border-radius:8px;">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Nota atual</div>
            <div style="font-size:15px;font-weight:700;color:${notaColor};">${r.total.toFixed(1)}<span style="font-size:11px;font-weight:400;color:var(--text-muted);"> / ${r.totalEsperado}</span></div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:1px;">Média: ${r.media}</div>
          </div>
          <div style="flex:1;min-width:120px;padding:8px 12px;background:#F8FAFF;border-radius:8px;">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">Frequência</div>
            <div style="font-size:15px;font-weight:700;color:${freqColor};">${r.pctFreq.toFixed(0)}%</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:1px;">${r.faltas} falta${r.faltas !== 1 ? 's' : ''} de ${totalAulas} aula${totalAulas !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  document.getElementById('modal-alertas-risco').classList.add('open');
}

// ── TOGGLE LISTA/GRADE RELATÓRIO ─────────────────────────────────────────────
let _relatorioModo = 'lista';
let _relatorioModoAplicado = false;

function toggleRelatorioModo(modo) {
  _relatorioModo = modo;
  const btnLista = document.getElementById('btn-rel-lista');
  const btnGrade = document.getElementById('btn-rel-grade');
  const listaView = document.querySelector('.relatorio-wrapper');
  const gradeView = document.getElementById('relatorio-grade-view');

  if (modo === 'lista') {
    btnLista.style.background = 'var(--purple)'; btnLista.style.color = '#fff';
    btnGrade.style.background = 'var(--white)'; btnGrade.style.color = 'var(--text-muted)';
    if (listaView) listaView.style.display = 'block';
    if (gradeView) gradeView.style.display = 'none';
  } else {
    btnGrade.style.background = 'var(--purple)'; btnGrade.style.color = '#fff';
    btnLista.style.background = 'var(--white)'; btnLista.style.color = 'var(--text-muted)';
    if (listaView) listaView.style.display = 'none';
    if (gradeView) gradeView.style.display = 'block';
    renderRelatorioGrade(relatorioCache);
  }
}

function renderRelatorioGrade(dados) {
  const el = document.getElementById('relatorio-grade-body');
  if (!el) return;
  if (!dados || !dados.length) {
    el.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);font-size:13px;">Nenhum aluno cadastrado</div>`;
    return;
  }
  el.innerHTML = dados.map(r => {
    const pctNota = r.totalEsperado > 0 ? Math.round((r.total / r.totalEsperado) * 100) : 0;
    const statusColor = r.abaixo ? '#DC2626' : '#16A34A';
    const statusBg = r.abaixo ? '#FEF2F2' : '#F0FDF4';
    const statusLabel = r.abaixo ? '⚠ Abaixo da média' : '✓ Acima da média';
    const inicial = r.aluno.nome_completo.charAt(0).toUpperCase();
    return `
    <div onclick="abrirFichaAluno('${r.aluno.id}')" style="background:${r.abaixo?'#FFF8F8':'var(--white)'};border:1.5px solid ${r.abaixo?'#FBBFBF':'var(--border)'};border-radius:12px;padding:16px;cursor:pointer;transition:box-shadow 0.15s;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;" onmouseover="this.style.boxShadow='0 4px 14px rgba(0,0,0,0.08)'" onmouseout="this.style.boxShadow='none'">
      <div style="width:48px;height:48px;border-radius:50%;background:${r.abaixo?'#FEE2E2':'var(--purple-light)'};display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:${r.abaixo?'#C0392B':'var(--purple)'};">${inicial}</div>
      <div style="font-size:12px;font-weight:700;color:var(--text);line-height:1.3;word-break:break-word;">${r.aluno.nome_completo}</div>
      <div style="display:flex;gap:8px;width:100%;justify-content:center;">
        <div style="flex:1;padding:6px;background:#F8FAFF;border-radius:8px;">
          <div style="font-size:9px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:2px;">Notas</div>
          <div style="font-size:13px;font-weight:700;color:${statusColor};">${r.total.toFixed(1)}</div>
        </div>
        <div style="flex:1;padding:6px;background:#F8FAFF;border-radius:8px;">
          <div style="font-size:9px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;margin-bottom:2px;">Faltas</div>
          <div style="font-size:13px;font-weight:700;color:${r.faltas > 0 ? '#DC2626' : 'var(--text-muted)'};">${r.faltas}</div>
        </div>
      </div>
      <div style="font-size:10px;font-weight:700;color:${statusColor};background:${statusBg};border-radius:20px;padding:3px 10px;width:100%;">${statusLabel}</div>
    </div>`;
  }).join('');
}



// FICHA DO ALUNO
async function abrirFichaAluno(alunoId) {
  if (!await garantirContextoCompleto()) { mostrarToast('Selecione uma turma para continuar.'); return; }
  await carregarValoresDivisaoDaTurma(turmaAtiva); // garante _valoresDivisaoCache pronto (função compartilhada com avaliacoes.js)
  const aluno = await garantirAlunoNoContexto(alunoId);
  if (!aluno) return;
  const idAluno = aluno.id;

  // Garantir que avaliações estão carregadas antes de montar a ficha
  if (!avaliacoesTurma.length) await carregarAvaliacoes();

  // preencher header da ficha
  document.getElementById('ficha-aluno-nome').textContent = aluno.nome_completo;
  // tag remanejado na ficha
  let fichaTagEl = document.getElementById('ficha-tag-remanejado');
  if (!fichaTagEl) {
    fichaTagEl = document.createElement('span');
    fichaTagEl.id = 'ficha-tag-remanejado';
    document.getElementById('ficha-aluno-nome').after(fichaTagEl);
  }
  fichaTagEl.innerHTML = aluno.remanejado
    ? `<span style="display:inline-block;margin-top:6px;background:#DCFCE7;color:#166534;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">Remanejado</span>`
    : '';

  // buscar todas as notas do aluno nessa turma
  const todasAvals = avaliacoesTurma;
  let totalNotasAno = 0, totalEsperadoAno = 0;

  // notas por trimestre
  const porTri = { 1: [], 2: [], 3: [] };
  todasAvals.forEach(av => { if (porTri[av.trimestre]) porTri[av.trimestre].push(av); });

  // maxPorTri/mediaPorTri: antes eram fixos (30/30/40 e 18/18/24).
  // Agora vêm de valoresDaDivisao(), que consulta parametro_divisoes.
  // Mantido como objeto {1:x, 2:y, 3:z} para não precisar reescrever
  // os consumidores abaixo que fazem maxPorTri[tri].
  const maxPorTri = { 1: valoresDaDivisao(1).max, 2: valoresDaDivisao(2).max, 3: valoresDaDivisao(3).max };
  const mediaPorTri = { 1: valoresDaDivisao(1).mediaMin, 2: valoresDaDivisao(2).mediaMin, 3: valoresDaDivisao(3).mediaMin };

  // buscar notas e faltas
  const _tdId = turmaDisciplinaAtiva?.id;
  const profData2 = JSON.parse(sessionStorage.getItem('prof_data') || '{}');

  // Buscar IDs de aulas da disciplina ativa (inclui legados com turma_disciplina_id NULL)
  let _aulasFichaIds = [];
  if (_tdId) {
    // Primeiro tenta as que já têm turma_disciplina_id populado
    const _comTd = aulasTurma.filter(a => a.turma_disciplina_id === _tdId).map(a => a.id);
    // Também pega as legadas (NULL) filtrando por professor_id como fallback
    const _semTd = aulasTurma.filter(a => !a.turma_disciplina_id && a.professor_id === profData2.id).map(a => a.id);
    _aulasFichaIds = [..._comTd, ..._semTd];
  } else {
    _aulasFichaIds = aulasTurma.map(a => a.id);
  }

  const _chamadaFilter = _aulasFichaIds.length
    ? `&aula_id=in.(${_aulasFichaIds.join(',')})`
    : '';

  const [notasRes, faltasRes, todasChamadas] = await Promise.all([
    todasAvals.length ? api(`notas?avaliacao_id=in.(${todasAvals.map(a=>a.id).join(',')})&aluno_id=eq.${idAluno}&select=*`) : Promise.resolve([]),
    api(`chamadas?aluno_id=eq.${idAluno}&presente=eq.false${_chamadaFilter}&select=aula_id,falta_abonada`),
    api(`chamadas?aluno_id=eq.${idAluno}${_chamadaFilter}&select=aula_id,presente`)
  ]);

  const mapNotas = {};
  (notasRes||[]).forEach(n => { mapNotas[n.avaliacao_id] = n; });

  // Buscar notas confirmadas dos 3 trimestres para este aluno
  const notasConfAluno = {};
  try {
    const _tdFilterFicha = turmaDisciplinaAtiva?.id ? `&turma_disciplina_id=eq.${turmaDisciplinaAtiva.id}` : '';
    const confResAluno = await api(`notas_confirmadas?aluno_id=eq.${idAluno}${_tdFilterFicha}&select=trimestre,nota_final`) || [];
    confResAluno.forEach(c => { notasConfAluno[c.trimestre] = Number(c.nota_final); });
  } catch(e) { console.warn('[Ficha] Erro ao buscar notas confirmadas:', e); }

  const totalFaltas = (faltasRes||[]).filter(f => !f.falta_abonada).length;
  const totalAulas = (todasChamadas||[]).length;
  const pctFreq = totalAulas > 0 ? (((totalAulas - totalFaltas) / totalAulas) * 100).toFixed(0) : 100;

  // calcular totais anuais
  let somaAno = 0;
  const isFundI = isFundamentalI();
  [1,2,3].forEach(tri => {
    // Se existe nota confirmada para este trimestre, usar ela diretamente
    if (notasConfAluno.hasOwnProperty(tri)) {
      somaAno += notasConfAluno[tri];
      totalEsperadoAno += maxPorTri[tri];
      return;
    }
    const avNorm = porTri[tri].filter(a => a.tipo !== 'recuperacao' && !_isNotaFinal(a));
    if (isFundI) {
      // Fundamental I: somar por disciplina, máximo 30 por disciplina
      const discsSet = [...new Set(avNorm.map(a => a.disciplina).filter(Boolean))].sort();
      discsSet.forEach(d => {
        const avalsDisc = avNorm.filter(av => av.disciplina === d);
        let somaDisc = 0;
        avalsDisc.forEach(av => {
          const n = mapNotas[av.id];
          if (n && !n.nao_realizado && n.nota !== null) {
            somaDisc += Number(n.nota);
          }
        });
        somaAno += Math.min(somaDisc, 30); // Limitar a 30 por disciplina
      });
    } else {
      // Outros: somar normalmente (nota + recuperacao_paralela)
      avNorm.forEach(av => {
        const n = mapNotas[av.id];
        if (n && !n.nao_realizado && n.nota !== null) somaAno += Number(n.nota);
        if (n && n.recuperacao_paralela !== null && n.recuperacao_paralela !== undefined) somaAno += Number(n.recuperacao_paralela);
      });
    }
    totalEsperadoAno += maxPorTri[tri];
  });
  const pctNotas = totalEsperadoAno > 0 ? ((somaAno / totalEsperadoAno) * 100).toFixed(0) : 0;

  // preencher resumo
  document.getElementById('ficha-notas-resumo').textContent = `${somaAno.toFixed(1)}/${totalEsperadoAno} — ${pctNotas}%`;
  document.getElementById('ficha-faltas-resumo').textContent = `${totalFaltas}/${totalAulas} — ${100 - parseInt(pctFreq)}%`;

  // montar lista de trimestres
  const ano = new Date().getFullYear();
  const nomesTri = { 1: '1º Trimestre', 2: '2º Trimestre', 3: '3º Trimestre' };

  document.getElementById('ficha-notas-lista').innerHTML = [1,2,3].map(tri => {
    const avNorm = porTri[tri].filter(a => a.tipo !== 'recuperacao' && !_isNotaFinal(a));
    const avRecup = porTri[tri].filter(a => a.tipo === 'recuperacao');
    const isFundI = isFundamentalI();
    
    // Em Fundamental I, somaTri = soma por disciplina (máximo 30 cada)
    // Em outros: somaTri = soma de todas as avaliações
    let somaTri = 0;
    const notaConfTri = notasConfAluno.hasOwnProperty(tri) ? notasConfAluno[tri] : null;
    if (notaConfTri !== null) {
      somaTri = notaConfTri;
    } else if (isFundI) {
      const discsSet = [...new Set(avNorm.map(a => a.disciplina).filter(Boolean))];
      discsSet.forEach(d => {
        const avalsDisc = avNorm.filter(av => av.disciplina === d);
        let somaDisc = avalsDisc.reduce((s, av) => {
          const n = mapNotas[av.id];
          return s + (n && !n.nao_realizado && n.nota !== null ? Number(n.nota) : 0);
        }, 0);
        somaTri += Math.min(somaDisc, 30); // Máximo 30 por disciplina
      });
    } else {
      somaTri = avNorm.reduce((s, av) => {
        const n = mapNotas[av.id];
        const notaVal = (n && !n.nao_realizado && n.nota !== null) ? Number(n.nota) : 0;
        const recVal = (n && n.recuperacao_paralela !== null && n.recuperacao_paralela !== undefined) ? Number(n.recuperacao_paralela) : 0;
        return s + notaVal + recVal;
      }, 0);
    }
    
    const abaixo = somaTri < mediaPorTri[tri];

    // Conteúdo interno: Fundamental I = por disciplina, Fundamental II = por avaliação
    let linhasNotas = '';
    if (isFundI) {
      const discsSet = [...new Set(avNorm.map(a => a.disciplina).filter(Boolean))].sort();
      linhasNotas = discsSet.map(d => {
        const avalsDisc = avNorm.filter(av => av.disciplina === d);
        const somaDisc = avalsDisc.reduce((s, av) => {
          const n = mapNotas[av.id];
          return s + (n && !n.nao_realizado && n.nota !== null ? Number(n.nota) : 0);
        }, 0);
        const maxDisc = avalsDisc.reduce((s, av) => s + Number(av.pontos || 0), 0);
        return `<tr>
          <td style="padding:6px 0;color:var(--text);font-weight:600;">${d}</td>
          <td style="text-align:right;font-weight:700;color:${somaDisc < (maxDisc * 0.6) ? '#C0392B' : 'var(--text)'};">${somaDisc.toFixed(1)}<span style="font-size:10px;font-weight:400;color:var(--text-muted);">/${maxDisc}</span></td>
        </tr>`;
      }).join('');
    } else {
      linhasNotas = avNorm.map(av => {
        const n = mapNotas[av.id];
        const nota = n && !n.nao_realizado && n.nota !== null ? Number(n.nota).toFixed(1) : (n?.nao_realizado ? 'N.R.' : '—');
        const recPar = (n && n.recuperacao_paralela !== null && n.recuperacao_paralela !== undefined)
          ? `<span style="font-size:10px;color:${Number(n.recuperacao_paralela) < 0 ? '#C0392B' : '#0F766E'};font-weight:600;"> ${Number(n.recuperacao_paralela) >= 0 ? '+' : ''}${Number(n.recuperacao_paralela).toFixed(1)} rec.par.</span>`
          : '';
        return `<tr><td style="padding:6px 0;color:var(--text);">${av.nome}</td><td style="text-align:right;font-weight:600;color:var(--text);">${nota}${recPar}</td></tr>`;
      }).join('');
    }

    return `
    <div style="margin-bottom:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:${abaixo?'#FFF0F0':'var(--white)'};border:1.5px solid ${abaixo?'#FBBFBF':'var(--border)'};border-radius:10px;cursor:pointer;" onclick="toggleFichaTri('ficha-tri-${tri}',this)">
        <span style="font-size:13px;font-weight:700;color:${abaixo?'#C0392B':'var(--text)'};">${nomesTri[tri]} — ${ano}</span>
        <div style="display:flex;align-items:center;gap:10px;">
          ${notaConfTri !== null ? `<span style="font-size:9px;background:#EFF6FF;color:#1D4ED8;border:1px solid #BFDBFE;border-radius:4px;padding:2px 6px;font-weight:700;">✎ confirmada</span>` : ''}
          <span style="font-size:14px;font-weight:700;color:${abaixo?'#C0392B':'var(--purple)'};">${somaTri.toFixed(1)}/${maxPorTri[tri]}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${abaixo?'#C0392B':'var(--purple)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </div>
      </div>

      <!-- Detalhe expandível -->
      <div id="ficha-tri-${tri}" style="display:none;background:#FAFBFF;border:1px solid var(--border);border-top:none;border-radius:0 0 10px 10px;padding:14px 16px;">
        ${notaConfTri !== null ? `<div style="margin-bottom:10px;padding:8px 12px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;font-size:12px;color:#1D4ED8;font-weight:600;">✎ Nota final confirmada pelo professor: <strong>${somaTri.toFixed(1)} pts</strong>. As notas abaixo são para referência.</div>` : ''}
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">${isFundI ? 'Nota por Disciplina' : (turmaAtiva?.disciplina || 'Disciplina')} — ${turmaAtiva?.nome || ''}</div>
        <table style="width:100%;font-size:13px;border-collapse:collapse;${notaConfTri !== null ? 'opacity:0.65;' : ''}">
          <tr style="border-bottom:1px solid var(--border);">
            <th style="text-align:left;padding:6px 0;font-size:11px;color:var(--text-muted);font-weight:600;">${isFundI ? 'Disciplina' : 'Avaliação'}</th>
            <th style="text-align:right;padding:6px 0;font-size:11px;color:var(--text-muted);font-weight:600;">Nota</th>
          </tr>
          ${linhasNotas}
          ${!isFundI && avRecup.length ? `
          <tr><td colspan="2" style="padding:8px 0 4px;font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Recuperação</td></tr>
          ${avRecup.map(av => {
            const n = mapNotas[av.id];
            const nota = n && !n.nao_realizado && n.nota !== null ? Number(n.nota).toFixed(1) : 'Sem registros';
            return `<tr><td style="padding:4px 0;color:var(--text-muted);font-style:italic;">${av.nome}</td><td style="text-align:right;color:var(--text-muted);">${nota}</td></tr>`;
          }).join('')}` : (!isFundI ? `<tr><td colspan="2" style="padding:8px 0 4px;font-size:11px;color:var(--text-muted);">Recuperação<br><span style="font-style:italic;">Sem registros</span></td></tr>` : '')}
        </table>
      </div>
    </div>`;
  }).join('');

  document.getElementById('modal-ficha-aluno').classList.add('open');

  // Guardar ID do aluno ativo para navegação entre alunos (abas usam parâmetro explícito)
  window._fichaAlunoAtualId = aluno.id;

  // Navegação prev/next — calcular índice na lista atual
  const _listaNav = (relatorioCache && relatorioCache.length) ? relatorioCache : alunosTurma.map(a => ({ aluno: a }));
  window._fichaNavLista = _listaNav;
  window._fichaAlunoIndex = _listaNav.findIndex(r => _idAluno(r.aluno.id) === _idAluno(idAluno));
  _atualizarBotoesNavFicha();

  // Resetar para aba Notas e limpar painéis das outras abas
  fichaAbaSwitch('notas');
  const elF = document.getElementById('ficha-faltas-lista');
  if (elF) elF.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">Clique na aba para carregar.</div>`;

  // ── Gráfico de evolução trimestral ───────────────────────────────────────
  (function renderGraficoEvolucao() {
    // Calcular somaTri para cada trimestre usando a mesma lógica
    const pontos = [1, 2, 3].map(tri => {
      const avNorm = porTri[tri].filter(a => a.tipo !== 'recuperacao' && !_isNotaFinal(a));
      const notaConfTri = notasConfAluno.hasOwnProperty(tri) ? notasConfAluno[tri] : null;
      let soma = 0;
      if (notaConfTri !== null) {
        soma = notaConfTri;
      } else if (isFundI) {
        const discsSet = [...new Set(avNorm.map(a => a.disciplina).filter(Boolean))];
        discsSet.forEach(d => {
          const avalsDisc = avNorm.filter(av => av.disciplina === d);
          let somaDisc = avalsDisc.reduce((s, av) => {
            const n = mapNotas[av.id];
            return s + (n && !n.nao_realizado && n.nota !== null ? Number(n.nota) : 0);
          }, 0);
          soma += Math.min(somaDisc, 30);
        });
      } else {
        soma = avNorm.reduce((s, av) => {
          const n = mapNotas[av.id];
          const nv = (n && !n.nao_realizado && n.nota !== null) ? Number(n.nota) : 0;
          const rv = (n && n.recuperacao_paralela != null) ? Number(n.recuperacao_paralela) : 0;
          return s + nv + rv;
        }, 0);
      }
      return { tri, soma, max: maxPorTri[tri], media: mediaPorTri[tri] };
    });

    const svgEl = document.getElementById('ficha-svg-evolucao');
    const graficoEl = document.getElementById('ficha-grafico-evolucao');
    if (!svgEl || !graficoEl) return;

    const W = 340, H = 140;
    const padL = 36, padR = 20, padT = 20, padB = 28;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    // Y scale: 0 to max possible (max do maior trimestre)
    const maxY = Math.max(...pontos.map(p => p.max));
    const toX = (i) => padL + (i / 2) * chartW;
    const toY = (v) => padT + chartH - (v / maxY) * chartH;

    // Media mínima média ponderada simplificada (18/30 = 60%)
    const mediaMinAno = maxY * 0.60;
    const mediaY = toY(mediaMinAno);

    // Polyline coords
    const coords = pontos.map((p, i) => `${toX(i)},${toY(p.soma)}`).join(' ');

    svgEl.innerHTML = `
      <!-- Grid lines -->
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" stroke="#E2E8F0" stroke-width="1"/>
      <line x1="${padL}" y1="${padT + chartH}" x2="${padL + chartW}" y2="${padT + chartH}" stroke="#E2E8F0" stroke-width="1"/>
      <!-- Linha de média mínima (tracejada) -->
      <line x1="${padL}" y1="${mediaY}" x2="${padL + chartW}" y2="${mediaY}" stroke="#F59E0B" stroke-width="1.5" stroke-dasharray="5,4"/>
      <text x="${padL - 4}" y="${mediaY + 4}" text-anchor="end" fill="#D97706" font-size="9" font-family="Sora,sans-serif">mín</text>
      <!-- Área abaixo da linha -->
      <polygon points="${padL},${padT + chartH} ${coords} ${padL + chartW},${padT + chartH}" fill="rgba(37,99,235,0.07)"/>
      <!-- Linha de evolução -->
      <polyline points="${coords}" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Pontos e valores -->
      ${pontos.map((p, i) => {
        const cx = toX(i), cy = toY(p.soma);
        const abaixo = p.soma < p.media;
        const cor = abaixo ? '#EF4444' : '#2563EB';
        const labelY = cy > padT + 18 ? cy - 8 : cy + 16;
        return `
          <circle cx="${cx}" cy="${cy}" r="5" fill="${cor}" stroke="#fff" stroke-width="2"/>
          <text x="${cx}" y="${labelY}" text-anchor="middle" fill="${cor}" font-size="10" font-family="Sora,sans-serif" font-weight="700">${p.soma.toFixed(1)}</text>
        `;
      }).join('')}
      <!-- Labels eixo X -->
      ${pontos.map((p, i) => `<text x="${toX(i)}" y="${padT + chartH + 16}" text-anchor="middle" fill="#6E7BA8" font-size="10" font-family="Sora,sans-serif">${p.tri}º Tri</text>`).join('')}
      <!-- Label eixo Y (máximo) -->
      <text x="${padL - 4}" y="${padT + 4}" text-anchor="end" fill="#6E7BA8" font-size="9" font-family="Sora,sans-serif">${maxY}</text>
      <text x="${padL - 4}" y="${padT + chartH + 4}" text-anchor="end" fill="#6E7BA8" font-size="9" font-family="Sora,sans-serif">0</text>
    `;

    graficoEl.style.display = 'block';
  })();
}

function toggleFichaTri(id, header) {
  const el = document.getElementById(id);
  const aberto = el.style.display !== 'none';
  el.style.display = aberto ? 'none' : 'block';
  header.style.borderRadius = aberto ? '10px' : '10px 10px 0 0';
}

function _atualizarBotoesNavFicha() {
  const lista = window._fichaNavLista || [];
  const idx = window._fichaAlunoIndex ?? -1;
  const btnPrev = document.getElementById('ficha-btn-prev');
  const btnNext = document.getElementById('ficha-btn-next');
  const contador = document.getElementById('ficha-nav-contador');
  if (btnPrev) { btnPrev.disabled = idx <= 0; btnPrev.style.opacity = idx <= 0 ? '0.3' : '1'; }
  if (btnNext) { btnNext.disabled = idx >= lista.length - 1; btnNext.style.opacity = idx >= lista.length - 1 ? '0.3' : '1'; }
  if (contador && lista.length > 1) contador.textContent = `${idx + 1} de ${lista.length}`;
  else if (contador) contador.textContent = '';
}

function navegarFicha(dir) {
  const lista = window._fichaNavLista || [];
  const novoIdx = (window._fichaAlunoIndex ?? 0) + dir;
  if (novoIdx < 0 || novoIdx >= lista.length) return;
  const novoAluno = lista[novoIdx].aluno;
  if (novoAluno) abrirFichaAluno(novoAluno.id);
}

// ── Navegação de abas na Ficha do Aluno ──────────────────────────────────────
function fichaAbaSwitch(aba, alunoId) {
  const id = _idAluno(alunoId || window._fichaAlunoAtualId);
  const abas = ['notas', 'faltas'];
  abas.forEach(a => {
    const btn = document.getElementById(`ficha-aba-${a}`);
    const painel = document.getElementById(`ficha-painel-${a}`);
    const ativo = a === aba;
    if (btn) {
      btn.style.color = ativo ? 'var(--purple)' : 'var(--text-muted)';
      btn.style.borderBottom = ativo ? '2px solid var(--purple)' : '2px solid transparent';
    }
    if (painel) painel.style.display = ativo ? 'block' : 'none';
  });

  if (aba === 'faltas' && id) renderFichaFaltas(id);
}

// ── SELETOR DE ALUNO VISUAL ───────────────────────────────────────────────────
let _seletorAlunoCallback = null;
let _seletorAlunoSelecionadoId = null;

async function abrirSeletorAluno(callback, titulo) {
  if (!await garantirContextoCompleto()) { mostrarToast('Selecione uma turma para continuar.'); return; }
  await garantirAlunosTurma();
  _seletorAlunoCallback = callback;
  _seletorAlunoSelecionadoId = null;
  document.getElementById('seletor-aluno-titulo').textContent = titulo || 'Selecionar aluno';
  document.getElementById('seletor-aluno-busca').value = '';
  const confirmar = document.getElementById('seletor-aluno-confirmar');
  confirmar.disabled = true;
  confirmar.style.opacity = '0.5';
  _renderSeletorAlunos(alunosTurma);
  document.getElementById('modal-seletor-aluno').classList.add('open');
  setTimeout(() => document.getElementById('seletor-aluno-busca').focus(), 100);
}

function _renderSeletorAlunos(lista) {
  const grid = document.getElementById('seletor-aluno-grid');
  if (!lista.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">Nenhum aluno encontrado</div>`;
    return;
  }
  grid.innerHTML = lista.map(a => {
    const selecionado = _idAluno(a.id) === _idAluno(_seletorAlunoSelecionadoId);
    return `<div id="seletor-card-${a.id}" onclick="selecionarAlunoCard('${a.id}')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;border:1.5px solid ${selecionado ? 'var(--purple)' : 'var(--border)'};background:${selecionado ? 'var(--purple-light)' : 'var(--white)'};cursor:pointer;transition:all 0.12s;position:relative;" onmouseover="if('${a.id}'!==_seletorAlunoSelecionadoId)this.style.background='#F8FAFF'" onmouseout="if('${a.id}'!==_seletorAlunoSelecionadoId)this.style.background='var(--white)'">
      <div style="width:36px;height:36px;border-radius:50%;background:${selecionado ? 'var(--purple)' : 'var(--purple-light)'};display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:${selecionado ? '#fff' : 'var(--purple)'};flex-shrink:0;">${a.nome_completo.charAt(0)}</div>
      <span style="font-size:12px;font-weight:600;color:${selecionado ? 'var(--purple)' : 'var(--text)'};line-height:1.3;">${a.nome_completo}</span>
      ${selecionado ? `<div style="position:absolute;top:6px;right:6px;width:16px;height:16px;border-radius:50%;background:var(--purple);display:flex;align-items:center;justify-content:center;"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>` : ''}
    </div>`;
  }).join('');
}

function selecionarAlunoCard(alunoId) {
  _seletorAlunoSelecionadoId = alunoId;
  const busca = document.getElementById('seletor-aluno-busca').value;
  const filtrado = busca ? alunosTurma.filter(a => a.nome_completo.toLowerCase().includes(busca.toLowerCase())) : alunosTurma;
  _renderSeletorAlunos(filtrado);
  const confirmar = document.getElementById('seletor-aluno-confirmar');
  confirmar.disabled = false;
  confirmar.style.opacity = '1';
}

function filtrarSeletorAluno(busca) {
  const filtrado = busca ? alunosTurma.filter(a => a.nome_completo.toLowerCase().includes(busca.toLowerCase())) : alunosTurma;
  _renderSeletorAlunos(filtrado);
}

function confirmarSeletorAluno(event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  if (!_seletorAlunoSelecionadoId || !_seletorAlunoCallback) return;
  // Capturar localmente antes de limpar — evita race condition se callback alterar estado
  const cb = _seletorAlunoCallback;
  const idSelecionado = _seletorAlunoSelecionadoId;
  const aluno = alunosTurma.find(a => _idAluno(a.id) === _idAluno(idSelecionado));
  // Limpar estado do seletor ANTES de chamar callback
  _seletorAlunoCallback = null;
  _seletorAlunoSelecionadoId = null;
  document.getElementById('modal-seletor-aluno').classList.remove('open');
  // Pequeno delay para garantir que o modal fechou antes de abrir outro
  setTimeout(() => cb(idSelecionado, aluno?.nome_completo || ''), 50);
}

async function abrirHistoricoPresenca(alunoId, nomeAluno) {
  if (!await garantirContextoCompleto()) { mostrarToast('Selecione uma turma para continuar.'); return; }
  await garantirAlunosTurma();
  const aluno = await garantirAlunoNoContexto(alunoId);
  if (!aluno) return;
  const id = _idAluno(aluno.id);
  const nome = aluno.nome_completo || nomeAluno || '—';
  document.getElementById('hist-presenca-nome').textContent = nome;
  const el = document.getElementById('hist-presenca-body');
  el.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">Carregando...</div>`;
  document.getElementById('modal-historico-presenca').classList.add('open');

  try {
    const chamadas = await api(`chamadas?aluno_id=eq.${id}&select=aula_id,presente,aulas(id,data,nome)`) || [];
    if (!chamadas.length) {
      el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px;">Nenhuma chamada registrada para este aluno.</div>`;
      return;
    }

    const sorted = [...chamadas].sort((a, b) => {
      const da = a.aulas?.data || '';
      const db = b.aulas?.data || '';
      return db.localeCompare(da);
    });

    const total = sorted.length;
    const presentes = sorted.filter(c => c.presente).length;
    const faltas = total - presentes;
    const pct = total > 0 ? Math.round((presentes / total) * 100) : 100;
    const pctColor = pct < 75 ? '#DC2626' : pct < 85 ? '#D97706' : '#16A34A';

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
        <div style="text-align:center;padding:10px;background:#F0FDF4;border-radius:10px;border:1px solid #BBF7D0;">
          <div style="font-size:18px;font-weight:700;color:#16A34A;">${presentes}</div>
          <div style="font-size:10px;color:#166534;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">Presente</div>
        </div>
        <div style="text-align:center;padding:10px;background:#FEF2F2;border-radius:10px;border:1px solid #FBBFBF;">
          <div style="font-size:18px;font-weight:700;color:#DC2626;">${faltas}</div>
          <div style="font-size:10px;color:#DC2626;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">Faltas</div>
        </div>
        <div style="text-align:center;padding:10px;background:#F8FAFF;border-radius:10px;border:1px solid var(--border);">
          <div style="font-size:18px;font-weight:700;color:${pctColor};">${pct}%</div>
          <div style="font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">Frequência</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${sorted.map(c => {
          const dataISO = c.aulas?.data ? dataAulaOnly(c.aulas.data) : null;
          const dataFmt = dataISO ? dataISO.split('-').reverse().join('/') : '—';
          const aulaLabel = c.aulas?.nome || `Aula de ${dataFmt}`;
          const pres = c.presente !== false;
          return `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:${pres?'#F0FDF4':'#FEF2F2'};border:1px solid ${pres?'#BBF7D0':'#FBBFBF'};border-radius:8px;">
            <div style="width:24px;height:24px;border-radius:50%;background:${pres?'#DCFCE7':'#FEE2E2'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              ${pres
                ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>'
                : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'}
            </div>
            <span style="font-size:11px;font-weight:700;color:${pres?'#166534':'#B91C1C'};flex-shrink:0;">${dataFmt}</span>
            <span style="font-size:12px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${aulaLabel}</span>
          </div>`;
        }).join('')}
      </div>`;
  } catch(e) {
    el.innerHTML = `<div style="text-align:center;padding:32px;color:var(--danger);font-size:13px;">Erro ao carregar histórico.</div>`;
  }
}

async function renderFichaFaltas(alunoId) {
  const el = document.getElementById('ficha-faltas-lista');
  if (!el) return;
  el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">Carregando faltas...</div>`;

  try {
    // Buscar chamadas onde presente=false, com dados da aula
    const faltas = await api(`chamadas?aluno_id=eq.${alunoId}&presente=eq.false&select=aula_id,falta_abonada,falta_justificada,aulas(id,data,nome)`) || [];

    if (!faltas.length) {
      el.innerHTML = `<div style="text-align:center;padding:32px;color:#16A34A;font-size:13px;font-weight:600;">✅ Nenhuma falta registrada!</div>`;
      return;
    }

    // Ordenar por data desc
    const sorted = [...faltas].sort((a, b) => {
      const da = a.aulas?.data || '';
      const db = b.aulas?.data || '';
      return db.localeCompare(da);
    });

    // Agrupar por trimestre
    const triDatas = {
      1: { ini: `-02-04`, fim: `-05-20`, label: '1º Trimestre' },
      2: { ini: `-05-21`, fim: `-09-09`, label: '2º Trimestre' },
      3: { ini: `-09-10`, fim: `-12-18`, label: '3º Trimestre' },
    };
    const ano = new Date().getFullYear();
    function getTri(dataISO) {
      if (!dataISO) return null;
      for (const [tri, d] of Object.entries(triDatas)) {
        if (dataISO >= `${ano}${d.ini}` && dataISO <= `${ano}${d.fim}`) return parseInt(tri);
      }
      return null;
    }

    const grupos = { 1: [], 2: [], 3: [], null: [] };
    sorted.forEach(f => {
      const dataISO = f.aulas?.data ? dataAulaOnly(f.aulas.data) : null;
      const tri = getTri(dataISO);
      grupos[tri === null ? 'null' : tri].push({ ...f, dataISO });
    });

    // O contador exibido reflete faltas que realmente contam (exclui abonadas)
    const abonadasCount = faltas.filter(f => f.falta_abonada).length;
    const faltasCount = faltas.length - abonadasCount;

    let html = `<div style="margin-bottom:10px;padding:10px 14px;background:#FEF2F2;border:1px solid #FBBFBF;border-radius:10px;display:flex;align-items:center;gap:8px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span style="font-size:12px;font-weight:700;color:#DC2626;">Total: ${faltasCount} falta${faltasCount !== 1 ? 's' : ''}${abonadasCount ? ` (${abonadasCount} abonada${abonadasCount !== 1 ? 's' : ''}, não contam)` : ''}</span>
    </div>`;

    [1, 2, 3].forEach(tri => {
      const lista = grupos[tri];
      if (!lista.length) return;
      const contamTri = lista.filter(f => !f.falta_abonada).length;
      html += `
        <div style="margin-bottom:14px;">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;padding:6px 10px;background:#F1F5F9;border-radius:6px;">
            ${triDatas[tri].label} — ${contamTri} falta${contamTri !== 1 ? 's' : ''}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${lista.map(f => {
              const dataFmt = f.dataISO ? f.dataISO.split('-').reverse().join('/') : '—';
              const aulaLabel = f.aulas?.nome ? f.aulas.nome : `Aula de ${dataFmt}`;
              const cor = f.falta_abonada ? '#1E40AF' : '#B91C1C';
              const bg = f.falta_abonada ? '#EFF6FF' : '#FFF8F8';
              const borda = f.falta_abonada ? '#BFDBFE' : '#FBBFBF';
              const tag = f.falta_abonada ? ' · Abonada' : (f.falta_justificada ? ' · Justificada' : '');
              return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:${bg};border:1.5px solid ${borda};border-radius:8px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span style="font-size:12px;font-weight:600;color:${cor};flex-shrink:0;">${dataFmt}${tag}</span>
                <span style="font-size:12px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${aulaLabel}</span>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    });

    // Sem trimestre definido
    if (grupos['null']?.length) {
      html += `<div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;padding:6px 10px;background:#F1F5F9;border-radius:6px;">Sem período definido — ${grupos['null'].length}</div>
        ${grupos['null'].map(f => {
          const dataFmt = f.dataISO ? f.dataISO.split('-').reverse().join('/') : '—';
          return `<div style="padding:8px 12px;background:#FFF8F8;border:1px solid #FBBFBF;border-radius:8px;font-size:12px;color:#B91C1C;">${dataFmt}</div>`;
        }).join('')}
      </div>`;
    }

    el.innerHTML = html;
  } catch(e) {
    el.innerHTML = `<div style="text-align:center;padding:24px;color:var(--danger);font-size:13px;">Erro ao carregar faltas.</div>`;
  }
}

// Cache de bloqueio de trimestre (turmaId::tri -> boolean), válido por 2 min
const _bloqueioCache = {};
function _bloqueioKey(tri) { return `${turmaAtiva?.id}::${tri}`; }
function _bloqueioCacheLer(tri) {
  const e = _bloqueioCache[_bloqueioKey(tri)];
  if (!e) return undefined;
  if (Date.now() - e.ts > 120000) { delete _bloqueioCache[_bloqueioKey(tri)]; return undefined; }
  return e.v;
}
function _bloqueioCacheSet(tri, v) { _bloqueioCache[_bloqueioKey(tri)] = { v, ts: Date.now() }; }

// Verifica se o trimestre está fechado para a turma ativa
async function trimestresEstaFechado(tri) {
  if (!turmaAtiva) return false;
  const cached = _bloqueioCacheLer(tri);
  if (cached !== undefined) return cached;
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const tdId = turmaDisciplinaAtiva?.id;
  const query = tdId
    ? `trimestres_fechados?turma_disciplina_id=eq.${tdId}&trimestre=eq.${tri}&aberto_em=is.null&select=id&limit=1`
    : `trimestres_fechados?turma_id=eq.${turmaAtiva.id}&professor_id=eq.${profData.id}&trimestre=eq.${tri}&aberto_em=is.null&select=id&limit=1`;
  const res = await api(query);
  const v = !!(res && res.length > 0);
  _bloqueioCacheSet(tri, v);
  return v;
}

async function verificarBloqueio(tri) {
  const bloqueado = await trimestresEstaFechado(tri);
  if (bloqueado) {
    if (typeof mostrarErro === 'function') mostrarErro('Este trimestre está fechado. Contate o Administrador para reabrir.');
    else mostrarToast('Este trimestre está fechado. Contate o Administrador para reabrir.');
    return true;
  }
  return false;
}

// CABEÇALHO ÚNICO
function atualizarCabecalho({ info, titulo, detalhe, voltarFn, cor }) {
  const cab = document.getElementById('cabecalho-principal');
  const mh = document.getElementById('mobile-header');
  const corFinal = cor || 'var(--purple-dark)';
  cab.style.background = corFinal;
  cab.style.transition = 'background 0.3s ease';
  if (mh) { mh.style.background = corFinal; mh.style.transition = 'background 0.3s ease'; }
  document.getElementById('escola-bar-codigo').textContent = info || '';
  document.getElementById('escola-bar-nome').textContent = titulo || '';
  const bemVindo = document.getElementById('bem-vindo-txt');
  if (voltarFn) {
    bemVindo.innerHTML = `<button onclick="${voltarFn}()" style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:rgba(255,255,255,0.8);padding:6px 14px;border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
      ${detalhe || 'Voltar'}
    </button>`;
  } else {
    bemVindo.textContent = detalhe || '';
  }
}



let _mapaAtivo = null; // { id, nome, fileiras, colunas, posicoes:{}, professorPos:{x,y} }

function _mapaStorageKey() { return `mapas_sala_${turmaAtiva?.id}`; }
function _mapaCarregarTodos() { return JSON.parse(localStorage.getItem(_mapaStorageKey()) || '[]'); }
function _mapaSalvarTodos(lista) { localStorage.setItem(_mapaStorageKey(), JSON.stringify(lista)); }

function renderListaMapeamentos() {
  const grid = document.getElementById('mapa-lista-grid');
  if (!grid) return;
  const lista = _mapaCarregarTodos();
  if (!lista.length) {
    grid.innerHTML = '';
    return;
  }
  grid.innerHTML = lista.map((m, i) => `
    <div style="background:#fff;border:1.5px solid var(--border);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px;">
      <div style="width:38px;height:38px;border-radius:10px;background:#EDE9FE;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
      </div>
      <div style="flex:1;">
        <div style="font-size:14px;font-weight:700;color:var(--text);">${m.nome}</div>
        <div style="font-size:11px;color:var(--text-muted);">${m.fileiras} fileiras × ${m.colunas} colunas</div>
      </div>
      <button onclick="abrirMapaCanvas(${i})" style="padding:8px 14px;border-radius:8px;border:none;background:#8B5CF6;color:#fff;font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;">Abrir</button>
      <button onclick="excluirMapa(${i})" style="padding:8px;border-radius:8px;border:1.5px solid var(--border);background:none;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;" onmouseover="this.style.borderColor='var(--danger)';this.style.color='var(--danger)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </button>
    </div>
  `).join('');
}

function excluirMapa(idx) {
  const lista = _mapaCarregarTodos();
  lista.splice(idx, 1);
  _mapaSalvarTodos(lista);
  renderListaMapeamentos();
}

function abrirModalCriarMapa() {
  document.getElementById('mapa-input-nome').value = '';
  document.getElementById('mapa-input-fileiras').value = 4;
  document.getElementById('mapa-input-colunas').value = 5;
  document.getElementById('mapa-input-aleatorio').checked = false;
  const modal = document.getElementById('modal-criar-mapa');
  modal.style.display = 'flex';
}
function fecharModalCriarMapa() {
  document.getElementById('modal-criar-mapa').style.display = 'none';
}

function confirmarCriarMapa() {
  const nome = document.getElementById('mapa-input-nome').value.trim() || 'Mapa sem nome';
  const fileiras = Math.max(1, parseInt(document.getElementById('mapa-input-fileiras').value) || 4);
  const colunas  = Math.max(1, parseInt(document.getElementById('mapa-input-colunas').value)  || 5);
  const aleatorio = document.getElementById('mapa-input-aleatorio').checked;
  const novoMapa = { id: Date.now(), nome, fileiras, colunas, posicoes: {}, professorPos: { x: null, y: null } };
  const lista = _mapaCarregarTodos();
  lista.push(novoMapa);
  _mapaSalvarTodos(lista);
  fecharModalCriarMapa();
  abrirMapaCanvas(lista.length - 1, aleatorio);
}

function abrirMapaCanvas(idx, aleatorio) {
  const lista = _mapaCarregarTodos();
  _mapaAtivo = { ...lista[idx], _idx: idx };
  document.getElementById('mapa-lista-view').style.display = 'none';
  document.getElementById('mapa-canvas-view').style.display = 'block';
  document.getElementById('mapa-canvas-titulo').textContent = _mapaAtivo.nome;
  setTimeout(() => iniciarMapaSala(aleatorio), 50);
}

function voltarListaMapa() {
  _mapaAtivo = null;
  document.getElementById('mapa-canvas-view').style.display = 'none';
  document.getElementById('mapa-lista-view').style.display = 'block';
  renderListaMapeamentos();
}

function iniciarMapaSala(aleatorio) {
  const canvas = document.getElementById('mapa-canvas');
  if (!canvas || !_mapaAtivo) return;
  canvas.innerHTML = '';

  // Mesa do professor (arrastável)
  const profPos = _mapaAtivo.professorPos;
  const px = (profPos?.x != null) ? profPos.x : Math.floor(canvas.offsetWidth / 2) - 70;
  const py = (profPos?.y != null) ? profPos.y : 16;
  const mesa = document.createElement('div');
  mesa.id = 'mapa-mesa-prof';
  mesa.style.cssText = `position:absolute;left:${px}px;top:${py}px;background:#3B4FE4;color:#fff;border-radius:10px;padding:9px 22px;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.5px;cursor:grab;user-select:none;z-index:3;box-shadow:0 3px 12px rgba(59,79,228,0.3);white-space:nowrap;`;
  mesa.textContent = '▲ Mesa do Professor';
  _makeDraggable(mesa, canvas);
  canvas.appendChild(mesa);

  // Alunos
  let alunos = [...(alunosTurma || [])];
  if (aleatorio) alunos = alunos.sort(() => Math.random() - 0.5);

  const colW = 106, rowH = 84, startX = 20, startY = 80;
  alunos.forEach((a, i) => {
    const pos = _mapaAtivo.posicoes[a.id];
    const col = i % _mapaAtivo.colunas, row = Math.floor(i / _mapaAtivo.colunas);
    const x = pos ? pos.x : startX + col * colW;
    const y = pos ? pos.y : startY + row * rowH;
    const card = document.createElement('div');
    card.className = 'mapa-card';
    card.dataset.id = a.id;
    card.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:94px;background:#fff;border:1.5px solid #BFDBFE;border-radius:10px;padding:8px 6px;font-family:'Sora',sans-serif;font-size:10px;font-weight:600;color:#1B2550;text-align:center;cursor:grab;user-select:none;box-shadow:0 2px 8px rgba(37,99,235,0.08);z-index:1;`;
    const initials = a.nome_completo.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase();
    card.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:#EAF1FF;color:#2563EB;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto 5px;">${initials}</div><div style="line-height:1.3;word-break:break-word;">${a.nome_completo.split(' ').slice(0,2).join(' ')}</div>`;
    _makeDraggable(card, canvas);
    canvas.appendChild(card);
  });
}

function _makeDraggable(el, canvas) {
  let ox, oy;
  el.addEventListener('mousedown', start);
  el.addEventListener('touchstart', e => { const t = e.touches[0]; start({ clientX: t.clientX, clientY: t.clientY, preventDefault: ()=>e.preventDefault() }); }, { passive: false });
  function start(e) {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    ox = (e.clientX - r.left) - (er.left - r.left);
    oy = (e.clientY - r.top)  - (er.top  - r.top);
    el.style.cursor = 'grabbing';
    el.style.zIndex = 99;
    el.style.boxShadow = '0 6px 20px rgba(37,99,235,0.2)';
    function move(e) {
      const cx = e.clientX ?? e.touches[0].clientX;
      const cy = e.clientY ?? e.touches[0].clientY;
      const r = canvas.getBoundingClientRect();
      let nx = Math.max(0, Math.min(cx - r.left - ox, canvas.offsetWidth  - el.offsetWidth));
      let ny = Math.max(0, Math.min(cy - r.top  - oy, canvas.offsetHeight - el.offsetHeight));
      el.style.left = nx + 'px'; el.style.top = ny + 'px';
    }
    function end() {
      el.style.cursor = 'grab';
      el.style.zIndex = el.id === 'mapa-mesa-prof' ? 3 : 1;
      el.style.boxShadow = el.id === 'mapa-mesa-prof' ? '0 3px 12px rgba(59,79,228,0.3)' : '0 2px 8px rgba(37,99,235,0.08)';
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', end);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
  }
}

function salvarMapaSala() {
  const canvas = document.getElementById('mapa-canvas');
  if (!canvas || !_mapaAtivo) return;
  const posicoes = {};
  canvas.querySelectorAll('.mapa-card').forEach(c => {
    posicoes[c.dataset.id] = { x: parseInt(c.style.left), y: parseInt(c.style.top) };
  });
  const mesa = document.getElementById('mapa-mesa-prof');
  const professorPos = mesa ? { x: parseInt(mesa.style.left), y: parseInt(mesa.style.top) } : _mapaAtivo.professorPos;
  const lista = _mapaCarregarTodos();
  lista[_mapaAtivo._idx] = { ...lista[_mapaAtivo._idx], posicoes, professorPos };
  _mapaSalvarTodos(lista);
  _mapaAtivo.posicoes = posicoes;
  _mapaAtivo.professorPos = professorPos;
  mostrarToast('Mapa salvo!');
}

function resetarMapaSala() {
  if (!_mapaAtivo) return;
  const lista = _mapaCarregarTodos();
  lista[_mapaAtivo._idx].posicoes = {};
  lista[_mapaAtivo._idx].professorPos = { x: null, y: null };
  _mapaSalvarTodos(lista);
  _mapaAtivo.posicoes = {};
  _mapaAtivo.professorPos = { x: null, y: null };
  iniciarMapaSala(false);
  mostrarToast('Layout resetado.');
}





let _heatmapAtivo = false;

function toggleHeatmap() {
  _heatmapAtivo = !_heatmapAtivo;
  const btn = document.getElementById('btn-heatmap');
  if (btn) {
    btn.style.background = _heatmapAtivo ? '#F0FDF4' : 'var(--white)';
    btn.style.borderColor = _heatmapAtivo ? '#22C55E' : 'var(--border)';
    btn.style.color = _heatmapAtivo ? '#166534' : 'var(--text-muted)';
  }
  _aplicarHeatmap();
}

function _notaParaCor(nota, max) {
  if (nota === null || nota === undefined || isNaN(nota)) return null;
  const pct = Math.min(1, Math.max(0, Number(nota) / Number(max)));
  // Vermelho (#EF4444) → Amarelo (#FBBF24) → Verde (#22C55E)
  let r, g, b;
  if (pct >= 0.6) {
    // Amarelo → Verde  (t=0 amarelo, t=1 verde)
    const t = (pct - 0.6) / 0.4;
    r = Math.round(251 - (251 - 34)  * t);   // 251→34
    g = Math.round(191 + (197 - 191) * t);   // 191→197
    b = Math.round(36  + (94  - 36)  * t);   // 36→94
  } else {
    // Vermelho → Amarelo  (t=0 vermelho, t=1 amarelo)
    const t = pct / 0.6;
    r = Math.round(239 + (251 - 239) * t);   // 239→251
    g = Math.round(68  + (191 - 68)  * t);   // 68→191
    b = Math.round(68  - (68  - 36)  * t);   // 68→36
  }
  return `rgba(${r},${g},${b},0.18)`;
}

function _aplicarHeatmap() {
  const tbody = document.getElementById('relatorio-body');
  if (!tbody) return;

  if (!_heatmapAtivo) {
    // Remover cores
    tbody.querySelectorAll('td[data-nota]').forEach(td => {
      td.style.background = '';
    });
    return;
  }

  // Coletar todos os valores numéricos de cada coluna para calcular o max relativo
  const rows = Array.from(tbody.querySelectorAll('tr'));
  // Para cada td com data-nota, aplicar cor baseada em data-nota / data-max
  rows.forEach(tr => {
    tr.querySelectorAll('td[data-nota]').forEach(td => {
      const nota = parseFloat(td.dataset.nota);
      const max  = parseFloat(td.dataset.max || '10');
      const cor = _notaParaCor(nota, max);
      if (cor) td.style.background = cor;
    });
  });
}

// Patch em renderRelatorio para adicionar data-nota e data-max nas células
const _renderRelatorio_orig = renderRelatorio;
renderRelatorio = function(dados, avalTri) {
  _renderRelatorio_orig(dados, avalTri);
  // Após render, anotar as células de nota com data attributes
  const tbody = document.getElementById('relatorio-body');
  if (!tbody || !dados.length) return;
  const isFundI = isFundamentalI();
  const rows = Array.from(tbody.querySelectorAll('tr'));
  rows.forEach((tr, i) => {
    if (!dados[i]) return;
    const r = dados[i];
    const tds = Array.from(tr.querySelectorAll('td'));
    if (isFundI) {
      // Fundamental I: colunas são disciplinas, max 30 cada
      tds.slice(1, tds.length - 1).forEach(td => {
        const val = parseFloat(td.textContent);
        if (!isNaN(val)) { td.dataset.nota = val; td.dataset.max = 30; }
      });
    } else {
      // notas individuais
      // max vem de valoresDaDivisao() (compartilhada com avaliacoes.js);
      // fallback seguro para 30 se o cache ainda não tiver sido carregado
      const tri = parseInt(document.getElementById('sel-rel-tri')?.value || '1');
      const max = valoresDaDivisao(tri).max;
      // última td antes da de faltas é o total — anotar
      if (tds.length >= 2) {
        const tdTotal = tds[tds.length - 2];
        const val = parseFloat(tdTotal.textContent);
        if (!isNaN(val)) { tdTotal.dataset.nota = val; tdTotal.dataset.max = max; }
        // colunas de notas individuais (do índice 1 até penúltima-1)
        const pontosAval = avalTri ? avalTri.map(a => Number(a.pontos || 0)) : [];
        tds.slice(1, tds.length - 2).forEach((td, j) => {
          const val = parseFloat(td.textContent);
          const maxAval = pontosAval[j] || 10;
          if (!isNaN(val)) { td.dataset.nota = val; td.dataset.max = maxAval; }
        });
      }
    }
  });
  if (_heatmapAtivo) _aplicarHeatmap();
};

