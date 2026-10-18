function abrirSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
}
function fecharSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}
function toggleSidebarDesktop() {
  const wrapper = document.getElementById('layout-wrapper');
  if (!wrapper) return;
  wrapper.classList.toggle('sidebar-hidden');
  const hidden = wrapper.classList.contains('sidebar-hidden');
  localStorage.setItem('sided_sidebar_hidden_desktop', hidden ? '1' : '0');
  const btn = document.getElementById('btn-toggle-sidebar-desktop');
  if (btn) btn.title = hidden ? 'Mostrar menu lateral' : 'Ocultar menu lateral';
}
function aplicarPreferenciaSidebarDesktop() {
  const wrapper = document.getElementById('layout-wrapper');
  if (!wrapper) return;
  const hidden = localStorage.getItem('sided_sidebar_hidden_desktop') === '1';
  wrapper.classList.toggle('sidebar-hidden', hidden);
  const btn = document.getElementById('btn-toggle-sidebar-desktop');
  if (btn) btn.title = hidden ? 'Mostrar menu lateral' : 'Ocultar menu lateral';
}
function atualizarHeaderMobile(titulo, sub, mostrarVoltar, mostrarHome) {
  document.getElementById('mh-title').textContent = titulo || 'SIDED+';
  document.getElementById('mh-sub').textContent = sub || '';
  document.getElementById('btn-voltar-mh').style.display = mostrarVoltar ? 'flex' : 'none';
  document.getElementById('btn-home-mh').style.display = mostrarHome ? 'flex' : 'none';
}
function voltarMobile() {
  const notasScreen = document.getElementById('notas-screen');
  if (notasScreen && notasScreen.style.display !== 'none') {
    voltarAvaliacoes();
    return;
  }
  if (turmaAtiva) {
    // Dentro de um serviço (aulas, chamada, planejamento...) volta ao relatório da
    // turma; só do relatório volta ao dashboard — igual ao desktop.
    const relatorio = document.getElementById('pagina-relatorio-geral');
    const noRelatorio = !!(relatorio && relatorio.style.display && relatorio.style.display !== 'none');
    if (noRelatorio) voltarDashboard();
    else voltarTurma();
    return;
  }
}
