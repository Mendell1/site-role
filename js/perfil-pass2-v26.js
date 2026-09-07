/* ROLÊ V26 — perfil pass 2
   Reusa a arte oficial da home no hero do perfil sem alterar a lógica do app. */
(() => {
  'use strict';
  if(window.__rolePerfilPass2V26) return;
  window.__rolePerfilPass2V26 = true;

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

  let objectUrl = null;

  function base64ParaUrl(base64){
    const limpo=String(base64||'').replace(/\s+/g,'');
    if(!limpo.startsWith('UklG')) throw new Error('hero inválido');
    const binario=atob(limpo);
    const bytes=new Uint8Array(binario.length);
    for(let i=0;i<binario.length;i++) bytes[i]=binario.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));
  }

  async function aplicarHero(){
    const hero=document.querySelector('.perfil-hero');
    if(!hero || hero.dataset.heroOficialPerfil==='1') return;

    try{
      const respostas=await Promise.all(PARTES_HERO.map(async caminho=>{
        const r=await fetch(`${caminho}?v=20260907-0245`,{cache:'no-store'});
        if(!r.ok) throw new Error(`${caminho}: ${r.status}`);
        return (await r.text()).replace(/\s+/g,'');
      }));

      objectUrl=base64ParaUrl(respostas.join(''));
      hero.style.setProperty('--perfil-hero-hq',`url("${objectUrl}")`);
      hero.dataset.heroOficialPerfil='1';
      hero.classList.add('perfil-hero-hq');
    }catch(erro){
      console.warn('[ROLÊ] Mantendo imagem de fallback no perfil.',erro);
    }
  }

  function limparCabecalhoEventos(){
    document.querySelectorAll('.perfil-eventos-resumo-v26').forEach(el=>el.remove());
  }

  function iniciar(){
    document.body.classList.add('v26-perfil-pass2');
    limparCabecalhoEventos();
    aplicarHero();

    const obs=new MutationObserver(()=>{
      limparCabecalhoEventos();
      const hero=document.querySelector('.perfil-hero');
      if(hero && hero.dataset.heroOficialPerfil!=='1' && !objectUrl) aplicarHero();
    });
    obs.observe(document.body,{childList:true,subtree:true});
  }

  window.addEventListener('pagehide',()=>{
    if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}
  });

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
