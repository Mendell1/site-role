/* ============================================================
   ROLÊ — Etapas 4 a 8
   Banco real + favoritos/interesses + denúncias/admin +
   filtros/paginação no banco + mapa + calendário.
   ============================================================ */

const CORES = {
  festas:'var(--rosa)', games:'var(--lilas)', esportes:'var(--verde)',
  educacao:'var(--azul)', cultura:'var(--laranja)', gastronomia:'var(--amarelo)',
  musica:'var(--lilas)', social:'var(--rosa)', profissional:'var(--papel)',
  feiras:'var(--verde)', outros:'var(--papel)'
};

const POR_PAGINA = 12;
let CATEGORIAS = [];
let EVENTOS = [];
let editando = null;
let denunciando = null;
let buscaTimer = null;
let recarregando = null;
let detalheAtual = null;

const favoritos = new Set();
const interesses = new Set();
const estado = {
  busca:'', cat:null, atalhos:new Set(), aba:'todos',
  pagina:0, total:0, visualizacao:'mural',
  mesCalendario:new Date(new Date().getFullYear(), new Date().getMonth(), 1)
};

const hoje = new Date(); hoje.setHours(0,0,0,0);
const campo = id => document.getElementById(id);
const meuId = () => Sessao.usuario ? Sessao.usuario.id : null;
const escapa = t => String(t==null?'':t).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const dataISO = d => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
const dataDe = ev => new Date(ev.data_evento + 'T00:00:00');
const hora = ev => (ev.hora_evento || '').slice(0,5);
const fmt = d => d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
const diaSemana = d => d.toLocaleDateString('pt-BR',{weekday:'long'});
const cor = ev => CORES[ev.categoria_id] || 'var(--papel)';
const rotula = ev => (ev.categoria_emoji||'') + ' ' + (ev.categoria_nome||'');

const SITUACOES_EVENTO = {
  agendado:'Agendado',
  adiado:'Adiado',
  esgotado:'Esgotado',
  cancelado:'Cancelado',
  finalizado:'Finalizado'
};
const situacaoEvento = ev => SITUACOES_EVENTO[ev.situacao || 'agendado'] || 'Agendado';
const eventoEncerrado = ev => ['cancelado','finalizado'].includes(ev.situacao);

function rotacao(id){
  let s = 0; for (const ch of String(id)) s += ch.charCodeAt(0);
  return [-1.8,1.4,-1.1,2,-2.2,.9,1.7,-1.5][s % 8] + 'deg';
}

function caminhoStoragePublico(url,bucket){
  if(!url) return null;
  const marca='/storage/v1/object/public/'+bucket+'/';
  const i=String(url).indexOf(marca);
  if(i<0) return null;
  return decodeURIComponent(String(url).slice(i+marca.length).split('?')[0]);
}

async function removerArquivoPublico(bucket,url){
  const caminho=caminhoStoragePublico(url,bucket);
  if(!caminho) return;
  const {error}=await db.storage.from(bucket).remove([caminho]);
  if(error) console.warn('Não foi possível remover arquivo antigo de '+bucket,error);
}

/* ============================================================
   AVISOS / MODAIS
   ============================================================ */
const abrir = id => document.getElementById(id).classList.add('aberta');
const fecharTudo = () => document.querySelectorAll('.cortina').forEach(m=>m.classList.remove('aberta'));
let avisoTimer;
function avisar(txt){
  const a = document.getElementById('aviso');
  a.textContent = txt; a.classList.add('mostra');
  clearTimeout(avisoTimer); avisoTimer = setTimeout(()=>a.classList.remove('mostra'), 3400);
}
window.avisar = avisar;

/* ============================================================
   CATEGORIAS E VÍNCULOS DO USUÁRIO
   ============================================================ */
async function carregarCategorias(){
  const { data, error } = await db.from('categorias').select('*').order('ordem');
  if(error){ console.error(error); return; }
  CATEGORIAS = data || [];
  campo('f_cat').innerHTML = CATEGORIAS.map(c=>'<option value="'+c.id+'">'+c.emoji+' '+escapa(c.nome)+'</option>').join('');
  campo('cats').innerHTML =
    '<button class="cat cat-tudo" data-cat="" aria-pressed="true">TUDO</button>' +
    CATEGORIAS.map(c=>
      '<button class="cat" data-cat="'+c.id+'" aria-pressed="false"><span class="cat-ponto" aria-hidden="true"></span><span>'+escapa(c.nome)+'</span></button>'
    ).join('');
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

function iniciaisCard(nome){
  return String(nome||'?').trim().split(/\s+/).slice(0,2).map(x=>x.charAt(0).toUpperCase()).join('') || '?';
}

function dataLista(d){
  return d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}).replace('.', '');
}

async function carregarMeusVinculos(){
  favoritos.clear(); interesses.clear();
  if(!Sessao.logado()) return;
  const [fav, itr] = await Promise.all([
    db.from('favoritos').select('evento_id').eq('usuario_id', meuId()),
    db.from('interesses').select('evento_id').eq('usuario_id', meuId())
  ]);
  if(fav.error) console.error(fav.error); else (fav.data||[]).forEach(x=>favoritos.add(x.evento_id));
  if(itr.error) console.error(itr.error); else (itr.data||[]).forEach(x=>interesses.add(x.evento_id));
}

function mostrarExclusaoPendente(){
  if(!Sessao.logado() || !Sessao.perfil || !Sessao.perfil.exclusao_prevista) return false;
  const prazo = new Date(Sessao.perfil.exclusao_prevista);
  campo('prazoExclusao').textContent = prazo.toLocaleString('pt-BR');
  fecharTudo();
  abrir('modalReativar');
  return true;
}

