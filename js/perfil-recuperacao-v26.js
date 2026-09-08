/* ============================================================
   ROLÊ V26 — recuperação de visibilidade do perfil
   Evita a tela vazia quando a sessão/perfil carregam depois dos
   módulos visuais e garante que hero, conteúdo e abas sincronizem.
   ============================================================ */
(() => {
  'use strict';
  if (window.__rolePerfilRecuperacaoV26) return;
  window.__rolePerfilRecuperacaoV26 = true;

  let tentouRecarregar = false;
  let raf = 0;

  function sincronizarFaixa(main){
    const faixa = document.querySelector('.perfil-abas-faixa-v26');
    if (faixa) faixa.hidden = !!main.hidden;
  }

  function restaurar(){
    const main = document.getElementById('perfilMain');
    const hero = document.getElementById('perfilHero');
    const semSessao = document.getElementById('estadoSemSessao');
    if (!main || !hero) return;

    const sessao = window.Sessao;
    const logado = !!(sessao && typeof sessao.logado === 'function' && sessao.logado());
    const perfil = !!(sessao && sessao.perfil);

    if (!logado) {
      sincronizarFaixa(main);
      return;
    }

    if (perfil) {
      // Mostra a estrutura imediatamente. Os dados/cards podem continuar
      // carregando sem deixar a página inteira vazia.
      hero.hidden = false;
      main.hidden = false;
      if (semSessao) semSessao.hidden = true;
      sincronizarFaixa(main);

      if (typeof window.renderResumoPerfil === 'function') {
        try { window.renderResumoPerfil(); } catch (e) { console.warn('[perfil-recuperacao] resumo', e); }
      }

      // Se o fluxo normal não concluiu, dispara uma única nova tentativa.
      if (!tentouRecarregar && typeof window.aoMudarSessao === 'function') {
        tentouRecarregar = true;
        Promise.resolve(window.aoMudarSessao()).catch(e => {
          console.warn('[perfil-recuperacao] sessão', e);
          // Mesmo com erro de rede, mantém o perfil visível.
          hero.hidden = false;
          main.hidden = false;
          sincronizarFaixa(main);
        });
      }
    } else {
      sincronizarFaixa(main);
    }
  }

  function agendar(){
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      restaurar();
    });
  }

  function iniciar(){
    restaurar();

    const main = document.getElementById('perfilMain');
    if (main) {
      new MutationObserver(agendar).observe(main, {
        attributes: true,
        attributeFilter: ['hidden']
      });
    }

    // Auth e perfil chegam de forma assíncrona; acompanha por alguns segundos.
    let tentativas = 0;
    const timer = setInterval(() => {
      tentativas++;
      restaurar();
      if (tentativas >= 30 || (window.Sessao && Sessao.perfil && !document.getElementById('perfilMain')?.hidden)) {
        clearInterval(timer);
      }
    }, 250);

    window.addEventListener('pageshow', restaurar);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once:true });
  else iniciar();
})();
