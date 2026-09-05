/* ============================================================
   CONFIGURAÇÃO DO SUPABASE
   ------------------------------------------------------------
   No painel do Supabase: Settings > API
   Use somente a URL e a chave pública/publishable.
   NUNCA coloque service_role ou segredos no frontend.
   ============================================================ */

const SUPABASE_URL = 'https://wguayxwgxjvrtyowkzyz.supabase.co';
const SUPABASE_ANON = 'sb_publishable_Nrx0t9ApDVC2RfqPmlyKSA_9-kgVHpc';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

if (SUPABASE_URL.startsWith('COLE')) {
  console.warn('Configure js/config.js com a URL e a chave do seu projeto Supabase.');
}

/* ============================================================
   V25 — carregamento por página
   Evita módulos duplicados e reduz código desnecessário em telas
   que não usam participação, check-in, inteligência ou Push.
   ============================================================ */
(() => {
  'use strict';

  const pagina = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const eh = (...nomes) => nomes.includes(pagina);

  function estilo(href, marcador){
    if(document.querySelector(`link[href="${href}"]`) || document.querySelector(`link[data-role-${marcador}]`)) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=href;
    link.dataset[`role${marcador.replace(/-([a-z0-9])/g,(_,c)=>c.toUpperCase())}`]='1';
    document.head.appendChild(link);
  }

  function script(src, marcador){
    if(document.querySelector(`script[src="${src}"]`) || document.querySelector(`script[data-role-${marcador}]`)) return;
    const s=document.createElement('script');
    s.src=src;
    s.async=false;
    s.dataset[`role${marcador.replace(/-([a-z0-9])/g,(_,c)=>c.toUpperCase())}`]='1';
    document.head.appendChild(s);
  }

  /* V25.1 — comunidade.
     perfil/admin/organizador já incluem o módulo diretamente no HTML.
     Não injetar aqui evita a execução duplicada encontrada na V25.5. */

  /* V25.2 — participação: detalhe do evento e Minhas inscrições. */
  if(eh('index.html','perfil.html')){
    estilo('css/participacao-v25.css','v25-2');
    script('js/participacao-v25.js','v25-2');
  }

  /* V25.3 — ingresso/check-in. O adaptador de QR entra antes. */
  if(eh('index.html','perfil.html')){
    if(eh('index.html')) script('js/estabilidade-v25.js','v25-stability');
    script('js/qr-compat-v25.js','v25-qr-compat');
    if(eh('index.html')) script('js/qr-evento-v25.js','v25-event-qr');
    estilo('css/checkin-v25.css','v25-3');
    script('js/checkin-v25.js','v25-3');
  }

  /* V25.4 — PWA pode existir em todas as páginas públicas do projeto. */
  estilo('css/pwa-v25.css','v25-4-pwa');
  script('js/pwa-v25.js','v25-4-pwa');

  /* V25.4 — inteligência só existe no mural. */
  if(eh('index.html')){
    estilo('css/inteligencia-v25.css','v25-4-inteligencia');
    script('js/inteligencia-v25.js','v25-4-inteligencia');
  }

  /* V25.4 — configuração de Push fica no perfil do usuário. */
  if(eh('perfil.html')){
    estilo('css/push-v25.css','v25-4-push');
    script('js/push-v25.js','v25-4-push');
  }

  /* V25.5 — acabamento e acessibilidade. */
  estilo('css/revisao-v25.css','v25-5-review');
  script('js/revisao-v25.js','v25-5-review');
})();
