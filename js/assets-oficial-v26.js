/* ROLÊ V26 — assets oficiais e carregamento robusto do hero. */
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

  async function aplicarHeroOficial(){
    const hero = document.querySelector('.hero');
    if (!hero) return;

    try {
      const resposta = await fetch('assets/hero-v26-oficial.b64?v=20260906-1945', {
        cache: 'no-store'
      });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

      const base64 = (await resposta.text()).replace(/\s+/g, '');
      if (!base64.startsWith('UklG')) throw new Error('hero base64 inválido');

      const binario = atob(base64);
      const bytes = new Uint8Array(binario.length);
      for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);

      const blob = new Blob([bytes], { type: 'image/webp' });
      const blobUrl = URL.createObjectURL(blob);

      /*
       * A arte aprovada é 16:9, enquanto a hero do site é muito mais larga.
       * Não usamos cover: isso ampliava demais a ponte/assinatura e destruía
       * a nitidez. A imagem agora ocupa a altura da hero e fica ancorada à
       * direita, como no mockup aprovado; o lado esquerdo permanece escuro.
       */
      hero.style.setProperty(
        'background-image',
        `linear-gradient(90deg, rgba(8,7,5,.98) 0%, rgba(8,7,5,.94) 30%, rgba(8,7,5,.72) 47%, rgba(8,7,5,.20) 64%, rgba(8,7,5,.04) 100%), url("${blobUrl}")`,
        'important'
      );
      hero.style.setProperty('background-size', '100% 100%, auto 100%', 'important');
      hero.style.setProperty('background-position', 'center center, right center', 'important');
      hero.style.setProperty('background-repeat', 'no-repeat, no-repeat', 'important');
      hero.style.setProperty('background-color', '#090806', 'important');

      let estilo = document.getElementById('v26HeroRuntimeStyle');
      if (!estilo) {
        estilo = document.createElement('style');
        estilo.id = 'v26HeroRuntimeStyle';
        estilo.textContent = `
          .hero::before,.hero::after{display:none!important;}
          .v26-hero-arte{display:none!important;}
          .hero-conteudo,.v26-hero-grid{position:relative!important;z-index:2!important;}

          @media (min-width: 1200px){
            .hero{
              background-size:100% 100%, auto 100%!important;
              background-position:center center, right center!important;
            }
          }

          @media (max-width: 1199px){
            .hero{
              background-size:100% 100%, auto 92%!important;
              background-position:center center, right center!important;
            }
          }

          @media (max-width: 900px){
            .hero{
              background-size:100% 100%, auto 78%!important;
              background-position:center center, 112% center!important;
            }
          }

          @media (max-width: 620px){
            .hero{
              background-size:100% 100%, auto 62%!important;
              background-position:center center, 125% 18%!important;
            }
          }
        `;
        document.head.appendChild(estilo);
      }

      document.body.classList.add('v26-hero-oficial-carregado');
      console.info('[V26] Hero oficial carregado com composição lateral.');
    } catch (erro) {
      console.error('[V26] Falha ao carregar o hero oficial:', erro);
    }
  }

  corrigirIcones();
  const obs = new MutationObserver(corrigirIcones);
  obs.observe(document.documentElement, { childList:true, subtree:true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicarHeroOficial, { once:true });
  } else {
    aplicarHeroOficial();
  }
})();
