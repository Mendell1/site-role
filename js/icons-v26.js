/* ============================================================
   ROLÊ V26 — ICONOGRAFIA APROVADA
   SVGs inline + PNGs aprovados para Cultura e Gastronomia.
   ============================================================ */
(() => {
  'use strict';
  if (window.__roleV26IconsAtivos) return;
  window.__roleV26IconsAtivos = true;

  const P = {
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.8 21a2 2 0 0 1-3.6 0"/>',
    menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
    user:'<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c.7-4.2 3-6.3 6.5-6.3s5.8 2.1 6.5 6.3"/>',
    shield:'<path d="M12 3 20 6v5.5c0 4.6-3.1 7.7-8 9.5-4.9-1.8-8-4.9-8-9.5V6l8-3Z"/><path d="m8.4 12 2.3 2.3 4.9-5"/>',
    search:'<circle cx="10.6" cy="10.6" r="6.2"/><path d="m15.2 15.2 4.3 4.3"/>',
    calendar:'<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M7 3v4M17 3v4M3.5 9.2h17"/>',
    calendarGrid:'<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M7 3v4M17 3v4M3.5 9.2h17"/><path d="M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01M16 16.5h.01"/>',
    tag:'<path d="M20.5 13.2 13.2 20.5 3.5 10.8V4h6.8l10.2 9.2Z"/><circle cx="8" cy="8" r="1.2"/>',
    navigation:'<path d="m21 3-7.4 18-3.1-7.5L3 10.4 21 3Z"/><path d="m10.5 13.5 5.2-5.2"/>',
    music:'<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    gamepad:'<path d="M8.2 8.1h7.6c2.4 0 4 1.6 4.4 4.4l.5 3.6c.3 2.3-2.1 3.6-3.7 2l-2.2-2.2H9.2L7 18.1c-1.6 1.6-4 .3-3.7-2l.5-3.6c.4-2.8 2-4.4 4.4-4.4Z"/><path d="M7 11v4M5 13h4"/><circle cx="16" cy="12" r=".8"/><circle cx="18" cy="14" r=".8"/>',
    dumbbell:'<rect x="4.6" y="7.7" width="3" height="8.6" rx="1.5"/><rect x="1.9" y="9.6" width="2.7" height="4.8" rx="1.35"/><rect x="16.4" y="7.7" width="3" height="8.6" rx="1.5"/><rect x="19.4" y="9.6" width="2.7" height="4.8" rx="1.35"/><path d="M7.6 12h8.8"/>',
    education:'<path d="m3 10 9-5 9 5-9 5-9-5Z"/><path d="M7 12.2V16c2.9 2 7.1 2 10 0v-3.8M21 10v5"/>',
    users:'<circle cx="12" cy="8" r="3"/><path d="M6.5 20c.5-3.9 2.3-6 5.5-6s5 2.1 5.5 6"/><circle cx="5" cy="10" r="2"/><circle cx="19" cy="10" r="2"/><path d="M2 18c.3-2.5 1.5-4 3.8-4M22 18c-.3-2.5-1.5-4-3.8-4"/>',
    briefcase:'<rect x="3" y="7" width="18" height="12" rx="2.2"/><path d="M9 7V5.5h6V7M3 11.5h18M10 12h4v2h-4z"/>',
    storefront:'<path d="M4 10v10h16V10M3 10l2-5h14l2 5"/><path d="M3 10c0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0"/><path d="M9 20v-6h6v6"/>',
    grid:'<rect x="4" y="4" width="6" height="6" rx="1.2"/><rect x="14" y="4" width="6" height="6" rx="1.2"/><rect x="4" y="14" width="6" height="6" rx="1.2"/><rect x="14" y="14" width="6" height="6" rx="1.2"/>',
    sparkles:'<path d="m12 3 1.2 3.3L16.5 7.5l-3.3 1.2L12 12l-1.2-3.3-3.3-1.2 3.3-1.2L12 3Z"/><path d="m18.5 13 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8ZM5.5 14l.8 2.2 2.2.8-2.2.8L5.5 20l-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/>',
    heart:'<path d="M20.7 5.8c-2-2-5.2-1.9-7.1.1L12 7.6l-1.6-1.7c-1.9-2-5.1-2.1-7.1-.1-2.1 2.1-2 5.5.1 7.5L12 21l8.6-7.7c2.1-2 2.2-5.4.1-7.5Z"/>',
    bookmark:'<path d="M6 4.5h12v16l-6-3.7-6 3.7v-16Z"/>',
    mapPin:'<path d="M20 10c0 5.2-8 11-8 11S4 15.2 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.4"/>',
    more:'<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>'
  };

  const PNG = {
    culture:'assets/icons/categoria-cultura.png',
    food:'assets/icons/categoria-gastronomia.png'
  };

  function icon(name, extra='') {
    if (PNG[name]) {
      return `<img class="v26-ui-icon v26-icon-${name} v26-icon-png ${extra}" src="${PNG[name]}" alt="" aria-hidden="true" draggable="false">`;
    }
    const content=P[name] || P.more;
    return `<svg class="v26-ui-icon v26-icon-${name} ${extra}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
  }

  const limparPrefixo=(texto='')=>texto.replace(/^[\s★☆✦♡♥▦▱♙⌖▣▤♫♪◆●•]+/u,'').trim();
  function colocarNoBotao(el,nome,preservar=true){
    if(!el||el.dataset.v26IconReady==='1') return;
    const texto=preservar?limparPrefixo(el.textContent):'';
    el.innerHTML=icon(nome)+(texto?`<span class="v26-icon-label">${texto}</span>`:'');
    el.dataset.v26IconReady='1';
  }

  function topo(){
    const sino=document.querySelector('#btnNotificacoes');
    if(sino&&sino.dataset.v26IconReady!=='1'){
      const badge=sino.querySelector('#badgeNotificacoes');
      sino.innerHTML=icon('bell'); if(badge) sino.appendChild(badge); sino.dataset.v26IconReady='1';
    }
    colocarNoBotao(document.querySelector('#btnMenuMobile'),'menu',false);
    colocarNoBotao(document.querySelector('#btnPerfil'),'user');
    colocarNoBotao(document.querySelector('#btnAdmin'),'shield');
  }

  function buscaEFiltros(){
    const icone=document.querySelector('.busca-icone');
    if(icone&&icone.dataset.v26IconReady!=='1'){icone.innerHTML=icon('search');icone.dataset.v26IconReady='1'}
    colocarNoBotao(document.querySelector('#btnBuscar'),'search');
    const atalhos={hoje:'calendar',fds:'calendar',semana:'calendarGrid',gratis:'tag'};
    document.querySelectorAll('.chip[data-atalho]').forEach(btn=>colocarNoBotao(btn,atalhos[btn.dataset.atalho]||'calendar'));
    document.querySelectorAll('.chip-perto-v23').forEach(btn=>colocarNoBotao(btn,'navigation'));
  }

  const categorias={festas:'music',games:'gamepad',esportes:'dumbbell',educacao:'education',cultura:'culture',gastronomia:'food',musica:'music',social:'users',profissional:'briefcase',feiras:'storefront',outros:'more'};
  function categoriasUI(){
    document.querySelectorAll('.cat[data-cat]').forEach(btn=>{
      const cat=(btn.dataset.cat||'').toLowerCase();
      if(cat==='todos'||cat==='tudo') return;
      colocarNoBotao(btn,categorias[cat]||'more');
    });
  }

  function abasEVisoes(){
    document.querySelectorAll('.aba[data-aba]').forEach(btn=>{
      const aba=(btn.dataset.aba||'').toLowerCase();
      const nome=aba==='todos'?'grid':(aba==='recomendados'||aba==='para-voce')?'sparkles':aba==='favoritos'?'heart':aba==='interesse'?'bookmark':aba==='meus'?'user':'grid';
      colocarNoBotao(btn,nome);
    });
    document.querySelectorAll('.visao[data-visao]').forEach(btn=>{
      const v=(btn.dataset.visao||'').toLowerCase();
      colocarNoBotao(btn,v==='mapa'?'mapPin':v==='calendario'?'calendar':'grid');
    });
  }

  function categoriasCards(){
    document.querySelectorAll('.v261-categoria-media').forEach(el=>{
      if(el.dataset.v26IconReady==='1') return;
      const texto=limparPrefixo(el.textContent);
      const chave=texto.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
      el.innerHTML=icon(categorias[chave]||'tag')+`<span class="v26-icon-label">${texto}</span>`;
      el.dataset.v26IconReady='1';
    });
  }

  function aplicar(){topo();buscaEFiltros();categoriasUI();abasEVisoes();categoriasCards()}
  let agendado=false;
  function agendar(){if(agendado)return;agendado=true;requestAnimationFrame(()=>{agendado=false;aplicar()})}
  function iniciar(){
    if(!document.body.classList.contains('v26-home')) document.body.classList.add('v26-home');
    aplicar(); const obs=new MutationObserver(agendar); obs.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true}); else iniciar();
})();
