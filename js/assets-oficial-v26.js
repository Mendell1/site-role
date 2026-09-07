/* ROLÊ V26 — assets oficiais e hero físico em alta qualidade. */
(() => {
  'use strict';
  if (window.__roleV26AssetsOficiaisV2) return;
  window.__roleV26AssetsOficiaisV2 = true;

  const mapa = {
    'assets/icons/categoria-cultura.png': 'preview-v25/assets/icons/categoria-cultura.png',
    'assets/icons/categoria-gastronomia.png': 'preview-v25/assets/icons/categoria-gastronomia.png'
  };

  let heroPromise = null;
  let heroDataUrl = null;

  function corrigirIcones(){
    document.querySelectorAll('img.v26-icon-png').forEach(img => {
      const atual = img.getAttribute('src') || '';
      if (mapa[atual] && img.getAttribute('src') !== mapa[atual]) {
        img.setAttribute('src', mapa[atual]);
      }
    });
  }

  async function obterHeroHQ(){
    if (heroDataUrl) return heroDataUrl;
    if (heroPromise) return heroPromise;

    heroPromise = (async () => {
      const resposta = await fetch('assets/hero-v26-wide-approved-hq.b64?v=20260907-0035', {
        cache: 'reload'
      });
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);

      const base64 = (await resposta.text()).replace(/\s+/g, '');
      if (!base64.startsWith('UklG')) throw new Error('payload do hero não é WebP base64 válido');

      heroDataUrl = `data:image/webp;base64,${base64}`;
      return heroDataUrl;
    })().catch(erro => {
      heroPromise = null;
      throw erro;
    });

    return heroPromise;
  }

  async function aplicarHeroFisico(){
    const hero = document.querySelector('.hero');
    if (!hero) return;

    document.body.classList.add('v26-home', 'v26-hero-oficial-carregado');

    hero.style.setProperty('position', 'relative', 'important');
    hero.style.setProperty('overflow', 'hidden', 'important');
    /* IMPORTANTE: não usar o shorthand `background` aqui. Ele apagava a
       background-image definida pelo CSS oficial e deixava o hero preto. */
    hero.style.removeProperty('background');
    hero.style.setProperty('background-color', '#090806', 'important');
    hero.style.setProperty('isolation', 'isolate', 'important');

    let img = hero.querySelector('.v26-hero-bg-fisico');
    if (!img) {
      img = document.createElement('img');
      img.className = 'v26-hero-bg-fisico';
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.decoding = 'async';
      img.loading = 'eager';
      img.fetchPriority = 'high';

      Object.assign(img.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center center',
        zIndex: '0',
        pointerEvents: 'none',
        userSelect: 'none',
        display: 'block',
        visibility: 'visible',
        opacity: '1'
      });

      img.addEventListener('load', () => {
        hero.classList.add('v26-hero-img-ok');
        console.info('[V26] Hero HQ físico carregado:', img.naturalWidth, 'x', img.naturalHeight);
      });

      img.addEventListener('error', () => {
        console.error('[V26] Falha ao decodificar hero HQ; mantendo fallback CSS.');
      });

      hero.prepend(img);
    }

    try {
      const src = await obterHeroHQ();
      if (img.src !== src) img.src = src;
    } catch (erro) {
      console.error('[V26] Falha ao carregar payload HQ do hero:', erro);
      /* O CSS hero-oficial-v26-v2.css continua sendo o fallback. */
    }

    let overlay = hero.querySelector('.v26-hero-overlay-fisico');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'v26-hero-overlay-fisico';
      overlay.setAttribute('aria-hidden', 'true');
      Object.assign(overlay.style, {
        position: 'absolute',
        inset: '0',
        zIndex: '1',
        pointerEvents: 'none',
        background: 'linear-gradient(90deg, rgba(7,6,5,.68) 0%, rgba(7,6,5,.48) 27%, rgba(7,6,5,.18) 48%, rgba(7,6,5,.03) 68%, rgba(7,6,5,0) 100%)'
      });
      img.after(overlay);
    }

    hero.querySelectorAll('.hero-conteudo,.v26-hero-grid').forEach(el => {
      el.style.setProperty('position', 'relative', 'important');
      el.style.setProperty('z-index', '2', 'important');
    });

    hero.querySelectorAll('.v26-hero-arte,.v26-wordmark,.v26-slogan,.v26-palavras,.v26-cityline').forEach(el => {
      el.style.setProperty('display', 'none', 'important');
    });
  }

  function iniciar(){
    corrigirIcones();
    aplicarHeroFisico();

    const obs = new MutationObserver(() => {
      corrigirIcones();
      const hero = document.querySelector('.hero');
      if (hero && !hero.querySelector('.v26-hero-bg-fisico')) aplicarHeroFisico();
    });
    obs.observe(document.documentElement, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once:true });
  } else {
    iniciar();
  }
})();
