/* ============================================================
   ROLÊ V25.5 — revisão de UX, mobile e acessibilidade
   Não cria novas features; organiza comportamento dos modais.
   ============================================================ */
(() => {
  'use strict';

  if(window.__roleV255RevisaoAtiva) return;
  window.__roleV255RevisaoAtiva=true;

  const abertos=new Set();
  const mediaMobile=window.matchMedia('(max-width:760px)');
  let reposicaoPendente=false;

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

  /*
   * No desktop, Participação/Check-in pertence à coluna lateral.
   * No celular, a coluna lateral inteira vem depois da descrição/comentários.
   * Isso fazia os controles parecerem ausentes. Em telas <= 760px movemos
   * somente o cartão de participação para antes dos comentários.
   */
  function reposicionarParticipacao(){
    const folha=document.getElementById('folhaDetalhe');
    const card=document.getElementById('participacaoV252');
    if(!folha || !card) return;

    const principal=folha.querySelector('.detalhe-coluna-principal');
    const lateral=folha.querySelector('.detalhe-coluna-lateral');
    if(!principal || !lateral) return;

    if(mediaMobile.matches){
      const comentarios=principal.querySelector('#areaComentarios');
      if(!comentarios) return;
      if(card.parentElement!==principal || card.nextElementSibling!==comentarios){
        principal.insertBefore(card,comentarios);
      }
      card.dataset.v255Posicao='mobile';
      return;
    }

    const organizador=lateral.querySelector('#detalheOrganizador');
    const posicaoCorreta=card.parentElement===lateral && (!organizador || card.nextElementSibling===organizador);
    if(!posicaoCorreta) lateral.insertBefore(card,organizador || null);
    card.dataset.v255Posicao='desktop';
  }

  function agendarReposicaoParticipacao(){
    if(reposicaoPendente) return;
    reposicaoPendente=true;
    requestAnimationFrame(()=>{
      reposicaoPendente=false;
      reposicionarParticipacao();
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
    agendarReposicaoParticipacao();

    const observer=new MutationObserver(()=>{
      melhorarAcessibilidade();
      sincronizarModais();
      agendarReposicaoParticipacao();
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape') return;
      if(fecharTopo()) e.preventDefault();
    },true);

    if(typeof mediaMobile.addEventListener==='function') mediaMobile.addEventListener('change',agendarReposicaoParticipacao);
    else if(typeof mediaMobile.addListener==='function') mediaMobile.addListener(agendarReposicaoParticipacao);

    window.addEventListener('pageshow',()=>{
      sincronizarModais();
      agendarReposicaoParticipacao();
    });
    console.info('[V25.5] revisão de UX ativa');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
