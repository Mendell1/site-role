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
  abrir('modalPerfilPublico');

  const {data,error}=await db.rpc('perfil_publico',{p_usuario:id});
  const p=Array.isArray(data)?data[0]:data;
  if(error || !p){
    caixa.innerHTML='<h3>Perfil indisponível</h3><p class="dica">Este perfil não está disponível publicamente.</p>';
    return;
  }

  const {data:eventosPerfil}=await db.from('eventos_lista')
    .select('id,nome,data_evento,hora_evento,cidade,situacao')
    .eq('criador_id',p.id)
    .gte('data_evento',dataISO(hoje))
    .order('data_evento',{ascending:true})
    .limit(6);

  caixa.innerHTML=
    '<div class="perfil-publico-cabecalho">'+
      avatarHtml(p.foto_url,p.nome,'avatar-grande')+
      '<div><h3>'+escapa(p.nome)+'</h3>'+
      (p.cidade?'<p class="dica">📍 '+escapa(p.cidade)+'</p>':'')+
      '<p class="dica">'+Number(p.total_eventos||0)+' evento(s) futuro(s)</p></div>'+
    '</div>'+
    (p.bio?'<p class="perfil-publico-bio">'+escapa(p.bio)+'</p>':'<p class="dica">Este usuário ainda não escreveu uma biografia.</p>')+
    (p.contato?'<div class="linha-info"><b>Contato público</b><span>'+escapa(p.contato)+'</span></div>':'')+
    '<h4 class="comentarios-titulo" style="margin-top:18px">Próximos eventos</h4>'+
    ((eventosPerfil||[]).length
      ? '<div class="perfil-eventos">'+eventosPerfil.map(ev=>
          '<button class="perfil-evento" data-abrir-evento="'+ev.id+'"><strong>'+escapa(ev.nome)+'</strong><span>'+fmt(dataDe(ev))+' · '+hora(ev)+' · '+escapa(ev.cidade||'')+'</span></button>'
        ).join('')+'</div>'
      : '<p class="dica">Nenhum evento futuro publicado.</p>')+
    (p.id!==meuId()
      ? '<div class="acoes" style="margin-top:18px"><button class="btn-linha" data-denunciar data-denuncia-tipo="usuario" data-denuncia-id="'+p.id+'" data-denuncia-rotulo="'+escapa(p.nome)+'">Denunciar usuário</button></div>'
      : '');
}

document.addEventListener('click',async e=>{
  const ae=e.target.closest('[data-abrir-evento]');
  if(ae){ fecharTudo(); await abrirDetalhe(ae.dataset.abrirEvento); }
});

/* ============================================================
   COMENTÁRIOS

   Quem apaga o quê é decidido pelo banco (políticas de RLS):
   o autor apaga o próprio, o dono do evento limpa a página dele
   e o administrador pode tudo. Aqui só escondemos os botões que
   a pessoa não usaria — a interface acompanha a regra, não a cria.
   ============================================================ */
let eventoComentado = null;

function iniciais(nome){ return (nome||'?').trim().charAt(0).toUpperCase(); }

function avatarHtml(foto, nome, classe){
  return foto
    ? '<span class="'+classe+'"><img src="'+escapa(foto)+'" alt=""></span>'
    : '<span class="'+classe+'">'+escapa(iniciais(nome))+'</span>';
}

function quandoFoi(iso){
  const minutos = Math.round((Date.now() - new Date(iso)) / 60000);
  if(minutos < 1)    return 'agora';
  if(minutos < 60)   return minutos + ' min';
  if(minutos < 1440) return Math.round(minutos/60) + ' h';
  const dias = Math.round(minutos/1440);
  if(dias < 30) return dias + (dias===1 ? ' dia' : ' dias');
  return new Date(iso).toLocaleDateString('pt-BR');
}

async function carregarComentarios(eventoId){
  eventoComentado = eventoId;
  const area = campo('areaComentarios');
  if(!area) return;
  area.innerHTML = '<div class="esqueleto" style="min-height:56px"></div>';

  const { data, error } = await db.from('comentarios_lista').select('*').eq('evento_id', eventoId).order('criado_em', { ascending:true });
  if(error){ area.innerHTML = '<p class="dica">Não foi possível carregar os comentários.</p>'; return; }

  const ev = detalheAtual && detalheAtual.id===eventoId ? detalheAtual : EVENTOS.find(x=>x.id===eventoId);
  const souDonoDoEvento = ev && ev.criador_id === meuId();

  const lista = data.map(c=>{
    const meu = c.autor_id === meuId();
    return '<article class="comentario comentario-card-lovable" data-comentario="'+c.id+'">' +
      avatarHtml(c.autor_foto, c.autor_nome, 'avatar-mini') +
      '<div class="comentario-corpo">' +
        '<div class="comentario-topo">' +
          '<button class="perfil-publico-link comentario-autor" data-perfil-publico="'+c.autor_id+'"><strong>'+escapa(c.autor_nome)+(meu?' (você)':'')+'</strong></button>' +
          '<span class="comentario-tempo">'+quandoFoi(c.criado_em)+(c.editado_em?' · editado':'')+'</span>' +
        '</div>' +
        '<p class="comentario-texto">'+escapa(c.texto)+'</p>' +
        '<div class="comentario-acoes">' +
          (meu ? '<button data-editar-coment="'+c.id+'">Editar</button>' : '') +
          ((meu || souDonoDoEvento) ? '<button data-apagar-coment="'+c.id+'">Apagar</button>' : '') +
          (!meu ? '<button data-denunciar data-denuncia-tipo="comentario" data-denuncia-id="'+c.id+'" data-denuncia-rotulo="Comentário de '+escapa(c.autor_nome)+'">Denunciar</button>' : '') +
        '</div>' +
      '</div>' +
    '</article>';
  }).join('');

  const form = Sessao.logado()
    ? '<div class="comentario-form comentario-form-lovable">' +
        '<textarea id="novoComentario" rows="1" maxlength="1000" placeholder="Escreva um comentário respeitoso"></textarea>' +
        '<button class="btn-escuro" id="btnComentar">Enviar</button>' +
      '</div>'
    : '<p class="dica"><a href="#" data-abrir-login style="color:inherit"><strong>Entre na sua conta</strong></a> para comentar.</p>';

  area.innerHTML =
    '<h4 class="comentarios-titulo">COMENTÁRIOS · '+data.length+'</h4>' +
    form +
    '<div class="comentarios-lista-lovable">'+(data.length ? lista : '<p class="dica comentario-vazio">Ninguém comentou ainda. Seja o primeiro.</p>')+'</div>';
}

