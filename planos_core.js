/* ============================================================================
   SIDED+ — planos_core.js
   Núcleo sem interface: variáveis [nome], substituição e tratamento de .docx.

   Sobre "docxlib": não existe pacote JavaScript com esse nome (só há versões
   em Ring e em Go, que não rodam no navegador). Por isso o tratamento do DOCX
   é próprio do SIDED+: um .docx é um ZIP com XML (word/document.xml); este
   arquivo lê esse XML e troca os marcadores diretamente, mantendo estilos,
   fontes, tabelas, cabeçalhos e rodapés do modelo.
   Única dependência externa: JSZip (abrir/gravar o ZIP), carregado sob demanda.
   ========================================================================== */
(function (g) {
  'use strict';

  /* ── texto ── */
  const RE_VAR = /\[([a-zA-Z_][a-zA-Z0-9_]*)\]/g;
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const fmtData = iso => { const [y, m, d] = String(iso).split('-'); return `${d}/${m}/${y}`; };
  const vazio = v => v == null || String(v).trim() === '';

  function parseVariaveis(texto) {
    const vistos = new Set(), lista = [];
    String(texto || '').replace(RE_VAR, (m, n) => { if (!vistos.has(n)) { vistos.add(n); lista.push(n); } return m; });
    return lista;
  }

  /** Substitui marcadores e devolve TEXTO PURO (linha com todas as variáveis vazias é removida). */
  function renderizar(modelo, valores) {
    const v = valores || {};
    const umaData = !vazio(v.data_1) && vazio(v.data_2);
    const saida = [];
    for (let linha of String(modelo).split('\n')) {
      if (umaData) linha = linha.replace(/\[data_1\]\s*à\s*\[data_2\]/g, '[data_1]');
      const vars = (linha.match(RE_VAR) || []).map(m => m.slice(1, -1));
      if (vars.length && vars.every(n => vazio(v[n]))) continue;
      saida.push(linha.replace(RE_VAR, (m, n) => (vazio(v[n]) ? '' : String(v[n]).trim())).replace(/[ \t]+$/, ''));
    }
    return saida.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  const ehRotulo = (l, i) => i > 0 && i < 40 && !l.slice(0, i).includes('—');

  /** Texto final → HTML seguro (tudo escapado; "# " vira título). */
  function textoParaHtml(texto) {
    return String(texto).split('\n').map(l => {
      if (/^#\s+/.test(l)) return `<h2>${esc(l.replace(/^#\s+/, ''))}</h2>`;
      if (l.trim() === '') return '<div class="pa-gap"></div>';
      const i = l.indexOf(':');
      if (ehRotulo(l, i)) return `<p><strong>${esc(l.slice(0, i + 1))}</strong>${esc(l.slice(i + 1))}</p>`;
      return `<p>${esc(l)}</p>`;
    }).join('');
  }

  /* ── XML do DOCX ── */
  const unx = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const enx = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const RE_P = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  const RE_T = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;

  /** Texto do documento: um parágrafo por linha. */
  function textoDoXml(xml) {
    const linhas = [];
    (xml.match(RE_P) || []).forEach(p => {
      let t = ''; p.replace(RE_T, (m, x) => { t += unx(x); return m; });
      linhas.push(t);
    });
    return linhas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /**
   * Troca [marcadores] no XML sem perder a formatação. Um marcador pode estar
   * dividido em vários "runs" (o Word faz isso); o valor entra no run onde o
   * marcador começa, herdando a formatação dele.
   * Parágrafo cujas variáveis estão todas vazias é removido.
   */
  function substituirXml(xml, valores) {
    const v = valores || {};
    const umaData = !vazio(v.data_1) && vazio(v.data_2);
    const out = xml.replace(RE_P, p => {
      const nos = [];
      p.replace(RE_T, (m, t) => { nos.push(unx(t)); return m; });
      const full = nos.join('');
      if (full.indexOf('[') < 0) return p;
      const re = umaData ? /\[data_1\]\s*à\s*\[data_2\]|\[([a-zA-Z_]\w*)\]/g : /\[([a-zA-Z_]\w*)\]/g;
      const ms = []; let m;
      while ((m = re.exec(full))) ms.push({ s: m.index, e: m.index + m[0].length, nome: m[1] || 'data_1' });
      if (!ms.length) return p;
      if (ms.every(x => vazio(v[x.nome]))) return '';
      const car = full.split('');
      ms.forEach(x => {
        for (let i = x.s; i < x.e; i++) car[i] = '';
        car[x.s] = vazio(v[x.nome]) ? '' : String(v[x.nome]).trim();
      });
      let pos = 0;
      const novos = nos.map(t => { const s = car.slice(pos, pos + t.length).join(''); pos += t.length; return s; });
      let k = 0;
      return p.replace(RE_T, () => {
        const partes = novos[k++].split('\n').map(enx);
        return '<w:t xml:space="preserve">' + partes.join('</w:t><w:br/><w:t xml:space="preserve">') + '</w:t>';
      });
    });
    // célula de tabela não pode ficar sem parágrafo
    return out.replace(/(<w:tc(?:\s[^>]*)?>(?:<w:tcPr>[\s\S]*?<\/w:tcPr>)?)(<\/w:tc>)/g, '$1<w:p/>$2');
  }

  /* ── JSZip sob demanda ── */
  let _jz = null;
  function carregarJSZip() {
    if (g.JSZip) return Promise.resolve(g.JSZip);
    if (_jz) return _jz;
    _jz = new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = () => (g.JSZip ? ok(g.JSZip) : falha(new Error('JSZip não carregou')));
      s.onerror = () => falha(new Error('Não foi possível carregar o JSZip (verifique a conexão).'));
      document.head.appendChild(s);
    });
    return _jz;
  }

  /** Lê um .docx de modelo: texto (um parágrafo por linha) e variáveis. */
  async function lerDocx(buf) {
    const Z = await carregarJSZip();
    let zip;
    try { zip = await Z.loadAsync(buf); } catch (e) { throw new Error('O arquivo não é um .docx válido.'); }
    const f = zip.file('word/document.xml');
    if (!f) throw new Error('O arquivo não parece ser um documento do Word (.docx).');
    const texto = textoDoXml(await f.async('string'));
    return { texto, variaveis: parseVariaveis(texto) };
  }

  /** Preenche o modelo e devolve os bytes do novo .docx. O modelo original não é alterado. */
  async function preencherDocx(buf, valores) {
    const Z = await carregarJSZip();
    const zip = await Z.loadAsync(buf);
    const alvos = Object.keys(zip.files).filter(n => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n));
    for (const n of alvos) zip.file(n, substituirXml(await zip.file(n).async('string'), valores));
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }

  /** DOCX simples a partir do texto final (para planos sem arquivo de modelo). */
  async function gerarDocx(texto) {
    const Z = await carregarJSZip();
    const run = (t, b, sz) => {
      const partes = String(t).split('\n').map(enx);
      return `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/>${b ? '<w:b/>' : ''}<w:sz w:val="${sz || 22}"/></w:rPr>` +
        partes.map(x => `<w:t xml:space="preserve">${x}</w:t>`).join('<w:br/>') + '</w:r>';
    };
    const ps = String(texto).split('\n').map(l => {
      if (/^#\s+/.test(l)) return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr>${run(l.replace(/^#\s+/, ''), true, 32)}</w:p>`;
      if (l.trim() === '') return '<w:p/>';
      const i = l.indexOf(':');
      const corpo = ehRotulo(l, i) ? run(l.slice(0, i + 1), true) + run(l.slice(i + 1)) : run(l);
      return `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr>${corpo}</w:p>`;
    }).join('');
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const zip = new Z();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${ps}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`);
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  }

  g.PlanoCore = {
    esc, norm, fmtData, vazio, parseVariaveis, renderizar, textoParaHtml,
    textoDoXml, substituirXml, lerDocx, preencherDocx, gerarDocx, carregarJSZip
  };
})(typeof window !== 'undefined' ? window : globalThis);
