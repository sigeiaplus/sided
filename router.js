// ============================================
// ROUTER.JS - Sistema de Rotas com History API
// SIDED+ Professor Dashboard
// ============================================

// Função para abrir turma via turma_disciplina
async function abrirTurmaViaDisciplina(td) {
  if (typeof showLoading === 'function') showLoading('Carregando turma...');
  try {
    // Primeiro, garantir que a turma está carregada
    if (!todasTurmas || !todasTurmas.length) {
      if (typeof carregarTurmas === 'function') {
        const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
        await carregarTurmas(profData.id);
      }
    }

    turmaDisciplinaAtiva = td; // <-- Atualiza o estado global!
    turmaAtiva = td.turmas;    // <-- Atualiza a turma ativa

    // Esconde a tela anterior e limpa os containers de dado ANTES de buscar
    // os novos, para nunca deixar dado da turma anterior visível durante o fetch.
    esconderTudo();
    _limparCachesVisuais();

    // Limpa e carrega os dados
    await _carregarContextoTurmaViaDisciplina(td);

    // Abre a página padrão (relatório geral)
    const nome = turmaAtiva?.nome || '';
    atualizarCabecalho({ info: `Relatórios - ${td.disciplinas?.nome || '—'}`, titulo: nome, detalhe: 'Voltar às turmas', voltarFn: 'voltarDashboard', cor: '#16A34A' });
    atualizarHeaderMobile('Relatório Geral', `${nome} - ${td.disciplinas?.nome || '—'}`, true, false);
    _setSidebarEstadoTurma(true);

    const selTri = parseInt(document.getElementById('sel-rel-tri')?.value || '1');

    // Atualiza a URL
    const url = _construirUrl('relatorio-geral', turmaAtiva, { tri: selTri });
    window.history.pushState({ pagina: 'relatorio-geral', turmaId: String(turmaAtiva.id), turmaDisciplinaId: String(td.id), opts: { tri: selTri } }, '', url);

    await carregarRelatorio(selTri);

    // Só mostra a tela depois que os dados já estão prontos —
    // evita o "flash" de tela vazia/desatualizada antes do render.
    document.getElementById('pagina-relatorio-geral').style.display = 'block';
  } finally {
    if (typeof hideLoading === 'function') hideLoading();
  }
}

// Nova função para carregar o contexto via turma_disciplina
async function _carregarContextoTurmaViaDisciplina(td) {
  // Resetar TODO o estado global da turma anterior
  relatorioCache = [];
  alunosTurma = [];
  aulasTurma = [];
  avaliacoesTurma = [];
  avalDiscFiltro = td.disciplinas?.nome || null; // <-- Filtra automaticamente na disciplina correta!
  avaliacaoAtiva = null;
  chamadaTemp = {};
  triAtivo = '';
  modoSelecionarAulas = false;
  if (typeof resetarModoSelecaoAulas === 'function') resetarModoSelecaoAulas();
  aulasSelecionadas = new Set();
  grupoComposicaoSelecionada = [];
  grupoEntrouId = null;
  modoGrupoNotasAtivo = null;
  editandoAulaId = null;
  editandoAvalId = null;
  alunosRecuperacaoExtra = new Set();
  _cntSomaAtual = 0;
  filtrosAtivos = { ano: null, turno: null };
  
  // Limpar caches
  window._chamadaCache = {};
  
  // Salvar na sessão
  if (typeof _ctxSalvarTurma === 'function') _ctxSalvarTurma(turmaAtiva);
  sessionStorage.setItem('td_ativa', JSON.stringify(td)); // <-- Salva a turma_disciplina ativa na sessão
  
  await Promise.all([carregarAulas(), carregarAlunos(), carregarAvaliacoes()]);
}

const todasPaginas = [
  'turma-screen','pagina-aulas','pagina-chamada','pagina-avaliacoes','notas-screen',
  'pagina-relatorio-geral','pagina-mapeamento-sala',
  'pagina-calendario-escolar','pagina-comunicacao','pagina-planejamento'
];

const _abaParaSegmento = {
  'aulas': 'aulas',
  'chamada': 'chamada',
  'avaliacoes': 'avaliacoes',
  'relatorio-geral': 'relatorio',
  'mapeamento-sala': 'mapeamento',
  'calendario-escolar': 'calendario',
  'planejamento': 'planejamento'
};

const _segmentoParaAba = Object.fromEntries(
  Object.entries(_abaParaSegmento).map(([k, v]) => [v, k])
);