async function enviarComentario(){
  const caixa = campo('novoComentario');
  const texto = caixa.value.trim();
  if(!texto){ avisar('Escreva algo antes de enviar'); return; }

  const btn = campo('btnComentar');
  btn.disabled = true; btn.textContent = 'Enviando...';
  const { error } = await db.from('comentarios').insert({
    evento_id: eventoComentado, autor_id: meuId(), texto
  });
  btn.disabled = false; btn.textContent = 'Enviar';

  if(error){ avisar(traduzirErroBanco(error)); return; }
  caixa.value = '';
  await carregarComentarios(eventoComentado);
  avisar('Comentário publicado');
}

async function apagarComentario(id){
  if(!confirm('Apagar este comentário?')) return;
  const { error } = await db.from('comentarios').delete().eq('id', id);
  if(error){ avisar(traduzirErroBanco(error)); return; }
  await carregarComentarios(eventoComentado);
  avisar('Comentário apagado');
}

async function editarComentario(id){
  const bloco = document.querySelector('[data-comentario="'+id+'"] .comentario-texto');
  const atual = bloco ? bloco.textContent : '';
  const texto = prompt('Editar comentário:', atual);
  if(texto === null) return;
  if(!texto.trim()){ avisar('O comentário não pode ficar vazio'); return; }

  const { error } = await db.from('comentarios').update({ texto: texto.trim() }).eq('id', id);
  if(error){ avisar(traduzirErroBanco(error)); return; }
  await carregarComentarios(eventoComentado);
  avisar('Comentário atualizado');
}

document.addEventListener('click', async e=>{
  if(e.target.closest('#btnComentar')) await enviarComentario();

  const ap = e.target.closest('[data-apagar-coment]');
  if(ap) await apagarComentario(ap.dataset.apagarComent);

  const ed = e.target.closest('[data-editar-coment]');
  if(ed) await editarComentario(ed.dataset.editarComent);

  if(e.target.closest('[data-abrir-login]')){ fecharTudo(); abrir('modalLogin'); }
});

/* ============================================================
   SENHA FORTE E REGRAS DE CONVIVÊNCIA
   ============================================================ */
ligarMedidorDeSenha('c_senha', 'c_senha2');

document.addEventListener('click', e=>{
  if(e.target.closest('[data-ver-regras]')){
    e.preventDefault();
    abrir('modalRegras');
  }
  const doc = e.target.closest('[data-doc]');
  if(doc){
    e.preventDefault();
    const modais = { regras:'modalRegras', termos:'modalTermos', privacidade:'modalPrivacidade' };
    const destino = modais[doc.dataset.doc];
    if(destino){ fecharTudo(); abrir(destino); }
  }
  if(e.target.closest('[data-esqueci]')){
    e.preventDefault();
    campo('r_email').value = campo('l_email').value.trim();
    fecharTudo(); abrir('modalEsqueci');
  }
});

campo('btnAceitarRegras').addEventListener('click', ()=>{
  campo('c_regras').checked = true;
  fecharTudo(); abrir('modalCadastro');
  avisar('Regras aceitas');
});

/* ============================================================
   ESQUECI MINHA SENHA

   O Supabase envia um link de uso único e com validade. Nós só
   dizemos para onde ele deve levar depois de validado. A resposta
   é sempre a mesma, exista ou não a conta: confirmar quais e-mails
   estão cadastrados entregaria informação a quem estivesse testando.
   ============================================================ */
const RECUPERACAO_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutos
let timerRecuperacao = null;

function chaveCooldownRecuperacao(){
  const email = (campo('r_email')?.value || '').trim().toLowerCase();
  return 'role_recuperacao_10min_' + encodeURIComponent(email || 'sem-email');
}

function formatarCronometro(segundos){
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return String(min).padStart(2,'0') + ':' + String(seg).padStart(2,'0');
}

function iniciarCooldownRecuperacao(){
  localStorage.setItem(chaveCooldownRecuperacao(), String(Date.now()));
  atualizarCooldownRecuperacao();
}

function atualizarCooldownRecuperacao(){
  const btn = campo('btnEnviarRecuperacao');
  const info = campo('estadoRecuperacao');
  if(!btn || !info) return;

  clearTimeout(timerRecuperacao);

  const ultimo = Number(localStorage.getItem(chaveCooldownRecuperacao()) || 0);
  const restante = Math.ceil((RECUPERACAO_COOLDOWN_MS - (Date.now() - ultimo)) / 1000);

  if(restante > 0){
    const tempo = formatarCronometro(restante);
    btn.disabled = true;
    btn.textContent = 'Novo link em ' + tempo;
    info.dataset.erroPersistente = '';
    info.textContent = 'Link solicitado. Você poderá pedir outro em ' + tempo + '. Confira também Spam/Lixo eletrônico.';
    timerRecuperacao = setTimeout(atualizarCooldownRecuperacao, 1000);
  }else{
    btn.disabled = false;
    btn.textContent = 'Enviar link';
    if(!info.dataset.erroPersistente) info.textContent = '';
  }
}

document.addEventListener('click', e=>{
  if(e.target.closest('[data-esqueci]')){
    setTimeout(atualizarCooldownRecuperacao, 0);
  }
});

campo('r_email').addEventListener('input', atualizarCooldownRecuperacao);

