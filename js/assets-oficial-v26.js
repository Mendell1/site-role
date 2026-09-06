/* ROLÊ V26 — assets oficiais. O hero agora é carregado diretamente pelo CSS. */
(() => {
  'use strict';
  if (window.__roleV26AssetsOficiais) return;
  window.__roleV26AssetsOficiais = true;

  const mapa = {
    'assets/icons/categoria-cultura.png': 'preview-v25/assets/icons/categoria-cultura.png',
    'assets/icons/categoria-gastronomia.png': 'preview-v25/assets/icons/categoria-gastronomia.png'
  };

  function corrigirIcones(){
    document.querySelectorAll('img.v26-icon-png').forEach(img => {
      const atual = img.getAttribute('src') || '';
      if (mapa[atual] && img.getAttribute('src') !== mapa[atual]) {
        img.setAttribute('src', mapa[atual]);
      }
    });
  }

  corrigirIcones();
  const obs = new MutationObserver(corrigirIcones);
  obs.observe(document.documentElement, { childList:true, subtree:true });

  const hero = document.querySelector('.hero');
  if (hero) {
    document.body.classList.add('v26-hero-oficial-carregado');
    console.info('[V26] Hero HQ aprovado carregado diretamente pelo CSS.');
  }
})();
