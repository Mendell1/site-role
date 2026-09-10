/* ============================================================
   ROLÊ V25.6 — Mapa avançado por raio
   Assume o controle do botão “Perto de mim” da V23 e acrescenta
   1 / 5 / 10 / 25 km. O mesmo conjunto aparece no mural e mapa.
   ============================================================ */
(() => {
  'use strict';

  if(window.__roleV256MapaRaioAtivo) return;
  window.__roleV256MapaRaioAtivo = true;

  const estadoRaio = {
    ativo:false,
    raioKm:10,
    localizacao:null,
    carregando:false,
    eventos:[],
    distancias:new Map()
  };
  window.RoleMapaRaioV256 = estadoRaio;

  let camadaUsuario = null;
  let timerFiltro = null;
  let revisaoRaio=0;

  function avisar(texto){
    if(typeof window.avisar==='function') window.avisar(texto);
    else console.info('[V25.6 mapa]',texto);
  }

  function botaoPerto(){ return document.querySelector('.chip-perto-v23'); }

  function atualizarBotao(){
    const btn=botaoPerto();
    if(!btn) return;
    btn.textContent = estadoRaio.ativo
      ? '⌖ PERTO DE MIM · '+estadoRaio.raioKm+' KM'
      : '⌖ PERTO DE MIM';
    btn.setAttribute('aria-pressed',String(estadoRaio.ativo));
    btn.disabled=estadoRaio.carregando;
  }

  function instalarSeletor(){
    const perto=botaoPerto();
    if(!perto || document.querySelector('.v256-raio')) return false;
    const box=document.createElement('div');
    box.className='v256-raio';
    box.setAttribute('aria-label','Raio dos eventos próximos');
    box.innerHTML='<span>RAIO</span>'+[1,5,10,25].map(km=>
      '<button type="button" data-v256-raio="'+km+'" aria-pressed="'+String(km===estadoRaio.raioKm)+'">'+km+' km</button>'
    ).join('');
    perto.insertAdjacentElement('afterend',box);
    atualizarBotao();
    return true;
  }

  function observarBotao(){
    if(instalarSeletor()) return;
    const obs=new MutationObserver(()=>{
      if(instalarSeletor()) obs.disconnect();
    });
    obs.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>obs.disconnect(),5000);
  }

  function formatarKm(valor){
    return Number(valor||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:1})+' km';
  }

  function aplicarDistanciasNosCards(){
    estadoRaio.eventos.forEach(ev=>{
      const card=document.querySelector('.evento-card[data-ev="'+CSS.escape(ev.id)+'"]');
      const media=card && card.querySelector('.evento-media');
      if(!media) return;
      let selo=media.querySelector('.v256-distancia');
      if(!selo){
        selo=document.createElement('span');
        selo.className='v256-distancia';
        media.appendChild(selo);
      }
      selo.textContent='⌖ '+formatarKm(estadoRaio.distancias.get(ev.id));
    });
  }

  function renderVazio(){
    if(typeof EVENTOS!=='undefined') EVENTOS=[];
    if(typeof estado!=='undefined'){
      estado.total=0;
      estado.pagina=0;
    }
    const grade=document.getElementById('grade');
    if(grade) grade.innerHTML='<div class="perto-vazio-v23"><strong>Nenhum evento neste raio</strong>Amplie o raio ou limpe os filtros.<br><button type="button" data-limpar-filtros>Limpar filtros</button></div>';
    const cont=document.getElementById('contagem');
    if(cont) cont.textContent='0 EVENTOS NO RAIO';
    const titulo=document.getElementById('tituloLista');
    if(titulo) titulo.textContent='Eventos em até '+estadoRaio.raioKm+' km';
    const mais=document.getElementById('btnMais'); if(mais) mais.hidden=true;
    if(typeof estado!=='undefined' && estado.visualizacao==='mapa') renderMapaRaio([]);
  }

  async function buscarEventosNoRaio(){
    if(!estadoRaio.ativo || !estadoRaio.localizacao || estadoRaio.carregando) return;
    const revisao=++revisaoRaio;
    estadoRaio.carregando=true;
    atualizarBotao();

    const grade=document.getElementById('grade');
    if(grade && (typeof estado==='undefined' || estado.visualizacao==='mural')) grade.innerHTML='<div class="esqueleto"></div>'.repeat(3);

    try{
      const loc=estadoRaio.localizacao;
      const {data:ordem,error}=await db.rpc('eventos_perto_de_mim',{
        p_lat:loc.latitude,
        p_lng:loc.longitude,
        p_limite:200,
        p_raio_km:estadoRaio.raioKm
      });
      if(revisao!==revisaoRaio || !estadoRaio.ativo) return;
      if(error) throw error;

      const ids=(ordem||[]).map(x=>x.evento_id);
      estadoRaio.distancias=new Map((ordem||[]).map(x=>[x.evento_id,Number(x.distancia_km)]));
      if(!ids.length){ estadoRaio.eventos=[]; renderVazio(); return; }

      let base=db.from('eventos_lista').select('*').in('id',ids);
      if(typeof aplicarFiltros==='function'){
        const aplicado=aplicarFiltros(base,{modo:'lista'});
        if(aplicado.vazio){ estadoRaio.eventos=[]; renderVazio(); return; }
        base=aplicado.query;
      }
      const {data,error:eventosErro}=await base.limit(200);
      if(revisao!==revisaoRaio || !estadoRaio.ativo) return;
      if(eventosErro) throw eventosErro;

      const mapa=new Map((data||[]).map(x=>[x.id,x]));
      estadoRaio.eventos=ids.map(id=>mapa.get(id)).filter(Boolean);

      if(typeof EVENTOS!=='undefined') EVENTOS=estadoRaio.eventos;
      if(typeof estado!=='undefined'){
        estado.total=estadoRaio.eventos.length;
        estado.pagina=0;
      }
      if(typeof renderMural==='function') renderMural();
      aplicarDistanciasNosCards();

      const cont=document.getElementById('contagem');
      if(cont) cont.textContent=estadoRaio.eventos.length+(estadoRaio.eventos.length===1?' EVENTO NO RAIO':' EVENTOS NO RAIO');
      const titulo=document.getElementById('tituloLista');
      if(titulo) titulo.textContent='Eventos em até '+estadoRaio.raioKm+' km';
      const mais=document.getElementById('btnMais'); if(mais) mais.hidden=true;

      if(typeof estado!=='undefined' && estado.visualizacao==='mapa') renderMapaRaio(estadoRaio.eventos);
    }catch(err){
      if(revisao!==revisaoRaio) return;
      console.error('[V25.6 mapa]',err);
      avisar('Não foi possível carregar os eventos deste raio.');
    }finally{
      if(revisao===revisaoRaio){ estadoRaio.carregando=false; atualizarBotao(); }
    }
  }

  function limparCamadaUsuario(){
    if(camadaUsuario && typeof mapaEventos!=='undefined' && mapaEventos){
      try{ mapaEventos.removeLayer(camadaUsuario); }catch(_){}
    }
    camadaUsuario=null;
  }

  function renderMapaRaio(eventos){
    if(typeof criarMapaEventos!=='function' || typeof L==='undefined') return;
    criarMapaEventos();
    if(typeof mapaEventos==='undefined' || !mapaEventos || typeof camadaMarcadores==='undefined') return;

    camadaMarcadores.clearLayers();
    if(typeof marcadoresMapa!=='undefined') marcadoresMapa.clear();
    limparCamadaUsuario();

    const local=estadoRaio.localizacao;
    if(local){
      camadaUsuario=L.layerGroup().addTo(mapaEventos);
      const circulo=L.circle([local.latitude,local.longitude],{
        radius:estadoRaio.raioKm*1000,
        weight:2,
        opacity:.75,
        fillOpacity:.08
      }).addTo(camadaUsuario);
      L.circleMarker([local.latitude,local.longitude],{
        radius:7,
        weight:3,
        fillOpacity:1
      }).bindTooltip('Você está aqui').addTo(camadaUsuario);
      setTimeout(()=>mapaEventos.fitBounds(circulo.getBounds(),{padding:[28,28]}),80);
    }

    if(typeof eventosMapa!=='undefined') eventosMapa=(eventos||[]).filter(ev=>Number.isFinite(Number(ev.latitude))&&Number.isFinite(Number(ev.longitude)));
    const lista=typeof eventosMapa!=='undefined'?eventosMapa:[];

    lista.forEach(ev=>{
      const lat=Number(ev.latitude),lng=Number(ev.longitude);
      const marcador=L.marker([lat,lng],{icon:typeof iconeMapa==='function'?iconeMapa(ev,false):undefined}).addTo(camadaMarcadores);
      if(typeof selecionarEventoMapa==='function') marcador.on('click',()=>selecionarEventoMapa(ev.id,{centralizar:false}));
      if(typeof marcadoresMapa!=='undefined') marcadoresMapa.set(ev.id,marcador);
    });

    if(typeof eventoMapaSelecionadoId!=='undefined') eventoMapaSelecionadoId=lista[0]?.id||null;
    if(typeof renderPainelMapa==='function') renderPainelMapa();
    aplicarDistanciasMapa();

    const status=document.getElementById('mapaStatus');
    if(status) status.textContent=lista.length+' evento(s) em até '+estadoRaio.raioKm+' km da sua localização.';
    if(typeof ajustarMapa==='function') ajustarMapa(mapaEventos);
  }

  function aplicarDistanciasMapa(){
    document.querySelectorAll('.mapa-lista-item[data-mapa-selecionar]').forEach(item=>{
      const id=item.dataset.mapaSelecionar;
      const small=item.querySelector('small');
      if(!small || !estadoRaio.distancias.has(id) || small.querySelector('.v256-km-inline')) return;
      const span=document.createElement('span');
      span.className='v256-km-inline';
      span.textContent=' · '+formatarKm(estadoRaio.distancias.get(id));
      small.appendChild(span);
    });
    const destaque=document.querySelector('#mapaSelecionado .mapa-card-destaque');
    if(destaque && typeof eventoMapaSelecionadoId!=='undefined' && estadoRaio.distancias.has(eventoMapaSelecionadoId)){
      const linha=destaque.querySelector('.mapa-quando');
      if(linha && !linha.querySelector('.v256-km-inline')){
        const span=document.createElement('span');
        span.className='v256-km-inline';
        span.textContent=' · '+formatarKm(estadoRaio.distancias.get(eventoMapaSelecionadoId));
        linha.appendChild(span);
      }
    }
  }

  function localizarEAtivar(){
    if(!navigator.geolocation){ avisar('Seu navegador não oferece localização.'); return; }
    const revisao=++revisaoRaio;
    estadoRaio.carregando=true;
    atualizarBotao();
    navigator.geolocation.getCurrentPosition(pos=>{
      if(revisao!==revisaoRaio) return;
      estadoRaio.localizacao={latitude:pos.coords.latitude,longitude:pos.coords.longitude};
      estadoRaio.ativo=true;
      estadoRaio.carregando=false;
      atualizarBotao();
      buscarEventosNoRaio();
    },()=>{
      if(revisao!==revisaoRaio) return;
      estadoRaio.carregando=false;
      atualizarBotao();
      avisar('Permita a localização para usar o raio do mapa.');
    },{enableHighAccuracy:true,timeout:12000,maximumAge:120000});
  }

  function limparEstadoRaio(){
    ++revisaoRaio; clearTimeout(timerFiltro);
    estadoRaio.carregando=false;
    estadoRaio.ativo=false;
    estadoRaio.eventos=[];
    estadoRaio.distancias.clear();
    limparCamadaUsuario();
    atualizarBotao();
  }
  document.addEventListener('role:limpar-filtros',limparEstadoRaio);

  async function desativar(){
    limparEstadoRaio();
    try{
      if(typeof filtrosMudaram==='function') await filtrosMudaram();
    }catch(err){ console.warn('[V25.6 mapa] restauração',err); }
  }

  function selecionarRaio(km){
    estadoRaio.raioKm=km;
    document.querySelectorAll('[data-v256-raio]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.v256Raio)===km)));
    atualizarBotao();
    if(estadoRaio.ativo) buscarEventosNoRaio();
  }

  // Captura antes do listener antigo da V23. Assim não existem dois estados
  // diferentes disputando o mesmo botão.
  document.addEventListener('click',e=>{
    const perto=e.target.closest('.chip-perto-v23');
    if(perto){
      e.preventDefault();
      e.stopImmediatePropagation();
      if(estadoRaio.ativo) desativar();
      else if(estadoRaio.localizacao){ estadoRaio.ativo=true; atualizarBotao(); buscarEventosNoRaio(); }
      else localizarEAtivar();
      return;
    }

    const raio=e.target.closest('[data-v256-raio]');
    if(raio){
      e.preventDefault();
      e.stopImmediatePropagation();
      selecionarRaio(Number(raio.dataset.v256Raio));
    }
  },true);

  // Se filtros normais mudarem enquanto “Perto de mim” estiver ativo,
  // reaplica o raio depois que o app terminar a consulta normal.
  document.addEventListener('click',e=>{
    if(!estadoRaio.ativo) return;
    if(e.target.closest('.cat,.chip:not(.chip-perto-v23),.aba,#btnBuscar')){
      clearTimeout(timerFiltro);
      timerFiltro=setTimeout(buscarEventosNoRaio,650);
    }
    if(e.target.closest('.visao[data-visao="mapa"]')){
      setTimeout(()=>renderMapaRaio(estadoRaio.eventos),650);
    }
  });

  document.addEventListener('click',e=>{
    if(!estadoRaio.ativo) return;
    const item=e.target.closest('.mapa-lista-item[data-mapa-selecionar]');
    if(item) setTimeout(aplicarDistanciasMapa,0);
  });

  const busca=document.getElementById('busca');
  if(busca) busca.addEventListener('input',()=>{
    if(!estadoRaio.ativo) return;
    clearTimeout(timerFiltro);
    timerFiltro=setTimeout(buscarEventosNoRaio,700);
  });

  function iniciar(){
    observarBotao();
    console.info('[V25.6] mapa por raio carregado');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();

