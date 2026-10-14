// init.js — Ponto de entrada da aplicação
let _inicioEmAndamento = false;

async function iniciarAplicacao() {
  if (_inicioEmAndamento) return;
  _inicioEmAndamento = true;

  const gradeTurmas = document.getElementById('turmas-grid');
  if (gradeTurmas?.querySelector('[data-erro-inicializacao]')) {
    gradeTurmas.innerHTML = '<div class="turma-empty">Carregando turmas...</div>';
  }

  try {
    if (typeof init === 'function') await init();
  } catch (error) {
    console.error('[APP] Falha ao inicializar:', error);
    if (typeof forcarFecharLoading === 'function') forcarFecharLoading();

    const grade = document.getElementById('turmas-grid');
    if (grade) {
      grade.innerHTML = `<div data-erro-inicializacao role="alert" style="padding:20px;text-align:center;color:var(--text-muted);">
        <p style="margin-bottom:12px;">Não foi possível carregar seus dados. Verifique sua conexão e permissões.</p>
        <button class="btn-new" type="button" onclick="iniciarAplicacao()">Tentar novamente</button>
      </div>`;
    } else if (typeof mostrarErro === 'function') {
      mostrarErro('Não foi possível carregar o SIDED+. Verifique sua conexão e tente novamente.');
    }
  } finally {
    _inicioEmAndamento = false;
  }
}

document.addEventListener('DOMContentLoaded', iniciarAplicacao, { once: true });
