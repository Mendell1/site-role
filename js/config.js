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

/* V25: correção de estabilidade precisa carregar antes dos módulos dinâmicos. */
(() => {
  if (!document.querySelector('script[data-role-v25-stability]')) {
    const script = document.createElement('script');
    script.src = 'js/estabilidade-v25.js';
    script.async = false;
    script.dataset.roleV25Stability = '1';
    document.head.appendChild(script);
  }
})();

/* V25.2 experimental: inscrição, vagas e lista de espera. */
(() => {
  if (!document.querySelector('link[data-role-v25-2]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/participacao-v25.css';
    link.dataset.roleV252 = '1';
    document.head.appendChild(link);
  }
  if (!document.querySelector('script[data-role-v25-2]')) {
    const script = document.createElement('script');
    script.src = 'js/participacao-v25.js';
    script.async = false;
    script.dataset.roleV252 = '1';
    document.head.appendChild(script);
  }
})();

/* V25.3: adaptador do QR precisa existir antes do módulo de check-in. */
(() => {
  if (!document.querySelector('script[data-role-v25-qr-compat]')) {
    const script = document.createElement('script');
    script.src = 'js/qr-compat-v25.js';
    script.async = false;
    script.dataset.roleV25QrCompat = '1';
    document.head.appendChild(script);
  }
})();

/* V25.3 experimental: ingresso QR, check-in e painel presencial. */
(() => {
  if (!document.querySelector('link[data-role-v25-3]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/checkin-v25.css';
    link.dataset.roleV253 = '1';
    document.head.appendChild(link);
  }
  if (!document.querySelector('script[data-role-v25-3]')) {
    const script = document.createElement('script');
    script.src = 'js/checkin-v25.js';
    script.async = false;
    script.dataset.roleV253 = '1';
    document.head.appendChild(script);
  }
})();

/* V25.4 — PWA instalável e suporte offline do frontend. */
(() => {
  if (!document.querySelector('link[data-role-v25-4-pwa]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/pwa-v25.css';
    link.dataset.roleV254Pwa = '1';
    document.head.appendChild(link);
  }
  if (!document.querySelector('script[data-role-v25-4-pwa]')) {
    const script = document.createElement('script');
    script.src = 'js/pwa-v25.js';
    script.async = false;
    script.dataset.roleV254Pwa = '1';
    document.head.appendChild(script);
  }
})();

/* V25.4 — recomendações e busca inteligente. */
(() => {
  if (!document.querySelector('link[data-role-v25-4-inteligencia]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/inteligencia-v25.css';
    link.dataset.roleV254Inteligencia = '1';
    document.head.appendChild(link);
  }
  if (!document.querySelector('script[data-role-v25-4-inteligencia]')) {
    const script = document.createElement('script');
    script.src = 'js/inteligencia-v25.js';
    script.async = false;
    script.dataset.roleV254Inteligencia = '1';
    document.head.appendChild(script);
  }
})();
