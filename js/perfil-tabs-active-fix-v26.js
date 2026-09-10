/* Sincroniza abas, painéis e navegação por teclado, mesmo fora do main. */
(() => {
  'use strict';
  if(window.__rolePerfilTabsActiveFixV26) return;
  window.__rolePerfilTabsActiveFixV26=true;
  let raf=0;
  const atribuir=(el,nome,valor)=>{
    if(el.getAttribute(nome)!==valor) el.setAttribute(nome,valor);
  };
  function sincronizar(){
    const main=document.getElementById('perfilMain');
    const abas=document.querySelector('.perfil-abas');
    if(!main||!abas) return;
    const paineis=[...main.querySelectorAll('.perfil-painel[data-pane]')];
    const visivel=paineis.find(p=>!p.hidden);
    abas.querySelectorAll('.perfil-aba[data-tab]').forEach(btn=>{
      const painel=paineis.find(p=>p.dataset.pane===btn.dataset.tab);
      if(!painel) return;
      if(!btn.id) btn.id='perfil-aba-'+btn.dataset.tab;
      if(!painel.id) painel.id='perfil-painel-'+btn.dataset.tab;
      const ativo=painel===visivel&&!btn.hidden;
      if(btn.classList.contains('ativa')!==ativo) btn.classList.toggle('ativa',ativo);
      atribuir(btn,'aria-selected',String(ativo));
      atribuir(btn,'aria-controls',painel.id);
      atribuir(btn,'tabindex',ativo?'0':'-1');
      atribuir(painel,'role','tabpanel');
      atribuir(painel,'aria-labelledby',btn.id);
      atribuir(painel,'tabindex','0');
    });
  }
  function agendar(){
    if(raf) return;
    raf=requestAnimationFrame(()=>{raf=0;sincronizar();});
  }
  function iniciar(){
    sincronizar();
    document.addEventListener('click',e=>{
      if(e.target.closest('.perfil-aba[data-tab]')) agendar();
    });
    document.addEventListener('keydown',e=>{
      const btn=e.target.closest('.perfil-aba[data-tab]');
      if(!btn||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
      const abas=[...document.querySelectorAll('.perfil-abas .perfil-aba')].filter(b=>!b.hidden&&!b.disabled);
      const i=abas.indexOf(btn);
      if(i<0||!abas.length) return;
      e.preventDefault();
      const proximo=e.key==='Home'?0:e.key==='End'?abas.length-1:(i+(e.key==='ArrowRight'?1:-1)+abas.length)%abas.length;
      abas[proximo].focus();
      abas[proximo].click();
      abas[proximo].scrollIntoView({block:'nearest',inline:'nearest'});
      agendar();
    });
    const obs=new MutationObserver(agendar);
    obs.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','aria-selected']});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