campo('btnEnviarRecuperacao').addEventListener('click', async e=>{
  const btn = e.currentTarget;
  const info = campo('estadoRecuperacao');
  const email = campo('r_email').value.trim();
  if(!email){ avisar('Informe o e-mail da sua conta'); return; }

  info.dataset.erroPersistente = '';
  info.textContent = '';
  btn.disabled = true; btn.textContent = 'Enviando...';

  const destino = location.origin + location.pathname.replace(/[^/]*$/, '') + 'redefinir.html';
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: destino });

  if(error){
    const msg = (error.message || '').toLowerCase();
    const codigo = String(error.code || '').toLowerCase();
    const limiteEmail = codigo.includes('over_email_send_rate_limit') ||
                        msg.includes('email rate limit') ||
                        msg.includes('rate limit');

    if(limiteEmail){
      info.dataset.erroPersistente = '';
      iniciarCooldownRecuperacao();
      avisar('Limite de e-mails atingido. Uma nova tentativa ficará disponível em 10 minutos.');
      return;
    }

    btn.disabled = false; btn.textContent = 'Enviar link';
    avisar(traduzirErro(error));
    return;
  }

  info.dataset.erroPersistente = '';
  iniciarCooldownRecuperacao();
  avisar('Se existir conta com esse e-mail, o link foi solicitado. Confira a caixa de entrada e o spam.');
});

/* ============================================================
   NOTIFICAÇÕES
   ============================================================ */
let canalNotificacoes = null;

async function carregarNotificacoes({abrirLista=false}={}){
  if(!Sessao.logado()) return;

  const { data, error } = await db.from('notificacoes')
    .select('*').order('criado_em', { ascending:false }).limit(30);
  if(error) return;

  const naoLidas = data.filter(n=>!n.lida).length;
  const badge = campo('badgeNotificacoes');
  badge.hidden = naoLidas === 0;
  badge.textContent = naoLidas;

  campo('listaNotificacoes').innerHTML = data.length
    ? data.map(n=>{
        const tipo = n.denuncia_id ? 'denuncia' : /coment/i.test(n.titulo || '') ? 'comentario' : /adiad|cancelad|evento/i.test((n.titulo||'')+' '+(n.mensagem||'')) ? 'evento' : 'geral';
        const icones = { denuncia:'⚑', comentario:'□', evento:'▣', geral:'○' };
        return '<article class="notificacao-card-lovable'+(n.lida?'':' nova')+'">' +
          '<div class="notificacao-icone">'+icones[tipo]+'</div>' +
          '<div class="notificacao-corpo">' +
            '<strong>'+escapa(n.titulo)+'</strong>' +
            '<p>'+escapa(n.mensagem)+'</p>' +
            '<span class="notificacao-tempo">'+quandoFoi(n.criado_em)+'</span>' +
          '</div>' +
          (!n.lida ? '<span class="notificacao-ponto" aria-hidden="true"></span>' : '') +
        '</article>';
      }).join('')
    : '<p class="dica">Nenhuma notificação por aqui.</p>';

  if(abrirLista) abrir('modalNotificacoes');
}

campo('btnNotificacoes').addEventListener('click', ()=>carregarNotificacoes({abrirLista:true}));

campo('btnLerTodas').addEventListener('click', async ()=>{
  const { error } = await db.from('notificacoes')
    .update({ lida:true }).eq('usuario_id', meuId()).eq('lida', false);
  if(error){ avisar(traduzirErroBanco(error)); return; }
  await carregarNotificacoes();
  avisar('Notificações marcadas como lidas');
});

const STATUS_DENUNCIA_USUARIO = {
  recebida:'Recebida',
  em_analise:'Em análise',
  aguardando_info:'Aguardando informações',
  resolvida:'Resolvida',
  em_recurso:'Em recurso',
  arquivada:'Arquivada'
};

async function carregarMinhasDenuncias(){
  if(!Sessao.logado()){ abrir('modalLogin'); return; }

  const caixa = campo('listaMinhasDenuncias');
  caixa.innerHTML = '<p class="dica">Carregando...</p>';
  fecharTudo(); abrir('modalMinhasDenuncias');

  const { data, error } = await db.from('denuncias')
    .select('id, numero, motivo, descricao, status, resposta, criado_em, resolvida_em, prazo_recurso, recurso_texto, recurso_em, recurso_decisao, recurso_resposta, recurso_decidido_em, info_solicitada, info_resposta, info_respondida_em')
    .eq('usuario_id', meuId())
    .order('criado_em', { ascending:false });

  if(error){
    caixa.innerHTML = '<p class="dica">Não foi possível carregar suas denúncias.</p>';
    return;
  }

  if(!data || !data.length){
    caixa.innerHTML = '<p class="dica">Você ainda não enviou nenhuma denúncia.</p>';
    return;
  }

  const agora = new Date();
  caixa.innerHTML = data.map(d=>{
    const prazo = d.prazo_recurso ? new Date(d.prazo_recurso) : null;
    const podeRecorrer = d.status === 'resolvida' && !d.recurso_texto && prazo && prazo > agora;
    const dias = prazo ? Math.max(0, Math.ceil((prazo - agora) / 86400000)) : null;
    const aguardandoInfo = d.status === 'aguardando_info';
    const decisaoRecurso = d.recurso_decisao === 'aceito' ? 'ACEITO' : d.recurso_decisao === 'negado' ? 'NEGADO' : null;

    return '<div class="ficha" style="margin-bottom:12px">' +
      '<div class="corpo">' +
        '<h4>Denúncia #'+d.numero+'</h4>' +
        '<div class="meta">' +
          'STATUS: '+escapa(STATUS_DENUNCIA_USUARIO[d.status] || d.status)+'<br>' +
          'MOTIVO: '+escapa(d.motivo || '')+'<br>' +
          'ENVIADA: '+new Date(d.criado_em).toLocaleString('pt-BR')+'<br>' +
          (d.resposta ? '<span class="descricao-denuncia">RESPOSTA DA MODERAÇÃO: '+escapa(d.resposta)+'</span><br>' : '') +
          (dias !== null && d.status === 'resolvida' && !d.recurso_texto ? 'PRAZO DE RECURSO: '+dias+' DIA(S)<br>' : '') +
        '</div>' +
        (d.info_solicitada ? '<div class="alerta"><strong>Informações solicitadas pela moderação</strong><p>'+escapa(d.info_solicitada)+'</p></div>' : '') +
        (d.info_resposta ? '<div class="alerta"><strong>Sua resposta</strong><p>'+escapa(d.info_resposta)+'</p></div>' : '') +
        (aguardandoInfo && !d.info_resposta
          ? '<div class="campo" style="margin-top:10px"><label for="info-'+d.id+'">Enviar informações</label><textarea id="info-'+d.id+'" maxlength="2000" placeholder="Responda ao que a moderação solicitou"></textarea></div>' +
            '<button class="mini" data-enviar-info="'+d.id+'">Enviar informações</button>'
          : '') +
        (d.recurso_texto
          ? '<div class="alerta"><strong>Recurso enviado'+(decisaoRecurso?' · '+decisaoRecurso:'')+'</strong><p>'+escapa(d.recurso_texto)+'</p>'+
            (d.recurso_resposta?'<p><strong>Resposta da moderação:</strong> '+escapa(d.recurso_resposta)+'</p>':'')+'</div>'
          : '') +
        (podeRecorrer
          ? '<div class="campo" style="margin-top:10px"><label for="recurso-'+d.id+'">Recurso</label><textarea id="recurso-'+d.id+'" maxlength="1500" placeholder="Explique por que deseja que a decisão seja revista"></textarea></div>' +
            '<button class="mini" data-enviar-recurso="'+d.id+'">Enviar recurso</button>'
          : '') +
      '</div>' +
    '</div>';
  }).join('');
}