window.aoMudarSessao = async function(){
  // Visitantes podem navegar e ver eventos, mas só usuários logados podem publicar.
  campo('btnCriar').hidden = !Sessao.logado();
  if(campo('btnCadastroTopo')) campo('btnCadastroTopo').hidden = Sessao.logado();
  if(mostrarExclusaoPendente()){
    acompanharNotificacoes();
    return;
  }

  carregarNotificacoes();
  acompanharNotificacoes();
  await carregarMeusVinculos();
  if(!Sessao.logado() && estado.aba!=='todos'){
    estado.aba='todos';
    document.querySelectorAll('.aba').forEach(x=>x.setAttribute('aria-pressed', String(x.dataset.aba==='todos')));
    campo('tituloLista').textContent='Próximos eventos';
  }
  await atualizarConsultaAtual();

  // V16: quando o usuário veio da página de perfil para publicar,
  // abre o formulário real depois que a sessão estiver pronta.
  const parametros = new URLSearchParams(location.search);
  if(Sessao.logado() && parametros.get('criar') === '1'){
    parametros.delete('criar');
    const novaBusca = parametros.toString();
    history.replaceState({}, '', location.pathname + (novaBusca ? '?' + novaBusca : '') + location.hash);
    setTimeout(()=>{
      if(campo('btnCriar')) campo('btnCriar').click();
    }, 80);
  }
};

/* ============================================================
   ETAPA 5 — CONSULTA, FILTROS E PAGINAÇÃO NO BANCO
   ============================================================ */
function buscaSegura(){
  return estado.busca.replace(/[,%()]/g,' ').replace(/\s+/g,' ').trim();
}

function datasFimDeSemana(){
  const r=[];
  for(let i=0;i<=7;i++){
    const d=new Date(hoje); d.setDate(d.getDate()+i);
    if(d.getDay()===0 || d.getDay()===6) r.push(dataISO(d));
  }
  return r;
}

function aplicarFiltros(query, opcoes={}){
  const modo = opcoes.modo || 'lista';
  let q = query.eq('ativo', true);

  if(modo==='calendario'){
    q = q.gte('data_evento', opcoes.inicio).lte('data_evento', opcoes.fim);
  }else{
    q = q.gte('data_evento', dataISO(hoje));
  }

  if(estado.cat) q = q.eq('categoria_id', estado.cat);
  if(estado.atalhos.has('gratis')) q = q.eq('gratuito', true);

  const termo = buscaSegura();
  if(termo) q = q.or('nome.ilike.%'+termo+'%,descricao.ilike.%'+termo+'%');

  if(estado.atalhos.has('hoje')){
    q = q.eq('data_evento', dataISO(hoje));
  }
  if(estado.atalhos.has('semana')){
    const fim = new Date(hoje); fim.setDate(fim.getDate()+7);
    q = q.gte('data_evento', dataISO(hoje)).lte('data_evento', dataISO(fim));
  }
  if(estado.atalhos.has('fds')){
    const datas = datasFimDeSemana();
    if(!datas.length) return { query:q, vazio:true };
    q = q.in('data_evento', datas);
  }

  if(estado.aba==='meus'){
    if(!meuId()) return { query:q, vazio:true };
    q = q.eq('criador_id', meuId());
  }
  if(estado.aba==='favoritos'){
    const ids=[...favoritos];
    if(!ids.length) return { query:q, vazio:true };
    q = q.in('id', ids);
  }
  if(estado.aba==='interesse'){
    const ids=[...interesses];
    if(!ids.length) return { query:q, vazio:true };
    q = q.in('id', ids);
  }
  return { query:q, vazio:false };
}

function esqueletos(){
  campo('grade').innerHTML='<div class="esqueleto"></div>'.repeat(6);
  campo('contagem').textContent='carregando...';
}

async function carregarEventos({append=false,silencioso=false}={}){
  if(!append){ estado.pagina=0; if(!silencioso) esqueletos(); }
  const base = db.from('eventos_lista').select('*',{count:'exact'});
  const aplicado = aplicarFiltros(base,{modo:'lista'});

  if(aplicado.vazio){
    EVENTOS=[]; estado.total=0; renderMural(); return;
  }

  const inicio = estado.pagina * POR_PAGINA;
  const fim = inicio + POR_PAGINA - 1;
  const { data, error, count } = await aplicado.query
    .order('data_evento',{ascending:true})
    .order('hora_evento',{ascending:true})
    .range(inicio,fim);

  if(error){
    campo('grade').innerHTML='<div class="erro-box"><strong>Não deu para carregar</strong>'+escapa(error.message)+'</div>';
    campo('contagem').textContent='erro';
    return;
  }

  estado.total = count || 0;
  EVENTOS = append ? EVENTOS.concat(data||[]) : (data||[]);
  renderMural();
}

function renderMural(novoId){
  const grade=campo('grade');
  campo('contagem').textContent = estado.total + (estado.total===1?' EVENTO ENCONTRADO':' EVENTOS ENCONTRADOS');
  campo('btnMais').hidden = EVENTOS.length >= estado.total;

  if(!EVENTOS.length){
    grade.innerHTML='<div class="vazio"><strong>Nada por aqui ainda</strong>'+
      (estado.aba==='meus'?'Você ainda não publicou nenhum evento.':'Tente limpar os filtros ou buscar por outro nome.')+'</div>';
    return;
  }

  grade.innerHTML=EVENTOS.map((ev,indice)=>{
    const d=dataDe(ev);
    const dia=String(d.getDate()).padStart(2,'0');
    const mes=d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase();
    const img=imagemFallback(ev);
    const nomeOrganizador=ev.criador_nome||'Organizador';
    const interesse=interesses.has(ev.id);
    const fav=favoritos.has(ev.id);
    const situacao=(ev.situacao && ev.situacao!=='agendado')
      ? '<span class="situacao-evento situacao-'+escapa(ev.situacao)+'">'+escapa(situacaoEvento(ev))+'</span>' : '';

    return '<article class="evento-card'+(ev.id===novoId?' novo':'')+'" data-ev="'+ev.id+'" role="button" tabindex="0" aria-label="Abrir evento '+escapa(ev.nome)+'">'+
      '<div class="evento-media">'+
        '<img class="capa" src="'+escapa(img)+'" alt="'+escapa(ev.nome)+'" loading="'+(indice<3?'eager':'lazy')+'">'+
        '<span class="data-bloco"><strong>'+dia+'</strong><small>'+mes+'</small></span>'+
        '<span class="preco-badge '+(ev.gratuito?'gratis':'')+'">'+(ev.gratuito?'GRÁTIS':'R$ '+Number(ev.valor||0).toFixed(2).replace('.',','))+'</span>'+
      '</div>'+
      '<div class="evento-conteudo">'+
        '<div class="evento-tags"><span class="tag categoria-pill" data-cat="'+escapa(ev.categoria_id)+'"><i aria-hidden="true"></i>'+escapa(ev.categoria_nome||'Evento')+'</span>'+situacao+'</div>'+
        '<h3>'+escapa(ev.nome)+'</h3>'+
        '<ul class="evento-meta">'+
          '<li><span aria-hidden="true">▣</span> '+escapa(dataLista(d))+' <span class="meta-sep">◷</span> '+escapa(hora(ev))+'</li>'+
          '<li><span aria-hidden="true">⌖</span> '+escapa([ev.bairro,ev.cidade].filter(Boolean).join(', '))+'</li>'+
          '<li><span aria-hidden="true">♙</span> '+(ev.total_interessados||0)+' pessoas com interesse</li>'+
        '</ul>'+
        '<div class="evento-rodape">'+
          '<button type="button" class="organizador-card" data-perfil-publico="'+escapa(ev.criador_id)+'" aria-label="Ver perfil de '+escapa(nomeOrganizador)+'">'+
            (ev.criador_foto
              ? '<span class="avatar-card avatar-foto"><img src="'+escapa(ev.criador_foto)+'" alt=""></span>'
              : '<span class="avatar-card">'+escapa(iniciaisCard(nomeOrganizador))+'</span>'
            )+'<span>'+escapa(nomeOrganizador)+'</span>'+
          '</button>'+
          '<div class="evento-acoes">'+
            '<button class="fav-card" data-fav="'+ev.id+'" type="button" aria-label="'+(fav?'Remover dos favoritos':'Adicionar aos favoritos')+'" aria-pressed="'+(fav?'true':'false')+'">'+(fav?'★':'☆')+'</button>'+
            '<button class="interesse-card '+(interesse?'ativo':'')+'" data-interesse="'+ev.id+'" type="button" aria-pressed="'+(interesse?'true':'false')+'">'+(interesse?'Tenho interesse':'Marcar interesse')+'</button>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</article>';
  }).join('');
}
window.render=renderMural;

