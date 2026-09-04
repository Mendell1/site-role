/* ============================================================
   CONFIGURAÇÃO DO SUPABASE
   ------------------------------------------------------------
   No painel do Supabase: Settings > API
   Copie os dois valores e cole abaixo.

   A chave "anon public" pode ficar visível no código — ela só
   funciona dentro das regras de segurança (RLS) que criamos na
   Etapa 2. NUNCA use aqui a chave "service_role".
   ============================================================ */

const SUPABASE_URL = 'https://wguayxwgxjvrtyowkzyz.supabase.co';

const SUPABASE_ANON = 'sb_publishable_Nrx0t9ApDVC2RfqPmlyKSA_9-kgVHpc';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
// aviso amigável enquanto as chaves não forem preenchidas
if (SUPABASE_URL.startsWith('COLE')) {
  console.warn('Configure js/config.js com a URL e a chave do seu projeto Supabase.');
}

/* V25 experimental: módulo comunitário carregado de forma isolada. */
(() => {
  if (!document.querySelector('link[data-role-v25]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/comunidade-v25.css';
    link.dataset.roleV25 = '1';
    document.head.appendChild(link);
  }
  if (!document.querySelector('script[data-role-v25]')) {
    const script = document.createElement('script');
    script.src = 'js/comunidade-v25.js';
    script.async = false;
    script.dataset.roleV25 = '1';
    document.head.appendChild(script);
  }
})();
