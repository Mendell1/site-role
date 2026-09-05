/* ============================================================
   ROLÊ V25.2 — Participação
   Inscrição, capacidade e lista de espera.
   Módulo isolado para preservar a V24 e reduzir regressões.
   ============================================================ */
(() => {
  'use strict';

  const PREFIXO = '[V25.2]';
  let eventoDetalheAtual = null;
  let observerDetalhe = null;

  const escapa = valor => String(valor == null ? '' : valor).replace(/[&<>\"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'
  }[c]));

  const temDb = () => typeof db !== 'undefined' && db && typeof db.rpc === 'function';
  const temSessao = () => typeof Sessao !== 'undefined' && Sessao;
  const logado = () => temSessao() && typeof Sessao.logado === 'function' && Sessao.logado();

  function avisarV252(texto){
    if(typeof window.avisar === 'function'){
      window.avisar(texto);
      return;
    }
    const aviso = document.getElementById('aviso');
    if(aviso){
      aviso.textContent = texto;
      aviso.classList.add('mostra');
      setTimeout(()=>aviso.classList.remove('mostra'), 3400);
      return;
    }
    console.info(PREFIXO, texto);
  }

  function abrirLogin(){
    const modal = document.getElementById('modalLogin');
    if(modal) modal.classList.add('aberta');
    else location.href = 'index.html';
  }

  function formatarData(iso){
    if(!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if(Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
  }

  function horarioCurto(h){ return String(h || '').slice(0,5); }

  function idEventoNoDetalhe(){
    const folha = document.getElementById('folhaDetalhe');
    if(!folha) return null;
    const alvo = folha.querySelector('[data-editar],[data-interesse],[data-denuncia-tipo="evento"]');
    if(!alvo) return null;
    return alvo.dataset.editar || alvo.dataset.interesse || alvo.dataset.denunciaId || null;
  }

  function rotuloStatus(status){
    return ({inscrito:'Inscrição confirmada',espera:'Lista de espera',cancelado:'Inscrição cancelada',nenhum:'Ainda não inscrito'})[status] || 'Ainda não inscrito';
  }

  function resumoVagas(status){
    const inscritos = Number(status.inscritos || 0);
    const capacidade = status.capacidade == null ? null : Number(status.capacidade);
    if(capacidade == null) return '<strong>'+inscritos+'</strong><span>inscrito'+(inscritos===1?'':'s')+' · sem limite definido</span>';
    return '<strong>'+inscritos+' / '+capacidade+'</strong><span>vaga'+(capacidade===1?'':'s')+' preenchida'+(capacidade===1?'':'s')+'</span>';
  }

  function barraVagas(status){
    const capacidade = status.capacidade == null ? null : Number(status.capacidade);
    if(!capacidade) return '';
    const inscritos = Number(status.inscritos || 0);
    const pct = Math.max(0,Math.min(100,Math.round((inscritos/capacidade)*100)));
    return '<div class="v252-barra" aria-label="'+pct+'% das vagas preenchidas"><span style="width:'+pct+'%"></span></div>';
  }

  function acoesParticipacao(eventoId,status){
    if(status.sou_organizador){
      return '<button type="button" class="v252-btn v252-btn-secundario" data-v252-participantes="'+escapa(eventoId)+'">Ver participantes</button>';
    }
    if(!logado()){
      return '<button type="button" class="v252-btn" data-v252-login>Entrar para participar</button>';
    }
    if(status.meu_status === 'inscrito'){
      return '<div class="v252-acoes"><button type="button" class="v252-btn v252-btn-ok" disabled>✓ Inscrito</button><button type="button" class="v252-btn v252-btn-secundario" data-v252-cancelar="'+escapa(eventoId)+'">Cancelar inscrição</button></div>';
    }
    if(status.meu_status === 'espera'){
      return '<div class="v252-acoes"><button type="button" class="v252-btn v252-btn-fila" disabled>Fila · posição '+escapa(status.posicao_espera || '—')+'</button><button type="button" class="v252-btn v252-btn-secundario" data-v252-cancelar="'+escapa(eventoId)+'">Sair da lista</button></div>';
    }
    const lotado = status.capacidade != null && Number(status.inscritos || 0) >= Number(status.capacidade);
    return '<button type="button" class="v252-btn" data-v252-participar="'+escapa(eventoId)+'">'+(lotado?'Entrar na lista de espera':'Quero participar')+'</button>';
  }

  function renderParticipacaoDetalhe(eventoId,status){
    const lateral = document.querySelector('#folhaDetalhe .detalhe-coluna-lateral');
    if(!lateral || !status) return;
    let caixa = lateral.querySelector('#participacaoV252');
    if(!caixa){
      caixa = document.createElement('section');
      caixa.id = 'participacaoV252';
      caixa.className = 'v252-card';
      const organizador = lateral.querySelector('#detalheOrganizador');
      if(organizador) lateral.insertBefore(caixa,organizador);
      else lateral.appendChild(caixa);
    }
    const espera = Number(status.espera || 0);
    const vagas = status.vagas_disponiveis;
    caixa.innerHTML =
      '<div class="v252-cabecalho"><p>PARTICIPAÇÃO</p><span class="v252-status v252-status-'+escapa(status.meu_status || 'nenhum')+'">'+escapa(rotuloStatus(status.meu_status))+'</span></div>'+
      '<div class="v252-numeros">'+resumoVagas(status)+'</div>'+
      barraVagas(status)+
      '<div class="v252-meta">'+
        (status.capacidade == null ? '<span>Capacidade livre</span>' : '<span>'+(Number(vagas || 0)>0 ? escapa(vagas)+' vaga'+(Number(vagas)===1?'':'s')+' disponível'+(Number(vagas)===1?'':'is') : 'Evento lotado')+'</span>')+
        (espera>0 ? '<span>'+espera+' na lista de espera</span>' : '')+
      '</div>'+
      acoesParticipacao(eventoId,status);
  }

  async function carregarStatusDetalhe(eventoId){
    if(!temDb() || !eventoId) return;
    if(!logado()){
      renderParticipacaoDetalhe(eventoId,{
        capacidade:null, inscritos:0, espera:0, vagas_disponiveis:null,
        meu_status:'nenhum', posicao_espera:null, sou_organizador:false
      });
      return;
    }
    const {data,error} = await db.rpc('status_participacao_v25_2',{p_evento:eventoId});
    if(error){
      console.warn(PREFIXO,'status de participação indisponível',error);
      return;
    }
    renderParticipacaoDetalhe(eventoId,data);
  }

  function agendarDetalhe(){
    clearTimeout(agendarDetalhe.timer);
    agendarDetalhe.timer = setTimeout(()=>{
      const id = idEventoNoDetalhe();
      if(!id) return;
      eventoDetalheAtual = id;
      carregarStatusDetalhe(id);
    },80);
  }

  function criarModalParticipantes(){
    if(document.getElementById('modalParticipantesV252')) return;
    const modal = document.createElement('div');
    modal.className = 'cortina';
    modal.id = 'modalParticipantesV252';
    modal.innerHTML = '<div class="folha v252-modal" role="dialog" aria-modal="true">'+
      '<button class="fechar" data-v252-fechar>×</button>'+
      '<div class="v252-modal-topo"><p class="v252-kicker">V25.2 · PARTICIPAÇÃO</p><h3>Participantes do evento</h3><p class="dica">Inscritos confirmados e pessoas aguardando vaga.</p></div>'+
      '<div id="listaParticipantesV252"><p class="dica">Carregando...</p></div>'+
      '</div>';
    document.body.appendChild(modal);
  }

  function avatarParticipante(p){
    if(p.foto_url) return '<span class="v252-avatar"><img src="'+escapa(p.foto_url)+'" alt=""></span>';
    const iniciais = String(p.nome || '?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
    return '<span class="v252-avatar">'+escapa(iniciais || '?')+'</span>';
  }

  async function abrirParticipantes(eventoId){
    if(!logado()){ abrirLogin(); return; }
    criarModalParticipantes();
    const modal = document.getElementById('modalParticipantesV252');
    const lista = document.getElementById('listaParticipantesV252');
    lista.innerHTML = '<p class="dica">Carregando participantes...</p>';
    modal.classList.add('aberta');
    const {data,error} = await db.rpc('participantes_evento_v25_2',{p_evento:eventoId});
    if(error){
      lista.innerHTML = '<div class="v252-erro">'+escapa(error.message || 'Não foi possível carregar')+'</div>';
      return;
    }
    const itens = data || [];
    const confirmados = itens.filter(x=>x.status==='inscrito');
    const fila = itens.filter(x=>x.status==='espera');
    const secao = (titulo,arr,status)=>
      '<section class="v252-lista-secao"><div class="v252-lista-titulo"><h4>'+titulo+'</h4><span>'+arr.length+'</span></div>'+
      (arr.length ? arr.map((p,i)=>'<article class="v252-pessoa">'+avatarParticipante(p)+'<div><strong>'+escapa(p.nome)+'</strong><span>'+(status==='espera'?'Posição '+(i+1)+' na fila':'Inscrição confirmada')+'</span></div></article>').join('') : '<p class="dica">Ninguém nesta lista.</p>')+
      '</section>';
    lista.innerHTML = secao('Inscritos',confirmados,'inscrito') + secao('Lista de espera',fila,'espera');
  }

  async function participar(eventoId,botao){
    if(!logado()){ abrirLogin(); return; }
    if(botao){ botao.disabled=true; botao.textContent='Confirmando...'; }
    const {data,error} = await db.rpc('participar_evento_v25_2',{p_evento:eventoId});
    if(botao) botao.disabled=false;
    if(error){
      avisarV252(error.message || 'Não foi possível concluir a inscrição');
      await carregarStatusDetalhe(eventoId);
      return;
    }
    if(data && data.status==='espera') avisarV252('Evento lotado. Você entrou na lista de espera na posição '+(data.posicao_espera || '—')+'.');
    else avisarV252('Inscrição confirmada! Sua vaga está reservada.');
    await carregarStatusDetalhe(eventoId);
    atualizarMinhasInscricoesSeVisivel();
  }

  async function cancelar(eventoId,botao){
    if(!confirm('Cancelar sua participação neste evento?')) return;
    if(botao){ botao.disabled=true; botao.textContent='Cancelando...'; }
    const {error} = await db.rpc('cancelar_participacao_v25_2',{p_evento:eventoId});
    if(botao) botao.disabled=false;
    if(error){ avisarV252(error.message || 'Não foi possível cancelar'); return; }
    avisarV252('Participação cancelada.');
    await carregarStatusDetalhe(eventoId);
    atualizarMinhasInscricoesSeVisivel();
  }

  function criarAbaPerfil(){
    const abas = document.querySelector('.perfil-abas');
    const main = document.getElementById('perfilMain');
    if(!abas || !main || abas.querySelector('[data-tab="inscricoes"]')) return;

    const favoritos = abas.querySelector('[data-tab="favoritos"]');
    const botao = document.createElement('button');
    botao.className = 'perfil-aba';
    botao.dataset.tab = 'inscricoes';
    botao.setAttribute('role','tab');
    botao.setAttribute('aria-selected','false');
    botao.textContent = 'Minhas inscrições';
    if(favoritos && favoritos.nextSibling) abas.insertBefore(botao,favoritos.nextSibling);
    else abas.appendChild(botao);

    const painelFavoritos = main.querySelector('[data-pane="favoritos"]');
    const painel = document.createElement('section');
    painel.className = 'perfil-painel';
    painel.dataset.pane = 'inscricoes';
    painel.hidden = true;
    painel.innerHTML = '<div class="v252-perfil-topo"><div><p class="v252-kicker">PARTICIPAÇÃO</p><h2>Minhas inscrições</h2><p>Acompanhe vagas confirmadas e posições na lista de espera.</p></div></div><div id="listaInscricoesV252" class="v252-inscricoes-grade"><p class="dica">Abra esta aba para carregar suas inscrições.</p></div>';
    if(painelFavoritos && painelFavoritos.nextSibling) main.insertBefore(painel,painelFavoritos.nextSibling);
    else main.appendChild(painel);
  }

  async function carregarMinhasInscricoes(){
    const caixa = document.getElementById('listaInscricoesV252');
    if(!caixa || !temDb()) return;
    if(!logado()){
      caixa.innerHTML='<div class="vazio perfil-vazio"><strong>Entre para acompanhar suas inscrições</strong></div>';
      return;
    }
    caixa.innerHTML='<p class="dica">Carregando inscrições...</p>';
    const {data,error} = await db.rpc('minhas_inscricoes_v25_2');
    if(error){
      caixa.innerHTML='<div class="v252-erro">'+escapa(error.message || 'Não foi possível carregar')+'</div>';
      return;
    }
    const itens = data || [];
    if(!itens.length){
      caixa.innerHTML='<div class="vazio perfil-vazio"><strong>Nenhuma inscrição ativa</strong><p>Quando você confirmar presença em um evento, ele aparece aqui.</p><a class="btn-linha link-botao" href="index.html">Encontrar eventos</a></div>';
      return;
    }
    caixa.innerHTML = itens.map(i=>{
      const status = i.status==='espera'
        ? '<span class="v252-status v252-status-espera">Fila · posição '+escapa(i.posicao_espera || '—')+'</span>'
        : '<span class="v252-status v252-status-inscrito">✓ Inscrito</span>';
      const ocupacao = i.capacidade == null ? escapa(i.inscritos)+' inscritos' : escapa(i.inscritos)+' / '+escapa(i.capacidade)+' vagas';
      return '<article class="v252-inscricao-card">'+
        (i.imagem_url?'<img src="'+escapa(i.imagem_url)+'" alt="">':'<div class="v252-inscricao-sem-imagem">ROLÊ</div>')+
        '<div class="v252-inscricao-corpo">'+status+'<h3>'+escapa(i.nome)+'</h3><p>'+escapa(formatarData(i.data_evento))+' · '+escapa(horarioCurto(i.hora_evento))+'</p><p>⌖ '+escapa([i.bairro,i.cidade].filter(Boolean).join(', '))+'</p><p class="v252-ocupacao">'+ocupacao+'</p><a class="v252-btn v252-btn-secundario v252-link" href="index.html?evento='+encodeURIComponent(i.evento_id)+'">Ver evento</a></div></article>';
    }).join('');
  }

  function abrirTabInscricoes(){
    const main = document.getElementById('perfilMain');
    if(!main) return;
    main.querySelectorAll('.perfil-aba').forEach(b=>{
      const ativo = b.dataset.tab==='inscricoes';
      b.classList.toggle('ativa',ativo);
      b.setAttribute('aria-selected',String(ativo));
    });
    main.querySelectorAll('.perfil-painel').forEach(p=>{ p.hidden = p.dataset.pane!=='inscricoes'; });
    carregarMinhasInscricoes();
  }

  function atualizarMinhasInscricoesSeVisivel(){
    const pane = document.querySelector('[data-pane="inscricoes"]');
    if(pane && !pane.hidden) carregarMinhasInscricoes();
  }

  function ligarEventos(){
    document.addEventListener('click',async e=>{
      const login = e.target.closest('[data-v252-login]');
      if(login){ e.preventDefault(); abrirLogin(); return; }

      const entrar = e.target.closest('[data-v252-participar]');
      if(entrar){ e.preventDefault(); e.stopPropagation(); await participar(entrar.dataset.v252Participar,entrar); return; }

      const cancelarBtn = e.target.closest('[data-v252-cancelar]');
      if(cancelarBtn){ e.preventDefault(); e.stopPropagation(); await cancelar(cancelarBtn.dataset.v252Cancelar,cancelarBtn); return; }

      const participantes = e.target.closest('[data-v252-participantes]');
      if(participantes){ e.preventDefault(); e.stopPropagation(); await abrirParticipantes(participantes.dataset.v252Participantes); return; }

      if(e.target.closest('[data-v252-fechar]') || (e.target.id==='modalParticipantesV252')){
        const modal = document.getElementById('modalParticipantesV252');
        if(modal) modal.classList.remove('aberta');
        return;
      }

      const tab = e.target.closest('.perfil-aba[data-tab="inscricoes"]');
      if(tab){ e.preventDefault(); abrirTabInscricoes(); }
    },true);
  }

  function observarDetalhe(){
    const folha = document.getElementById('folhaDetalhe');
    if(!folha || observerDetalhe) return;
    observerDetalhe = new MutationObserver(agendarDetalhe);
    observerDetalhe.observe(folha,{childList:true,subtree:true});
    agendarDetalhe();
  }

  function iniciar(){
    criarAbaPerfil();
    observarDetalhe();
    criarModalParticipantes();
    ligarEventos();

    // Páginas do Rolê podem terminar de montar a sessão depois deste módulo.
    // Uma segunda passada sincroniza o detalhe/perfil sem substituir os hooks existentes.
    setTimeout(()=>{
      criarAbaPerfil();
      observarDetalhe();
      if(eventoDetalheAtual) carregarStatusDetalhe(eventoDetalheAtual);
    },700);

    console.info(PREFIXO,'módulo de participação carregado');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
