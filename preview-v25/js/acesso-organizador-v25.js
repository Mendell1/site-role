/* ============================================================
   ROLÊ V25.9 — PAPEL DE ORGANIZADOR
   Usuário comum participa. Organizador publica e administra.
   Administrador aprova, concede, verifica e revoga o acesso.
   ============================================================ */
(() => {
  'use strict';
  if(window.__roleV259AcessoAtivo) return;
  window.__roleV259AcessoAtivo=true;

  const pagina=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const esc=v=>String(v==null?'':v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const fmt=iso=>iso?new Date(iso).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
  const fmtData=iso=>iso?new Date(iso).toLocaleDateString('pt-BR'):'—';
  let session=null;
  let perfil=null;
  let cargaPerfil=0;
  let renderAcesso=0;
  let aplicando=false;
  let observer=null;
  let timerAplicar=null;
  let adminPainelAtivo=false;
  let abriuQueryOrganizador=false;
  let contadorAdminCarregado=false;

  const podeOrganizar=()=>!!perfil&&['organizador','admin'].includes(perfil.papel);
  const usuarioComum=()=>!!perfil&&perfil.papel==='usuario';
  const eAdmin=()=>!!perfil&&perfil.papel==='admin';

  function setText(el,texto){ if(el&&el.textContent!==texto) el.textContent=texto; }
  function setHidden(el,valor){ if(el&&el.hidden!==valor) el.hidden=valor; }

  function avisar(texto){
    if(typeof window.avisar==='function') return window.avisar(texto);
    const a=document.getElementById('aviso');
    if(a){setText(a,texto);a.classList.add('mostra');setTimeout(()=>a.classList.remove('mostra'),3400);}
    else console.info('[V25.9]',texto);
  }

  async function carregarPerfil(){
    const carga=++cargaPerfil;
    const r=await db.auth.getSession();
    if(carga!==cargaPerfil) return perfil;
    session=r.data?.session||null;
    if(!session){ perfil=null; return null; }
    const usuarioId=session.user.id;
    if(perfil?.id!==usuarioId) perfil=null;
    const {data,error}=await db.from('perfis').select('id,nome,email,papel,bloqueado,cadastro_completo,cidade,contato,data_nascimento,aceitou_regras,verificado,seguidores_total,organizador_nome,organizador_descricao,organizador_desde,organizador_revogado_em,organizador_revogacao_motivo,exclusao_prevista,suspenso_ate').eq('id',usuarioId).single();
    if(carga!==cargaPerfil || session?.user.id!==usuarioId) return perfil;
    if(!error) perfil=data;
    return perfil;
  }

  function abrirSolicitacao(){
    const u=new URL('perfil.html',location.href);
    u.search='';u.hash='';u.searchParams.set('organizador','1');
    location.href=u.href;
  }

  function atualizarBotaoPublicar(){
    if(pagina!=='index.html') return;
    const btn=document.getElementById('btnCriar');
    if(!btn||!session) return;
    setHidden(btn,false);
    if(usuarioComum()){
      setText(btn,'🎪 Quero publicar eventos');
      btn.dataset.v259Solicitar='1';
      if(btn.title!=='Solicite acesso de organizador para publicar eventos') btn.title='Solicite acesso de organizador para publicar eventos';
    }else if(podeOrganizar()){
      delete btn.dataset.v259Solicitar;
      setText(btn,'＋ Publicar evento');
      if(btn.title!=='Publicar evento') btn.title='Publicar evento';
    }

    const abaMeus=document.querySelector('#abas .aba[data-aba="meus"]');
    setHidden(abaMeus,usuarioComum());
    if(usuarioComum() && typeof estado!=='undefined' && estado.aba==='meus'){
      const todos=document.querySelector('#abas .aba[data-aba="todos"]');
      if(todos) todos.click();
    }
  }

  function limparControlesPrivadosDetalhe(){
    if(pagina!=='index.html'||!usuarioComum()) return;
    const folha=document.getElementById('folhaDetalhe');
    if(!folha) return;
    folha.querySelectorAll('[data-editar],[data-excluir],[data-v252-participantes],[data-v253-scanner],[data-v253-painel],[data-v253-desfazer]').forEach(el=>setHidden(el,true));
  }

  function bloquearAcoesIndex(e){
    if(pagina!=='index.html'||!usuarioComum()) return;
    const solicitar=e.target.closest('#btnCriar,[data-v259-solicitar]');
    if(solicitar){
      e.preventDefault();e.stopImmediatePropagation();abrirSolicitacao();return;
    }
    const privado=e.target.closest('#btnPublicar,[data-editar],[data-excluir],[data-v252-participantes],[data-v253-scanner],[data-v253-painel],[data-v253-desfazer]');
    if(privado){
      e.preventDefault();e.stopImmediatePropagation();
      avisar('Para publicar ou administrar eventos, solicite acesso de Organizador.');
    }
  }

  function garantirAbaOrganizadorPerfil(){
    if(pagina!=='perfil.html') return;
    const abas=document.querySelector('.perfil-abas');
    const main=document.getElementById('perfilMain');
    if(!abas||!main) return;
    let btn=abas.querySelector('[data-tab="organizador-v25-9"]');
    if(!btn){
      btn=document.createElement('button');
      btn.className='perfil-aba';
      btn.type='button';
      btn.dataset.tab='organizador-v25-9';
      btn.setAttribute('role','tab');
      btn.setAttribute('aria-selected','false');
      btn.textContent='Organizador';
      const conta=abas.querySelector('[data-tab="conta"]');
      if(conta) abas.insertBefore(btn,conta); else abas.appendChild(btn);
      btn.addEventListener('click',()=>abrirAbaOrganizador());
    }
    let pane=main.querySelector('[data-pane="organizador-v25-9"]');
    if(!pane){
      pane=document.createElement('section');
      pane.className='perfil-painel';
      pane.dataset.pane='organizador-v25-9';
      pane.hidden=true;
      pane.innerHTML='<div id="conteudoOrganizadorV259" class="v259-perfil"><p class="dica">Carregando acesso de organizador...</p></div>';
      const contaPane=main.querySelector('[data-pane="conta"]');
      if(contaPane) main.insertBefore(pane,contaPane); else main.appendChild(pane);
    }
  }

  function selecionarAbaPerfil(tab){
    document.querySelectorAll('.perfil-aba').forEach(b=>{
      const ativo=b.dataset.tab===tab;
      b.classList.toggle('ativa',ativo);
      b.setAttribute('aria-selected',String(ativo));
    });
    document.querySelectorAll('[data-pane]').forEach(p=>setHidden(p,p.dataset.pane!==tab));
  }

  async function abrirAbaOrganizador(){
    garantirAbaOrganizadorPerfil();
    selecionarAbaPerfil('organizador-v25-9');
    await renderAcessoPerfil();
  }

  function elegibilidadeHtml(perfilAtual=perfil){
    const itens=[
      ['Conta ativa',!!perfilAtual&&!perfilAtual.bloqueado&&!perfilAtual.exclusao_prevista],
      ['Perfil completo',!!perfilAtual?.cadastro_completo],
      ['Data de nascimento preenchida',!!perfilAtual?.data_nascimento],
      ['Regras de convivência aceitas',perfilAtual?.aceitou_regras===true]
    ];
    return '<div class="v259-checklist">'+itens.map(([t,ok])=>'<span class="'+(ok?'ok':'pendente')+'">'+(ok?'✓':'○')+' '+esc(t)+'</span>').join('')+'</div>';
  }

  function formularioSolicitacao(ultima,perfilAtual=perfil){
    const cidade=perfilAtual?.cidade||ultima?.cidade||'';
    const contato=perfilAtual?.contato||ultima?.contato||'';
    return '<section class="superficie-lovable v259-card v259-form-card">'+
      '<p class="bloco-kicker">TORNE-SE ORGANIZADOR</p><h2>Quero publicar eventos</h2>'+
      '<p class="v259-intro">O acesso de organizador é aprovado pela moderação. Depois da aprovação você poderá publicar eventos, controlar vagas, participantes, check-in e métricas.</p>'+
      elegibilidadeHtml(perfilAtual)+
      (perfilAtual?.organizador_revogado_em?'<div class="v259-alerta"><strong>Acesso anterior revogado</strong><p>'+esc(perfilAtual.organizador_revogacao_motivo||'A moderação retirou o acesso de organizador.')+'</p></div>':'')+
      (ultima?.status==='recusada'?'<div class="v259-alerta"><strong>Última solicitação não aprovada</strong><p>'+esc(ultima.observacao_admin||'Revise seus dados e você pode enviar uma nova solicitação.')+'</p></div>':'')+
      '<div class="campo"><label for="v259_nome">Nome do organizador, projeto ou grupo *</label><input id="v259_nome" maxlength="100" value="'+esc(ultima?.nome_organizacao||perfilAtual?.nome||'')+'" placeholder="Ex.: Associação Cultural do Bairro"></div>'+
      '<div class="linha-form-lovable linha-2"><div class="campo"><label for="v259_cidade">Cidade/região de atuação *</label><input id="v259_cidade" maxlength="100" value="'+esc(cidade)+'" placeholder="São Paulo — Zona Leste"></div><div class="campo"><label for="v259_tipos">Que eventos pretende organizar? *</label><input id="v259_tipos" maxlength="300" value="'+esc(ultima?.tipos_eventos||'')+'" placeholder="Feiras, oficinas, campeonatos..."></div></div>'+
      '<div class="campo"><label for="v259_desc">Sobre o projeto/organização *</label><textarea id="v259_desc" maxlength="700" rows="4" placeholder="Conte brevemente quem organiza e que atividades realiza.">'+esc(ultima?.descricao||'')+'</textarea></div>'+
      '<div class="campo"><label for="v259_contato">Contato público <small>(opcional)</small></label><input id="v259_contato" maxlength="180" value="'+esc(contato)+'" placeholder="Instagram, site ou WhatsApp público"></div>'+
      '<div class="campo"><label for="v259_motivo">Por que deseja publicar eventos no Rolê? *</label><textarea id="v259_motivo" maxlength="1000" rows="4" placeholder="Explique como pretende usar a plataforma.">'+esc(ultima?.motivo||'')+'</textarea></div>'+
      '<label class="aceite v259-aceite"><input type="checkbox" id="v259_regras"><span>Li e aceito as regras para organizadores. Sou responsável pelas informações, locais, datas e condições dos eventos que eu publicar.</span></label>'+
      '<div class="acoes"><button type="button" class="btn-escuro" id="btnSolicitarOrganizadorV259">Enviar solicitação</button></div>'+
    '</section>';
  }

  async function renderAcessoPerfil(){
    const alvo=document.getElementById('conteudoOrganizadorV259');
    if(!alvo) return;
    const renderAtual=++renderAcesso;
    if(!perfil) await carregarPerfil();
    if(renderAtual!==renderAcesso) return;
    const perfilAtual=perfil;
    if(!perfilAtual){ alvo.innerHTML='<div class="v259-alerta" role="status">Não foi possível carregar seu perfil. <button type="button" class="btn-linha" data-v259-recarregar>Tentar novamente</button></div>'; return; }
    if(perfilAtual.papel==='admin'){
      alvo.innerHTML='<section class="superficie-lovable v259-card"><p class="bloco-kicker">ADMINISTRAÇÃO</p><h2>Administrador da plataforma</h2><p>Administradores já possuem acesso completo às ferramentas de eventos e à análise de solicitações de organizadores.</p><div class="acoes"><a class="btn-escuro link-botao" href="admin.html">Abrir painel administrativo</a><a class="btn-linha link-botao" href="index.html?criar=1">Publicar evento</a></div></section>';
      return;
    }
    if(perfilAtual.papel==='organizador'){
      alvo.innerHTML='<section class="superficie-lovable v259-card v259-aprovado"><div class="v259-status-grande">🎪</div><div><p class="bloco-kicker">ACESSO APROVADO</p><h2>'+esc(perfilAtual.organizador_nome||perfilAtual.nome)+'</h2><p>Você pode publicar e administrar seus próprios eventos.</p>'+
        '<div class="v259-selos"><span>🎪 Organizador</span>'+(perfilAtual.verificado?'<span class="verificado">✓ Verificado</span>':'')+(perfilAtual.organizador_desde?'<span>Desde '+esc(fmtData(perfilAtual.organizador_desde))+'</span>':'')+'</div>'+
        '<div class="acoes"><a class="btn-escuro link-botao" href="index.html?criar=1">＋ Publicar evento</a><button type="button" class="btn-linha" data-v259-abrir-painel>Painel do organizador</button></div></div></section>';
      return;
    }

    alvo.innerHTML='<p class="dica">Carregando sua solicitação...</p>';
    const {data,error}=await db.from('solicitacoes_organizador_v25_9').select('*').eq('usuario_id',perfilAtual.id).order('criado_em',{ascending:false}).limit(5);
    if(renderAtual!==renderAcesso || session?.user.id!==perfilAtual.id) return;
    if(error){alvo.innerHTML='<div class="v259-alerta">Não foi possível carregar suas solicitações agora. <button type="button" class="btn-linha" data-v259-recarregar>Tentar novamente</button></div>';return;}
    const lista=data||[];
    const pendente=lista.find(x=>x.status==='pendente');
    const ultima=lista[0]||null;
    if(pendente){
      alvo.innerHTML='<section class="superficie-lovable v259-card"><div class="v259-status-grande">◷</div><div><p class="bloco-kicker">SOLICITAÇÃO EM ANÁLISE</p><h2>'+esc(pendente.nome_organizacao)+'</h2><p>A moderação ainda está analisando seu pedido. Você receberá uma notificação quando houver decisão.</p><div class="v259-resumo"><span><b>Enviada</b>'+esc(fmt(pendente.criado_em))+'</span><span><b>Região</b>'+esc(pendente.cidade)+'</span><span><b>Eventos</b>'+esc(pendente.tipos_eventos)+'</span></div><div class="acoes"><button type="button" class="btn-linha" data-v259-cancelar="'+esc(pendente.id)+'">Cancelar solicitação</button></div></div></section>';
      return;
    }
    alvo.innerHTML=formularioSolicitacao(ultima,perfilAtual);
  }

  async function enviarSolicitacao(){
    const btn=document.getElementById('btnSolicitarOrganizadorV259');
    const valor=id=>document.getElementById(id)?.value.trim()||'';
    if(!document.getElementById('v259_regras')?.checked){avisar('Aceite as regras para organizadores antes de enviar.');return;}
    if(!btn) return;
    btn.disabled=true;btn.textContent='Enviando...';
    const {error}=await db.rpc('solicitar_organizador_v25_9',{
      p_nome_organizacao:valor('v259_nome'),p_cidade:valor('v259_cidade'),p_tipos_eventos:valor('v259_tipos'),
      p_descricao:valor('v259_desc'),p_contato:valor('v259_contato')||null,p_motivo:valor('v259_motivo'),p_aceitou_regras:true
    });
    btn.disabled=false;btn.textContent='Enviar solicitação';
    if(error){avisar(error.message||'Não foi possível enviar a solicitação.');return;}
    avisar('Solicitação enviada para a moderação.');
    await renderAcessoPerfil();
  }

  async function cancelarSolicitacao(id){
    if(!confirm('Cancelar esta solicitação de organizador?')) return;
    const {error}=await db.rpc('cancelar_solicitacao_organizador_v25_9',{p_solicitacao:id});
    if(error){avisar(error.message);return;}
    avisar('Solicitação cancelada.');
    await renderAcessoPerfil();
  }

  function aplicarPerfil(){
    if(pagina!=='perfil.html'||!perfil) return;
    garantirAbaOrganizadorPerfil();
    const kicker=document.getElementById('perfilKicker');
    if(kicker){
      if(eAdmin()) setText(kicker,'ADMINISTRADOR DO ROLÊ');
      else if(perfil.papel==='organizador') setText(kicker,perfil.verificado?'ORGANIZADOR VERIFICADO':'ORGANIZADOR DO ROLÊ');
      else setText(kicker,'MEMBRO DO ROLÊ');
    }

    const btnTopo=document.getElementById('btnCriar');
    const btnHero=document.getElementById('btnCriarHero');
    [btnTopo,btnHero].filter(Boolean).forEach(btn=>{
      if(usuarioComum()){
        setHidden(btn,false);setText(btn,'Quero publicar eventos');btn.dataset.v259Solicitar='1';
      }else if(podeOrganizar()){
        delete btn.dataset.v259Solicitar;setText(btn,btn===btnHero?'Publicar evento':'＋ Publicar evento');
      }
    });

    const tabEventos=document.querySelector('.perfil-aba[data-tab="eventos"]');
    const paneEventos=document.querySelector('[data-pane="eventos"]');
    const tabPainel=document.querySelector('.perfil-aba[data-tab="painel-v25-7"]');
    const panePainel=document.querySelector('[data-pane="painel-v25-7"]');
    setHidden(tabEventos,usuarioComum());
    if(paneEventos&&usuarioComum()) setHidden(paneEventos,true);
    setHidden(tabPainel,usuarioComum());
    if(panePainel&&usuarioComum()) setHidden(panePainel,true);

    if(usuarioComum() && tabEventos?.classList.contains('ativa')) selecionarAbaPerfil('favoritos');

    if(!abriuQueryOrganizador&&new URLSearchParams(location.search).get('organizador')==='1'){
      abriuQueryOrganizador=true;
      setTimeout(()=>abrirAbaOrganizador(),30);
    }
  }

  async function carregarAdminOrganizadores(){
    if(pagina!=='admin.html'||!eAdmin()) return;
    adminPainelAtivo=true;
    const lista=document.getElementById('lista');
    const titulo=document.getElementById('tituloPainel');
    const contagem=document.getElementById('contagemPainel');
    setText(titulo,'Organizadores');
    document.querySelectorAll('.painel-aba').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.painel==='organizadores-v25-9')));
    if(lista) lista.innerHTML='<div class="esqueleto" style="min-height:80px"></div>'.repeat(3);

    const [solResp,orgResp,userResp]=await Promise.all([
      db.from('solicitacoes_organizador_v25_9').select('*').eq('status','pendente').order('criado_em',{ascending:true}),
      db.from('perfis').select('id,nome,email,cidade,papel,verificado,seguidores_total,organizador_nome,organizador_desde').eq('papel','organizador').order('organizador_desde',{ascending:false}),
      db.from('perfis').select('id,nome,email,cidade,papel,bloqueado').eq('papel','usuario').eq('bloqueado',false).order('nome').limit(100)
    ]);
    if(solResp.error||orgResp.error||userResp.error){
      if(lista) lista.innerHTML='<div class="vazio"><strong>Não foi possível carregar</strong>Tente novamente em instantes.</div>';
      return;
    }
    const solicitacoes=solResp.data||[], organizadores=orgResp.data||[], usuarios=userResp.data||[];
    const ids=[...new Set(solicitacoes.map(x=>x.usuario_id))];
    const perfisReq=new Map();
    if(ids.length){
      const r=await db.from('perfis').select('id,nome,email,cidade').in('id',ids);
      (r.data||[]).forEach(x=>perfisReq.set(x.id,x));
    }
    setText(contagem,solicitacoes.length+' pendente'+(solicitacoes.length===1?'':'s')+' · '+organizadores.length+' organizador'+(organizadores.length===1?'':'es'));

    const pendHtml=solicitacoes.length?solicitacoes.map(s=>{
      const u=perfisReq.get(s.usuario_id)||{};
      return '<article class="ficha v259-admin-solicitacao"><div class="corpo"><h4>'+esc(s.nome_organizacao)+'</h4><div class="meta"><strong>'+esc(u.nome||'Usuário')+'</strong> · '+esc(u.email||'')+'<br>⌖ '+esc(s.cidade)+' · ENVIADA '+esc(fmt(s.criado_em))+'<br><b>TIPOS:</b> '+esc(s.tipos_eventos)+'</div><p>'+esc(s.descricao)+'</p><div class="v259-motivo"><b>POR QUE QUER PUBLICAR:</b><br>'+esc(s.motivo)+'</div>'+(s.contato?'<div class="meta">CONTATO PÚBLICO: '+esc(s.contato)+'</div>':'')+'</div><div class="botoes"><button class="mini ok" data-v259-aprovar="'+esc(s.id)+'">Aprovar</button><button class="mini perigo" data-v259-recusar="'+esc(s.id)+'">Recusar</button></div></article>';
    }).join(''):'<div class="v259-admin-vazio">Nenhuma solicitação aguardando análise.</div>';

    const orgHtml=organizadores.length?organizadores.map(o=>'<article class="ficha"><div class="corpo"><h4>🎪 '+esc(o.organizador_nome||o.nome)+'</h4><div class="meta">'+esc(o.nome)+' · '+esc(o.email||'')+(o.cidade?' · '+esc(o.cidade):'')+'<br>DESDE '+esc(fmtData(o.organizador_desde))+' · '+Number(o.seguidores_total||0)+' seguidor(es)</div></div>'+(o.verificado?'<span class="selo admin">✓ verificado</span>':'<span class="selo oculto">organizador</span>')+'<div class="botoes">'+(o.verificado?'<button class="mini" data-v259-verificar="'+esc(o.id)+'" data-valor="0">Remover selo</button>':'<button class="mini ok" data-v259-verificar="'+esc(o.id)+'" data-valor="1">Verificar</button>')+'<button class="mini perigo" data-v259-revogar="'+esc(o.id)+'">Revogar acesso</button></div></article>').join(''):'<div class="v259-admin-vazio">Nenhum organizador aprovado ainda.</div>';

    const options=usuarios.map(u=>'<option value="'+esc(u.id)+'">'+esc(u.nome)+' — '+esc(u.email||u.cidade||'')+'</option>').join('');
    if(lista) lista.innerHTML='<section class="v259-admin-bloco"><div class="v259-admin-titulo"><div><span class="v259-kicker">FILA DE APROVAÇÃO</span><h3>Solicitações pendentes</h3></div><span>'+solicitacoes.length+'</span></div>'+pendHtml+'</section>'+
      '<section class="v259-admin-bloco"><div class="v259-admin-titulo"><div><span class="v259-kicker">ACESSO ATIVO</span><h3>Organizadores</h3></div><span>'+organizadores.length+'</span></div>'+orgHtml+'</section>'+
      '<section class="v259-admin-bloco v259-convite"><div><span class="v259-kicker">CONCESSÃO DIRETA</span><h3>Convidar usuário para organizar</h3><p>Use para prefeitura, ONG, instituição ou pessoa já conhecida pela administração.</p></div>'+
        (usuarios.length?'<div class="linha-form-lovable linha-2"><div class="campo"><label for="v259_convidar_usuario">Usuário</label><select id="v259_convidar_usuario"><option value="">Selecione...</option>'+options+'</select></div><div class="campo"><label for="v259_convidar_nome">Nome do projeto/organizador</label><input id="v259_convidar_nome" maxlength="100" placeholder="Opcional"></div></div><button class="mini ok" id="btnConcederOrganizadorV259">Conceder acesso de organizador</button>':'<p class="dica">Nenhum usuário comum elegível no momento.</p>')+'</section>';
    await atualizarContadorAdmin();
  }

  function garantirAbaAdmin(){
    if(pagina!=='admin.html'||!eAdmin()) return;
    const abas=document.querySelector('.painel-abas');
    if(!abas) return;
    let btn=abas.querySelector('[data-painel="organizadores-v25-9"]');
    if(!btn){
      btn=document.createElement('button');btn.className='painel-aba';btn.dataset.painel='organizadores-v25-9';btn.setAttribute('aria-pressed','false');
      btn.innerHTML='Organizadores <span class="contador" id="cntOrganizadoresV259" hidden>0</span>';
      const usuarios=abas.querySelector('[data-painel="usuarios"]');
      if(usuarios&&usuarios.nextSibling) abas.insertBefore(btn,usuarios.nextSibling); else abas.appendChild(btn);
      contadorAdminCarregado=false;
    }
    if(!contadorAdminCarregado){contadorAdminCarregado=true;atualizarContadorAdmin();}
  }

  async function atualizarContadorAdmin(){
    if(!eAdmin()) return;
    const {count}=await db.from('solicitacoes_organizador_v25_9').select('id',{count:'exact',head:true}).eq('status','pendente');
    const c=document.getElementById('cntOrganizadoresV259');
    if(c){setHidden(c,!count);setText(c,String(count||0));}
  }

  async function decidirSolicitacao(id,decisao){
    let obs=null;
    if(decisao==='recusar'){
      obs=prompt('Explique o motivo da recusa. Essa mensagem será mostrada ao usuário:','');
      if(obs===null) return;
      if(obs.trim().length<5){avisar('Escreva um motivo um pouco mais claro.');return;}
    }else if(!confirm('Aprovar esta conta como Organizador de eventos?')) return;
    const {error}=await db.rpc('admin_decidir_solicitacao_organizador_v25_9',{p_solicitacao:id,p_decisao:decisao,p_observacao:obs?.trim()||null});
    if(error){avisar(error.message);return;}
    avisar(decisao==='aprovar'?'Organizador aprovado.':'Solicitação recusada.');
    await carregarAdminOrganizadores();
  }

  async function revogarOrganizador(id){
    const motivo=prompt('Motivo da revogação do acesso de organizador:','');
    if(motivo===null) return;
    if(motivo.trim().length<5){avisar('Informe um motivo mais claro.');return;}
    const ocultar=confirm('Também ocultar os eventos futuros deste organizador?\n\nOK = revogar e ocultar futuros eventos\nCancelar = revogar acesso, mantendo eventos atuais visíveis');
    if(!confirm('Confirmar a retirada do acesso de organizador? A conta continuará existindo como usuário comum.')) return;
    const {error}=await db.rpc('admin_revogar_organizador_v25_9',{p_usuario:id,p_motivo:motivo.trim(),p_ocultar_eventos:ocultar});
    if(error){avisar(error.message);return;}
    avisar('Acesso de organizador revogado.');
    await carregarAdminOrganizadores();
  }

  async function concederOrganizador(){
    const sel=document.getElementById('v259_convidar_usuario');
    const id=sel?.value;
    if(!id){avisar('Selecione um usuário.');return;}
    const nome=document.getElementById('v259_convidar_nome')?.value.trim()||null;
    if(!confirm('Conceder acesso de Organizador diretamente para este usuário?')) return;
    const {error}=await db.rpc('admin_conceder_organizador_v25_9',{p_usuario:id,p_nome_organizacao:nome,p_observacao:'Acesso concedido pelo painel administrativo'});
    if(error){avisar(error.message);return;}
    avisar('Acesso de organizador concedido.');
    await carregarAdminOrganizadores();
  }

  async function alterarVerificacao(id,valor){
    const {error}=await db.rpc('admin_definir_verificacao_v25',{p_usuario:id,p_verificado:valor});
    if(error){avisar(error.message);return;}
    avisar(valor?'Organizador verificado.':'Selo de verificação removido.');
    await carregarAdminOrganizadores();
  }

  function aplicarAdmin(){
    if(pagina!=='admin.html'||!eAdmin()) return;
    garantirAbaAdmin();
  }

  async function validarPaginaOrganizador(){
    if(pagina!=='organizador.html') return;
    const id=new URLSearchParams(location.search).get('id');
    if(!id) return;
    const {data,error}=await db.rpc('perfil_publico_v25',{p_usuario:id});
    const p=Array.isArray(data)?data[0]:data;
    if(error||!p){
      const alvo=document.getElementById('organizadorConteudo');
      if(alvo) alvo.innerHTML='<div class="organizador-vazio v259-sem-organizador"><strong>Perfil sem acesso de organizador</strong><p>Esta conta não está autorizada a publicar ou administrar eventos no Rolê.</p><a href="index.html" class="btn-linha link-botao">Voltar ao mural</a></div>';
    }
  }

  function aplicarTudo(){
    if(aplicando) return;
    aplicando=true;
    try{
      atualizarBotaoPublicar();
      limparControlesPrivadosDetalhe();
      aplicarPerfil();
      aplicarAdmin();
    }finally{aplicando=false;}
  }

  function agendarAplicar(){
    clearTimeout(timerAplicar);
    timerAplicar=setTimeout(aplicarTudo,80);
  }

  function envolverMudancaSessao(){
    let tentativas=0;
    const tentar=()=>{
      const atual=window.aoMudarSessao;
      if(typeof atual==='function'&&!atual.__v259Envolvida){
        const original=atual;
        const wrapper=async function(...args){
          const r=await original.apply(this,args);
          await carregarPerfil();
          aplicarTudo();
          return r;
        };
        wrapper.__v259Envolvida=true;
        window.aoMudarSessao=wrapper;
        return;
      }
      if(tentativas++<30) setTimeout(tentar,150);
    };
    tentar();
  }

  function ligarEventos(){
    document.addEventListener('click',async e=>{
      if(usuarioComum()&&e.target.closest('#btnCriar,[data-v259-solicitar],#btnCriarHero')){
        e.preventDefault();e.stopImmediatePropagation();
        if(pagina==='perfil.html') abrirAbaOrganizador(); else abrirSolicitacao();
        return;
      }
      bloquearAcoesIndex(e);

      if(e.target.closest('[data-v259-recarregar]')){ await carregarPerfil(); await renderAcessoPerfil(); return; }
      const enviar=e.target.closest('#btnSolicitarOrganizadorV259');
      if(enviar){e.preventDefault();await enviarSolicitacao();return;}
      const cancelar=e.target.closest('[data-v259-cancelar]');
      if(cancelar){e.preventDefault();await cancelarSolicitacao(cancelar.dataset.v259Cancelar);return;}
      const painel=e.target.closest('[data-v259-abrir-painel]');
      if(painel){e.preventDefault();const b=document.querySelector('[data-tab="painel-v25-7"]');if(b)b.click();return;}

      const abaAdmin=e.target.closest('[data-painel="organizadores-v25-9"]');
      if(abaAdmin&&eAdmin()){
        e.preventDefault();e.stopImmediatePropagation();await carregarAdminOrganizadores();return;
      }
      const aprovar=e.target.closest('[data-v259-aprovar]');
      if(aprovar){e.preventDefault();await decidirSolicitacao(aprovar.dataset.v259Aprovar,'aprovar');return;}
      const recusar=e.target.closest('[data-v259-recusar]');
      if(recusar){e.preventDefault();await decidirSolicitacao(recusar.dataset.v259Recusar,'recusar');return;}
      const revogar=e.target.closest('[data-v259-revogar]');
      if(revogar){e.preventDefault();await revogarOrganizador(revogar.dataset.v259Revogar);return;}
      const verificar=e.target.closest('[data-v259-verificar]');
      if(verificar){e.preventDefault();await alterarVerificacao(verificar.dataset.v259Verificar,verificar.dataset.valor==='1');return;}
      if(e.target.closest('#btnConcederOrganizadorV259')){e.preventDefault();await concederOrganizador();return;}

      if(pagina==='admin.html'&&adminPainelAtivo&&e.target.closest('.painel-aba:not([data-painel="organizadores-v25-9"])')) adminPainelAtivo=false;
    },true);
  }

  async function iniciar(){
    await carregarPerfil();
    ligarEventos();
    envolverMudancaSessao();
    aplicarTudo();
    validarPaginaOrganizador();
    db.auth.onAuthStateChange(()=>setTimeout(async()=>{await carregarPerfil();aplicarTudo();},60));
    if(document.body){
      observer=new MutationObserver(agendarAplicar);
      observer.observe(document.body,{childList:true,subtree:true});
    }
    setTimeout(aplicarTudo,600);
    setTimeout(aplicarTudo,1400);
    console.info('[V25.9] controle de acesso de organizador carregado');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();