// Auxiliar para transformar o nome da turma em texto limpo para a URL
function _gerarSlug(texto) {
  if (!texto) return '';
  return texto.toString().toLowerCase().trim()
    .replace(/[\s_]+/g, '-') 
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// Reconstrói a URL combinando Nome Resumido + ID
function _construirUrl(pagina, turmaObj, opts = {}) {
  if (!turmaObj || pagina === 'dashboard') return '/dashboard';
  
  const id = turmaObj.id;
  const slugNome = _gerarSlug(turmaObj.nome);
  const identificador = slugNome ? `${slugNome}-${id}` : id;

  if (pagina === 'relatorio-geral') {
    const tri = opts.tri || document.getElementById('sel-rel-tri')?.value || '1';
    return `/turma/${identificador}/relatorio?tri=${tri}`;
  }
  const seg = _abaParaSegmento[pagina];
  return seg ? `/turma/${identificador}/${seg}` : `/turma/${identificador}`;
}

// Extrai o ID real do final do segmento da URL
function _parsearUrl(pathname, search) {
  const match = pathname.match(/^\/turma\/([^\/]+)\/?([^/?]*)?/);
  if (!match) return { pagina: 'dashboard', turmaId: null };

  const segmentoCompleto = match[1]; 
  const segAba = match[2] || '';

  // Captura o UUID de 36 caracteres no final do segmento
  const uuidMatch = segmentoCompleto.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i);
  const turmaId = uuidMatch ? uuidMatch[1] : segmentoCompleto;

  const pagina = segAba ? (_segmentoParaAba[segAba] || 'relatorio-geral') : 'relatorio-geral';
  const params = new URLSearchParams(search || '');
  const tri = parseInt(params.get('tri') || '1');

  return { pagina, turmaId, tri };
}

function _setSidebarEstadoTurma(dentroTurma) {
  const normal = document.getElementById('sidebar-estado-normal');
  const menu   = document.getElementById('sidebar-turma-menu');
  const mini   = document.getElementById('btn-perfil-mini');
  const mobMenu = document.getElementById('mob-turma-menu');
  if (normal) normal.style.display = dentroTurma ? 'none' : 'flex';
  if (menu)   menu.style.display = dentroTurma ? 'flex' : 'none';
  if (mini)   mini.style.display = dentroTurma ? 'flex' : 'none';
  if (mobMenu) mobMenu.style.display = dentroTurma ? 'flex' : 'none';
}

function esconderTudo() {
  todasPaginas.forEach(p => {
    const el = document.getElementById(p);
    if (el) { el.style.display = 'none'; el.classList.remove('active'); }
  });
  const dash = document.getElementById('dashboard-screen');
  if (dash) dash.style.display = 'none';
}

// Limpa visualmente os containers de dados de todas as telas antes de uma
// troca de contexto (turma/tela), para que o usuário nunca veja dado da
// tela/turma anterior "grudado" enquanto os novos dados ainda carregam.
// Usa skeleton (placeholder animado) em vez de innerHTML='' para também
// evitar o estado "Nenhum dado encontrado" aparecer antes da hora.
function _limparCachesVisuais() {
  const skel = (typeof skeletonHtml === 'function') ? skeletonHtml(3) : '';
  const containers = [
    'aulas-list',
    'avaliacoes-list',
    'chamada-list',
    'relatorio-body',
  ];
  containers.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = skel;
  });
  // Containers que devem apenas ficar vazios (não têm "estado vazio" textual
  // que confundiria o usuário — são áreas auxiliares, não listas principais)
  const limparSemSkeleton = ['chamada-faltosos-wrap'];
  limparSemSkeleton.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
}

function _paginaEstaVisivel(id) {
  const el = document.getElementById(id);
  return !!(el && el.style.display && el.style.display !== 'none');
}