campo('btnMinhasDenuncias').addEventListener('click', carregarMinhasDenuncias);

document.addEventListener('click', async e=>{
  const btnRecurso = e.target.closest('[data-enviar-recurso]');
  if(btnRecurso){
    const id = btnRecurso.dataset.enviarRecurso;
    const textarea = campo('recurso-'+id);
    const texto = textarea ? textarea.value.trim() : '';
    if(texto.length < 10){ avisar('Explique o recurso com pelo menos 10 caracteres'); return; }

    btnRecurso.disabled = true; btnRecurso.textContent = 'Enviando...';
    const { error } = await db.rpc('enviar_recurso_denuncia', { p_denuncia:id, p_texto:texto });
    btnRecurso.disabled = false; btnRecurso.textContent = 'Enviar recurso';
    if(error){ avisar('Não foi possível enviar o recurso: ' + error.message); return; }
    avisar('Recurso enviado. A denúncia voltou para a fila da moderação.');
    await carregarMinhasDenuncias();
    return;
  }

  const btnInfo = e.target.closest('[data-enviar-info]');
  if(btnInfo){
    const id = btnInfo.dataset.enviarInfo;
    const textarea = campo('info-'+id);
    const texto = textarea ? textarea.value.trim() : '';
    if(texto.length < 5){ avisar('Escreva as informações solicitadas'); return; }

    btnInfo.disabled = true; btnInfo.textContent = 'Enviando...';
    const { error } = await db.rpc('enviar_informacoes_denuncia', { p_denuncia:id, p_texto:texto });
    btnInfo.disabled = false; btnInfo.textContent = 'Enviar informações';
    if(error){ avisar('Não foi possível enviar: ' + error.message); return; }
    avisar('Informações enviadas. A denúncia voltou para análise.');
    await carregarMinhasDenuncias();
  }
});

/* avisa na hora quando o administrador mexe numa denúncia sua */
function acompanharNotificacoes(){
  if(canalNotificacoes){ db.removeChannel(canalNotificacoes); canalNotificacoes = null; }
  if(!Sessao.logado()) return;

  canalNotificacoes = db.channel('minhas-notificacoes')
    .on('postgres_changes', {
      event:'INSERT', schema:'public', table:'notificacoes',
      filter:'usuario_id=eq.'+meuId()
    }, payload=>{
      avisar(payload.new.titulo + ': ' + payload.new.mensagem);
      carregarNotificacoes();
    })
    .subscribe();
}

/* ============================================================
   EXCLUSÃO DE CONTA

   Três barreiras de propósito: a caixa de ciência, o texto
   digitado por extenso e a confirmação final. A intenção é que
   ninguém apague a conta por acidente ou por um clique impulsivo.
   ============================================================ */
const FRASE_EXCLUSAO = 'EXCLUIR MINHA CONTA';

function validarExclusao(){
  const ok = campo('x_ciente').checked &&
             campo('x_senha').value.length > 0 &&
             campo('x_confirmacao').value.trim().toUpperCase() === FRASE_EXCLUSAO;
  campo('btnConfirmarExclusao').disabled = !ok;
}

campo('btnAbrirExclusao').addEventListener('click', async ()=>{
  campo('x_ciente').checked = false;
  campo('x_senha').value = '';
  campo('x_confirmacao').value = '';
  validarExclusao();

  // mostra o tamanho do estrago antes de perguntar
  const [ev, co] = await Promise.all([
    db.from('eventos').select('id', { count:'exact', head:true }).eq('criador_id', meuId()),
    db.from('comentarios').select('id', { count:'exact', head:true }).eq('autor_id', meuId())
  ]);
  campo('resumoExclusao').innerHTML =
    '<li>seu perfil e sua foto</li>' +
    '<li><strong>'+(ev.count||0)+'</strong> evento(s) que você publicou</li>' +
    '<li><strong>'+(co.count||0)+'</strong> comentário(s) seus</li>' +
    '<li>seus favoritos e interesses</li>';

  fecharTudo(); abrir('modalExcluirConta');
});

campo('x_ciente').addEventListener('change', validarExclusao);
campo('x_senha').addEventListener('input', validarExclusao);
campo('x_confirmacao').addEventListener('input', validarExclusao);

