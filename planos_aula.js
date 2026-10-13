/* ============================================================================
   SIDED+ — planos_aula.js   (requer planos_core.js carregado antes)
   Tela própria de Plano de Aula dentro de Planejamento. Sem IA.

   Em Planejamento, adicione um botão que chame:
     PlanosAula.abrirTela({
       professorId, professorNome,            // do usuário autenticado
       disciplinaId, disciplinaNome,          // componente curricular atual
       anoEscolar                             // opcional (filtra habilidades)
     });
   A tela abre por cima, com botão "Voltar ao planejamento"; não mexe no router.

   Tudo que depende do seu esquema fica em CFG (marcado "AJUSTAR").
   ========================================================================== */
(function (g) {
  'use strict';
  const C = g.PlanoCore;
  if (!C) throw new Error('planos_aula.js: carregue planos_core.js antes.');
  const { esc, norm, fmtData, vazio } = C;

  /* ───────────── CONFIG (AJUSTAR) ───────────── */
  const CFG = {
    client: () => g.sb || g.supabaseClient || g.supabase_client,       // AJUSTAR
    T: { modelos: 'plano_modelos', planos: 'plano_docs' },
    bucket: 'plano-modelos',
    async carregarTurmas(ctx, sb) {                                     // AJUSTAR → [{id, nome}]
      const { data, error } = await sb.from('turmas').select('id, nome')
        .eq('professor_id', ctx.professorId).eq('disciplina_id', ctx.disciplinaId).order('nome');
      if (error) throw error;
      return data || [];
    },
    async carregarHabilidades(ctx, sb) {                                // AJUSTAR → [{id, codigo, descricao}]
      let q = sb.from('habilidades_bncc').select('id, codigo, descricao');
      if (ctx.disciplinaId) q = q.eq('disciplina_id', ctx.disciplinaId);
      if (ctx.anoEscolar) q = q.eq('ano', ctx.anoEscolar);
      const { data, error } = await q.order('codigo');
      if (error) throw error;
      return data || [];
    }
  };

  // Modelo oficial versionado no GitHub (pasta modelos/ na raiz, servida pela Vercel).
  CFG.oficial = { url: '/modelos/plano_de_aula.docx', arquivo: 'plano_de_aula.docx', nome: 'Plano de aula (modelo oficial)' };

  const AUTO = ['professor_nome', 'disciplina'];
  const DERIVADAS = ['data_1', 'data_2', 'turmas', 'habilidade', ...AUTO];
  const OBRIGATORIAS = ['temas'];
  const LABELS = { temas: 'Tema(s)', objetivo: 'Objetivo(s)', metodos: 'Metodologia(s)', recursos: 'Recursos', conteudo: 'Conteúdo(s)', av: 'Avaliação(ões)', obs: 'Observações' };
  const MODELO_PADRAO = {
    nome: 'Plano de aula padrão',
    conteudo: ['# Plano de Aula', 'Professor(a): [professor_nome]', 'Período: [data_1] à [data_2]', 'Turma(s): [turmas]',
      'Componente curricular: [disciplina]', 'Tema(s): [temas]', 'Habilidade(s) BNCC: [habilidade]', 'Objetivo(s): [objetivo]',
      'Metodologia(s): [metodos]', 'Recursos: [recursos]', 'Conteúdo(s): [conteudo]', 'Avaliação(ões): [av]', 'Observações: [obs]'].join('\n')
  };
  const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const CSS = `
  .pa-tela{position:fixed;inset:0;z-index:1000;background:var(--bg,#F5F8FF);overflow:auto;font-family:'Sora',sans-serif;color:var(--text,#1B2550)}
  .pa-top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:14px;padding:12px 20px;background:var(--purple-dark,#3B4FE4);color:#fff}
  .pa-top .pa-btn{background:rgba(255,255,255,.15);border-color:transparent;color:#fff}
  .pa-body{max-width:900px;margin:0 auto;padding:22px 18px 60px}
  .pa *{box-sizing:border-box}
  .pa h3{font-size:17px;font-weight:700;margin:0 0 4px}
  .pa .pa-sub{font-size:12px;color:var(--text-muted,#6E7BA8);margin-bottom:16px}
  .pa .pa-box{background:#fff;border:1.5px solid var(--border,#DBE4FF);border-radius:14px;padding:16px 18px;margin-bottom:14px}
  .pa .pa-box.pa-err{border-color:var(--danger,#EF4444)}
  .pa label.pa-l{display:block;font-size:12px;font-weight:600;margin-bottom:6px}
  .pa .pa-req{color:var(--danger,#EF4444);margin-left:3px}
  .pa .pa-auto{font-size:12px;color:var(--text-muted,#6E7BA8)}
  .pa input[type=text],.pa input[type=date],.pa textarea{width:100%;padding:10px 12px;background:#F8FAFF;border:1.5px solid var(--border,#DBE4FF);border-radius:8px;font:13px 'Sora',sans-serif;color:inherit;outline:none}
  .pa textarea{resize:vertical;min-height:44px}
  .pa input:focus,.pa textarea:focus{border-color:var(--purple,#2563EB)}
  .pa-btn{padding:9px 16px;border-radius:9px;border:1.5px solid var(--border,#DBE4FF);background:#fff;font:600 13px 'Sora',sans-serif;color:var(--text,#1B2550);cursor:pointer}
  .pa-btn:hover{border-color:var(--purple,#2563EB);color:var(--purple,#2563EB)}
  .pa-btn.pri{background:var(--purple,#2563EB);border-color:var(--purple,#2563EB);color:#fff}
  .pa-btn.pri:hover{opacity:.9;color:#fff}
  .pa-btn.sm{padding:6px 11px;font-size:12px}
  .pa-btn.dng:hover{border-color:var(--danger,#EF4444);color:var(--danger,#EF4444)}
  .pa-btn:disabled{opacity:.5;cursor:not-allowed}
  .pa .pa-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .pa .pa-between{justify-content:space-between;margin-bottom:14px}
  .pa .pa-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:20px;border:1.5px solid var(--border,#DBE4FF);background:#fff;font:500 12px 'Sora',sans-serif;cursor:pointer}
  .pa .pa-chip.on{background:var(--purple-light,#E8F0FF);border-color:var(--purple,#2563EB);color:var(--purple,#2563EB)}
  .pa .pa-chip button{border:none;background:none;cursor:pointer;color:inherit;font-size:14px;line-height:1;padding:0}
  .pa .pa-msg{font-size:12px;color:var(--danger,#EF4444);margin-top:6px}
  .pa .pa-item{background:#fff;border:1.5px solid var(--border,#DBE4FF);border-radius:12px;padding:14px 16px;margin-bottom:10px}
  .pa .pa-item b{font-size:14px}
  .pa .pa-meta{font-size:12px;color:var(--text-muted,#6E7BA8);margin:4px 0 10px;line-height:1.6}
  .pa .pa-hab{position:relative}
  .pa .pa-hab-list{display:none;position:absolute;left:0;right:0;top:100%;margin-top:4px;max-height:280px;overflow:auto;background:#fff;border:1.5px solid var(--border,#DBE4FF);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:20}
  .pa .pa-hab-list.open{display:block}
  .pa .pa-opt{display:flex;gap:10px;padding:10px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border,#DBE4FF)}
  .pa .pa-opt:hover{background:var(--purple-light,#E8F0FF)}
  .pa .pa-opt input{margin-top:2px;accent-color:var(--purple,#2563EB)}
  .pa .pa-opt b{white-space:nowrap;font-size:12px}
  .pa .pa-sel{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:10px;background:var(--purple-light,#E8F0FF);margin-top:8px;font-size:12px}
  .pa .pa-sel div{flex:1}
  .pa .pa-sel button{border:none;background:none;cursor:pointer;font-size:18px;line-height:1;color:var(--text-muted,#6E7BA8)}
  .pa .pa-sel button:hover{color:var(--danger,#EF4444)}
  .pa .pa-vars{font-size:11px;color:var(--text-muted,#6E7BA8);margin-top:6px}
  .pa .pa-doc{background:#fff;border:1.5px solid var(--border,#DBE4FF);border-radius:14px;padding:28px 32px;font-size:13px;line-height:1.55;margin-bottom:14px}
  .pa .pa-doc h2{font-size:18px;margin:0 0 14px;text-align:center}
  .pa .pa-doc p{margin:0 0 6px;white-space:pre-wrap}
  .pa .pa-gap{height:10px}
  .pa .pa-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1B2550;color:#fff;padding:10px 16px;border-radius:10px;font-size:13px;z-index:9999;max-width:90%}
  .pa .pa-aviso{background:#FEF3C7;border:1px solid #FDE68A;color:#92400E;border-radius:10px;padding:10px 14px;font-size:12px;margin-bottom:14px}
  @media(max-width:600px){.pa .pa-doc{padding:18px}.pa-body{padding:16px 12px 60px}}`;

  /* ───────────── helpers ───────────── */
  const dt = iso => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'plano';
  const arr = v => (Array.isArray(v) ? v : []);
  function periodo(datas) {
    const d = arr(datas).slice().sort();
    if (!d.length) return '—';
    return d.length === 1 ? fmtData(d[0]) : `${fmtData(d[0])} à ${fmtData(d[d.length - 1])} (${d.length} datas)`;
  }
  function baixar(bytesOuBlob, nome, mime) {
    const blob = bytesOuBlob instanceof Blob ? bytesOuBlob : new Blob([bytesOuBlob], { type: mime });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  /** Valores finais de um plano (usado ao salvar e ao exportar DOCX). */
  function montarValores(p) {
    const datas = arr(p.datas).slice().sort();
    const v = Object.assign({}, p.valores);
    v.professor_nome = p.professor_nome; v.disciplina = p.disciplina_nome;
    v.data_1 = datas.length ? fmtData(datas[0]) : '';
    v.data_2 = datas.length > 1 ? fmtData(datas[datas.length - 1]) : '';
    v.turmas = arr(p.turmas).map(t => t.nome).join(', ');
    v.habilidade = arr(p.habilidades).map(h => `${h.codigo} — ${h.descricao}`).join('\n');
    return v;
  }

  /* ───────────────────────── TELA ───────────────────────── */
  function abrirTela(ctx) {
    injetarCss();
    const antiga = document.getElementById('pa-tela'); if (antiga) antiga.remove();
    const t = document.createElement('div'); t.id = 'pa-tela'; t.className = 'pa-tela pa';
    t.innerHTML = '<div class="pa-top"><button class="pa-btn sm" id="pa-voltar">← Voltar ao planejamento</button><b>Plano de aula</b></div><div class="pa-body" id="pa-root"></div>';
    document.body.appendChild(t);
    t.querySelector('#pa-voltar').onclick = () => t.remove();
    montar(t.querySelector('#pa-root'), ctx);
  }
  function injetarCss() {
    if (document.getElementById('pa-style')) return;
    const s = document.createElement('style'); s.id = 'pa-style'; s.textContent = CSS; document.head.appendChild(s);
  }

  function montar(app, ctx) {
    const sb = () => { const c = CFG.client(); if (!c) throw new Error('Cliente Supabase não encontrado. Ajuste CFG.client em planos_aula.js.'); return c; };
    const toast = m => { const d = document.createElement('div'); d.className = 'pa-toast'; d.textContent = m; document.body.appendChild(d); setTimeout(() => d.remove(), 3500); };
    const aviso = (m) => { const d = document.createElement('div'); d.className = 'pa-aviso'; d.textContent = m; return d; };
    let S = null; // estado do formulário

    /* ═════════ LISTA ═════════ */
    async function viewLista() {
      app.innerHTML = `<div class="pa-row pa-between"><div><h3>Meus planos de aula</h3><div class="pa-sub" style="margin:0">Seus planos ficam salvos e não expiram.</div></div>
        <div class="pa-row"><button class="pa-btn pri" id="pa-novo">Novo plano</button><button class="pa-btn" id="pa-mod">Modelos</button></div></div>
        <input type="text" id="pa-busca" placeholder="Buscar por tema…" style="margin-bottom:14px"><div id="pa-lista">Carregando…</div>`;
      app.querySelector('#pa-novo').onclick = () => viewModelos(true);
      app.querySelector('#pa-mod').onclick = () => viewModelos(false);
      let planos = [];
      try {
        const { data, error } = await sb().from(CFG.T.planos)
          .select('id, tema, disciplina_nome, datas, turmas, atualizado_em')
          .eq('professor_id', ctx.professorId).order('atualizado_em', { ascending: false });
        if (error) throw error; planos = data || [];
      } catch (e) { app.querySelector('#pa-lista').innerHTML = `<div class="pa-msg">Não foi possível carregar os planos: ${esc(e.message)}</div>`; return; }

      const box = app.querySelector('#pa-lista');
      const desenhar = () => {
        const termo = norm(app.querySelector('#pa-busca').value);
        const f = planos.filter(p => !termo || norm(p.tema).includes(termo));
        box.innerHTML = f.length ? f.map(p => `<div class="pa-item"><b>${esc(p.tema || '(sem tema)')}</b>
          <div class="pa-meta">${esc(p.disciplina_nome || '—')} · Turma(s): ${esc(arr(p.turmas).map(t => t.nome).join(', ') || '—')}<br>
          Data(s): ${esc(periodo(p.datas))} · Atualizado em ${esc(dt(p.atualizado_em))}</div>
          <div class="pa-row" data-id="${esc(p.id)}">
            <button class="pa-btn sm pri" data-a="ver">Visualizar</button><button class="pa-btn sm" data-a="editar">Editar</button>
            <button class="pa-btn sm" data-a="clonar">Clonar</button><button class="pa-btn sm dng" data-a="excluir">Excluir</button></div></div>`).join('')
          : '<div class="pa-sub">' + (planos.length ? 'Nenhum plano encontrado para essa busca.' : 'Você ainda não tem planos. Clique em "Novo plano".') + '</div>';
      };
      desenhar();
      app.querySelector('#pa-busca').addEventListener('input', desenhar);
      box.addEventListener('click', ev => {
        const a = ev.target.dataset && ev.target.dataset.a; const id = ev.target.parentElement && ev.target.parentElement.dataset.id;
        if (a && id) acao(a, id);
      });
    }

    async function getPlano(id) {
      const { data, error } = await sb().from(CFG.T.planos).select('*').eq('id', id).single();
      if (error) throw error; return data;
    }

    async function acao(a, id) {
      try {
        if (a === 'excluir') return excluir(id);
        const p = await getPlano(id);
        if (a === 'ver') viewPlano(p);
        if (a === 'editar') iniciarForm('editar', p);
        if (a === 'clonar') iniciarForm('clonar', p);
      } catch (e) { toast('Erro: ' + e.message); }
    }

    async function excluir(id) {
      if (!confirm('Excluir este plano de aula? Esta ação não pode ser desfeita.\nO modelo e as habilidades BNCC não serão apagados.')) return;
      const { error } = await sb().from(CFG.T.planos).delete().eq('id', id).eq('professor_id', ctx.professorId);
      if (error) return toast('Erro ao excluir: ' + error.message);
      toast('Plano excluído.'); viewLista();
    }

    /* ═════════ VISUALIZAÇÃO (versão digital) ═════════ */
    function viewPlano(p) {
      app.innerHTML = `<div class="pa-row pa-between"><button class="pa-btn sm" id="pa-lst">← Meus planos</button></div>
        <h3>${esc(p.tema || 'Plano de aula')}</h3><div class="pa-sub">Atualizado em ${esc(dt(p.atualizado_em))}</div>
        <div class="pa-doc">${C.textoParaHtml(p.texto_final)}</div>
        <div class="pa-row" data-id="${esc(p.id)}">
          <button class="pa-btn" data-a="editar">Editar</button><button class="pa-btn" data-a="clonar">Clonar</button>
          <button class="pa-btn" data-a="pdf">Exportar PDF</button><button class="pa-btn" data-a="docx">Exportar DOCX</button>
          <button class="pa-btn dng" data-a="excluir">Excluir</button></div>`;
      app.querySelector('#pa-lst').onclick = viewLista;
      app.querySelector('[data-id]').addEventListener('click', ev => {
        const a = ev.target.dataset && ev.target.dataset.a; if (!a) return;
        if (a === 'pdf') exportarPdf(p);
        else if (a === 'docx') exportarDocx(p, ev.target);
        else if (a === 'editar') iniciarForm('editar', p);
        else if (a === 'clonar') iniciarForm('clonar', p);
        else if (a === 'excluir') excluir(p.id);
      });
    }

    /* ═════════ EXPORTAÇÃO ═════════ */
    // PDF: abre a versão formatada na impressão do navegador ("Salvar como PDF"). Sem biblioteca extra.
    function exportarPdf(p) {
      const w = window.open('', '_blank'); if (!w) return toast('Permita pop-ups para exportar o PDF.');
      w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(p.tema || 'Plano de aula')}</title>
        <style>@page{size:A4;margin:20mm}body{font-family:Arial,sans-serif;font-size:13px;line-height:1.55;color:#000}
        h2{text-align:center;font-size:18px;margin:0 0 16px}p{margin:0 0 6px;white-space:pre-wrap}.pa-gap{height:10px}</style></head>
        <body>${C.textoParaHtml(p.texto_final)}</body></html>`);
      w.document.close(); w.focus(); setTimeout(() => w.print(), 250);
    }

    async function exportarDocx(p, btn) {
      const rot = btn.textContent; btn.disabled = true; btn.textContent = 'Gerando…';
      const nome = `Plano de aula - ${slug(p.tema)}.docx`;
      try {
        let bytes = null;
        if (p.modelo_arquivo_path) {
          try {
            const { data, error } = await sb().storage.from(CFG.bucket).download(p.modelo_arquivo_path);
            if (error) throw error;
            bytes = await C.preencherDocx(await data.arrayBuffer(), montarValores(p)); // modelo original intacto
          } catch (e) { toast('Modelo .docx indisponível; gerando versão simples. (' + e.message + ')'); }
        }
        if (!bytes) bytes = await C.gerarDocx(p.texto_final);
        baixar(bytes, nome, MIME_DOCX);
      } catch (e) { toast('Erro ao exportar DOCX: ' + e.message); }
      btn.disabled = false; btn.textContent = rot;
    }

    /* ═════════ MODELOS ═════════ */
    async function viewModelos(escolher) {
      app.innerHTML = `<div class="pa-row pa-between"><button class="pa-btn sm" id="pa-lst">← Meus planos</button></div>
        <h3>${escolher ? 'Escolha o modelo do novo plano' : 'Modelos'}</h3>
        <div class="pa-sub">Modelos .docx mantêm a formatação do arquivo original, que nunca é alterado. Marque as variáveis no Word como [temas], [habilidade] etc.</div>
        <div id="pa-ml">Carregando…</div>
        <div class="pa-row" style="margin-top:12px"><button class="pa-btn pri" id="pa-of">Usar modelo oficial</button>
        <button class="pa-btn" id="pa-imp">Importar modelo .docx</button>
        <button class="pa-btn" id="pa-txt">Novo modelo de texto</button><input type="file" id="pa-file" accept=".docx" hidden></div>`;
      app.querySelector('#pa-lst').onclick = viewLista;
      app.querySelector('#pa-of').onclick = usarOficial;
      app.querySelector('#pa-txt').onclick = () => viewEditorTexto(null);
      const fi = app.querySelector('#pa-file');
      app.querySelector('#pa-imp').onclick = () => fi.click();
      fi.onchange = () => { if (fi.files[0]) importarDocx(fi.files[0]); fi.value = ''; };
      let ms = [];
      try {
        const { data, error } = await sb().from(CFG.T.modelos).select('id, nome, conteudo, arquivo_path, arquivo_nome').eq('ativo', true).order('nome');
        if (error) throw error; ms = data || [];
      } catch (e) { app.querySelector('#pa-ml').innerHTML = `<div class="pa-msg">Não foi possível carregar os modelos: ${esc(e.message)}</div>`; return; }
      const box = app.querySelector('#pa-ml');
      box.innerHTML = ms.length ? '' : '<div class="pa-sub">Nenhum modelo ainda. Importe um .docx ou crie o modelo padrão.</div>';
      ms.forEach(m => {
        const el = document.createElement('div'); el.className = 'pa-item';
        el.innerHTML = `<b>${esc(m.nome)}</b><div class="pa-meta">${m.arquivo_path ? 'Arquivo .docx: ' + esc(m.arquivo_nome || '') : 'Modelo de texto'} · Variáveis: ${esc(C.parseVariaveis(m.conteudo).map(v => '[' + v + ']').join(' ') || 'nenhuma')}</div>
          <div class="pa-row"><button class="pa-btn sm pri" data-a="usar">Usar</button><button class="pa-btn sm" data-a="editar">${m.arquivo_path ? 'Renomear' : 'Editar'}</button><button class="pa-btn sm dng" data-a="excluir">Excluir</button></div>`;
        el.addEventListener('click', async ev => {
          const a = ev.target.dataset && ev.target.dataset.a; if (!a) return;
          if (a === 'usar') iniciarForm('novo', null, m);
          if (a === 'editar') m.arquivo_path ? renomear(m) : viewEditorTexto(m);
          if (a === 'excluir' && confirm(`Excluir o modelo "${m.nome}"? Planos já criados continuam funcionando.`)) {
            const { error } = await sb().from(CFG.T.modelos).update({ ativo: false }).eq('id', m.id);
            if (error) return toast('Erro: ' + error.message); viewModelos(escolher);
          }
        });
        box.appendChild(el);
      });
      if (!ms.length) {
        const b = document.createElement('button'); b.className = 'pa-btn'; b.textContent = 'Criar modelo padrão';
        b.onclick = async () => {
          const { error } = await sb().from(CFG.T.modelos).insert({ nome: MODELO_PADRAO.nome, conteudo: MODELO_PADRAO.conteudo, ativo: true, criado_por: ctx.professorId });
          if (error) return toast('Erro: ' + error.message); viewModelos(escolher);
        };
        box.appendChild(b);
      }
    }

    async function renomear(m) {
      const nome = prompt('Novo nome do modelo:', m.nome); if (!nome || !nome.trim()) return;
      const { error } = await sb().from(CFG.T.modelos).update({ nome: nome.trim() }).eq('id', m.id);
      if (error) return toast('Erro: ' + error.message); viewModelos(false);
    }

    // Busca o modelo oficial publicado junto com o SIDED+ (modelos/plano_de_aula.docx) e importa.
    async function usarOficial() {
      const O = CFG.oficial;
      try {
        const { data: ja } = await sb().from(CFG.T.modelos).select('id').eq('arquivo_nome', O.arquivo).eq('ativo', true);
        if (ja && ja.length && !confirm('O modelo oficial já está na lista. Importar de novo como uma nova versão?')) return;
        const r = await fetch(O.url, { cache: 'no-store' });
        if (!r.ok) throw new Error(`arquivo não encontrado em ${O.url} (HTTP ${r.status}). Confira se ele está na pasta modelos/ do repositório.`);
        const file = new File([await r.blob()], O.arquivo, { type: MIME_DOCX });
        const nome = ja && ja.length ? `${O.nome} (${new Date().toLocaleDateString('pt-BR')})` : O.nome;
        await importarDocx(file, { nome });
      } catch (e) { toast('Não foi possível usar o modelo oficial: ' + e.message); }
    }

    async function importarDocx(file, opt) {
      opt = opt || {};
      try {
        const buf = await file.arrayBuffer();
        const info = await C.lerDocx(buf);
        if (!info.variaveis.length && !confirm('Nenhuma variável [nome] foi encontrada neste arquivo. Importar mesmo assim?')) return;
        const nome = opt.nome || prompt('Nome do modelo:', file.name.replace(/\.docx$/i, '')); if (!nome || !nome.trim()) return;
        const path = `${ctx.professorId}/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, '_')}`; // nunca sobrescreve
        const up = await sb().storage.from(CFG.bucket).upload(path, file, { contentType: MIME_DOCX, upsert: false });
        if (up.error) throw up.error;
        const { error } = await sb().from(CFG.T.modelos).insert({ nome: nome.trim(), conteudo: info.texto, arquivo_path: path, arquivo_nome: file.name, ativo: true, criado_por: ctx.professorId });
        if (error) throw error;
        toast(`Modelo importado. Variáveis: ${info.variaveis.join(', ') || 'nenhuma'}`); viewModelos(false);
      } catch (e) { toast('Erro ao importar: ' + e.message); }
    }

    function viewEditorTexto(m) {
      const at = m || { nome: '', conteudo: '' };
      const sug = ['professor_nome', 'disciplina', 'data_1', 'data_2', 'turmas', 'temas', 'habilidade', 'objetivo', 'metodos', 'recursos', 'conteudo', 'av', 'obs'];
      app.innerHTML = `<h3>${m ? 'Editar modelo' : 'Novo modelo de texto'}</h3><div class="pa-sub">Linhas que começam com "# " viram título.</div>
        <div class="pa-box"><label class="pa-l">Nome<span class="pa-req">*</span></label><input type="text" id="pa-nome" maxlength="120" value="${esc(at.nome)}">
        <label class="pa-l" style="margin-top:12px">Conteúdo</label><textarea id="pa-cont" rows="16" style="font-family:'Space Mono',monospace;font-size:12px">${esc(at.conteudo)}</textarea>
        <div class="pa-row" style="margin-top:8px" id="pa-ins">${sug.map(v => `<button type="button" class="pa-chip" data-v="${v}">[${v}]</button>`).join('')}</div>
        <div class="pa-vars" id="pa-det"></div><div class="pa-msg" id="pa-msg"></div></div>
        <div class="pa-row"><button class="pa-btn pri" id="pa-sv">Salvar modelo</button><button class="pa-btn" id="pa-cn">Cancelar</button></div>`;
      const ta = app.querySelector('#pa-cont');
      const det = () => { app.querySelector('#pa-det').textContent = 'Variáveis detectadas: ' + (C.parseVariaveis(ta.value).map(v => `[${v}]`).join(' ') || 'nenhuma'); };
      det(); ta.addEventListener('input', det);
      app.querySelector('#pa-ins').addEventListener('click', ev => {
        const v = ev.target.dataset && ev.target.dataset.v; if (!v) return;
        const i = ta.selectionStart, f = ta.selectionEnd, tx = `[${v}]`;
        ta.value = ta.value.slice(0, i) + tx + ta.value.slice(f); ta.focus(); ta.selectionStart = ta.selectionEnd = i + tx.length; det();
      });
      app.querySelector('#pa-cn').onclick = () => viewModelos(false);
      app.querySelector('#pa-sv').onclick = async () => {
        const nome = app.querySelector('#pa-nome').value.trim();
        if (!nome) { app.querySelector('#pa-msg').textContent = 'Informe o nome do modelo.'; return; }
        const reg = { nome, conteudo: ta.value };
        const { error } = await (m ? sb().from(CFG.T.modelos).update(reg).eq('id', m.id)
          : sb().from(CFG.T.modelos).insert(Object.assign(reg, { ativo: true, criado_por: ctx.professorId })));
        if (error) { app.querySelector('#pa-msg').textContent = 'Erro ao salvar: ' + error.message; return; }
        viewModelos(false);
      };
    }

    /* ═════════ FORMULÁRIO (novo / editar / clonar) ═════════ */
    function iniciarForm(modo, plano, modelo) {
      const base = plano ? {
        id: modo === 'editar' ? plano.id : null,
        modelo: { id: plano.modelo_id, nome: plano.tema, conteudo: plano.modelo_conteudo || plano.texto_final, arquivo_path: plano.modelo_arquivo_path },
        valores: Object.assign({}, plano.valores),
        datas: arr(plano.datas).slice(),
        turmasSel: arr(plano.turmas).map(t => String(t.id)),
        turmasSnap: arr(plano.turmas).map(t => ({ id: String(t.id), nome: t.nome })),
        habs: arr(plano.habilidades)
      } : { id: null, modelo, valores: {}, datas: [], turmasSel: [], turmasSnap: [], habs: [] };
      S = { modo, id: base.id, modelo: base.modelo, valores: base.valores, datas: base.datas, turmasSel: base.turmasSel,
        turmas: base.turmasSnap, turmasOk: false, habs: [], habsOk: false,
        habsSel: new Map(base.habs.map(h => [String(h.id), h])) };
      viewForm();
    }

    const vars = () => C.parseVariaveis(S.modelo.conteudo);

    function viewForm() {
      const titulo = { novo: 'Novo plano de aula', editar: 'Editar plano de aula', clonar: 'Clonar plano de aula' }[S.modo];
      app.innerHTML = `<h3>${titulo}</h3><div class="pa-sub">Itens com * são obrigatórios.</div><div id="pa-av"></div><div id="pa-campos"></div>
        <div class="pa-box" id="pa-pv" style="display:none"></div>
        <div class="pa-row"><button class="pa-btn pri" id="pa-salvar">${S.modo === 'editar' ? 'Salvar alterações' : 'Salvar plano'}</button>
        <button class="pa-btn" id="pa-prev">Pré-visualizar</button><button class="pa-btn" id="pa-cancel">Cancelar</button></div>`;
      if (S.modo === 'clonar') app.querySelector('#pa-av').appendChild(aviso('Você está criando uma cópia. O plano original não será alterado. Ajuste turmas, datas e conteúdo antes de salvar.'));
      const box = app.querySelector('#pa-campos');
      const add = (id) => { const d = document.createElement('div'); d.className = 'pa-box'; d.id = 'pa-b-' + id; box.appendChild(d); return d; };
      let datas = false;
      vars().forEach(v => {
        if (AUTO.includes(v)) {
          const val = v === 'professor_nome' ? ctx.professorNome : ctx.disciplinaNome;
          add(v).innerHTML = `<label class="pa-l">${v === 'professor_nome' ? 'Professor(a)' : 'Componente curricular'}</label><div class="pa-auto">${esc(val || '—')} <i>(preenchido automaticamente)</i></div>`;
        } else if (v === 'data_1' || v === 'data_2') { if (!datas) { datas = true; compDatas(add('datas')); } }
        else if (v === 'turmas') compTurmas(add('turmas'));
        else if (v === 'habilidade') compHabilidades(add('habilidade'));
        else compTexto(add(v), v);
      });
      app.querySelector('#pa-cancel').onclick = viewLista;
      app.querySelector('#pa-prev').onclick = () => {
        const pv = app.querySelector('#pa-pv'); pv.style.display = 'block';
        pv.innerHTML = '<div class="pa-doc" style="margin:0">' + C.textoParaHtml(C.renderizar(S.modelo.conteudo, montarValores(planoAtual()))) + '</div>';
      };
      app.querySelector('#pa-salvar').onclick = salvar;
    }

    function erro(id, msg) {
      const b = app.querySelector('#pa-b-' + id); if (!b) return;
      b.classList.toggle('pa-err', !!msg);
      let m = b.querySelector('.pa-msg-v'); if (!m) { m = document.createElement('div'); m.className = 'pa-msg pa-msg-v'; b.appendChild(m); }
      m.textContent = msg || '';
    }

    function compTexto(el, v) {
      const obrig = OBRIGATORIAS.includes(v);
      el.innerHTML = `<label class="pa-l" for="pa-f-${v}">${esc(LABELS[v] || v)}${obrig ? '<span class="pa-req">*</span>' : ''}</label><textarea id="pa-f-${v}" rows="${v === 'temas' ? 2 : 3}" maxlength="5000"></textarea>`;
      const ta = el.querySelector('textarea'); ta.value = S.valores[v] || '';
      ta.addEventListener('input', () => { S.valores[v] = ta.value; if (obrig && ta.value.trim()) erro(v, ''); });
    }

    function compDatas(el) {
      el.innerHTML = `<label class="pa-l">Data(s) da aula<span class="pa-req">*</span></label>
        <div class="pa-row"><input type="date" id="pa-d-in" style="max-width:180px"><button type="button" class="pa-btn" id="pa-d-add">Adicionar data</button></div>
        <div class="pa-row" id="pa-d-l" style="margin-top:8px"></div>`;
      const l = el.querySelector('#pa-d-l');
      const draw = () => { S.datas.sort(); l.innerHTML = S.datas.map(d => `<span class="pa-chip on">${fmtData(d)}<button type="button" data-d="${d}" aria-label="Remover ${fmtData(d)}">×</button></span>`).join(''); };
      draw();
      el.querySelector('#pa-d-add').onclick = () => {
        const i = el.querySelector('#pa-d-in'); if (!i.value) return erro('datas', 'Escolha uma data para adicionar.');
        if (S.datas.includes(i.value)) return erro('datas', 'Essa data já foi adicionada.');
        S.datas.push(i.value); i.value = ''; erro('datas', ''); draw();
      };
      l.addEventListener('click', ev => { const d = ev.target.dataset && ev.target.dataset.d; if (d) { S.datas = S.datas.filter(x => x !== d); draw(); } });
    }

    async function compTurmas(el) {
      el.innerHTML = '<label class="pa-l">Turma(s)<span class="pa-req">*</span></label><div id="pa-t">Carregando turmas…</div>';
      const corpo = el.querySelector('#pa-t');
      if (!S.turmasOk) {
        try {
          const car = (await CFG.carregarTurmas(ctx, sb())).map(t => ({ id: String(t.id), nome: t.nome }));
          S.turmas.forEach(t => { if (!car.some(c => c.id === t.id)) car.push(t); }); // mantém turmas já vinculadas ao plano
          S.turmas = car; S.turmasOk = true;
        } catch (e) { corpo.innerHTML = `<div class="pa-msg">Não foi possível carregar as turmas: ${esc(e.message)}</div>`; return; }
      }
      if (!S.turmas.length) { corpo.innerHTML = '<div class="pa-auto">Nenhuma turma disponível para este componente curricular.</div>'; return; }
      const draw = () => {
        const sel = S.turmas.filter(t => S.turmasSel.includes(t.id)), disp = S.turmas.filter(t => !S.turmasSel.includes(t.id));
        corpo.innerHTML = `<div class="pa-row">${sel.length ? sel.map(t => `<span class="pa-chip on">${esc(t.nome)}<button type="button" data-rm="${esc(t.id)}" aria-label="Remover ${esc(t.nome)}">×</button></span>`).join('') : '<span class="pa-auto">Nenhuma turma selecionada.</span>'}</div>
          ${disp.length ? `<div class="pa-auto" style="margin:10px 0 6px">Adicionar:</div><div class="pa-row">${disp.map(t => `<button type="button" class="pa-chip" data-add="${esc(t.id)}">${esc(t.nome)}</button>`).join('')}</div>` : ''}`;
      };
      draw();
      corpo.addEventListener('click', ev => {
        const a = ev.target.dataset || {};
        if (a.add != null) { if (!S.turmasSel.includes(a.add)) S.turmasSel.push(a.add); erro('turmas', ''); draw(); }
        if (a.rm != null) { S.turmasSel = S.turmasSel.filter(x => x !== a.rm); draw(); }
      });
    }

    async function compHabilidades(el) {
      el.innerHTML = `<label class="pa-l">Habilidades BNCC<span class="pa-req">*</span></label>
        <div class="pa-hab"><input type="text" id="pa-h-q" placeholder="Pesquisar por código ou palavras da descrição…" autocomplete="off"><div class="pa-hab-list" id="pa-h-l"></div></div><div id="pa-h-s"></div>`;
      const q = el.querySelector('#pa-h-q'), list = el.querySelector('#pa-h-l'), sel = el.querySelector('#pa-h-s');
      const idS = h => String(h.id);
      const drawSel = () => {
        sel.innerHTML = [...S.habsSel.values()].map(h => `<div class="pa-sel"><div><b>${esc(h.codigo)}</b> — ${esc(h.descricao)}</div><button type="button" data-rm="${esc(idS(h))}" aria-label="Remover ${esc(h.codigo)}">×</button></div>`).join('')
          || '<div class="pa-auto" style="margin-top:8px">Nenhuma habilidade selecionada.</div>';
      };
      drawSel();
      if (!S.habsOk) {
        list.textContent = 'Carregando…';
        try { S.habs = await CFG.carregarHabilidades(ctx, sb()); S.habsOk = true; }
        catch (e) { q.disabled = true; sel.insertAdjacentHTML('beforeend', `<div class="pa-msg">Não foi possível carregar as habilidades: ${esc(e.message)}</div>`); return; }
      }
      const drawList = () => {
        const t = norm(q.value);
        const ach = S.habs.filter(h => !t || norm(h.codigo).includes(t) || norm(h.descricao).includes(t)), m = ach.slice(0, 80);
        list.innerHTML = m.map(h => `<label class="pa-opt"><input type="checkbox" data-id="${esc(idS(h))}" ${S.habsSel.has(idS(h)) ? 'checked' : ''}><span><b>${esc(h.codigo)}</b> — ${esc(h.descricao)}</span></label>`).join('')
          + (ach.length > 80 ? `<div class="pa-opt" style="cursor:default">Mostrando 80 de ${ach.length}. Refine a busca.</div>` : '')
          || '<div class="pa-opt" style="cursor:default">Nenhuma habilidade encontrada.</div>';
      };
      drawList();
      q.addEventListener('focus', () => { drawList(); list.classList.add('open'); });
      q.addEventListener('input', () => { drawList(); list.classList.add('open'); });
      list.addEventListener('change', ev => {
        const id = ev.target.dataset && ev.target.dataset.id; if (id == null) return;
        const h = S.habs.find(x => idS(x) === id); if (!h) return;
        if (ev.target.checked) S.habsSel.set(id, { id: h.id, codigo: h.codigo, descricao: h.descricao }); else S.habsSel.delete(id);
        erro('habilidade', ''); drawSel();
      });
      sel.addEventListener('click', ev => { const id = ev.target.dataset && ev.target.dataset.rm; if (id != null) { S.habsSel.delete(id); drawSel(); drawList(); } });
      document.addEventListener('click', ev => { if (el.isConnected && !el.contains(ev.target)) list.classList.remove('open'); });
    }

    /* ═════════ SALVAR ═════════ */
    function planoAtual() {
      const nomeT = id => (S.turmas.find(t => t.id === id) || {}).nome;
      const valores = {}; Object.keys(S.valores).forEach(k => { if (!DERIVADAS.includes(k)) valores[k] = S.valores[k]; });
      const tema = String(valores.temas || '').trim().split('\n')[0].slice(0, 200) || S.modelo.nome || '(sem tema)';
      return {
        modelo_id: S.modelo.id || null, modelo_conteudo: S.modelo.conteudo, modelo_arquivo_path: S.modelo.arquivo_path || null,
        professor_id: ctx.professorId, professor_nome: ctx.professorNome, disciplina_id: ctx.disciplinaId || null, disciplina_nome: ctx.disciplinaNome,
        tema, valores, datas: S.datas.slice().sort(),
        turmas: S.turmasSel.map(id => ({ id, nome: nomeT(id) })).filter(t => t.nome),
        habilidades: [...S.habsSel.values()].map(h => ({ id: h.id, codigo: h.codigo, descricao: h.descricao }))
      };
    }

    function validar() {
      const lista = vars(); let ok = true;
      const f = (id, m) => { erro(id, m); ok = false; };
      if (lista.some(v => v === 'data_1' || v === 'data_2')) { if (!S.datas.length) f('datas', 'Selecione pelo menos uma data.'); else erro('datas', ''); }
      if (lista.includes('turmas')) { if (!S.turmasSel.length) f('turmas', 'Selecione pelo menos uma turma.'); else erro('turmas', ''); }
      if (lista.includes('habilidade')) { if (!S.habsSel.size) f('habilidade', 'Selecione pelo menos uma habilidade BNCC.'); else erro('habilidade', ''); }
      OBRIGATORIAS.forEach(v => { if (lista.includes(v)) { if (vazio(S.valores[v])) f(v, 'Este campo é obrigatório.'); else erro(v, ''); } });
      return ok;
    }

    async function salvar() {
      if (!validar()) { const e = app.querySelector('.pa-err'); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      const btn = app.querySelector('#pa-salvar'), rot = btn.textContent; btn.disabled = true; btn.textContent = 'Salvando…';
      try {
        const p = planoAtual();
        const reg = Object.assign({}, p, { texto_final: C.renderizar(S.modelo.conteudo, montarValores(p)) });
        let id = S.id;
        if (S.modo === 'editar') {
          const { error } = await sb().from(CFG.T.planos).update(reg).eq('id', id).eq('professor_id', ctx.professorId);
          if (error) throw error;
        } else {
          const { data, error } = await sb().from(CFG.T.planos).insert(reg).select('id').single();
          if (error) throw error; id = data.id;
        }
        const r = await sb().rpc('plano_set_vinculos', { p_plano: id, p_turmas: p.turmas.map(t => t.id), p_habs: p.habilidades.map(h => h.id) });
        if (r.error) toast('Plano salvo, mas os vínculos falharam: ' + r.error.message);
        else toast(S.modo === 'editar' ? 'Alterações salvas.' : 'Plano salvo.');
        viewPlano(await getPlano(id)); // versão digital direto na interface
      } catch (e) { btn.disabled = false; btn.textContent = rot; toast('Erro ao salvar: ' + e.message); }
    }

    viewLista();
  }

  g.PlanosAula = {
    abrirTela, montar: (el, ctx) => { injetarCss(); el.classList.add('pa'); montar(el, ctx); },
    configure: o => { o = o || {}; const T = Object.assign({}, CFG.T, o.T); Object.assign(CFG, o); CFG.T = T; },
    montarValores
  };
})(typeof window !== 'undefined' ? window : globalThis);