// CORRIGIDO: não retorna mais cedo se todasTurmas estiver vazio —
// busca as turmas on-demand para garantir que o F5 em rota de turma funcione.
async function _carregarContextoTurma(id) {
  // Se todasTurmas ainda não foi carregado, buscar agora
  if (!todasTurmas || todasTurmas.length === 0) {
    if (typeof buscarTodasTurmasDoProfessor === 'function') {
      await buscarTodasTurmasDoProfessor();
    }
  }
  // Ainda vazio após tentativa = professor sem turmas ou erro de API
  if (!todasTurmas || todasTurmas.length === 0) return;

  turmaAtiva = todasTurmas.find(t => String(t.id) === String(id)) || null;
  if (!turmaAtiva) return;

  // Resetar TODO o estado global da turma anterior
  relatorioCache = [];
  alunosTurma = [];
  aulasTurma = [];
  avaliacoesTurma = [];
  avalDiscFiltro = null;
  avaliacaoAtiva = null;
  chamadaTemp = {};
  triAtivo = '';
  modoSelecaoAulas = false;
  aulasSelecionadas = new Set();
  grupoComposicaoSelecionada = [];
  grupoEntrouId = null;
  modoGrupoNotasAtivo = null;
  editandoAulaId = null;
  editandoAvalId = null;
  alunosRecuperacaoExtra = new Set();
  _cntSomaAtual = 0;
  filtrosAtivos = { ano: null, turno: null };
  
  // Limpar caches
  window._chamadaCache = {};
  // Não limpar gruposAvaliacaoConfig pois é por turma (chave inclui turma id)
  
  // Salvar a nova turma na sessão via context-guard
  if (typeof _ctxSalvarTurma === 'function') _ctxSalvarTurma(turmaAtiva);
  
  esconderTudo();
  _limparCachesVisuais();
  await Promise.all([carregarAulas(), carregarAlunos(), carregarAvaliacoes()]);
}

async function _executarAbrirTurma(id) {
  if (typeof showLoading === 'function') showLoading('Carregando turma...');
  try {
    await _carregarContextoTurma(id);
    if (!turmaAtiva) return;

    const nome = turmaAtiva?.nome || '';
    atualizarCabecalho({ info: 'Relatórios', titulo: nome, detalhe: 'Voltar às turmas', voltarFn: 'voltarDashboard', cor: '#16A34A' });
    atualizarHeaderMobile('Relatório Geral', nome, true, false);
    _setSidebarEstadoTurma(true);

    const selTri = parseInt(document.getElementById('sel-rel-tri')?.value || '1');
    await carregarRelatorio(selTri);
    document.getElementById('pagina-relatorio-geral').style.display = 'block';
  } finally {
    if (typeof hideLoading === 'function') hideLoading();
  }
}

function _executarVoltarDashboard() {
  esconderTudo();
  const dash = document.getElementById('dashboard-screen');
  if (dash) dash.style.display = 'block';
  
  // Resetar TODO o estado global
  turmaAtiva = null;
  turmaDisciplinaAtiva = null; // <-- Limpa a turma_disciplina ativa!
  relatorioCache = [];
  alunosTurma = [];
  aulasTurma = [];
  avaliacoesTurma = [];
  avalDiscFiltro = null;
  avaliacaoAtiva = null;
  chamadaTemp = {};
  triAtivo = '';
  modoSelecionarAulas = false;
  if (typeof resetarModoSelecaoAulas === 'function') resetarModoSelecaoAulas();
  aulasSelecionadas = new Set();
  grupoComposicaoSelecionada = [];
  grupoEntrouId = null;
  modoGrupoNotasAtivo = null;
  editandoAulaId = null;
  editandoAvalId = null;
  alunosRecuperacaoExtra = new Set();
  _cntSomaAtual = 0;
  filtrosAtivos = { ano: null, turno: null };
  
  // Limpar caches
  window._chamadaCache = {};
  sessionStorage.removeItem('td_ativa'); // <-- Limpa da sessão também!
  
  _setSidebarEstadoTurma(false);
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const escola = profData.escolas?.nome || '';
  const codigo = profData.escolas?.codigo_escola ? `Código: ${profData.escolas.codigo_escola}` : '';
  atualizarCabecalho({ info: codigo, titulo: escola, detalhe: `Bem-vindo(a), ${(profData.nome || '').split(' ')[0]}!`, cor: 'var(--purple-dark)' });
  atualizarHeaderMobile('SIDED+', escola, false, false);
}