async function atualizarConsultaAtual(){
  await carregarEventos({silencioso:true});
  if(estado.visualizacao==='mapa') await carregarMapa();
  if(estado.visualizacao==='calendario') await carregarCalendario();
}

async function filtrosMudaram(){
  await carregarEventos();
  if(estado.visualizacao==='mapa') await carregarMapa();
  if(estado.visualizacao==='calendario') await carregarCalendario();
}

campo('btnMais').addEventListener('click', async e=>{
  e.currentTarget.disabled=true;
  estado.pagina++;
  await carregarEventos({append:true,silencioso:true});
  e.currentTarget.disabled=false;
});

/* ============================================================
   DETALHE DO EVENTO
   ============================================================ */
function dataDetalhe(d){
  return d.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
}

async function hidratarOrganizadorDetalhe(id){
  const caixa=campo('detalheOrganizador');
  if(!caixa || !id) return;
  const {data,error}=await db.rpc('perfil_publico',{p_usuario:id});
  const p=Array.isArray(data)?data[0]:data;
  if(error || !p) return;
  caixa.innerHTML=
    '<p class="detalhe-label">ORGANIZADOR</p>'+ 
    '<button class="detalhe-organizador-perfil" data-perfil-publico="'+escapa(p.id)+'">'+
      (p.foto_url?'<span class="detalhe-organizador-avatar"><img src="'+escapa(p.foto_url)+'" alt=""></span>':'<span class="detalhe-organizador-avatar">'+escapa(iniciaisCard(p.nome))+'</span>')+
      '<span><strong>'+escapa(p.nome)+'</strong><small>'+Number(p.total_eventos||0)+' eventos no mural</small></span>'+ 
    '</button>'+ 
    (p.contato?'<p class="detalhe-contato">Contato: '+escapa(p.contato)+'</p>':'');
}

