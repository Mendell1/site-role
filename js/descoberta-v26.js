/* Controles de descoberta: reutiliza os filtros e as consultas do aplicativo. */
(() => {
  'use strict';
  function iniciar(){
    const botao=document.getElementById('btnFiltros');
    const painel=document.getElementById('painelFiltros');
    const resumo=document.getElementById('filtrosAtivos');
    const contador=document.getElementById('filtrosContagem');
    if(!botao||!painel||!resumo) return;
    const textos={hoje:'Hoje',fds:'Fim de semana',semana:'Próximos 7 dias',gratis:'Grátis'};
    const abas={favoritos:'Favoritos',interesse:'Tenho interesse',meus:'Criados por mim'};

    function atualizar(){
      const dica=document.getElementById('dicaBuscaV254');
      if(dica&&dica.parentElement!==painel) painel.appendChild(dica);
      const busca=document.getElementById('busca');
      if(busca&&busca.placeholder!=='Buscar eventos') busca.placeholder='Buscar eventos';
      const filtros=[];
      if(estado.cat) filtros.push(CATEGORIAS.find(c=>c.id===estado.cat)?.nome||estado.cat);
      estado.atalhos.forEach(a=>{if(textos[a]) filtros.push(textos[a]);});
      const interpretacao=document.getElementById('interpretacaoV254');
      const termo=(estado.busca||(!interpretacao?.hidden?busca.value:'')).trim();
      if(termo) filtros.push('Busca: '+termo);
      if(abas[estado.aba]) filtros.push(abas[estado.aba]);
      if(document.querySelector('[data-v254-recomendados][aria-pressed="true"]')) filtros.push('Para você');
      const perto=window.RoleMapaRaioV256;
      if(perto?.ativo) filtros.push('Até '+perto.raioKm+' km');
      else if(perto?.carregando) filtros.push('Localizando…');
      const seletor=document.querySelector('.v256-raio');
      if(seletor) seletor.hidden=!perto?.ativo;
      const html=filtros.map(f=>'<span class="filtro-ativo">'+escapa(f)+'</span>').join('');
      if(resumo.innerHTML!==html) resumo.innerHTML=html;
      resumo.hidden=!filtros.length;
      contador.textContent=filtros.length?String(filtros.length):'';
      contador.hidden=!filtros.length;
      document.getElementById('btnLimparFiltros').hidden=!filtros.length;
    }
    function abrirPainel(aberto){
      painel.hidden=!aberto;
      botao.setAttribute('aria-expanded',String(aberto));
    }
    botao.addEventListener('click',()=>abrirPainel(painel.hidden));
    painel.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();abrirPainel(false);botao.focus();}
    });
    document.addEventListener('click',async e=>{
      if(e.target.closest('[data-limpar-filtros]')){
        e.preventDefault();
        botao.focus({preventScroll:true});
        await limparFiltros(); atualizar();
      }
    });
    let quadro=null;
    function agendar(){
      if(quadro!==null) return;
      quadro=requestAnimationFrame(()=>{quadro=null;atualizar();});
    }
    document.addEventListener('role:filtros-alterados',agendar);
    const observador=new MutationObserver(mudancas=>{
      if(mudancas.every(m=>m.target.nodeType===1&&m.target.closest('#filtrosAtivos,#filtrosContagem'))) return;
      agendar();
    });
    [document.querySelector('.hero'),document.getElementById('cats'),document.getElementById('abas')].filter(Boolean).forEach(el=>observador.observe(el,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-pressed','placeholder']}));
    const interpretacao=document.getElementById('interpretacaoV254');
    if(interpretacao) observador.observe(interpretacao,{attributes:true,attributeFilter:['hidden'],childList:true});
    atualizar();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