campo('btnConfirmarExclusao').addEventListener('click', async e=>{
  if(!confirm('Confirmar o pedido de exclusão? Você terá 7 dias para cancelar.')) return;

  const btn = e.currentTarget;
  btn.disabled = true; btn.textContent = 'Confirmando...';

  try{
    const senha = campo('x_senha').value;
    const email = Sessao.usuario && Sessao.usuario.email;
    if(!email) throw new Error('Sessão inválida');

    // Reautenticação: quem pegou uma sessão aberta ainda precisa saber a senha.
    const reauth = await db.auth.signInWithPassword({ email, password: senha });
    if(reauth.error) throw new Error('Senha atual incorreta');

    const { data: prazo, error } = await db.rpc('solicitar_exclusao_conta');
    if(error) throw error;

    await db.auth.signOut();
    fecharTudo();
    const quando = prazo ? new Date(prazo).toLocaleString('pt-BR') : 'daqui a 7 dias';
    avisar('Pedido registrado. A exclusão definitiva está prevista para ' + quando + '.');
    setTimeout(()=>location.reload(), 2500);
  }catch(err){
    avisar(err.message || 'Não foi possível iniciar a exclusão');
  }finally{
    btn.disabled = false; btn.textContent = 'Iniciar exclusão (7 dias)';
  }
});

campo('btnCancelarExclusao').addEventListener('click', async ()=>{
  const { error } = await db.rpc('cancelar_exclusao_conta');
  if(error){ avisar('Não foi possível cancelar: ' + error.message); return; }

  if(Sessao.perfil){
    Sessao.perfil.exclusao_pedida_em = null;
    Sessao.perfil.exclusao_prevista = null;
  }
  fecharTudo();
  atualizarTopo();
  avisar('Exclusão cancelada. Sua conta continua ativa.');
  await window.aoMudarSessao();
});

campo('btnManterExclusao').addEventListener('click', async ()=>{
  await db.auth.signOut();
  fecharTudo();
  avisar('Pedido mantido. Você ainda pode voltar antes do prazo entrando novamente.');
});

/* ============================================================
   PERFIL DO USUÁRIO
   ============================================================ */
function abrirPerfil(){
  if(!Sessao.logado()){ abrir('modalLogin'); return; }
  const p = Sessao.perfil || {};
  campo('p_nome').value    = p.nome || '';
  campo('p_bio').value     = p.bio || '';
  campo('p_cidade').value  = p.cidade || '';
  campo('p_contato').value = p.contato || '';
  campo('p_nascimento').value = p.data_nascimento || '';
  campo('p_email').textContent = p.email || '';
  campo('p_foto').value = '';
  campo('p_bioContador').textContent = (p.bio || '').length + '/300';
  mostrarFotoPerfil(p.foto_url, p.nome);
  abrir('modalPerfil');
}

function mostrarFotoPerfil(url, nome){
  campo('p_previa').innerHTML = url
    ? '<img src="'+escapa(url)+'" alt="">'
    : escapa(iniciais(nome));
}

campo('p_bio').addEventListener('input', e=>{
  campo('p_bioContador').textContent = e.target.value.length + '/300';
});

campo('p_foto').addEventListener('change', e=>{
  const arquivo = e.target.files[0];
  if(arquivo) mostrarFotoPerfil(URL.createObjectURL(arquivo), Sessao.perfil && Sessao.perfil.nome);
});

async function enviarAvatar(arquivo){
  if(!arquivo) return null;
  if(arquivo.size > 3*1024*1024) throw new Error('A foto precisa ter no máximo 3 MB');
  if(!['image/jpeg','image/png','image/webp'].includes(arquivo.type)) throw new Error('Use uma foto JPG, PNG ou WebP');
  const ext = (arquivo.name.split('.').pop()||'jpg').toLowerCase();
  const caminho = meuId()+'/'+Date.now()+'.'+ext;
  const { error } = await db.storage.from('avatares').upload(caminho, arquivo, { upsert:false });
  if(error) throw error;
  return { caminho, url:db.storage.from('avatares').getPublicUrl(caminho).data.publicUrl };
}

campo('btnSalvarPerfil').addEventListener('click', async e=>{
  const btn = e.currentTarget;
  const nome = campo('p_nome').value.trim();
  if(nome.length < 2){ avisar('Informe seu nome'); return; }

  btn.disabled = true; btn.textContent = 'Salvando...';
  let fotoNova=null;
  const fotoAntiga=Sessao.perfil && Sessao.perfil.foto_url;
  try{
    fotoNova = await enviarAvatar(campo('p_foto').files[0]);
    const dados = {
      nome,
      bio: campo('p_bio').value.trim() || null,
      cidade: campo('p_cidade').value.trim() || null,
      contato: campo('p_contato').value.trim() || null
    };
    if(campo('p_nascimento').value) dados.data_nascimento = campo('p_nascimento').value;
    if(fotoNova) dados.foto_url = fotoNova.url;

    const { data, error } = await db.from('perfis').update(dados).eq('id', meuId()).select().single();
    if(error) throw error;

    if(fotoNova && fotoAntiga && fotoAntiga!==fotoNova.url) await removerArquivoPublico('avatares',fotoAntiga);
    Sessao.perfil = { ...Sessao.perfil, ...data };
    atualizarTopo();
    fecharTudo();
    avisar('Perfil atualizado');
    await atualizarConsultaAtual();
  }catch(err){
    if(fotoNova) await db.storage.from('avatares').remove([fotoNova.caminho]);
    avisar(err.message && err.message.includes('18 anos')
      ? 'A plataforma é restrita a maiores de 18 anos'
      : traduzirErroBanco(err));
  }finally{
    btn.disabled = false; btn.textContent = 'Salvar alterações';
  }
});

