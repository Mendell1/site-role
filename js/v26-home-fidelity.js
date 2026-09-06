/* ============================================================
   ROLÊ V26.1 — fidelidade visual dos cards e navegação
   Mantém a lógica V25 e apenas reorganiza a apresentação.
   ============================================================ */
(() => {
  'use strict';

  if(window.__roleV261FidelityAtiva) return;
  window.__roleV261FidelityAtiva=true;

  const texto = valor => String(valor == null ? '' : valor);

  function eventoPorId(id){
    try {
      if(typeof EVENTOS === 'undefined' || !Array.isArray(EVENTOS)) return null;
      return EVENTOS.find(ev => String(ev.id) === String(id)) || null;
    } catch (_) {
      return null;
    }
  }

  function horaCurta(ev){
    return texto(ev?.hora_evento).slice(0,5) || 'Horário a confirmar';
  }

  function localCurto(ev){
    const partes=[ev?.bairro,ev?.cidade].filter(Boolean);
    return partes.join(', ') || 'Local a confirmar';
  }

  function limparRotulosAbas(){
    const nomes={
      todos:'Todos os eventos',
      recomendados:'Para você',
      'para-voce':'Para você',
      favoritos:'Favoritos',
      interesse:'Tenho interesse',
      meus:'Criados por mim'
    };
    document.querySelectorAll('#abas .aba').forEach(btn=>{
      const nome=nomes[btn.dataset.aba];
      if(nome && btn.textContent.trim()!==nome) btn.textContent=nome;
    });
  }

  function enriquecerCard(card){
    if(!card || card.dataset.v261Fidelity==='1') return;
    const ev=eventoPorId(card.dataset.ev);
    if(!ev) return;

    card.dataset.v261Fidelity='1';
    const media=card.querySelector('.evento-media');
    const tags=card.querySelector('.evento-tags');
    const categoria=tags?.querySelector('.categoria-pill');
    if(media && categoria){
      categoria.classList.add('v261-categoria-media');
      media.appendChild(categoria);
    }

    const meta=card.querySelector('.evento-meta');
    if(meta){
      meta.innerHTML='';
      const local=document.createElement('li');
      local.className='v261-local';
      local.innerHTML='<span aria-hidden="true">⌖</span>';
      local.appendChild(document.createTextNode(' '+localCurto(ev)));

      const horario=document.createElement('li');
      horario.className='v261-horario';
      horario.innerHTML='<span aria-hidden="true">◷</span>';
      horario.appendChild(document.createTextNode(' '+horaCurta(ev)));
      meta.append(local,horario);
    }

    if(ev.descricao){
      const desc=document.createElement('p');
      desc.className='v261-card-desc';
      desc.textContent=ev.descricao;
      const rodape=card.querySelector('.evento-rodape');
      if(rodape) rodape.parentNode.insertBefore(desc,rodape);
      else card.querySelector('.evento-conteudo')?.appendChild(desc);
    }
  }

  function atualizarCards(){
    document.querySelectorAll('#grade .evento-card').forEach(enriquecerCard);
  }

  function observarGrade(){
    const grade=document.getElementById('grade');
    if(!grade) return;
    atualizarCards();
    const observer=new MutationObserver(()=>{
      limparRotulosAbas();
      atualizarCards();
    });
    observer.observe(grade,{childList:true,subtree:true});
  }

  function iniciar(){
    limparRotulosAbas();
    observarGrade();
    const abas=document.getElementById('abas');
    if(abas){
      new MutationObserver(limparRotulosAbas).observe(abas,{childList:true,subtree:true,characterData:true});
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
