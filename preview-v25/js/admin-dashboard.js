/* ============================================================
   ROLÊ V23 — resumo administrativo com métricas
   ============================================================ */
(() => {
  const $=id=>document.getElementById(id);
  const esc=v=>String(v==null?'':v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  let dias=30;
  let carregando=false;

  function garantirCss(){
    if(document.querySelector('link[data-recursos-v23]')) return;
    const link=document.createElement('link'); link.rel='stylesheet'; link.href='css/recursos-v23.css'; link.dataset.recursosV23='1'; document.head.appendChild(link);
  }

  function numero(v){ return Number(v||0).toLocaleString('pt-BR'); }

  function barra(rotulo,valor,maximo){
    const pct=maximo>0?Math.max(2,Math.round((valor/maximo)*100)):0;
    return '<div class="admin-barra-linha-v23"><span>'+esc(rotulo)+'</span><div class="admin-barra-v23"><i style="width:'+pct+'%"></i></div><b>'+numero(valor)+'</b></div>';
  }

  function kpi(rotulo,valor,extra){
    return '<article class="admin-kpi-v23"><span>'+esc(rotulo)+'</span><strong>'+numero(valor)+'</strong>'+(extra?'<small>'+esc(extra)+'</small>':'')+'</article>';
  }

  async function carregarResumo(){
    if(carregando) return;
    carregando=true;
    const lista=$('lista');
    if(!lista){ carregando=false; return; }
    lista.innerHTML='<div class="esqueleto" style="min-height:100px;margin-bottom:12px"></div>'.repeat(3);
    $('tituloPainel').textContent='Resumo do sistema';
    $('contagemPainel').textContent='últimos '+dias+' dias';

    try{
      const {data,error}=await db.rpc('admin_metricas',{p_dias:dias});
      if(error) throw error;
      const totais=data.totais||{}, periodo=data.periodo||{}, situacoes=data.situacoes||{}, categorias=data.categorias||[];
      const situacaoNomes={agendado:'Agendados',adiado:'Adiados',esgotado:'Esgotados',cancelado:'Cancelados',finalizado:'Finalizados'};
      const maxSituacao=Math.max(1,...Object.values(situacoes).map(Number));
      const maxCategoria=Math.max(1,...categorias.map(x=>Number(x.qtd||0)));

      lista.innerHTML='<section class="admin-resumo-v23">'+
        '<div class="admin-resumo-toolbar">'+
          '<div><strong style="color:#fff1df">Visão geral do Rolê</strong><div class="meta">Dados reais do banco, sem valores fictícios.</div></div>'+ 
          '<label>Período <select id="adminPeriodoV23"><option value="7"'+(dias===7?' selected':'')+'>7 dias</option><option value="30"'+(dias===30?' selected':'')+'>30 dias</option><option value="90"'+(dias===90?' selected':'')+'>90 dias</option><option value="365"'+(dias===365?' selected':'')+'>1 ano</option></select><button class="mini" id="adminAtualizarV23">Atualizar</button></label>'+ 
        '</div>'+ 
        '<div class="admin-kpis-v23">'+
          kpi('Usuários',totais.usuarios,'+'+numero(periodo.usuarios)+' no período')+
          kpi('Eventos ativos',totais.eventos_ativos,'de '+numero(totais.eventos)+' cadastrados')+
          kpi('Interesses',totais.interesses,'+'+numero(periodo.interesses)+' no período')+
          kpi('Denúncias pendentes',totais.denuncias_pendentes,numero(totais.denuncias)+' no total')+
        '</div>'+ 
        '<div class="admin-periodo-v23">'+
          '<div class="admin-periodo-item-v23"><strong>'+numero(periodo.usuarios)+'</strong><span>NOVOS USUÁRIOS</span></div>'+ 
          '<div class="admin-periodo-item-v23"><strong>'+numero(periodo.eventos)+'</strong><span>EVENTOS CRIADOS</span></div>'+ 
          '<div class="admin-periodo-item-v23"><strong>'+numero(periodo.comentarios)+'</strong><span>COMENTÁRIOS</span></div>'+ 
          '<div class="admin-periodo-item-v23"><strong>'+numero(periodo.interesses)+'</strong><span>INTERESSES</span></div>'+ 
          '<div class="admin-periodo-item-v23"><strong>'+numero(periodo.denuncias)+'</strong><span>DENÚNCIAS</span></div>'+ 
        '</div>'+ 
        '<div class="admin-graficos-v23">'+
          '<section class="admin-grafico-v23"><h3>Eventos por situação</h3>'+Object.entries(situacaoNomes).map(([chave,nome])=>barra(nome,Number(situacoes[chave]||0),maxSituacao)).join('')+'</section>'+ 
          '<section class="admin-grafico-v23"><h3>Eventos por categoria</h3>'+(categorias.length?categorias.slice(0,10).map(c=>barra(c.nome,Number(c.qtd||0),maxCategoria)).join(''):'<div class="meta">Sem categorias com eventos.</div>')+'</section>'+ 
        '</div>'+ 
      '</section>';
    }catch(err){
      console.error('Métricas administrativas:',err);
      lista.innerHTML='<div class="vazio"><strong>Não foi possível carregar o resumo</strong>'+esc(err.message||'Tente novamente.')+'</div>';
    }finally{ carregando=false; }
  }

  function selecionarResumo(botao){
    document.querySelectorAll('.painel-aba').forEach(x=>x.setAttribute('aria-pressed',String(x===botao)));
    carregarResumo();
  }

  function instalar(){
    garantirCss();
    const abas=document.querySelector('.painel-abas');
    if(!abas || abas.querySelector('[data-painel="resumo"]')) return;
    const botao=document.createElement('button');
    botao.className='painel-aba'; botao.dataset.painel='resumo'; botao.setAttribute('aria-pressed','false'); botao.textContent='Resumo';
    abas.insertBefore(botao,abas.firstChild);

    abas.addEventListener('click',e=>{
      const b=e.target.closest('[data-painel="resumo"]');
      if(!b) return;
      e.preventDefault(); e.stopImmediatePropagation();
      selecionarResumo(b);
    },true);

    document.addEventListener('change',e=>{
      if(e.target.id==='adminPeriodoV23'){
        dias=Number(e.target.value)||30;
        carregarResumo();
      }
    });
    document.addEventListener('click',e=>{
      if(e.target.closest('#adminAtualizarV23')) carregarResumo();
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',instalar,{once:true});
  else instalar();
})();