function montarDetalhe(ev){
  detalheAtual=ev;
  const d=dataDe(ev), temInteresse=interesses.has(ev.id), souDono=ev.criador_id===meuId();
  const encerrado=eventoEncerrado(ev);
  const folha=campo('folhaDetalhe');
  const endereco=[escapa(enderecoCompleto(ev)),escapa([ev.bairro,ev.cidade].filter(Boolean).join(', '))].filter(Boolean).join('<br>');
  const capacidade=ev.max_participantes ? ' · '+ev.max_participantes+' vagas' : '';
  const imagem=imagemFallback(ev);
  const situacao='<span class="tag categoria-pill" data-cat="'+escapa(ev.categoria_id)+'"><i aria-hidden="true"></i>'+escapa(ev.categoria_nome||'Evento')+'</span>'+
    '<span class="situacao-evento situacao-'+escapa(ev.situacao||'agendado')+'">'+escapa(situacaoEvento(ev))+'</span>';
  const avisoSituacao = ev.situacao==='cancelado' ? 'Este evento foi cancelado pelo organizador.' :
    ev.situacao==='adiado' ? 'Este evento está marcado como adiado. Confira a nova data com o organizador.' :
    ev.situacao==='esgotado' ? 'Este evento está esgotado no momento.' :
    ev.situacao==='finalizado' ? 'Este evento já foi finalizado.' : '';

  folha.style.setProperty('--cor',cor(ev));
  folha.innerHTML=
    '<div class="detalhe-modal-cabecalho">'+
      '<h2>'+escapa(ev.nome)+'</h2>'+
      '<button class="fechar" data-fecha aria-label="Fechar">×</button>'+
    '</div>'+
    '<div class="detalhe-modal-scroll">'+
      '<div class="detalhe-lovable-grid">'+
        '<div class="detalhe-coluna-principal">'+
          '<img class="detalhe-imagem" src="'+escapa(imagem)+'" alt="'+escapa(ev.nome)+'">'+
          '<div class="detalhe-tags">'+situacao+(souDono?'<span class="dono">SEU EVENTO</span>':'')+'</div>'+ 
          (avisoSituacao?'<div class="alerta-evento">'+escapa(avisoSituacao)+'</div>':'')+
          '<p class="detalhe-descricao">'+escapa(ev.descricao||'Sem descrição.')+'</p>'+ 
          '<div id="areaComentarios" class="comentarios detalhe-comentarios"></div>'+ 
        '</div>'+ 
        '<aside class="detalhe-coluna-lateral">'+
          '<div class="detalhe-info-card">'+
            '<div class="detalhe-info-item"><span class="detalhe-icone">▣</span><span>'+escapa(dataDetalhe(d))+'</span></div>'+ 
            '<div class="detalhe-info-item"><span class="detalhe-icone">◷</span><span>'+escapa(hora(ev))+'</span></div>'+ 
            '<div class="detalhe-info-item"><span class="detalhe-icone">⌖</span><span>'+endereco+'</span></div>'+ 
            '<div class="detalhe-info-item"><span class="detalhe-icone">▧</span><span>'+(ev.gratuito?'Grátis':'R$ '+Number(ev.valor||0).toFixed(2).replace('.',','))+'</span></div>'+ 
            '<div class="detalhe-info-item"><span class="detalhe-icone">♙</span><span>'+(ev.total_interessados||0)+' interessados'+capacidade+'</span></div>'+ 
          '</div>'+ 
          '<div class="detalhe-organizador-card" id="detalheOrganizador">'+
            '<p class="detalhe-label">ORGANIZADOR</p>'+ 
            '<button class="detalhe-organizador-perfil" data-perfil-publico="'+escapa(ev.criador_id)+'">'+
              '<span class="detalhe-organizador-avatar">'+escapa(iniciaisCard(ev.criador_nome||'Organizador'))+'</span>'+ 
              '<span><strong>'+escapa(ev.criador_nome||'Organizador')+'</strong><small>carregando perfil...</small></span>'+ 
            '</button>'+ 
          '</div>'+ 
        '</aside>'+ 
      '</div>'+ 
    '</div>'+ 
    '<div class="detalhe-rodape-fixo">'+
      '<div class="detalhe-rodape-esquerda">'+
        ((ev.latitude!=null && ev.longitude!=null)?'<button class="btn-linha detalhe-acao-secundaria" data-ver-mapa="'+ev.id+'">⌖ Ver no mapa</button>':'')+
        (souDono?'<button class="btn-linha detalhe-acao-secundaria" data-editar="'+ev.id+'">Editar</button><button class="btn-linha detalhe-acao-secundaria" data-excluir="'+ev.id+'">Excluir</button>':'')+
      '</div>'+ 
      '<div class="detalhe-rodape-direita">'+
        (!souDono?'<button class="btn-linha" data-denunciar data-denuncia-tipo="evento" data-denuncia-id="'+ev.id+'" data-denuncia-rotulo="'+escapa(ev.nome)+'">⚑ Denunciar</button>':'')+
        '<button class="btn-escuro" data-interesse="'+ev.id+'"'+(encerrado?' disabled':'')+'>'+(temInteresse?'☆ Tenho interesse':'☆ Tenho interesse')+'</button>'+ 
      '</div>'+ 
    '</div>';
  abrir('modalDetalhe');
  carregarComentarios(ev.id);
  hidratarOrganizadorDetalhe(ev.criador_id);
}

async function abrirDetalhe(id){
  let ev=EVENTOS.find(x=>x.id===id);
  if(!ev){
    const {data,error}=await db.from('eventos_lista').select('*').eq('id',id).single();
    if(error){ avisar('Não foi possível abrir este evento'); return; }
    ev=data;
  }
  montarDetalhe(ev);
}

/* ============================================================
   ETAPA 8 — MAPA DOS EVENTOS
   ============================================================ */
/* junta rua, número e complemento numa linha só */
function enderecoCompleto(ev){
  if(!ev.endereco && !ev.numero) return 'Endereço não informado';
  const rua = [ev.endereco, ev.numero].filter(Boolean).join(', ');
  return ev.complemento ? rua + ' — ' + ev.complemento : rua;
}

let mapaEventos=null, camadaMarcadores=null, eventosMapa=[];
let mapaFormulario=null, marcadorFormulario=null;
let eventoMapaSelecionadoId=null;
const marcadoresMapa=new Map();

/* Leaflet mede o container no momento em que o mapa nasce. Se ele
   estiver escondido (hidden) ou o layout ainda não tiver acontecido,
   a medida sai errada e os tiles ficam desalinhados. invalidateSize()
   remede e redesenha — chamamos algumas vezes para pegar o layout
   já estabilizado. */
function conferirCssDoMapa(elemento){
  const posicao = getComputedStyle(elemento).position;
  if(posicao === 'static'){
    avisar('O estilo do mapa não carregou. Verifique sua conexão e recarregue a página.');
    console.error('leaflet.css não foi aplicado — o mapa vai aparecer quebrado.');
    return false;
  }
  return true;
}

function ajustarMapa(mapa){
  if(!mapa) return;
  [0, 150, 400].forEach(ms => setTimeout(()=>mapa.invalidateSize(), ms));
}
window.addEventListener('resize', ()=>{
  if(mapaEventos) mapaEventos.invalidateSize();
  if(mapaFormulario) mapaFormulario.invalidateSize();
});

function dataMapa(ev){
  const d=dataDe(ev);
  return d.getDate()+' de '+d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toLowerCase();
}

function precoMapa(ev){
  return ev.gratuito ? 'Grátis' : 'R$ '+Number(ev.valor||0).toFixed(2).replace('.',',');
}

function classeCategoriaMapa(ev){
  return 'mapa-cat-'+String(ev.categoria_id||'outros').replace(/[^a-z0-9_-]/gi,'');
}

function iconeMapa(ev,selecionado=false){
  return L.divIcon({
    className:'role-map-divicon',
    html:'<span class="mapa-pino '+classeCategoriaMapa(ev)+(selecionado?' selecionado':'')+'"><i aria-hidden="true"></i>'+escapa(dataMapa(ev))+'</span>',
    iconSize:[112,30],
    iconAnchor:[56,28]
  });
}

function criarMapaEventos(){
  if(mapaEventos || !window.L) return;
  mapaEventos=L.map('mapaEventos',{zoomControl:false,attributionControl:true}).setView([-23.5505,-46.6333],11);
  L.control.zoom({position:'bottomright'}).addTo(mapaEventos);
  /* V18: usamos os tiles padrão do OpenStreetMap, que não exigem
     chave de API. O aspecto escuro é aplicado só por CSS na camada
     de tiles, mantendo os marcadores e controles com suas cores reais. */
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    subdomains:'abc',
    maxZoom:19,
    attribution:'&copy; OpenStreetMap contributors'
  }).addTo(mapaEventos);
  camadaMarcadores=L.layerGroup().addTo(mapaEventos);
  conferirCssDoMapa(campo('mapaEventos'));
  ajustarMapa(mapaEventos);
}