async function _executarAbrirPagina(pagina, opts = {}) {
  if (typeof showLoading === 'function') showLoading('Carregando...');
  try {
    esconderTudo();
    _limparCachesVisuais();
    const nome = turmaAtiva?.nome || '';

    if (turmaAtiva?.id) await garantirAlunosTurma();

    switch (pagina) {
      case 'aulas':
        atualizarCabecalho({ info: 'Aulas', titulo: nome, detalhe: 'Voltar à turma', voltarFn: 'voltarTurma', cor: '#0F766E' });
        atualizarHeaderMobile('Aulas', nome, true, true);
        await carregarAulas();
        if (typeof _inicializarFiltroDiscAulas === 'function') await _inicializarFiltroDiscAulas();
        document.getElementById('pagina-aulas').style.display = 'block';
        break;

      case 'chamada': {
        const chamadaTitulo = `${turmaAtiva.codigo || ''} — ${turmaAtiva.nome || ''} — ${turmaAtiva.disciplina || ''} — ${turmaAtiva.turno || ''} — ${turmaAtiva.escolas?.nome || ''}`;
        document.getElementById('chamada-turma-titulo').textContent = chamadaTitulo;
        atualizarCabecalho({ info: 'Chamada do Dia', titulo: nome, detalhe: 'Voltar à turma', voltarFn: 'voltarTurma', cor: '#6C4FD4' });
        atualizarHeaderMobile('Chamada do Dia', nome, true, true);
        await garantirAlunosTurma();
        await carregarChamadaHoje();
        document.getElementById('pagina-chamada').style.display = 'block';
        break;
      }

      case 'avaliacoes': {
        document.getElementById('notas-screen').style.display = 'none';
        document.getElementById('aval-turma-titulo').textContent = `${turmaAtiva.codigo || ''} — ${turmaAtiva.nome || ''} — ${turmaAtiva.disciplina || ''} — ${turmaAtiva.turno || ''} — ${turmaAtiva.escolas?.nome || ''}`;
        const triAtual = detectarTrimestreAtual().tri;
        const sel = document.getElementById('sel-aval-tri'); if (sel) sel.value = String(triAtual);
        atualizarCabecalho({ info: 'Avaliações', titulo: nome, detalhe: 'Voltar à turma', voltarFn: 'voltarTurma', cor: '#FF8C38' });
        atualizarHeaderMobile('Avaliações', nome, true, true);
        if (typeof _inicializarFiltroDiscAval === 'function') await _inicializarFiltroDiscAval();
        await carregarAvaliacoes();
        document.getElementById('pagina-avaliacoes').style.display = 'block';
        break;
      }

      case 'relatorio-geral': {
        // O relatório geral é a tela inicial da turma: aqui "voltar" leva ao dashboard
        // (mesmo comportamento de abrirTurma). Antes apontava para voltarTurma, que só
        // reabria o próprio relatório e parecia não fazer nada.
        atualizarCabecalho({ info: 'Relatórios', titulo: nome, detalhe: 'Voltar às turmas', voltarFn: 'voltarDashboard', cor: '#16A34A' });
        atualizarHeaderMobile('Relatório Geral', nome, true, false);
        await garantirAlunosTurma();
        const triRel = parseInt((opts.tri ?? document.getElementById('sel-rel-tri')?.value) || '1');
        const selRelTri = document.getElementById('sel-rel-tri');
        if (selRelTri) selRelTri.value = String(triRel);
        await carregarRelatorio(triRel);
        document.getElementById('pagina-relatorio-geral').style.display = 'block';
        break;
      }

      case 'mapeamento-sala':
        document.getElementById('mapa-lista-view').style.display = 'block';
        document.getElementById('mapa-canvas-view').style.display = 'none';
        _mapaAtivo = null;
        atualizarCabecalho({ info: 'Turma', titulo: nome, detalhe: 'Voltar à turma', voltarFn: 'voltarTurma', cor: '#8B5CF6' });
        atualizarHeaderMobile('Mapeamento de Sala', nome, true, true);
        if (typeof renderListaMapeamentos === 'function') renderListaMapeamentos();
        document.getElementById('pagina-mapeamento-sala').style.display = 'block';
        break;

      case 'calendario-escolar':
        atualizarCabecalho({ info: 'Turma', titulo: nome, detalhe: 'Voltar à turma', voltarFn: 'voltarTurma', cor: '#0EA5E9' });
        atualizarHeaderMobile('Calendário Escolar', nome, true, true);
        if (typeof iniciarCalendario === 'function') await iniciarCalendario();
        document.getElementById('pagina-calendario-escolar').style.display = 'block';
        break;

      case 'planejamento':
        atualizarCabecalho({ info: 'Planejamento', titulo: nome, detalhe: 'Voltar à turma', voltarFn: 'voltarTurma', cor: '#BE185D' });
        atualizarHeaderMobile('Planejamento', nome, true, true);
        if (typeof iniciarPlanejamento === 'function') await iniciarPlanejamento();
        document.getElementById('pagina-planejamento').style.display = 'block';
        break;

      default:
        console.warn('[ROUTER] Página desconhecida:', pagina);
        break;
    }
  } finally {
    if (typeof hideLoading === 'function') hideLoading();
  }
}