campo('btnRemoverFoto').addEventListener('click', async ()=>{
  const antiga=Sessao.perfil && Sessao.perfil.foto_url;
  const { error } = await db.from('perfis').update({ foto_url: null }).eq('id', meuId());
  if(error){ avisar(traduzirErroBanco(error)); return; }
  if(antiga) await removerArquivoPublico('avatares',antiga);
  Sessao.perfil.foto_url = null;
  mostrarFotoPerfil(null, Sessao.perfil.nome);
  atualizarTopo();
  avisar('Foto removida');
});

ligarMedidorDeSenha('ps_senha','ps_senha2',{
  barra:'ps_forcaBarra', preenchida:'ps_forcaPreenchida', rotulo:'ps_forcaRotulo',
  lista:'ps_requisitosSenha', conferencia:'ps_conferenciaSenha'
});

campo('btnTrocarSenha').addEventListener('click', ()=>{
  campo('ps_senha').value = '';
  campo('ps_senha2').value = '';
  fecharTudo(); abrir('modalTrocarSenha');
});

campo('btnSalvarNovaSenha').addEventListener('click', async e=>{
  const btn=e.currentTarget;
  const nova=campo('ps_senha').value;
  const conf=campo('ps_senha2').value;
  const analise=analisarSenha(nova);
  if(!analise.aprovada){ avisar('A senha ainda não cumpre todos os requisitos'); return; }
  if(nova!==conf){ avisar('As senhas não são iguais'); return; }

  btn.disabled=true; btn.textContent='Salvando...';
  const { error } = await db.auth.updateUser({ password:nova });
  btn.disabled=false; btn.textContent='Salvar nova senha';
  if(error){ avisar(traduzirErro(error)); return; }
  fecharTudo(); avisar('Senha alterada com segurança');
});

campo('btnPerfil').addEventListener('click', ()=>{ location.href = 'perfil.html'; });

/* ============================================================
   FAVORITOS E INTERESSES — ATUALIZAÇÃO OTIMISTA
   ============================================================ */
async function alternarFav(id){
  if(!Sessao.logado()){ avisar('Entre na sua conta para favoritar'); abrir('modalLogin'); return; }
  const tinha=favoritos.has(id);
  tinha?favoritos.delete(id):favoritos.add(id);
  renderMural();

  const {error}=tinha
    ? await db.from('favoritos').delete().eq('usuario_id',meuId()).eq('evento_id',id)
    : await db.from('favoritos').insert({usuario_id:meuId(),evento_id:id});
  if(error){
    tinha?favoritos.add(id):favoritos.delete(id); renderMural(); avisar(traduzirErroBanco(error)); return;
  }
  avisar(tinha?'Removido dos favoritos':'Salvo nos favoritos');
  if(estado.aba==='favoritos') await atualizarConsultaAtual();
}

async function alternarInteresse(id){
  if(!Sessao.logado()){ avisar('Entre na sua conta para marcar interesse'); abrir('modalLogin'); return; }
  let ev=EVENTOS.find(x=>x.id===id);
  if(!ev){ const r=await db.from('eventos_lista').select('*').eq('id',id).single(); if(r.error) return; ev=r.data; }
  const tinha=interesses.has(id);
  tinha?interesses.delete(id):interesses.add(id);
  ev.total_interessados=Math.max(0,(ev.total_interessados||0)+(tinha?-1:1));
  renderMural(); montarDetalhe(ev);

  const {error}=tinha
    ? await db.from('interesses').delete().eq('usuario_id',meuId()).eq('evento_id',id)
    : await db.from('interesses').insert({usuario_id:meuId(),evento_id:id});
  if(error){
    tinha?interesses.add(id):interesses.delete(id);
    ev.total_interessados=Math.max(0,(ev.total_interessados||0)+(tinha?1:-1));
    renderMural(); montarDetalhe(ev); avisar(traduzirErroBanco(error)); return;
  }
  avisar(tinha?'Interesse removido':'Interesse registrado');
  if(estado.aba==='interesse') await atualizarConsultaAtual();
}

/* ============================================================
   AUTENTICAÇÃO — BOTÕES DA TELA
   ============================================================ */
if(campo('btnCadastroTopo')) campo('btnCadastroTopo').addEventListener('click',()=>{ fecharTudo(); abrir('modalCadastro'); });

campo('btnEntrar').addEventListener('click',()=>{
  abrir('modalLogin');
});
if(campo('btnSair')) campo('btnSair').addEventListener('click',async()=>{
  await sair(); favoritos.clear(); interesses.clear(); estado.aba='todos';
  document.querySelectorAll('.aba').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.aba==='todos')));
  campo('tituloLista').textContent='Próximos eventos';
  avisar('Você saiu da conta');
});

campo('btnLogar').addEventListener('click',async e=>{
  const btn=e.currentTarget, email=campo('l_email').value.trim(), senha=campo('l_senha').value;
  if(!email||!senha){ avisar('Preencha e-mail e senha'); return; }
  btn.disabled=true; btn.textContent='Entrando...';
  try{
    const login = await entrar(email,senha);
    campo('l_senha').value='';

    const id = login && login.user && login.user.id;
    const perfil = id ? await carregarPerfil(id) : null;
    if(perfil){ Sessao.perfil = perfil; }

    if(perfil && perfil.exclusao_prevista){
      mostrarExclusaoPendente();
      avisar('Sua conta ainda pode ser recuperada antes do prazo.');
    }else{
      fecharTudo();
      avisar('Bem-vindo de volta!');

      // Se o login foi aberto porque a pessoa veio do perfil para publicar,
      // abre o formulário depois que o modal de login fechar.
      const parametros = new URLSearchParams(location.search);
      if(parametros.get('criar') === '1'){
        parametros.delete('criar');
        const novaBusca = parametros.toString();
        history.replaceState({}, '', location.pathname + (novaBusca ? '?' + novaBusca : '') + location.hash);
        setTimeout(()=>campo('btnCriar') && campo('btnCriar').click(), 120);
      }
    }
  }
  catch(err){ avisar(traduzirErro(err)); }
  finally{ btn.disabled=false; btn.textContent='Entrar'; }
});

