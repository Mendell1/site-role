/* ============================================================
   ROLÊ V26 — ordem visual das abas do perfil
   Inverte as posições de "Meus eventos" e "Conta e segurança"
   sem alterar qual aba está ativa nem a lógica dos painéis.
   ============================================================ */
(() => {
  'use strict';
  if (window.__rolePerfilAbasOrdemV26) return;
  window.__rolePerfilAbasOrdemV26 = true;

  const ORDEM = [
    'conta',
    'painel-v25-7',
    'favoritos',
    'inscricoes',
    'dados',
    'organizador-v25-9',
    'eventos'
  ];

  function aplicarOrdem(){
    const abas = document.querySelector('.perfil-abas');
    if (!abas) return false;

    const botoes = Array.from(abas.querySelectorAll('.perfil-aba'));
    if (!botoes.length) return false;

    const mapa = new Map(botoes.map(btn => [btn.dataset.tab, btn]));
    const desejados = ORDEM.map(tab => mapa.get(tab)).filter(Boolean);
    const conhecidos = new Set(desejados);
    const extras = botoes.filter(btn => !conhecidos.has(btn));
    const final = [...desejados.slice(0, -1), ...extras, ...desejados.slice(-1)];

    const atual = Array.from(abas.children).filter(el => el.classList?.contains('perfil-aba'));
    const igual = atual.length === final.length && atual.every((el, i) => el === final[i]);
    if (igual) return true;

    final.forEach(btn => abas.appendChild(btn));
    return true;
  }

  function iniciar(){
    aplicarOrdem();

    // As abas extras são criadas por módulos que carregam logo depois.
    // Reaplica por alguns instantes e encerra para não observar a página à toa.
    let tentativas = 0;
    const timer = setInterval(() => {
      tentativas++;
      aplicarOrdem();
      if (tentativas >= 12) clearInterval(timer);
    }, 180);

    const abas = document.querySelector('.perfil-abas');
    if (abas) {
      const obs = new MutationObserver(() => aplicarOrdem());
      obs.observe(abas, { childList: true });
      setTimeout(() => obs.disconnect(), 3000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once:true });
  } else {
    iniciar();
  }
})();
