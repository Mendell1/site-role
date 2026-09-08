/* ROLÊ V26 — ícones do topo do perfil iguais aos da home */
(() => {
  'use strict';
  if (window.__rolePerfilTopoIconsV26) return;
  window.__rolePerfilTopoIconsV26 = true;

  const paths = {
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.8 21a2 2 0 0 1-3.6 0"/>',
    user:'<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c.7-4.2 3-6.3 6.5-6.3s5.8 2.1 6.5 6.3"/>',
    shield:'<path d="M12 3 20 6v5.5c0 4.6-3.1 7.7-8 9.5-4.9-1.8-8-4.9-8-9.5V6l8-3Z"/><path d="m8.4 12 2.3 2.3 4.9-5"/>'
  };

  function icon(name){
    return `<svg class="perfil-topo-icon perfil-topo-icon-${name}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
  }

  function inserirComTexto(id,name){
    const btn=document.getElementById(id);
    if(!btn || btn.dataset.perfilTopoIcon==='1') return;
    const texto=btn.textContent.trim();
    btn.innerHTML=icon(name)+`<span class="perfil-topo-icon-label">${texto}</span>`;
    btn.dataset.perfilTopoIcon='1';
  }

  function sino(){
    const btn=document.getElementById('btnNotificacoes');
    if(!btn || btn.dataset.perfilTopoIcon==='1') return;
    const badge=btn.querySelector('#badgeNotificacoes');
    btn.innerHTML=icon('bell');
    if(badge) btn.appendChild(badge);
    btn.dataset.perfilTopoIcon='1';
  }

  function aplicar(){
    sino();
    inserirComTexto('btnPerfil','user');
    inserirComTexto('btnAdmin','shield');
  }

  function iniciar(){
    aplicar();
    const topo=document.querySelector('.topo');
    if(topo){
      new MutationObserver(aplicar).observe(topo,{childList:true,subtree:true});
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