function renderPainelMapa(){
  const selecionado=eventosMapa.find(ev=>ev.id===eventoMapaSelecionadoId) || eventosMapa[0] || null;
  if(selecionado) eventoMapaSelecionadoId=selecionado.id;

  const areaSelecionado=campo('mapaSelecionado');
  const lista=campo('mapaLista');
  if(!areaSelecionado || !lista) return;

  if(!selecionado){
    areaSelecionado.innerHTML='<div class="mapa-vazio-lateral"><strong>Nenhum evento localizado</strong><span>Os eventos precisam ter um ponto marcado para aparecer no mapa.</span></div>';
    lista.innerHTML='';
    return;
  }

  const img=imagemFallback(selecionado);
  areaSelecionado.innerHTML=
    '<article class="mapa-card-destaque">'+
      '<img src="'+escapa(img)+'" alt="'+escapa(selecionado.nome)+'" loading="lazy">'+
      '<div class="mapa-card-corpo">'+
        '<span class="tag categoria-pill" data-cat="'+escapa(selecionado.categoria_id)+'"><i aria-hidden="true"></i>'+escapa(selecionado.categoria_nome||'Evento')+'</span>'+
        '<h3>'+escapa(selecionado.nome)+'</h3>'+
        '<p class="mapa-endereco"><span aria-hidden="true">⌖</span> '+escapa(enderecoCompleto(selecionado))+' — '+escapa([selecionado.bairro,selecionado.cidade].filter(Boolean).join(', '))+'</p>'+
        '<p class="mapa-quando">'+escapa(dataMapa(selecionado))+' · '+escapa(hora(selecionado))+' · '+escapa(precoMapa(selecionado))+'</p>'+
        '<button type="button" class="btn-escuro mapa-ver-evento" data-mapa-abrir="'+selecionado.id+'">Ver evento</button>'+
      '</div>'+
    '</article>';

  lista.innerHTML=eventosMapa.map(ev=>
    '<button type="button" class="mapa-lista-item'+(ev.id===selecionado.id?' ativo':'')+'" data-mapa-selecionar="'+ev.id+'">'+
      '<i class="mapa-lista-ponto '+classeCategoriaMapa(ev)+'" aria-hidden="true"></i>'+
      '<span><strong>'+escapa(ev.nome)+'</strong><small>'+escapa((ev.bairro||ev.cidade||'Local'))+' · '+escapa(dataMapa(ev))+'</small></span>'+
    '</button>'
  ).join('');

  marcadoresMapa.forEach((marcador,id)=>{
    const ev=eventosMapa.find(x=>x.id===id);
    if(ev) marcador.setIcon(iconeMapa(ev,id===selecionado.id));
  });
}

function selecionarEventoMapa(id,{centralizar=true}={}){
  const ev=eventosMapa.find(x=>x.id===id);
  if(!ev) return;
  eventoMapaSelecionadoId=id;
  renderPainelMapa();
  const marcador=marcadoresMapa.get(id);
  if(centralizar && marcador && mapaEventos){
    mapaEventos.panTo(marcador.getLatLng(),{animate:true,duration:.35});
  }
}

async function carregarMapa(focoId=null){
  criarMapaEventos();
  if(!mapaEventos) return;
  camadaMarcadores.clearLayers();
  marcadoresMapa.clear();
  campo('mapaStatus').textContent='Carregando eventos localizados...';

  const base=db.from('eventos_lista').select('*').not('latitude','is',null).not('longitude','is',null);
  const aplicado=aplicarFiltros(base,{modo:'mapa'});
  if(aplicado.vazio){
    eventosMapa=[];
    eventoMapaSelecionadoId=null;
    campo('mapaStatus').textContent='Nenhum evento deste filtro tem localização marcada.';
    renderPainelMapa();
    return;
  }

  const {data,error}=await aplicado.query.order('data_evento',{ascending:true}).order('hora_evento',{ascending:true}).limit(200);
  if(error){
    campo('mapaStatus').textContent='Erro ao carregar mapa: '+error.message;
    eventosMapa=[];
    eventoMapaSelecionadoId=null;
    renderPainelMapa();
    return;
  }
  eventosMapa=(data||[]).filter(ev=>Number.isFinite(Number(ev.latitude))&&Number.isFinite(Number(ev.longitude)));

  const pontos=[];
  eventosMapa.forEach(ev=>{
    const lat=Number(ev.latitude), lng=Number(ev.longitude);
    const m=L.marker([lat,lng],{icon:iconeMapa(ev,ev.id===focoId)}).addTo(camadaMarcadores);
    m.on('click',()=>selecionarEventoMapa(ev.id,{centralizar:false}));
    marcadoresMapa.set(ev.id,m);
    pontos.push([lat,lng]);
  });

  const primeiroId=(focoId && eventosMapa.some(x=>x.id===focoId)) ? focoId :
    (eventoMapaSelecionadoId && eventosMapa.some(x=>x.id===eventoMapaSelecionadoId) ? eventoMapaSelecionadoId : eventosMapa[0]?.id);
  eventoMapaSelecionadoId=primeiroId||null;
  renderPainelMapa();

  campo('mapaStatus').textContent=eventosMapa.length+
    (eventosMapa.length===1?' evento localizado.':' eventos localizados. Eventos sem ponto marcado continuam no mural.');

  ajustarMapa(mapaEventos);
  setTimeout(()=>{
    mapaEventos.invalidateSize();
    const foco=eventoMapaSelecionadoId && marcadoresMapa.get(eventoMapaSelecionadoId);
    if(focoId && foco){ mapaEventos.setView(foco.getLatLng(),15); }
    else if(pontos.length===1) mapaEventos.setView(pontos[0],15);
    else if(pontos.length>1) mapaEventos.fitBounds(pontos,{padding:[42,42],maxZoom:14});
  },60);
}