campo('btnCadastrar').addEventListener('click',async e=>{
  const btn=e.currentTarget, nome=campo('c_nome').value.trim(), email=campo('c_email').value.trim(),
        senha=campo('c_senha').value, senha2=campo('c_senha2').value, nascimento=campo('c_nascimento').value;

  if(!nome||!email){ avisar('Preencha nome e e-mail'); return; }
  if(!nascimento){ avisar('Informe sua data de nascimento'); return; }

  const analise = analisarSenha(senha);
  if(!analise.aprovada){ avisar('A senha ainda não cumpre todos os requisitos'); return; }
  if(senha !== senha2){ avisar('As senhas não são iguais'); return; }
  if(!campo('c_regras').checked){ avisar('É preciso aceitar as regras de convivência'); return; }

  btn.disabled=true; btn.textContent='Criando...';
  try{
    const cadastro = await cadastrar(nome,email,senha,nascimento,true);
    fecharTudo();
    if(cadastro && cadastro.session){
      avisar('Conta criada. Bem-vindo, '+nome+'!');
    }else{
      avisar('Conta criada. Confira seu e-mail e clique no link de confirmação antes de entrar.');
    }
    campo('c_senha').value=''; campo('c_senha2').value=''; campo('c_regras').checked=false;
  }
  catch(err){ avisar(traduzirErro(err)); }
  finally{ btn.disabled=false; btn.textContent='Criar conta'; }
});

/* ============================================================
   PUBLICAR / EDITAR / EXCLUIR
   ============================================================ */
function limparFormulario(){
  ['f_nome','f_desc','f_cep','f_end','f_numero','f_complemento','f_bairro','f_cidade','f_vagas','f_contato'].forEach(id=>campo(id).value='');
  numeroAnterior='';
  campo('cepStatus').textContent='';
  campo('f_preco').value=''; campo('f_hora').value='19:00'; campo('f_situacao').value='agendado'; campo('f_img').value='';
  const d=new Date(); d.setDate(d.getDate()+7); campo('f_data').value=dataISO(d);
  limparPontoFormulario();
}

campo('btnCriar').addEventListener('click',()=>{
  if(!Sessao.logado()){ avisar('Entre na sua conta para publicar'); abrir('modalLogin'); return; }
  editando=null; limparFormulario(); campo('tituloForm').textContent='Publicar um evento'; campo('btnPublicar').textContent='Publicar';
  abrir('modalCriar'); prepararMapaFormulario();
});

async function abrirEdicao(id){
  let ev=EVENTOS.find(e=>e.id===id);
  if(!ev){
    const r=await db.from('eventos_lista').select('*').eq('id',id).single();
    if(r.error){ avisar('Não foi possível carregar o evento para edição'); return; }
    ev=r.data;
  }
  editando=id;
  limparPontoFormulario();
  campo('f_nome').value=ev.nome; campo('f_desc').value=ev.descricao||''; campo('f_cat').value=ev.categoria_id;
  campo('f_data').value=ev.data_evento; campo('f_hora').value=hora(ev); campo('f_end').value=ev.endereco||'';
  campo('f_numero').value=ev.numero||''; campo('f_complemento').value=ev.complemento||'';
  campo('f_cep').value=ev.cep?formatarCep(ev.cep):''; campo('cepStatus').textContent='';
  campo('f_bairro').value=ev.bairro||''; campo('f_cidade').value=ev.cidade||''; campo('f_preco').value=ev.gratuito?0:ev.valor;
  campo('f_situacao').value=ev.situacao||'agendado';
  campo('f_vagas').value=ev.max_participantes||''; campo('f_contato').value=ev.contato||''; campo('f_img').value='';
  campo('f_lat').value=ev.latitude==null?'':ev.latitude; campo('f_lng').value=ev.longitude==null?'':ev.longitude;
  campo('tituloForm').textContent='Editar evento'; campo('btnPublicar').textContent='Salvar alterações';
  fecharTudo(); abrir('modalCriar'); prepararMapaFormulario();
}

async function enviarImagem(arquivo){
  if(!arquivo) return null;
  if(arquivo.size>5*1024*1024) throw new Error('Imagem muito grande (máximo 5 MB)');
  if(!['image/jpeg','image/png','image/webp'].includes(arquivo.type)) throw new Error('Use uma imagem JPG, PNG ou WebP');
  const ext=(arquivo.name.split('.').pop()||'jpg').toLowerCase(), caminho=meuId()+'/'+Date.now()+'.'+ext;
  const {error}=await db.storage.from('eventos').upload(caminho,arquivo,{upsert:false});
  if(error) throw error;
  return { caminho, url:db.storage.from('eventos').getPublicUrl(caminho).data.publicUrl };
}

function coordOuNull(id){
  const valor=campo(id).value.trim(); if(!valor) return null;
  const n=Number(valor); return Number.isFinite(n)?n:null;
}

