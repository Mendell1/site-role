/* ============================================================
   ROLÊ V25.5 — revisão de UX e acessibilidade
   Não cria novas features; organiza comportamento dos modais.
   ============================================================ */
(() => {
  'use strict';

  if(window.__roleV255RevisaoAtiva) return;
  window.__roleV255RevisaoAtiva=true;

  const abertos=new Set();

  function melhorarAcessibilidade(){
    const aviso=document.getElementById('aviso');
    if(aviso){
      if(!aviso.hasAttribute('role')) aviso.setAttribute('role','status');
      if(!aviso.hasAttribute('aria-live')) aviso.setAttribute('aria-live','polite');
      aviso.setAttribute('aria-atomic','true');
    }

    const rede=document.getElementById('redeV254');
    if(rede){
      rede.setAttribute('role','status');
      rede.setAttribute('aria-live','polite');
    }

    document.querySelectorAll('.cortina .fechar').forEach(btn=>{
      if(!btn.getAttribute('aria-label')) btn.setAttribute('aria-label','Fechar janela');
      if(!btn.getAttribute('title')) btn.setAttribute('title','Fechar');
    });

    document.querySelectorAll('.cortina [role="dialog"]').forEach(dialog=>{
      dialog.setAttribute('aria-modal','true');
      if(!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex','-1');
    });
  }

  function modaisAbertos(){
    return [...document.querySelectorAll('.cortina.aberta')];
  }

  function sincronizarModais(){
    const atuais=modaisAbertos();
    document.body.classList.toggle('v255-modal-aberto',atuais.length>0);

    const idsAtuais=new Set(atuais.map((m,i)=>m.id||`modal-sem-id-${i}`));
    atuais.forEach((modal,i)=>{
      const id=modal.id||`modal-sem-id-${i}`;
      if(abertos.has(id)) return;
      abertos.add(id);
      const foco=modal.querySelector('[data-v253-fechar],[data-v252-fechar],[data-fecha],.fechar,[role="dialog"]');
      if(foco && typeof foco.focus==='function') requestAnimationFrame(()=>foco.focus({preventScroll:true}));
    });
    [...abertos].forEach(id=>{ if(!idsAtuais.has(id)) abertos.delete(id); });
  }

  function fecharTopo(){
    const atuais=modaisAbertos();
    if(!atuais.length) return false;
    const modal=atuais[atuais.length-1];
    const botao=modal.querySelector('[data-v253-fechar],[data-v252-fechar],[data-fecha],.fechar');
    if(botao){ botao.click(); return true; }
    modal.classList.remove('aberta');
    sincronizarModais();
    return true;
  }

  function iniciar(){
    melhorarAcessibilidade();
    sincronizarModais();

    const observer=new MutationObserver(()=>{
      melhorarAcessibilidade();
      sincronizarModais();
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape') return;
      if(fecharTopo()) e.preventDefault();
    },true);

    window.addEventListener('pageshow',sincronizarModais);
    console.info('[V25.5] revisão de UX ativa');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
