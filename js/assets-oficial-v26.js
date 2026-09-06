/* ROLÊ V26 — corrige caminhos de assets ao promover o preview para a raiz oficial. */
(() => {
  'use strict';
  if (window.__roleV26AssetsOficiais) return;
  window.__roleV26AssetsOficiais = true;

  const mapa = {
    'assets/icons/categoria-cultura.png': 'preview-v25/assets/icons/categoria-cultura.png',
    'assets/icons/categoria-gastronomia.png': 'preview-v25/assets/icons/categoria-gastronomia.png'
  };

  function corrigir(){
    document.querySelectorAll('img.v26-icon-png').forEach(img => {
      const atual = img.getAttribute('src') || '';
      if (mapa[atual] && img.getAttribute('src') !== mapa[atual]) img.setAttribute('src', mapa[atual]);
    });
  }

  corrigir();
  const obs = new MutationObserver(corrigir);
  obs.observe(document.documentElement, { childList:true, subtree:true });
})();