campo('viewMapa').addEventListener('click',async e=>{
  const sel=e.target.closest('[data-mapa-selecionar]');
  if(sel){ selecionarEventoMapa(sel.dataset.mapaSelecionar); return; }
  const abrirEv=e.target.closest('[data-mapa-abrir]');
  if(abrirEv){
    const ev=eventosMapa.find(x=>x.id===abrirEv.dataset.mapaAbrir);
    if(ev) montarDetalhe(ev);
  }
});

function criarMapaFormulario(){
  if(mapaFormulario || !window.L) return;
  mapaFormulario=L.map('mapaFormulario').setView([-14.235,-51.925],4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,
    attribution:'&copy; OpenStreetMap contributors'
  }).addTo(mapaFormulario);
  mapaFormulario.on('click',e=>definirPontoFormulario(e.latlng.lat,e.latlng.lng,true));
  conferirCssDoMapa(campo('mapaFormulario'));
  ajustarMapa(mapaFormulario);
}

function definirPontoFormulario(lat,lng,centralizar=false){
  criarMapaFormulario();
  campo('f_lat').value=Number(lat).toFixed(7);
  campo('f_lng').value=Number(lng).toFixed(7);
  if(marcadorFormulario) marcadorFormulario.setLatLng([lat,lng]);
  else marcadorFormulario=L.marker([lat,lng]).addTo(mapaFormulario);
  campo('localizacaoStatus').textContent='Ponto marcado: '+Number(lat).toFixed(5)+', '+Number(lng).toFixed(5);
  if(centralizar) mapaFormulario.setView([lat,lng],16);
}

function limparPontoFormulario(){
  campo('f_lat').value=''; campo('f_lng').value='';
  campo('localizacaoStatus').textContent='Nenhum ponto marcado.';
  if(marcadorFormulario){ mapaFormulario.removeLayer(marcadorFormulario); marcadorFormulario=null; }
}

function prepararMapaFormulario(){
  criarMapaFormulario();
  ajustarMapa(mapaFormulario);
  setTimeout(()=>{
    mapaFormulario.invalidateSize();
    const lat=Number(campo('f_lat').value), lng=Number(campo('f_lng').value);
    if(Number.isFinite(lat)&&Number.isFinite(lng)&&campo('f_lat').value&&campo('f_lng').value) definirPontoFormulario(lat,lng,true);
  },80);
}

/* transforma endereço escrito em coordenadas (Nominatim/OpenStreetMap) */
async function consultarNominatim(parametros){
  const url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&'+parametros;
  const resp=await fetch(url,{headers:{'Accept-Language':'pt-BR'}});
  if(!resp.ok) throw new Error('serviço indisponível');
  const dados=await resp.json();
  return dados.length ? dados[0] : null;
}

/* Converte o endereço escrito em coordenadas.

   Tenta em três níveis, do mais preciso para o mais genérico:
     1. consulta estruturada com número + rua + CEP  -> porta exata
     2. mesma consulta sem o CEP
     3. texto livre sem o número                     -> cai na rua
   O primeiro que responder vence. */
async function geocodificarEndereco({silencioso=false}={}){
  const rua    = campo('f_end').value.trim();
  const numero = campo('f_numero').value.trim();
  const bairro = campo('f_bairro').value.trim();
  const cidade = campo('f_cidade').value.trim();
  const cep    = soDigitos(campo('f_cep').value);

  if(!cidade){
    if(!silencioso) avisar('Informe pelo menos a cidade antes de buscar o endereço');
    return false;
  }

  // Nominatim espera o número ANTES do nome da rua no campo street
  const street = [numero, rua].filter(Boolean).join(' ');

  const tentativas = [];
  if(street && cep.length===8)
    tentativas.push('street='+encodeURIComponent(street)+'&city='+encodeURIComponent(cidade)+'&postalcode='+encodeURIComponent(cep));
  if(street)
    tentativas.push('street='+encodeURIComponent(street)+'&city='+encodeURIComponent(cidade));
  tentativas.push('q='+encodeURIComponent([rua,bairro,cidade,'Brasil'].filter(Boolean).join(', ')));

  try{
    for(const parametros of tentativas){
      const achado = await consultarNominatim(parametros);
      if(achado){
        definirPontoFormulario(Number(achado.lat),Number(achado.lon),true);
        const exato = parametros.startsWith('street=') && numero;
        campo('localizacaoStatus').textContent = exato
          ? 'Ponto no número '+numero+'. Confira no mapa e ajuste clicando, se precisar.'
          : 'Ponto aproximado na rua. Clique no mapa para marcar o local exato.';
        if(!silencioso) avisar(exato ? 'Endereço localizado' : 'Achei a rua, mas não o número exato');
        return true;
      }
    }
    if(!silencioso) avisar('Não encontrei esse endereço. Clique no mapa para marcar manualmente.');
    return false;
  }catch(err){
    if(!silencioso) avisar('Não consegui buscar o endereço. Você pode clicar no mapa para marcar o ponto.');
    return false;
  }
}

campo('btnGeocodificar').addEventListener('click',async e=>{
  const btn=e.currentTarget; btn.disabled=true; btn.textContent='Procurando...';
  await geocodificarEndereco();
  btn.disabled=false; btn.textContent='Encontrar endereço';
});

/* ------------------------------------------------------------
   BUSCA POR CEP (ViaCEP)
   O usuário digita o CEP e o resto se preenche sozinho:
   rua, bairro e cidade vêm dos Correios; em seguida o endereço
   é convertido em coordenadas e o ponto aparece no mapa.
   ------------------------------------------------------------ */
const soDigitos = t => (t||'').replace(/\D/g,'');

function formatarCep(v){
  const d = soDigitos(v).slice(0,8);
  return d.length > 5 ? d.slice(0,5)+'-'+d.slice(5) : d;
}