campo('btnPublicar').addEventListener('click',async e=>{
  const btn=e.currentTarget, nome=campo('f_nome').value.trim(), data=campo('f_data').value, cidade=campo('f_cidade').value.trim(), valor=Number(campo('f_preco').value)||0;
  if(nome.length<3){ avisar('O nome precisa ter pelo menos 3 letras'); return; }
  if(!data){ avisar('Escolha a data do evento'); return; }
  if(!cidade){ avisar('Informe a cidade'); return; }
  const rotulo=btn.textContent; btn.disabled=true; btn.textContent='Salvando...';

  let imagemNova=null;
  const eventoAnterior=editando ? EVENTOS.find(x=>x.id===editando) : null;
  const imagemAntiga=eventoAnterior && eventoAnterior.imagem_url;
  try{
    imagemNova=await enviarImagem(campo('f_img').files[0]);
    const dados={
      nome, descricao:campo('f_desc').value.trim()||null, categoria_id:campo('f_cat').value,
      data_evento:data, hora_evento:campo('f_hora').value||'19:00', endereco:campo('f_end').value.trim()||null,
      numero:campo('f_numero').value.trim()||null, complemento:campo('f_complemento').value.trim()||null,
      cep:soDigitos(campo('f_cep').value)||null,
      bairro:campo('f_bairro').value.trim()||null, cidade, gratuito:valor===0, valor,
      max_participantes:Number(campo('f_vagas').value)||null, contato:campo('f_contato').value.trim()||null,
      situacao:campo('f_situacao').value||'agendado',
      latitude:coordOuNull('f_lat'), longitude:coordOuNull('f_lng')
    };
    if(imagemNova) dados.imagem_url=imagemNova.url;
    let id;
    if(editando){
      const {error}=await db.from('eventos').update(dados).eq('id',editando); if(error) throw error; id=editando;
    }else{
      dados.criador_id=meuId();
      const {data:criado,error}=await db.from('eventos').insert(dados).select('id').single(); if(error) throw error; id=criado.id;
    }
    if(imagemNova && imagemAntiga && imagemAntiga!==imagemNova.url) await removerArquivoPublico('eventos',imagemAntiga);
    fecharTudo(); await carregarEventos(); avisar(editando?'Alterações salvas':'Evento publicado'); editando=null;
    if(estado.visualizacao==='mapa') await carregarMapa(id);
    setTimeout(()=>{ const el=document.querySelector('[data-ev="'+id+'"]'); if(el) el.scrollIntoView({block:'center'}); },150);
  }catch(err){
    if(imagemNova) await db.storage.from('eventos').remove([imagemNova.caminho]);
    console.error(err); avisar(traduzirErroBanco(err));
  }
  finally{ btn.disabled=false; btn.textContent=rotulo; }
});

async function excluirEvento(id){
  if(!confirm('Excluir este evento? Não dá para desfazer.')) return;
  let ev=EVENTOS.find(x=>x.id===id);
  if(!ev){
    const r=await db.from('eventos').select('id,imagem_url').eq('id',id).single();
    if(!r.error) ev=r.data;
  }
  const {error}=await db.from('eventos').delete().eq('id',id);
  if(error){ avisar(traduzirErroBanco(error)); return; }
  if(ev && ev.imagem_url) await removerArquivoPublico('eventos',ev.imagem_url);
  fecharTudo(); await atualizarConsultaAtual(); avisar('Evento excluído');
}

function traduzirErroBanco(e){
  const m=(e&&e.message||'').toLowerCase();
  if(m.includes('row-level security')) return 'Sem permissão para esta ação. Confira se você está logado.';
  if(m.includes('valor_coerente')) return 'Evento pago precisa de um valor maior que zero';
  if(m.includes('violates check')) return 'Algum campo está fora do formato esperado';
  if(m.includes('duplicate')) return 'Esse registro já existe';
  if(m.includes('failed to fetch')) return 'Sem conexão com o servidor';
  return 'Erro: '+(e&&e.message||'desconhecido');
}

/* ============================================================
   DENÚNCIAS / ADMIN
   ============================================================ */
campo('btnEnviarDenuncia').addEventListener('click',async e=>{
  const btn=e.currentTarget; if(!denunciando) return;
  btn.disabled=true; btn.textContent='Enviando...';
  let evidencia=null;
  const arquivo=campo('d_evidencia').files[0];

  if(arquivo){
    if(arquivo.size>5*1024*1024){
      avisar('A evidência precisa ter no máximo 5 MB');
      btn.disabled=false; btn.textContent='Enviar denúncia'; return;
    }
    if(!['image/jpeg','image/png','image/webp'].includes(arquivo.type)){
      avisar('Use uma imagem JPG, PNG ou WebP como evidência');
      btn.disabled=false; btn.textContent='Enviar denúncia'; return;
    }
    const ext=(arquivo.name.split('.').pop()||'jpg').toLowerCase();
    const caminho=meuId()+'/'+Date.now()+'.'+ext;
    const up=await db.storage.from('denuncias').upload(caminho,arquivo);
    if(up.error){
      avisar('Não foi possível anexar a evidência: '+up.error.message);
      btn.disabled=false; btn.textContent='Enviar denúncia'; return;
    }
    evidencia=caminho;
  }

  const {data:numero,error}=await db.rpc('abrir_denuncia',{
    p_alvo_tipo:denunciando.tipo,
    p_alvo_id:denunciando.id,
    p_categoria:campo('d_motivo').value,
    p_descricao:campo('d_descricao').value.trim()||null,
    p_evidencia_path:evidencia
  });

  btn.disabled=false; btn.textContent='Enviar denúncia';
  if(error){
    if(evidencia) await db.storage.from('denuncias').remove([evidencia]);
    avisar(traduzirErroBanco(error));
    return;
  }

  denunciando=null;
  fecharTudo();
  avisar('Denúncia nº '+numero+' enviada para a moderação.');
});
campo('btnAdmin').addEventListener('click',()=>{ location.href='admin.html'; });

/* ============================================================
   REALTIME
   ============================================================ */
function recarregarEmBreve(){
  clearTimeout(recarregando);
  recarregando=setTimeout(()=>atualizarConsultaAtual(),400);
}

db.channel('mural')
  .on('postgres_changes',{event:'*',schema:'public',table:'eventos'},recarregarEmBreve)
  .on('postgres_changes',{event:'*',schema:'public',table:'interesses'},recarregarEmBreve)
  .subscribe();

/* ============================================================
   INÍCIO
   ============================================================ */
(async function iniciar(){
  await carregarCategorias();
  await carregarEventos();
  const parametros = new URLSearchParams(location.search);
  const eventoDireto = parametros.get('evento');
  if(eventoDireto) setTimeout(()=>abrirDetalhe(eventoDireto),180);
})();

window.addEventListener('load', ()=>{
  const parametros = new URLSearchParams(location.search);
  if(parametros.get('criar') === '1'){
    setTimeout(()=>{
      if(Sessao.logado()) campo('btnCriar').click();
      else abrir('modalLogin');
    }, 650);
  }
});
