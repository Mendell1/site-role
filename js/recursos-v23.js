/* ============================================================
   ROLÊ V23 — proximidade, compartilhamento, calendário e QR Code
   Carregado depois do app principal para não mexer nos fluxos atuais.
   ============================================================ */
(() => {
  const STATUS = {
    agendado:'Agendado', adiado:'Adiado', esgotado:'Esgotado',
    cancelado:'Cancelado', finalizado:'Finalizado'
  };

  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const cacheEventos = new Map();
  let pertoAtivo = false;
  let ultimaLocalizacao = null;
  let carregandoPerto = false;

  function avisarV23(texto){
    if(typeof window.avisar === 'function') window.avisar(texto);
    else console.log('[Rolê]', texto);
  }

  function garantirCss(){
    if(document.querySelector('link[data-recursos-v23]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/recursos-v23.css';
    link.dataset.recursosV23 = '1';
    document.head.appendChild(link);
  }

  function dataISO(d){
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  }

  function dataEvento(ev){ return new Date(ev.data_evento + 'T00:00:00'); }
  function horaEvento(ev){ return (ev.hora_evento || '19:00').slice(0,5); }
  function dataCurta(ev){
    return dataEvento(ev).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}).replace('.','');
  }
  function dataLonga(ev){
    return dataEvento(ev).toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  }
  function endereco(ev){
    const linha1 = [ev.endereco, ev.numero].filter(Boolean).join(', ');
    const linha2 = [ev.bairro, ev.cidade].filter(Boolean).join(', ');
    return [linha1, linha2].filter(Boolean).join(' — ');
  }
  function imagemFallback(ev){
    const mapa={
      festas:'assets/evento-feira.jpg', feiras:'assets/evento-feira.jpg',
      musica:'assets/evento-musica.jpg', esportes:'assets/evento-esporte.jpg',
      educacao:'assets/evento-oficina.jpg', cultura:'assets/evento-bazar.jpg',
      games:'assets/evento-games.jpg', gastronomia:'assets/evento-feira.jpg',
      social:'assets/evento-esporte.jpg', profissional:'assets/evento-bazar.jpg',
      outros:'assets/evento-feira.jpg'
    };
    return ev.imagem_url || mapa[ev.categoria_id] || 'assets/evento-feira.jpg';
  }

  function urlEvento(id){
    const u = new URL('index.html', location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('evento', id);
    return u.href;
  }

  function urlOrganizador(id){
    const u = new URL('organizador.html', location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('id', id);
    return u.href;
  }

  async function copiar(texto){
    try{
      if(navigator.clipboard && window.isSecureContext){
        await navigator.clipboard.writeText(texto);
      }else{
        const area=document.createElement('textarea');
        area.value=texto; area.style.position='fixed'; area.style.opacity='0';
        document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
      }
      return true;
    }catch(_){ return false; }
  }

  async function obterEvento(id){
    if(cacheEventos.has(id)) return cacheEventos.get(id);
    const {data,error}=await db.from('eventos_lista').select('*').eq('id',id).single();
    if(error) throw error;
    cacheEventos.set(id,data);
    return data;
  }

  /* ------------------------------------------------------------
     PERTO DE MIM
     O banco devolve os IDs já ordenados por distância. Os filtros
     visuais ativos continuam sendo respeitados no navegador.
     ------------------------------------------------------------ */
  function filtrosAtuais(){
    const catSelecionada=document.querySelector('#cats .cat[aria-pressed="true"]');
    const categoria=catSelecionada && catSelecionada.dataset.cat ? catSelecionada.dataset.cat : null;
    const atalhos=new Set([...document.querySelectorAll('.chip[aria-pressed="true"]')]
      .filter(x=>!x.classList.contains('chip-perto-v23'))
      .map(x=>x.dataset.atalho));
    return {
      categoria,
      atalhos,
      busca:(document.getElementById('busca')?.value||'').trim().toLocaleLowerCase('pt-BR')
    };
  }

  function passaFiltros(ev,f){
    if(f.categoria && ev.categoria_id!==f.categoria) return false;
    if(f.busca){
      const alvo=[ev.nome,ev.descricao,ev.bairro,ev.cidade].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
      if(!alvo.includes(f.busca)) return false;
    }
    if(f.atalhos.has('gratis') && !ev.gratuito) return false;
    const d=dataEvento(ev);
    if(f.atalhos.has('hoje') && dataISO(d)!==dataISO(hoje)) return false;
    if(f.atalhos.has('semana')){
      const fim=new Date(hoje); fim.setDate(fim.getDate()+7);
      if(d<hoje || d>fim) return false;
    }
    if(f.atalhos.has('fds')){
      const fim=new Date(hoje); fim.setDate(fim.getDate()+7);
      if(d<hoje || d>fim || ![0,6].includes(d.getDay())) return false;
    }
    return true;
  }

  function cardPerto(ev,distancia){
    const d=dataEvento(ev);
    const dia=String(d.getDate()).padStart(2,'0');
    const mes=d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase();
    const preco=ev.gratuito?'GRÁTIS':'R$ '+Number(ev.valor||0).toFixed(2).replace('.',',');
    const situacao=ev.situacao && ev.situacao!=='agendado'
      ? '<span class="situacao-evento situacao-'+escapeHtml(ev.situacao)+'">'+escapeHtml(STATUS[ev.situacao]||ev.situacao)+'</span>' : '';
    return '<article class="evento-card evento-perto-v23" data-ev="'+escapeHtml(ev.id)+'" role="button" tabindex="0" aria-label="Abrir evento '+escapeHtml(ev.nome)+'">'+
      '<div class="evento-media">'+
        '<img class="capa" src="'+escapeHtml(imagemFallback(ev))+'" alt="'+escapeHtml(ev.nome)+'" loading="lazy">'+
        '<span class="data-bloco"><strong>'+dia+'</strong><small>'+mes+'</small></span>'+ 
        '<span class="preco-badge '+(ev.gratuito?'gratis':'')+'">'+preco+'</span>'+ 
        '<span class="distancia-badge-v23">⌖ '+Number(distancia).toLocaleString('pt-BR',{maximumFractionDigits:1})+' km</span>'+ 
      '</div>'+ 
      '<div class="evento-conteudo">'+
        '<div class="evento-tags"><span class="tag categoria-pill"><i aria-hidden="true"></i>'+escapeHtml(ev.categoria_nome||'Evento')+'</span>'+situacao+'</div>'+ 
        '<h3>'+escapeHtml(ev.nome)+'</h3>'+ 
        '<ul class="evento-meta">'+
          '<li><span aria-hidden="true">▣</span> '+escapeHtml(dataCurta(ev))+' <span class="meta-sep">◷</span> '+escapeHtml(horaEvento(ev))+'</li>'+ 
          '<li><span aria-hidden="true">⌖</span> '+escapeHtml([ev.bairro,ev.cidade].filter(Boolean).join(', ')||'Local não informado')+'</li>'+ 
          '<li><span aria-hidden="true">♙</span> '+Number(ev.total_interessados||0)+' pessoas com interesse</li>'+ 
        '</ul>'+ 
        '<div class="perto-resumo-v23"><span>Ordenado pela sua distância</span><span class="perto-ver-v23">Ver evento →</span></div>'+ 
      '</div>'+ 
    '</article>';
  }

  function renderPerto(eventos,distancias){
    const grade=document.getElementById('grade');
    if(!grade) return;
    const filtrados=eventos.filter(ev=>passaFiltros(ev,filtrosAtuais()));
    const cont=document.getElementById('contagem');
    if(cont) cont.textContent=filtrados.length+(filtrados.length===1?' EVENTO PRÓXIMO':' EVENTOS PRÓXIMOS');
    const titulo=document.getElementById('tituloLista'); if(titulo) titulo.textContent='Eventos perto de mim';
    const mais=document.getElementById('btnMais'); if(mais) mais.hidden=true;
    grade.innerHTML=filtrados.length
      ? filtrados.map(ev=>cardPerto(ev,distancias.get(ev.id)||0)).join('')
      : '<div class="perto-vazio-v23"><strong>Nenhum evento próximo encontrado</strong>Tente aumentar sua área ou limpar algum filtro.</div>';
  }

  async function carregarPerto(){
    if(!ultimaLocalizacao || carregandoPerto) return;
    carregandoPerto=true;
    const grade=document.getElementById('grade');
    if(grade) grade.innerHTML='<div class="esqueleto"></div>'.repeat(3);
    try{
      const {data:ordem,error}=await db.rpc('eventos_perto_de_mim',{
        p_lat:ultimaLocalizacao.latitude,
        p_lng:ultimaLocalizacao.longitude,
        p_limite:100,
        p_raio_km:100
      });
      if(error) throw error;
      const ids=(ordem||[]).map(x=>x.evento_id);
      if(!ids.length){ renderPerto([],new Map()); return; }
      const {data:eventos,error:eventosErro}=await db.from('eventos_lista').select('*').in('id',ids);
      if(eventosErro) throw eventosErro;
      const mapaEventos=new Map((eventos||[]).map(x=>[x.id,x]));
      const distancias=new Map((ordem||[]).map(x=>[x.evento_id,Number(x.distancia_km)]));
      const ordenados=ids.map(id=>mapaEventos.get(id)).filter(Boolean);
      ordenados.forEach(ev=>cacheEventos.set(ev.id,ev));
      renderPerto(ordenados,distancias);
    }catch(err){
      console.error('Perto de mim:',err);
      avisarV23('Não foi possível ordenar os eventos pela distância.');
      if(typeof window.render==='function') window.render();
      pertoAtivo=false;
      const b=document.querySelector('.chip-perto-v23'); if(b) b.setAttribute('aria-pressed','false');
    }finally{ carregandoPerto=false; }
  }

  function ativarPerto(botao){
    if(!navigator.geolocation){ avisarV23('Seu navegador não oferece localização.'); return; }
    botao.disabled=true; botao.textContent='⌖ LOCALIZANDO...';
    navigator.geolocation.getCurrentPosition(pos=>{
      ultimaLocalizacao={latitude:pos.coords.latitude,longitude:pos.coords.longitude};
      pertoAtivo=true;
      botao.disabled=false; botao.textContent='⌖ PERTO DE MIM'; botao.setAttribute('aria-pressed','true');
      carregarPerto();
    },()=>{
      botao.disabled=false; botao.textContent='⌖ PERTO DE MIM'; botao.setAttribute('aria-pressed','false');
      avisarV23('Permita o acesso à localização para usar “Perto de mim”.');
    },{enableHighAccuracy:true,timeout:12000,maximumAge:120000});
  }

  function instalarPerto(){
    const area=document.querySelector('.atalhos');
    if(!area || area.querySelector('.chip-perto-v23')) return;
    const botao=document.createElement('button');
    botao.type='button'; botao.className='chip chip-perto-v23'; botao.setAttribute('aria-pressed','false');
    botao.textContent='⌖ PERTO DE MIM';
    botao.addEventListener('click',e=>{
      e.preventDefault(); e.stopPropagation();
      if(pertoAtivo){
        pertoAtivo=false; botao.setAttribute('aria-pressed','false');
        if(typeof window.render==='function') window.render();
        return;
      }
      if(ultimaLocalizacao){ pertoAtivo=true; botao.setAttribute('aria-pressed','true'); carregarPerto(); }
      else ativarPerto(botao);
    });
    area.appendChild(botao);

    document.addEventListener('click',e=>{
      if(!pertoAtivo || e.target.closest('.chip-perto-v23')) return;
      if(e.target.closest('.cat,.chip:not(.chip-perto-v23),.aba,.visao,#btnBuscar')){
        pertoAtivo=false; botao.setAttribute('aria-pressed','false');
      }
      if(e.target.closest('[data-interesse]')) setTimeout(()=>{ if(pertoAtivo) carregarPerto(); },600);
    },true);
    document.getElementById('busca')?.addEventListener('input',()=>{
      if(pertoAtivo){ pertoAtivo=false; botao.setAttribute('aria-pressed','false'); }
    });
  }

  /* ------------------------------------------------------------
     COMPARTILHAR / CALENDÁRIO / QR
     ------------------------------------------------------------ */
  function textoCompartilhar(ev){
    const local=endereco(ev);
    return [
      ev.nome,
      dataLonga(ev)+' às '+horaEvento(ev),
      local || null,
      ev.gratuito ? 'Entrada gratuita' : 'Valor: R$ '+Number(ev.valor||0).toFixed(2).replace('.',','),
      urlEvento(ev.id)
    ].filter(Boolean).join('\n');
  }

  function abrirModalV23(titulo,conteudo){
    document.querySelectorAll('.v23-modal').forEach(x=>x.remove());
    const modal=document.createElement('div');
    modal.className='cortina aberta v23-modal';
    modal.innerHTML='<div class="folha" role="dialog" aria-modal="true">'+
      '<button class="fechar" data-v23-fecha aria-label="Fechar">×</button>'+ 
      '<h3>'+escapeHtml(titulo)+'</h3>'+conteudo+'</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{
      if(e.target===modal || e.target.closest('[data-v23-fecha]')) modal.remove();
    });
    return modal;
  }

  function formatarDataCalendario(data){
    const y=data.getFullYear(),m=String(data.getMonth()+1).padStart(2,'0'),d=String(data.getDate()).padStart(2,'0');
    const h=String(data.getHours()).padStart(2,'0'),mi=String(data.getMinutes()).padStart(2,'0'),s=String(data.getSeconds()).padStart(2,'0');
    return ''+y+m+d+'T'+h+mi+s;
  }

  function intervaloEvento(ev){
    const [h,m]=horaEvento(ev).split(':').map(Number);
    const inicio=new Date(ev.data_evento+'T00:00:00'); inicio.setHours(h||0,m||0,0,0);
    const fim=new Date(inicio.getTime()+2*60*60*1000);
    return {inicio,fim};
  }

  function urlGoogleAgenda(ev){
    const {inicio,fim}=intervaloEvento(ev);
    const u=new URL('https://calendar.google.com/calendar/render');
    u.searchParams.set('action','TEMPLATE');
    u.searchParams.set('text',ev.nome);
    u.searchParams.set('dates',formatarDataCalendario(inicio)+'/'+formatarDataCalendario(fim));
    u.searchParams.set('details',(ev.descricao||'')+'\n\nEvento no Rolê: '+urlEvento(ev.id));
    if(endereco(ev)) u.searchParams.set('location',endereco(ev));
    return u.href;
  }

  function escapeICS(v){ return String(v||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n'); }
  function baixarICS(ev){
    const {inicio,fim}=intervaloEvento(ev);
    const agora=new Date();
    const utc=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
    const conteudo=[
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Role//Eventos comunitarios//PT-BR','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
      'UID:'+ev.id+'@role-eventos','DTSTAMP:'+utc(agora),
      'DTSTART:'+formatarDataCalendario(inicio),'DTEND:'+formatarDataCalendario(fim),
      'SUMMARY:'+escapeICS(ev.nome),'DESCRIPTION:'+escapeICS((ev.descricao||'')+'\nEvento no Rolê: '+urlEvento(ev.id)),
      'LOCATION:'+escapeICS(endereco(ev)),'URL:'+urlEvento(ev.id),'END:VEVENT','END:VCALENDAR'
    ].join('\r\n');
    const blob=new Blob([conteudo],{type:'text/calendar;charset=utf-8'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='role-'+String(ev.nome||'evento').toLowerCase().replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')+'.ics';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function modalCalendario(ev){
    const modal=abrirModalV23('Adicionar ao calendário',
      '<p class="v23-modal-intro">Escolha onde você quer guardar este evento.</p>'+ 
      '<div class="v23-modal-acoes">'+
        '<button class="btn-escuro" data-v23-google-agenda>Google Agenda</button>'+ 
        '<button class="btn-linha" data-v23-ics>Baixar arquivo .ICS</button>'+ 
      '</div>');
    modal.querySelector('[data-v23-google-agenda]').addEventListener('click',()=>window.open(urlGoogleAgenda(ev),'_blank','noopener'));
    modal.querySelector('[data-v23-ics]').addEventListener('click',()=>baixarICS(ev));
  }

  function carregarQRCode(){
    if(window.QRCode) return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const existente=document.querySelector('script[data-qrcode-v23]');
      if(existente){ existente.addEventListener('load',resolve,{once:true}); existente.addEventListener('error',reject,{once:true}); return; }
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
      s.async=true; s.dataset.qrcodeV23='1'; s.onload=resolve; s.onerror=reject; document.head.appendChild(s);
    });
  }

  async function modalQR(ev){
    const link=urlEvento(ev.id);
    const modal=abrirModalV23('QR Code do evento',
      '<p class="v23-modal-intro">Aponte a câmera do celular para abrir este evento diretamente no Rolê.</p>'+ 
      '<div class="v23-qr-wrap" id="v23Qr"><span class="dica">Gerando QR Code...</span></div>'+ 
      '<div class="v23-link-caixa">'+escapeHtml(link)+'</div>'+ 
      '<div class="v23-modal-acoes"><button class="btn-linha" data-v23-copiar-qr>Copiar link</button></div>');
    modal.querySelector('[data-v23-copiar-qr]').addEventListener('click',async()=>{
      avisarV23(await copiar(link)?'Link copiado':'Não foi possível copiar o link');
    });
    try{
      await carregarQRCode();
      const alvo=modal.querySelector('#v23Qr'); alvo.innerHTML='';
      new QRCode(alvo,{text:link,width:220,height:220,correctLevel:QRCode.CorrectLevel.M});
    }catch(err){
      console.error('QR Code:',err);
      modal.querySelector('#v23Qr').innerHTML='<span class="dica">Não foi possível gerar o QR Code agora.</span>';
    }
  }

  async function compartilhar(ev){
    const link=urlEvento(ev.id), texto=textoCompartilhar(ev);
    if(navigator.share){
      try{ await navigator.share({title:ev.nome,text:texto,url:link}); return; }
      catch(err){ if(err && err.name==='AbortError') return; }
    }
    avisarV23(await copiar(link)?'Link do evento copiado':'Não foi possível copiar o link');
  }

  function enriquecerDetalhe(){
    const folha=document.getElementById('folhaDetalhe');
    if(!folha || folha.querySelector('.recursos-evento-v23')) return;
    const alvo=folha.querySelector('[data-interesse],[data-editar],[data-ver-mapa]');
    const id=alvo && (alvo.dataset.interesse||alvo.dataset.editar||alvo.dataset.verMapa);
    if(!id) return;

    obterEvento(id).then(ev=>{
      if(!document.body.contains(folha) || folha.querySelector('.recursos-evento-v23')) return;
      const lateral=folha.querySelector('.detalhe-coluna-lateral') || folha.querySelector('.detalhe-modal-scroll');
      if(!lateral) return;
      const bloco=document.createElement('div');
      bloco.className='recursos-evento-v23';
      bloco.innerHTML='<p class="detalhe-label">LEVAR ESTE ROLÊ COM VOCÊ</p>'+ 
        '<div class="recursos-evento-grade-v23">'+
          '<button class="btn-linha recurso-destaque-v23" data-v23-share>↗ Compartilhar evento</button>'+ 
          '<button class="btn-linha" data-v23-whatsapp>WhatsApp</button>'+ 
          '<button class="btn-linha" data-v23-calendario>▣ Calendário</button>'+ 
          '<button class="btn-linha" data-v23-qr>QR Code</button>'+ 
          '<button class="btn-linha" data-v23-copy>Copiar link</button>'+ 
        '</div>';
      lateral.appendChild(bloco);
      bloco.querySelector('[data-v23-share]').addEventListener('click',()=>compartilhar(ev));
      bloco.querySelector('[data-v23-whatsapp]').addEventListener('click',()=>{
        window.open('https://wa.me/?text='+encodeURIComponent(textoCompartilhar(ev)),'_blank','noopener');
      });
      bloco.querySelector('[data-v23-calendario]').addEventListener('click',()=>modalCalendario(ev));
      bloco.querySelector('[data-v23-qr]').addEventListener('click',()=>modalQR(ev));
      bloco.querySelector('[data-v23-copy]').addEventListener('click',async()=>{
        avisarV23(await copiar(urlEvento(ev.id))?'Link do evento copiado':'Não foi possível copiar o link');
      });
    }).catch(err=>console.warn('Recursos do evento:',err));
  }

  function observarDetalhe(){
    const folha=document.getElementById('folhaDetalhe');
    if(!folha) return;
    new MutationObserver(()=>setTimeout(enriquecerDetalhe,0)).observe(folha,{childList:true,subtree:false});
    enriquecerDetalhe();
  }

  /* O perfil público já existia em modal. Nesta versão, o mesmo clique
     passa a abrir uma URL própria, que pode ser compartilhada. */
  function instalarPaginaOrganizador(){
    document.addEventListener('click',e=>{
      const alvo=e.target.closest('[data-perfil-publico]');
      if(!alvo) return;
      const id=alvo.dataset.perfilPublico;
      if(!id) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      location.href=urlOrganizador(id);
    },true);
  }

  function iniciar(){
    garantirCss();
    instalarPerto();
    observarDetalhe();
    instalarPaginaOrganizador();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