async function buscarCep({automatico=false}={}){
  const cep = soDigitos(campo('f_cep').value);
  const aviso = campo('cepStatus');

  if(cep.length !== 8){
    if(!automatico) avisar('O CEP precisa ter 8 números');
    return;
  }

  aviso.textContent = 'Procurando CEP...';
  try{
    const resp = await fetch('https://viacep.com.br/ws/'+cep+'/json/');
    if(!resp.ok) throw new Error('serviço indisponível');
    const d = await resp.json();

    if(d.erro){ aviso.textContent = 'CEP não encontrado. Preencha o endereço à mão.'; return; }

    if(d.logradouro) campo('f_end').value    = d.logradouro;
    if(d.bairro)     campo('f_bairro').value = d.bairro;
    if(d.localidade) campo('f_cidade').value = d.localidade;

    aviso.textContent = 'Encontrado: ' + [d.logradouro, d.bairro, d.localidade, d.uf].filter(Boolean).join(', ');

    // com o endereço preenchido, já marca o ponto no mapa
    const achou = await geocodificarEndereco({silencioso:true});
    if(!achou) aviso.textContent += ' · confira o número e clique em "Encontrar endereço"';
    if(!campo('f_numero').value) campo('f_numero').focus();   // só falta o número
  }catch(err){
    aviso.textContent = 'Não consegui consultar o CEP agora. Preencha o endereço à mão.';
  }
}

campo('f_cep').addEventListener('input', e=>{
  e.target.value = formatarCep(e.target.value);
  if(soDigitos(e.target.value).length === 8) buscarCep({automatico:true});   // busca sozinho ao completar
});
campo('btnBuscarCep').addEventListener('click', ()=>buscarCep());

/* ao sair do campo número, reposiciona o ponto na porta certa */
let numeroAnterior='';
campo('f_numero').addEventListener('change', async ()=>{
  const n = campo('f_numero').value.trim();
  if(!n || n===numeroAnterior) return;
  numeroAnterior = n;
  if(campo('f_end').value.trim() && campo('f_cidade').value.trim()){
    await geocodificarEndereco({silencioso:true});
  }
});

campo('btnMinhaLocalizacao').addEventListener('click',e=>{
  if(!navigator.geolocation){ avisar('Este navegador não oferece localização'); return; }
  const btn=e.currentTarget; btn.disabled=true; btn.textContent='Localizando...';
  navigator.geolocation.getCurrentPosition(pos=>{
    definirPontoFormulario(pos.coords.latitude,pos.coords.longitude,true);
    btn.disabled=false; btn.textContent='Usar minha localização';
  },()=>{
    avisar('O navegador não liberou sua localização');
    btn.disabled=false; btn.textContent='Usar minha localização';
  },{enableHighAccuracy:true,timeout:10000});
});

campo('btnLimparLocalizacao').addEventListener('click',limparPontoFormulario);

/* ============================================================
   ETAPA 8 — CALENDÁRIO
   ============================================================ */
function fimDoMes(d){ return new Date(d.getFullYear(),d.getMonth()+1,0); }
function mesmaData(a,b){ return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }

async function carregarCalendario(){
  const mes=estado.mesCalendario;
  const inicio=new Date(mes.getFullYear(),mes.getMonth(),1);
  const fim=fimDoMes(mes);
  campo('calTitulo').textContent=mes.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  campo('calendarioGrade').innerHTML='<div class="cal-vazio">Carregando calendário...</div>';

  const base=db.from('eventos_lista').select('*');
  const aplicado=aplicarFiltros(base,{modo:'calendario',inicio:dataISO(inicio),fim:dataISO(fim)});
  if(aplicado.vazio){ renderCalendario([]); return; }
  const {data,error}=await aplicado.query.order('data_evento',{ascending:true}).order('hora_evento',{ascending:true}).limit(500);
  if(error){ campo('calendarioGrade').innerHTML='<div class="cal-vazio">Erro: '+escapa(error.message)+'</div>'; return; }
  renderCalendario(data||[]);
}

function renderCalendario(eventos){
  const mes=estado.mesCalendario;
  const primeiro=new Date(mes.getFullYear(),mes.getMonth(),1);
  const deslocamento=(primeiro.getDay()+6)%7; // segunda = 0
  const dias=fimDoMes(mes).getDate();
  const porDia=new Map();
  eventos.forEach(ev=>{
    const d=dataDe(ev);
    if(d.getMonth()!==mes.getMonth() || d.getFullYear()!==mes.getFullYear()) return;
    const chave=d.getDate();
    if(!porDia.has(chave)) porDia.set(chave,[]);
    porDia.get(chave).push(ev);
  });

  let html='';
  /* No protótipo Lovable os dias anteriores e posteriores ao mês não
     viram células desenhadas: ficam apenas como espaço vazio. */
  for(let i=0;i<deslocamento;i++) html+='<div class="cal-espaco" aria-hidden="true"></div>';

  for(let dia=1;dia<=dias;dia++){
    const d=new Date(mes.getFullYear(),mes.getMonth(),dia);
    const lista=porDia.get(dia)||[];
    html+='<div class="cal-dia'+(mesmaData(d,hoje)?' hoje':'')+'">'+
      '<div class="cal-num">'+dia+'</div>'+
      '<div class="cal-eventos-dia">'+
        lista.map(ev=>
          '<button class="cal-evento" data-cal-evento="'+ev.id+'" title="'+escapa(ev.nome)+'">'+
            '<i class="cal-cat-dot '+classeCategoriaMapa(ev)+'" aria-hidden="true"></i>'+
            '<span>'+escapa(ev.nome)+'</span>'+
          '</button>'
        ).join('')+
      '</div>'+
    '</div>';
  }
  campo('calendarioGrade').innerHTML=html;
}

campo('calAnterior').addEventListener('click',()=>{ estado.mesCalendario=new Date(estado.mesCalendario.getFullYear(),estado.mesCalendario.getMonth()-1,1); carregarCalendario(); });
campo('calProximo').addEventListener('click',()=>{ estado.mesCalendario=new Date(estado.mesCalendario.getFullYear(),estado.mesCalendario.getMonth()+1,1); carregarCalendario(); });
campo('calHoje').addEventListener('click',()=>{ estado.mesCalendario=new Date(hoje.getFullYear(),hoje.getMonth(),1); carregarCalendario(); });
campo('calendarioGrade').addEventListener('click',e=>{ const b=e.target.closest('[data-cal-evento]'); if(b) abrirDetalhe(b.dataset.calEvento); });

/* ============================================================
   TROCA DE VISUALIZAÇÃO
   ============================================================ */
