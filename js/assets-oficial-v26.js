/* ROLÊ V26 — assets oficiais e hero aprovado em alta qualidade. */
(() => {
  'use strict';
  if (window.__roleV26AssetsOficiaisV5) return;
  window.__roleV26AssetsOficiaisV5 = true;

  const VERSAO = '20260907-0245';
  const BASE64_ESPERADO = 182088;
  const BYTES_ESPERADOS = 136564;
  const HERO_LARGURA = 2172;
  const HERO_ALTURA = 724;

  /* Fragmentos sequenciais do mesmo WebP aprovado.
     A soma precisa dar exatamente 182088 caracteres em base64. */
  const PARTES_HERO = [
    'assets/hero-v26-q80-part00.txt',
    'assets/hero-v26-q80-part01.txt',
    'assets/hero-v26-q80-part02.txt',
    'assets/hero-v26-q80-part03.txt',
    'assets/hero-v26-q80-part04a.txt',
    'assets/hero-v26-q80-part04b.txt',
    'assets/hero-v26-q80-part04c.txt',
    'assets/hero-v26-q80-part04d.txt',
    'assets/hero-v26-q80-part05.txt',
    'assets/hero-v26-q80-part06.txt',
    'assets/hero-v26-q80-part07.txt',
    'assets/hero-v26-q80-part08.txt',
    'assets/hero-v26-q80-part09.txt'
  ];

  const mapa = {
    'assets/icons/categoria-cultura.png': 'preview-v25/assets/icons/categoria-cultura.png',
    'assets/icons/categoria-gastronomia.png': 'preview-v25/assets/icons/categoria-gastronomia.png'
  };

  /* Sombra suave: mantém o texto legível sem criar um bloco preto sobre a arte. */
  const GRADIENTE = 'linear-gradient(90deg, rgba(7,6,5,.42) 0%, rgba(7,6,5,.30) 26%, rgba(7,6,5,.14) 46%, rgba(7,6,5,.04) 62%, rgba(7,6,5,0) 76%)';

  let heroPromise = null;
  let heroObjectUrl = null;
  let heroDimensoes = null;

  function corrigirIcones(){
    document.querySelectorAll('img.v26-icon-png').forEach(img => {
      const atual = img.getAttribute('src') || '';
      if (mapa[atual] && img.getAttribute('src') !== mapa[atual]) {
        img.setAttribute('src', mapa[atual]);
      }
    });
  }

  function base64ParaBlobUrl(base64){
    const limpo = String(base64 || '').replace(/\s+/g, '');

    if (!limpo.startsWith('UklG')) {
      throw new Error('payload do hero não começa com um WebP válido');
    }
    if (limpo.length !== BASE64_ESPERADO) {
      throw new Error(`payload do hero com tamanho incorreto: ${limpo.length}/${BASE64_ESPERADO}`);
    }

    const binario = atob(limpo);
    if (binario.length !== BYTES_ESPERADOS) {
      throw new Error(`arquivo reconstruído com tamanho incorreto: ${binario.length}/${BYTES_ESPERADOS} bytes`);
    }

    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);

    const assinatura = String.fromCharCode(...bytes.slice(0, 4));
    const formato = String.fromCharCode(...bytes.slice(8, 12));
    if (assinatura !== 'RIFF' || formato !== 'WEBP') {
      throw new Error(`assinatura inválida: ${assinatura}/${formato}`);
    }

    return URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }));
  }

  function validarImagem(url){
    return new Promise((resolve, reject) => {
      const teste = new Image();
      teste.decoding = 'async';
      teste.onload = () => {
        if (!teste.naturalWidth || !teste.naturalHeight) {
          reject(new Error('imagem decodificou sem dimensões'));
          return;
        }
        if (teste.naturalWidth !== HERO_LARGURA || teste.naturalHeight !== HERO_ALTURA) {
          reject(new Error(`dimensões inesperadas: ${teste.naturalWidth}x${teste.naturalHeight}`));
          return;
        }
        resolve({ width: teste.naturalWidth, height: teste.naturalHeight });
      };
      teste.onerror = () => reject(new Error('o navegador não conseguiu decodificar o WebP reconstruído'));
      teste.src = url;
    });
  }

  async function obterHeroHQ(){
    if (heroObjectUrl) return { url: heroObjectUrl, dimensoes: heroDimensoes };
    if (heroPromise) return heroPromise;

    heroPromise = (async () => {
      const respostas = await Promise.all(PARTES_HERO.map(async caminho => {
        const resposta = await fetch(`${caminho}?v=${VERSAO}`, { cache: 'no-store' });
        if (!resposta.ok) throw new Error(`${caminho}: HTTP ${resposta.status}`);
        const trecho = (await resposta.text()).replace(/\s+/g, '');
        if (!trecho) throw new Error(`${caminho}: fragmento vazio`);
        return trecho;
      }));

      const base64 = respostas.join('');
      const url = base64ParaBlobUrl(base64);

      try {
        const dimensoes = await validarImagem(url);
        heroObjectUrl = url;
        heroDimensoes = dimensoes;
        return { url, dimensoes };
      } catch (erro) {
        URL.revokeObjectURL(url);
        throw erro;
      }
    })().catch(erro => {
      heroPromise = null;
      throw erro;
    });

    return heroPromise;
  }

  async function aplicarHeroOficial(){
    const hero = document.querySelector('.hero');
    if (!hero) return;

    document.body.classList.add('v26-home');

    /* Remove a implementação antiga que inseria um <img> quebrado no canto. */
    hero.querySelectorAll('.v26-hero-bg-fisico,.v26-hero-overlay-fisico').forEach(el => el.remove());

    hero.style.setProperty('position', 'relative', 'important');
    hero.style.setProperty('overflow', 'hidden', 'important');
    hero.style.setProperty('isolation', 'isolate', 'important');
    hero.style.setProperty('background-color', '#090806', 'important');
    hero.style.setProperty('background-image', GRADIENTE, 'important');
    hero.style.setProperty('background-size', '100% 100%', 'important');
    hero.style.setProperty('background-position', 'center center', 'important');
    hero.style.setProperty('background-repeat', 'no-repeat', 'important');

    hero.querySelectorAll('.hero-conteudo,.v26-hero-grid').forEach(el => {
      el.style.setProperty('position', 'relative', 'important');
      el.style.setProperty('z-index', '2', 'important');
    });

    hero.querySelectorAll('.v26-hero-arte,.v26-wordmark,.v26-slogan,.v26-palavras,.v26-cityline').forEach(el => {
      el.style.setProperty('display', 'none', 'important');
    });

    try {
      const { url, dimensoes } = await obterHeroHQ();
      hero.style.setProperty('background-image', `${GRADIENTE}, url("${url}")`, 'important');
      hero.style.setProperty('background-size', '100% 100%, cover', 'important');
      hero.style.setProperty('background-position', 'center center, center center', 'important');
      hero.style.setProperty('background-repeat', 'no-repeat, no-repeat', 'important');
      hero.classList.add('v26-hero-img-ok');
      document.body.classList.add('v26-hero-oficial-carregado');
      console.info('[V26] Hero oficial validado e aplicado:', dimensoes.width, 'x', dimensoes.height);
    } catch (erro) {
      hero.classList.remove('v26-hero-img-ok');
      console.error('[V26] Hero oficial não pôde ser reconstruído; mantendo fundo seguro.', erro);
    }
  }

  function iniciar(){
    corrigirIcones();
    aplicarHeroOficial();

    const obs = new MutationObserver(() => {
      corrigirIcones();
      const hero = document.querySelector('.hero');
      if (hero && !hero.classList.contains('v26-hero-img-ok') && !heroPromise) {
        aplicarHeroOficial();
      }
    });
    obs.observe(document.documentElement, { childList:true, subtree:true });
  }

  window.addEventListener('pagehide', () => {
    if (heroObjectUrl) {
      URL.revokeObjectURL(heroObjectUrl);
      heroObjectUrl = null;
      heroDimensoes = null;
      heroPromise = null;
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once:true });
  } else {
    iniciar();
  }
})();
