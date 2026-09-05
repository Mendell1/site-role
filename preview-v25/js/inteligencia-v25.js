/* ============================================================
   ROLÊ V25.4 — recomendações + busca inteligente
   Reaproveita o mural existente e os sinais que o usuário já gera.
   ============================================================ */
(() => {
  'use strict';

  const PREFIXO='[V25.4/INTELIGÊNCIA]';
  let modoAtual=null;
  let metadados=new Map();

  const el=id=>document.getElementById(id);
  const logado=()=>typeof Sessao!=='undefined'&&Sessao&&typeof Sessao.logado==='function'&&Sessao.logado();
  const escapa=v=>String(v==null?'':v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));

  function natural(texto){
    const q=String(texto||'').toLowerCase();
    const palavras=q.trim().split(/\s+/).filter(Boolean);
    return palavras.length>=4 || /(gr[aá]tis|gratuit|hoje|amanh[aã]|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo|fim de semana|de noite|[àa] noite|de manh[aã]|[àa] tarde|perto de|no bairro|na regi[aã]o de)/i.test(q);
  }

  function garantirInterface(){
    const busca=el('busca');
    if(busca && !el('dicaBuscaV254')){
      busca.placeholder='Ex: grátis sábado à noite perto de Itaquera';
      const dica=document.createElement('div');
      dica.id='dicaBuscaV254'; dica.className='v254-dica-busca';
      dica.innerHTML='<span>✦ BUSCA INTELIGENTE</span><button type="button" data-v254-exemplo>“grátis sábado à noite perto de Itaquera”</button>';
      const caixa=busca.closest('.busca');
      if(caixa) caixa.insertAdjacentElement('afterend',dica);
    }

    const abas=el('abas');
    if(abas && !abas.querySelector('[data-v254-recomendados]')){
      const botao=document.createElement('button');
      botao.className='aba v254-aba';
      botao.type='button';
      botao.dataset.v254Recomendados='1';
      botao.setAttribute('aria-pressed','false');
      botao.textContent='✦ Para você';
      const primeira=abas.firstElementChild;
      if(primeira && primeira.nextSibling) abas.insertBefore(botao,primeira.nextSibling);
      else abas.appendChild(botao);
    }

    const linha=document.querySelector('.linha-topo');
    if(linha && !el('interpretacaoV254')){
      const caixa=document.createElement('div');
      caixa.id='interpretacaoV254'; caixa.className='v254-interpretacao'; caixa.hidden=true;
      linha.insertAdjacentElement('afterend',caixa);
    }
  }

  function resetAbas(recomendados=false){
    document.querySelectorAll('#abas .aba').forEach(b=>{
      const ativo=recomendados ? b.hasAttribute('data-v254-recomendados') : false;
      b.setAttribute('aria-pressed',String(ativo));
    });
  }

  function limparModo(){
    modoAtual=null; metadados.clear();
    const caixa=el('interpretacaoV254'); if(caixa){caixa.hidden=true;caixa.innerHTML='';}
  }

  function titulo(texto){
    const t=el('tituloLista'); if(t) t.textContent=texto;
  }

  function setEventos(dados,rotulo){
    // app.js é script clássico: seus bindings globais podem ser reutilizados aqui.
    EVENTOS=(dados||[]).map(({pontuacao,interpretacao,motivos,...evento})=>evento);
    estado.total=EVENTOS.length;
    estado.pagina=0;
    renderMural();
    const mais=el('btnMais'); if(mais) mais.hidden=true;
    const contagem=el('contagem');
    if(contagem) contagem.textContent=EVENTOS.length+(EVENTOS.length===1?' EVENTO ENCONTRADO':' EVENTOS ENCONTRADOS');
    titulo(rotulo);
  }

  function mostrarInterpretacao(info){
    const caixa=el('interpretacaoV254'); if(!caixa) return;
    const chips=[];
    if(info?.categoria) chips.push('Categoria: '+info.categoria);
    if(info?.gratuito) chips.push('Grátis');
    if(info?.periodo) chips.push(info.periodo.charAt(0).toUpperCase()+info.periodo.slice(1));
    if(info?.local) chips.push('Perto de '+info.local);
    if(info?.data_inicio){
      const ini=new Date(info.data_inicio+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
      const fim=info.data_fim&&info.data_fim!==info.data_inicio?new Date(info.data_fim+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}):null;
      chips.push(fim?'Data: '+ini+'–'+fim:'Data: '+ini);
    }
    caixa.innerHTML='<strong>O Rolê entendeu:</strong>'+(chips.length?chips.map(x=>'<span>'+escapa(x)+'</span>').join(''):'<span>busca por relevância</span>')+'<button type="button" data-v254-limpar>Limpar</button>';
    caixa.hidden=false;
  }

  function decorarMotivos(){
    requestAnimationFrame(()=>{
      metadados.forEach((meta,id)=>{
        const card=document.querySelector('.evento-card[data-ev="'+CSS.escape(id)+'"]');
        if(!card||card.querySelector('.v254-motivos')) return;
        const motivos=(meta.motivos||[]).slice(0,2);
        if(!motivos.length) return;
        const box=document.createElement('div');
        box.className='v254-motivos';
        box.innerHTML='<span>✦ PARA VOCÊ</span>'+motivos.map(m=>'<small>'+escapa(m)+'</small>').join('');
        const corpo=card.querySelector('.evento-conteudo')||card;
        corpo.appendChild(box);
      });
    });
  }

  async function buscarInteligente(texto){
    const q=String(texto||'').trim();
    if(q.length<2) return;
    modoAtual='busca'; metadados.clear();
    const grade=el('grade'); if(grade) grade.innerHTML='<div class="esqueleto"></div>'.repeat(6);
    const contagem=el('contagem'); if(contagem) contagem.textContent='interpretando sua busca...';

    const {data,error}=await db.rpc('buscar_eventos_inteligente_v25_4',{p_consulta:q,p_limite:36});
    if(error){
      console.warn(PREFIXO,error);
      if(typeof avisar==='function') avisar('Não foi possível usar a busca inteligente agora.');
      limparModo();
      return;
    }
    const dados=data||[];
    setEventos(dados,'Resultados da busca inteligente');
    mostrarInterpretacao(dados[0]?.interpretacao||{});
  }

  async function carregarRecomendacoes(){
    if(!logado()){
      if(typeof avisar==='function') avisar('Entre na sua conta para receber recomendações personalizadas.');
      const entrar=el('btnEntrar'); if(entrar) entrar.click();
      return;
    }
    modoAtual='recomendados'; metadados.clear(); resetAbas(true);
    const grade=el('grade'); if(grade) grade.innerHTML='<div class="esqueleto"></div>'.repeat(6);
    const contagem=el('contagem'); if(contagem) contagem.textContent='montando seu mural...';
    const caixa=el('interpretacaoV254');
    if(caixa){caixa.hidden=false;caixa.innerHTML='<strong>✦ Para você</strong><span>Usando favoritos, interesses, alertas, cidade e organizadores seguidos.</span>';}

    const {data,error}=await db.rpc('recomendacoes_v25_4',{p_limite:18});
    if(error){
      console.warn(PREFIXO,error);
      if(typeof avisar==='function') avisar('Não foi possível montar suas recomendações agora.');
      limparModo();
      return;
    }
    const dados=data||[];
    dados.forEach(item=>metadados.set(item.id,{motivos:item.motivos||[],pontuacao:item.pontuacao}));
    setEventos(dados,'Eventos escolhidos para você');
    decorarMotivos();
  }

  function buscaNormal(){
    limparModo();
    resetAbas(false);
    const todos=document.querySelector('#abas .aba[data-aba="todos"]'); if(todos) todos.setAttribute('aria-pressed','true');
    if(typeof carregarEventos==='function') carregarEventos();
  }

  function ligarEventos(){
    document.addEventListener('click',e=>{
      const exemplo=e.target.closest('[data-v254-exemplo]');
      if(exemplo){
        e.preventDefault();
        const input=el('busca');
        if(input){input.value='Quero algo grátis sábado à noite perto de Itaquera';buscarInteligente(input.value);}
        return;
      }

      const rec=e.target.closest('[data-v254-recomendados]');
      if(rec){e.preventDefault();e.stopImmediatePropagation();carregarRecomendacoes();return;}

      const limpar=e.target.closest('[data-v254-limpar]');
      if(limpar){e.preventDefault();if(el('busca'))el('busca').value='';buscaNormal();return;}

      const buscar=e.target.closest('#btnBuscar');
      if(buscar){
        const q=el('busca')?.value||'';
        if(natural(q)){
          e.preventDefault();e.stopImmediatePropagation();buscarInteligente(q);return;
        }
      }

      if(modoAtual && e.target.closest('#cats .cat,#atalhos .chip,#abas .aba[data-aba],.chip[data-atalho]')) limparModo();
    },true);

    document.addEventListener('keydown',e=>{
      if(e.key==='Enter'&&e.target.id==='busca'&&natural(e.target.value)){
        e.preventDefault();e.stopImmediatePropagation();buscarInteligente(e.target.value);
      }
    },true);
  }

  function iniciar(){
    garantirInterface(); ligarEventos();
    setTimeout(garantirInterface,700);
    console.info(PREFIXO,'módulo carregado');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
