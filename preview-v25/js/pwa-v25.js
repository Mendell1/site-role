/* ============================================================
   ROLÊ V25.5 — PWA instalável
   Manifesto, Service Worker, instalação e estado offline.
   ============================================================ */
(() => {
  'use strict';

  const PREFIXO='[V25.5/PWA]';
  const CHAVE_OCULTO_ATE='role_pwa_oculto_ate';
  const DIAS_OCULTO=7;
  let promptInstalacao=null;
  let registroSW=null;
  let timerConvite=null;

  function garantirHead(){
    if(!document.querySelector('link[rel="manifest"]')){
      const link=document.createElement('link');
      link.rel='manifest'; link.href='manifest.webmanifest';
      document.head.appendChild(link);
    }
    if(!document.querySelector('meta[name="theme-color"]')){
      const meta=document.createElement('meta');
      meta.name='theme-color'; meta.content='#17140F';
      document.head.appendChild(meta);
    }
    if(!document.querySelector('meta[name="apple-mobile-web-app-capable"]')){
      const meta=document.createElement('meta');
      meta.name='apple-mobile-web-app-capable'; meta.content='yes';
      document.head.appendChild(meta);
    }
    if(!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')){
      const meta=document.createElement('meta');
      meta.name='apple-mobile-web-app-status-bar-style'; meta.content='black-translucent';
      document.head.appendChild(meta);
    }
    if(!document.querySelector('link[rel="apple-touch-icon"]')){
      const link=document.createElement('link');
      link.rel='apple-touch-icon'; link.href='assets/icon-192.png';
      document.head.appendChild(link);
    }
  }

  function modoStandalone(){
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function conviteOculto(){
    const ate=Number(localStorage.getItem(CHAVE_OCULTO_ATE)||0);
    return Number.isFinite(ate) && ate>Date.now();
  }

  function ocultarPorAlgunsDias(){
    const ate=Date.now()+(DIAS_OCULTO*24*60*60*1000);
    localStorage.setItem(CHAVE_OCULTO_ATE,String(ate));
  }

  function criarAviso(){
    if(document.getElementById('pwaV254')) return document.getElementById('pwaV254');
    const el=document.createElement('aside');
    el.id='pwaV254'; el.className='v254-pwa'; el.hidden=true;
    el.setAttribute('aria-label','Instalar Rolê como aplicativo');
    el.innerHTML='<div class="v254-pwa-icone"><img src="assets/icon-192.png" alt=""></div>'+
      '<div class="v254-pwa-texto"><strong>Leve o Rolê com você</strong><span>Instale como aplicativo para abrir direto da tela inicial.</span></div>'+
      '<div class="v254-pwa-acoes"><button type="button" class="v254-pwa-instalar">Instalar</button><button type="button" class="v254-pwa-fechar" aria-label="Agora não">×</button></div>';
    document.body.appendChild(el);
    el.querySelector('.v254-pwa-instalar').addEventListener('click',instalar);
    el.querySelector('.v254-pwa-fechar').addEventListener('click',()=>{
      el.hidden=true;
      ocultarPorAlgunsDias();
    });
    return el;
  }

  function mostrarInstalacao(){
    if(modoStandalone() || !promptInstalacao || conviteOculto()) return;
    const el=criarAviso(); el.hidden=false;
  }

  function agendarConvite(){
    clearTimeout(timerConvite);
    timerConvite=setTimeout(mostrarInstalacao,4500);
  }

  async function instalar(){
    if(!promptInstalacao) return;
    const el=criarAviso();
    try{
      await promptInstalacao.prompt();
      const escolha=await promptInstalacao.userChoice;
      console.info(PREFIXO,'resultado da instalação',escolha.outcome);
      if(escolha.outcome!=='accepted') ocultarPorAlgunsDias();
    }catch(err){ console.warn(PREFIXO,err); }
    promptInstalacao=null;
    el.hidden=true;
  }

  function criarEstadoRede(){
    if(document.getElementById('redeV254')) return;
    const el=document.createElement('div');
    el.id='redeV254'; el.className='v254-rede'; el.hidden=navigator.onLine;
    el.setAttribute('role','status');
    el.setAttribute('aria-live','polite');
    el.textContent='Sem internet · mostrando o que estiver salvo neste aparelho';
    document.body.appendChild(el);
    window.addEventListener('offline',()=>{ el.hidden=false; });
    window.addEventListener('online',()=>{ el.hidden=true; });
  }

  async function registrarSW(){
    if(!('serviceWorker' in navigator)) return;
    try{
      registroSW=await navigator.serviceWorker.register('./sw-v25.js',{scope:'./'});
      console.info(PREFIXO,'service worker ativo',registroSW.scope);

      registroSW.addEventListener('updatefound',()=>{
        const novo=registroSW.installing;
        if(!novo) return;
        novo.addEventListener('statechange',()=>{
          if(novo.state==='installed' && navigator.serviceWorker.controller){
            console.info(PREFIXO,'nova versão disponível');
          }
        });
      });

      setTimeout(()=>registroSW?.update().catch(()=>{}),2500);
    }catch(err){
      console.warn(PREFIXO,'service worker não pôde ser registrado',err);
    }
  }

  function iniciar(){
    garantirHead(); criarAviso(); criarEstadoRede(); registrarSW();

    window.addEventListener('beforeinstallprompt',event=>{
      event.preventDefault();
      promptInstalacao=event;
      agendarConvite();
    });

    window.addEventListener('appinstalled',()=>{
      promptInstalacao=null;
      localStorage.removeItem(CHAVE_OCULTO_ATE);
      const el=document.getElementById('pwaV254'); if(el) el.hidden=true;
      console.info(PREFIXO,'Rolê instalado');
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