async function mostrarVisualizacao(tipo,focoId=null){
  estado.visualizacao=tipo;
  document.querySelectorAll('.visao').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.visao===tipo)));
  campo('viewMural').hidden=tipo!=='mural';
  campo('viewMapa').hidden=tipo!=='mapa';
  campo('viewCalendario').hidden=tipo!=='calendario';
  // deixa o navegador aplicar o layout antes de o Leaflet medir o container
  if(tipo==='mapa'){
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    await carregarMapa(focoId);
  }
  if(tipo==='calendario') await carregarCalendario();
}

campo('visoes').addEventListener('click',e=>{ const b=e.target.closest('.visao'); if(b) mostrarVisualizacao(b.dataset.visao); });

/* ============================================================
   CONTROLES DE FILTRO
   ============================================================ */
campo('cats').addEventListener('click',async e=>{
  const b=e.target.closest('.cat'); if(!b) return;
  const valor=b.dataset.cat || null;
  estado.cat = valor===null ? null : (estado.cat===valor ? null : valor);
  document.querySelectorAll('.cat').forEach(x=>{
    const selecionada = x.dataset.cat==='' ? estado.cat===null : x.dataset.cat===estado.cat;
    x.setAttribute('aria-pressed',String(selecionada));
  });
  await filtrosMudaram();
});

document.querySelectorAll('.chip').forEach(ch=>ch.addEventListener('click',async()=>{
  const a=ch.dataset.atalho;
  estado.atalhos.has(a)?estado.atalhos.delete(a):estado.atalhos.add(a);
  ch.setAttribute('aria-pressed',String(estado.atalhos.has(a)));
  await filtrosMudaram();
}));

campo('abas').addEventListener('click',async e=>{
  const b=e.target.closest('.aba'); if(!b) return;
  if(b.dataset.aba!=='todos'&&!Sessao.logado()){ avisar('Entre na sua conta para usar esta aba'); abrir('modalLogin'); return; }
  estado.aba=b.dataset.aba;
  document.querySelectorAll('.aba').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.aba===estado.aba)));
  campo('tituloLista').textContent=({todos:'Próximos eventos',favoritos:'Meus favoritos',interesse:'Tenho interesse',meus:'Eventos que publiquei'})[estado.aba];
  await filtrosMudaram();
});

function executarBusca(){ estado.busca=campo('busca').value.trim(); filtrosMudaram(); }
campo('btnBuscar').addEventListener('click',executarBusca);
campo('busca').addEventListener('input',()=>{
  clearTimeout(buscaTimer);
  buscaTimer=setTimeout(executarBusca,450);
});

/* ============================================================
   CLIQUES DO MURAL / MODAIS
   ============================================================ */
campo('grade').addEventListener('click',async e=>{
  const f=e.target.closest('[data-fav]');
  if(f){ e.stopPropagation(); await alternarFav(f.dataset.fav); return; }
  const i=e.target.closest('[data-interesse]');
  if(i){ e.stopPropagation(); await alternarInteresse(i.dataset.interesse); return; }
  if(e.target.closest('[data-perfil-publico]')) return;
  const p=e.target.closest('[data-ev]'); if(p) abrirDetalhe(p.dataset.ev);
});

campo('grade').addEventListener('keydown',e=>{
  const p=e.target.closest('[data-ev]');
  if(!p || e.target.closest('button')) return;
  if(e.key==='Enter' || e.key===' '){ e.preventDefault(); abrirDetalhe(p.dataset.ev); }
});

document.addEventListener('click',async e=>{
  if(e.target.closest('[data-fecha]')||e.target.classList.contains('cortina')) fecharTudo();

  const i=e.target.closest('[data-interesse]'); if(i) await alternarInteresse(i.dataset.interesse);
  const fv=e.target.closest('.btn-linha[data-fav]'); if(fv){ await alternarFav(fv.dataset.fav); if(Sessao.logado()) await abrirDetalhe(fv.dataset.fav); }
  const ed=e.target.closest('[data-editar]'); if(ed) await abrirEdicao(ed.dataset.editar);
  const ex=e.target.closest('[data-excluir]'); if(ex) await excluirEvento(ex.dataset.excluir);

  const vm=e.target.closest('[data-ver-mapa]');
  if(vm){ fecharTudo(); await mostrarVisualizacao('mapa',vm.dataset.verMapa); }

  const dn=e.target.closest('[data-denunciar]');
  if(dn){
    abrirModalDenuncia(
      dn.dataset.denunciaTipo || 'evento',
      dn.dataset.denunciaId || dn.dataset.denunciar,
      dn.dataset.denunciaRotulo || 'conteúdo'
    );
    return;
  }

  const pp=e.target.closest('[data-perfil-publico]');
  if(pp){
    e.preventDefault();
    await abrirPerfilPublico(pp.dataset.perfilPublico);
    return;
  }

  if(e.target.closest('[data-ir-cadastro]')){ fecharTudo(); abrir('modalCadastro'); }
  if(e.target.closest('[data-ir-login]')){ fecharTudo(); abrir('modalLogin'); }
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape') fecharTudo(); });

function motivosParaDenuncia(tipo){
  const comuns=['Conteúdo ofensivo','Assédio ou ameaça','Spam ou propaganda','Golpe ou cobrança indevida','Outro'];
  if(tipo==='evento') return ['Informação falsa ou enganosa','Evento não existe','Categoria errada',...comuns];
  if(tipo==='comentario') return ['Informação falsa ou enganosa',...comuns];
  return ['Perfil falso ou se passando por outra pessoa',...comuns];
}

function abrirModalDenuncia(tipo,id,rotulo){
  if(!Sessao.logado()){ avisar('Entre na sua conta para denunciar'); fecharTudo(); abrir('modalLogin'); return; }
  denunciando={tipo,id,rotulo};
  campo('tituloDenuncia').textContent =
    tipo==='evento' ? 'Denunciar evento' : tipo==='comentario' ? 'Denunciar comentário' : 'Denunciar usuário';
  campo('alvoDenuncia').textContent='Você está denunciando: '+rotulo;
  campo('d_motivo').innerHTML=motivosParaDenuncia(tipo).map(x=>'<option>'+escapa(x)+'</option>').join('');
  campo('d_descricao').value='';
  campo('d_evidencia').value='';
  fecharTudo();
  abrir('modalDenuncia');
}

async function abrirPerfilPublico(id){
  const caixa=campo('perfilPublicoConteudo');
  fecharTudo();
  caixa.innerHTML='<div class="esqueleto" style="min-height:180px"></div>';