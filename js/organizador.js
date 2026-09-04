/* ============================================================
   ROLÊ V23 — página pública do organizador
   ============================================================ */
(() => {
  const alvo=document.getElementById('organizadorConteudo');
  const esc=value=>String(value==null?'':value).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const iniciais=nome=>String(nome||'?').trim().split(/\s+/).slice(0,2).map(x=>x.charAt(0).toUpperCase()).join('')||'?';
  const hora=ev=>(ev.hora_evento||'19:00').slice(0,5);
  const data=ev=>new Date(ev.data_evento+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).replace('.','');
  const desde=iso=>iso?new Date(iso).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}):'';
  const status={agendado:'Agendado',adiado:'Adiado',esgotado:'Esgotado',cancelado:'Cancelado',finalizado:'Finalizado'};

  function imagemFallback(ev){
    const mapa={
      festas:'assets/evento-feira.jpg',feiras:'assets/evento-feira.jpg',musica:'assets/evento-musica.jpg',
      esportes:'assets/evento-esporte.jpg',educacao:'assets/evento-oficina.jpg',cultura:'assets/evento-bazar.jpg',
      games:'assets/evento-games.jpg',gastronomia:'assets/evento-feira.jpg',social:'assets/evento-esporte.jpg',
      profissional:'assets/evento-bazar.jpg',outros:'assets/evento-feira.jpg'
    };
    return ev.imagem_url||mapa[ev.categoria_id]||'assets/evento-feira.jpg';
  }

  function urlEvento(id){
    const u=new URL('index.html',location.href); u.search=''; u.searchParams.set('evento',id); return u.href;
  }

  function card(ev){
    const situacao=ev.situacao&&ev.situacao!=='agendado'
      ? '<span class="situacao-evento situacao-'+esc(ev.situacao)+'">'+esc(status[ev.situacao]||ev.situacao)+'</span>' : '';
    return '<a class="organizador-evento-card" href="'+esc(urlEvento(ev.id))+'">'+
      '<img src="'+esc(imagemFallback(ev))+'" alt="'+esc(ev.nome)+'" loading="lazy">'+
      '<div class="organizador-evento-corpo">'+
        '<div class="evento-tags"><span class="tag categoria-pill"><i aria-hidden="true"></i>'+esc(ev.categoria_nome||'Evento')+'</span>'+situacao+'</div>'+ 
        '<h3>'+esc(ev.nome)+'</h3>'+ 
        '<div class="organizador-evento-meta">'+
          '<span>▣ '+esc(data(ev))+' · '+esc(hora(ev))+'</span>'+ 
          '<span>⌖ '+esc([ev.bairro,ev.cidade].filter(Boolean).join(', ')||'Local não informado')+'</span>'+ 
          '<span>♙ '+Number(ev.total_interessados||0)+' interessados</span>'+ 
        '</div>'+ 
      '</div>'+ 
    '</a>';
  }

  async function iniciar(){
    const id=new URLSearchParams(location.search).get('id');
    if(!id){
      alvo.innerHTML='<div class="organizador-vazio"><strong>Perfil não informado</strong><p>Volte ao mural e abra um organizador por lá.</p></div>';
      return;
    }

    const [perfilResp,eventosResp]=await Promise.all([
      db.rpc('perfil_publico',{p_usuario:id}),
      db.from('eventos_lista').select('*').eq('criador_id',id).gte('data_evento',new Date().toISOString().slice(0,10)).order('data_evento',{ascending:true}).order('hora_evento',{ascending:true}).limit(30)
    ]);

    const p=Array.isArray(perfilResp.data)?perfilResp.data[0]:perfilResp.data;
    if(perfilResp.error||!p){
      alvo.innerHTML='<div class="organizador-vazio"><strong>Perfil indisponível</strong><p>Esse organizador não está disponível publicamente.</p></div>';
      return;
    }

    document.title=p.nome+' — Rolê';
    const eventos=eventosResp.error?[]:(eventosResp.data||[]);
    alvo.innerHTML=
      '<section class="organizador-publico-hero">'+
        '<div class="organizador-publico-avatar">'+(p.foto_url?'<img src="'+esc(p.foto_url)+'" alt="Foto de '+esc(p.nome)+'">':esc(iniciais(p.nome)))+'</div>'+ 
        '<div>'+ 
          '<p class="organizador-publico-kicker">ORGANIZADOR NO ROLÊ</p>'+ 
          '<h1>'+esc(p.nome)+'</h1>'+ 
          '<p class="organizador-publico-bio">'+esc(p.bio||'Este organizador ainda não adicionou uma biografia pública.')+'</p>'+ 
          '<div class="organizador-publico-meta">'+
            (p.cidade?'<span>⌖ '+esc(p.cidade)+'</span>':'')+
            '<span>▣ '+Number(p.total_eventos||0)+' evento(s) futuro(s)</span>'+ 
            (p.criado_em?'<span>No Rolê desde '+esc(desde(p.criado_em))+'</span>':'')+
          '</div>'+ 
        '</div>'+ 
        (p.contato?'<div class="organizador-publico-contato"><strong>Contato público</strong><br>'+esc(p.contato)+'</div>':'<div></div>')+
      '</section>'+ 
      '<div class="organizador-eventos-titulo"><div><p class="organizador-publico-kicker">AGENDA</p><h2>Próximos eventos</h2></div><span class="contagem">'+eventos.length+' encontrado(s)</span></div>'+ 
      (eventos.length?'<section class="organizador-eventos-grade">'+eventos.map(card).join('')+'</section>':'<div class="organizador-vazio"><strong>Nenhum evento futuro</strong><p>Este organizador ainda não publicou novos eventos.</p></div>');
  }

  iniciar().catch(err=>{
    console.error(err);
    alvo.innerHTML='<div class="organizador-vazio"><strong>Não foi possível abrir o perfil</strong><p>Tente novamente em alguns instantes.</p></div>';
  });
})();
