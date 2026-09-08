/* ============================================================
   CONFIGURAÇÃO DO SUPABASE — OFICIAL V26
   Usa os módulos validados no preview-v25 sem expor segredos.
   ============================================================ */
const SUPABASE_URL = 'https://wguayxwgxjvrtyowkzyz.supabase.co';
const SUPABASE_ANON = 'sb_publishable_Nrx0t9ApDVC2RfqPmlyKSA_9-kgVHpc';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

if (SUPABASE_URL.startsWith('COLE')) {
  console.warn('Configure js/config.js com a URL e a chave do seu projeto Supabase.');
}

(() => {
  'use strict';

  const pagina = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const eh = (...nomes) => nomes.includes(pagina);
  const BASE = 'preview-v25/';

  function estilo(rel, marcador){
    const href = BASE + rel;
    if(document.querySelector(`link[href="${href}"]`) || document.querySelector(`link[data-role-${marcador}]`)) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    link.dataset[`role${marcador.replace(/-([a-z0-9])/g,(_,c)=>c.toUpperCase())}`]='1';
    document.head.appendChild(link);
  }

  function estiloLocal(href, marcador){
    if(document.querySelector(`link[href="${href}"]`) || document.querySelector(`link[data-role-${marcador}]`)) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    link.dataset[`role${marcador.replace(/-([a-z0-9])/g,(_,c)=>c.toUpperCase())}`]='1';
    document.head.appendChild(link);
  }

  function script(rel, marcador){
    const src = BASE + rel;
    if(document.querySelector(`script[src="${src}"]`) || document.querySelector(`script[data-role-${marcador}]`)) return;
    const s=document.createElement('script');
    s.src=src;
    s.async=false;
    s.dataset[`role${marcador.replace(/-([a-z0-9])/g,(_,c)=>c.toUpperCase())}`]='1';
    document.head.appendChild(s);
  }

  function scriptLocal(src, marcador){
    if(document.querySelector(`script[src="${src}"]`) || document.querySelector(`script[data-role-${marcador}]`)) return;
    const s=document.createElement('script');
    s.src=src;
    s.async=false;
    s.dataset[`role${marcador.replace(/-([a-z0-9])/g,(_,c)=>c.toUpperCase())}`]='1';
    document.head.appendChild(s);
  }

  if(eh('index.html','perfil.html')){
    estilo('css/participacao-v25.css','v25-2');
    script('js/participacao-v25.js','v25-2');
  }

  if(eh('index.html','perfil.html')){
    if(eh('index.html')) script('js/estabilidade-v25.js','v25-stability');
    script('js/qr-compat-v25.js','v25-qr-compat');
    if(eh('index.html')) script('js/qr-evento-v25.js','v25-event-qr');
    estilo('css/checkin-v25.css','v25-3');
    script('js/checkin-v25.js','v25-3');
  }

  if(eh('index.html')){
    estilo('css/inteligencia-v25.css','v25-4-inteligencia');
    script('js/inteligencia-v25.js','v25-4-inteligencia');
  }

  estilo('css/revisao-v25.css','v25-5-review');
  script('js/revisao-v25.js','v25-5-review');

  if(eh('index.html')){
    estilo('css/v25-6.css','v25-6');
    script('js/recorrencia-v25.js','v25-6-recorrencia');
    script('js/mapa-raio-v25.js','v25-6-mapa-raio');
  }

  if(eh('index.html','perfil.html','organizador.html')){
    estilo('css/v25-7.css','v25-7');
    script('js/metricas-organizador-v25.js','v25-7-metricas');
  }

  if(eh('index.html','perfil.html','admin.html','organizador.html')){
    estilo('css/acesso-organizador-v25.css','v25-9-organizador');
    script('js/acesso-organizador-v25.js','v25-9-organizador');
  }

  if(eh('perfil.html')){
    estiloLocal('css/perfil-identidade-v26.css?v=20260907-1345','v26-perfil-identidade');
    estiloLocal('css/perfil-mockup-v26.css?v=20260907-1410','v26-perfil-mockup');
    scriptLocal('js/perfil-mockup-v26.js?v=20260907-1455','v26-perfil-mockup');
    estiloLocal('css/perfil-pass2-v26.css?v=20260907-1435','v26-perfil-pass2');
    scriptLocal('js/perfil-pass2-v26.js?v=20260907-1435','v26-perfil-pass2');
    estiloLocal('css/perfil-topo-home-v26.css?v=20260907-1455','v26-perfil-topo-home');
    estiloLocal('css/perfil-topo-icons-v26.css?v=20260908-0240','v26-perfil-topo-icons');
    scriptLocal('js/perfil-topo-icons-v26.js?v=20260908-0240','v26-perfil-topo-icons');
  }

  if(eh('index.html')){
    estilo('css/v26-home.css','v26-1-home');
    script('js/v26-home.js?v=20260907-0315','v26-1-home');

    estilo('css/v26-home-fidelity.css','v26-1-fidelity');
    script('js/v26-home-fidelity.js','v26-1-fidelity');

    estilo('css/v26-home-precision.css','v26-1-precision');
    script('js/v26-home-precision.js','v26-1-precision');

    estilo('css/icons-v26.css','v26-icons');
    script('js/icons-v26.js','v26-icons');
    estilo('css/icons-v26-hotfix.css','v26-icons-hotfix');

    estiloLocal('css/hero-oficial-v26-v2.css?v=20260907-0225','v26-hero-oficial-v2');
    scriptLocal('js/assets-oficial-v26.js?v=20260907-0225','v26-assets-oficial');
    estiloLocal('css/alinhamento-v26.css?v=20260907-0345','v26-alinhamento-final');
    estiloLocal('css/polimento-v26.css?v=20260907-1340','v26-polimento-final');
  }
})();
