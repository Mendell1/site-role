/* ============================================================
   ROLÊ V26 — sincroniza o destaque visual das abas do perfil.
   Corrige abas inseridas por módulos (ex.: Minhas inscrições).
   ============================================================ */
(() => {
  'use strict';
  if (window.__rolePerfilTabsActiveFixV26) return;
  window.__rolePerfilTabsActiveFixV26 = true;

  function sincronizar() {
    if (!document.body.classList.contains('pagina-perfil-lovable')) return;
    const main = document.getElementById('perfilMain');
    if (!main) return;

    const painelVisivel = [...main.querySelectorAll('.perfil-painel[data-pane]')]
      .find(painel => !painel.hidden);
    if (!painelVisivel) return;

    const tabAtiva = painelVisivel.dataset.pane;
    main.querySelectorAll('.perfil-aba[data-tab]').forEach(btn => {
      const ativo = btn.dataset.tab === tabAtiva;
      if (btn.classList.contains('ativa') !== ativo) btn.classList.toggle('ativa', ativo);
      if (btn.getAttribute('aria-selected') !== String(ativo)) {
        btn.setAttribute('aria-selected', String(ativo));
      }
    });
  }

  let raf = 0;
  function agendar() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      sincronizar();
    });
  }

  function iniciar() {
    sincronizar();

    document.addEventListener('click', e => {
      if (e.target.closest('.perfil-aba[data-tab]')) {
        // Executa depois dos handlers dos módulos, para refletir o painel que de fato ficou aberto.
        setTimeout(sincronizar, 0);
      }
    });

    const main = document.getElementById('perfilMain');
    if (main) {
      const obs = new MutationObserver(agendar);
      obs.observe(main, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['hidden', 'class', 'aria-selected']
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
})();