// Controla a entrada/restauração por URL
async function roteadorRestaurar() {
  const { pagina, turmaId, tri } = _parsearUrl(window.location.pathname, window.location.search);

  // Primeiro tenta restaurar da sessão!
  const tdSalvo = sessionStorage.getItem('td_ativa');
  if (tdSalvo) {
    try {
      const td = JSON.parse(tdSalvo);
      // Verifica se a turma_disciplina é válida e corresponde à turmaId
      if (td && td.turmas && String(td.turmas.id) === String(turmaId)) {
        await abrirTurmaViaDisciplina(td);
        if (pagina && pagina !== 'relatorio-geral') {
          await abrirPagina(pagina, { tri });
        }
        return;
      }
    } catch (e) {
      // Se der erro, continua o fluxo normal
    }
  }

  if (!turmaId || pagina === 'dashboard') {
    _executarVoltarDashboard();
    window.history.replaceState({ pagina: 'dashboard', turmaId: null }, '', '/dashboard');
    return;
  }

  // _carregarContextoTurma agora busca as turmas internamente se precisar
  await _carregarContextoTurma(turmaId);

  if (!turmaAtiva) {
    _executarVoltarDashboard();
    return;
  }

  // Se tem turma tem múltiplas disciplinas, pede para selecionar? Por enquanto usa a primeira
  if (todasTurmaDisciplinas && todasTurmaDisciplinas.length) {
    const primeiraTd = todasTurmaDisciplinas.find(x => String(x.turmas.id) === String(turmaId));
    if (primeiraTd) {
      await abrirTurmaViaDisciplina(primeiraTd);
      if (pagina && pagina !== 'relatorio-geral') {
        await abrirPagina(pagina, { tri });
      }
      return;
    }
  } else {
    const opts = pagina === 'relatorio-geral' ? { tri } : {};
    window.history.replaceState({ pagina, turmaId, opts }, '', _construirUrl(pagina, turmaAtiva, opts));
    await _executarAbrirPagina(pagina, opts);
  }
}

// Inicializa os escutadores do History API
let _popstateRegistrado = false;

async function roteadorInicializar() {
  if (!_popstateRegistrado) {
    window.addEventListener('popstate', async (e) => {
    if (e.state) {
      const { pagina, turmaId, opts } = e.state;
      if (pagina === 'dashboard' || !turmaId) {
        _executarVoltarDashboard();
      } else {
        if (!turmaAtiva || String(turmaAtiva.id) !== String(turmaId)) {
          await _carregarContextoTurma(turmaId);
        }
        await _executarAbrirPagina(pagina, opts || {});
      }
    } else {
      await roteadorRestaurar();
    }
    });
    _popstateRegistrado = true;
  }
  await roteadorRestaurar();
}

// APIs Públicas do sistema
async function abrirTurma(id) {
  try {
    await _executarAbrirTurma(id);
    if (!turmaAtiva) return;
    const selTri = parseInt(document.getElementById('sel-rel-tri')?.value || '1');
    const url = _construirUrl('relatorio-geral', turmaAtiva, { tri: selTri });
    window.history.pushState({ pagina: 'relatorio-geral', turmaId: String(id), opts: { tri: selTri } }, '', url);
  } catch (e) {
    console.error(e);
    if (typeof mostrarErro === 'function') mostrarErro('Erro ao abrir turma. Tente novamente.');
  }
}

function voltarDashboard() {
  _executarVoltarDashboard();
  window.history.pushState({ pagina: 'dashboard', turmaId: null }, '', '/dashboard');
}

async function abrirPagina(pagina, opts = {}) {
  if (!turmaAtiva) return;
  try {
    await _executarAbrirPagina(pagina, opts);
    const url = _construirUrl(pagina, turmaAtiva, opts);
    window.history.pushState({ pagina, turmaId: String(turmaAtiva.id), opts }, '', url);
  } catch (e) {
    console.error('[ROUTER] Erro ao abrir página:', e);
    if (typeof mostrarErro === 'function') mostrarErro('Erro ao carregar a página. Tente novamente.');
  }
}

async function voltarTurma() {
  if (!turmaAtiva) return;
  const selTri = parseInt(document.getElementById('sel-rel-tri')?.value || '1');
  await abrirPagina('relatorio-geral', { tri: selTri });
}

function trocarTab(tab) { abrirPagina(tab); }

async function abrirRelatorioUI(tri) {
  if (typeof fecharSidebar === 'function') fecharSidebar();
  await abrirPagina('relatorio-geral', { tri });
}
