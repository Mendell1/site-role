/* ============================================================
   PAINEL DO ADMINISTRADOR — Etapa 7

   Fecha os três níveis de acesso do projeto:
     Visitante  → só vê eventos ativos
     Usuário    → publica e gerencia os próprios eventos
     Administrador → vê tudo, oculta conteúdo, bloqueia contas

   Detalhe importante para a defesa: esconder esta página não é
   segurança. Quem digitar admin.html no navegador chega aqui —
   e não consegue fazer nada, porque toda ação passa pela função
   eh_admin() nas políticas de RLS do banco.
   ============================================================ */

let perfilAtual = null;
let adminsDisponiveis = [];
let aba = 'denuncias';

const STATUS = {
  recebida:        { rotulo:'Recebida',              cor:'aberta'  },
  em_analise:      { rotulo:'Em análise',            cor:'analise' },
  aguardando_info: { rotulo:'Aguardando informações', cor:'espera' },
  resolvida:       { rotulo:'Resolvida',             cor:'ok'      },
  em_recurso:      { rotulo:'Em recurso',            cor:'analise' },
  arquivada:       { rotulo:'Arquivada',             cor:'oculto'  }
};

const DECISOES = {
  violacao_confirmada:    'Violação confirmada',
  sem_violacao:           'Nenhuma violação encontrada',
  evidencia_insuficiente: 'Evidências insuficientes',
  duplicada:              'Denúncia duplicada ou indevida'
};

const MEDIDAS = {
  nenhuma:     'Nenhuma medida',
  advertencia: 'Advertência',
  remocao:     'Remoção do conteúdo',
  suspensao:   'Suspensão temporária',
  banimento:   'Banimento da conta'
};

const CATEGORIAS_DENUNCIA = [
  'Informação falsa ou enganosa',
  'Conteúdo ofensivo',
  'Assédio ou ameaça',
  'Evento não existe',
  'Golpe ou cobrança indevida',
  'Categoria errada',
  'Spam ou propaganda',
  'Perfil falso ou se passando por outra pessoa',
  'Outro'
];

const POR_PAGINA_ADMIN = 10;

const filtros = {
  busca:'', status:'', categoria:'', admin:'', de:'', ate:'',
  ordem:'recentes', pagina:0
};
let totalDenuncias = 0;

const el = id => document.getElementById(id);
const escapa = t => String(t==null?'':t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtData = s => s ? new Date(s + (s.length===10?'T00:00:00':'')).toLocaleDateString('pt-BR') : '—';
const fmtDataHora = s => s ? new Date(s).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';

let avisoTimer;
function avisar(txt){
  const a = el('aviso');
  a.textContent = txt; a.classList.add('mostra');
  clearTimeout(avisoTimer); avisoTimer = setTimeout(()=>a.classList.remove('mostra'), 3400);
}

function caminhoStoragePublico(url,bucket){
  if(!url) return null;
  const marca='/storage/v1/object/public/'+bucket+'/';
  const i=String(url).indexOf(marca);
  if(i<0) return null;
  return decodeURIComponent(String(url).slice(i+marca.length).split('?')[0]);
}

async function limparPastaStorage(bucket,pasta){
  const {data,error}=await db.storage.from(bucket).list(pasta,{limit:1000});
  if(error){ console.warn('Falha ao listar '+bucket,error); return false; }
  const arquivos=(data||[]).filter(x=>x.name && x.id).map(x=>pasta+'/'+x.name);
  if(!arquivos.length) return true;
  const rem=await db.storage.from(bucket).remove(arquivos);
  if(rem.error){ console.warn('Falha ao limpar '+bucket,rem.error); return false; }
  return true;
}

/* ============================================================
   PORTEIRO
   ============================================================ */
async function iniciar(){
  const { data:{ session } } = await db.auth.getSession();

  if(!session){
    el('bloqueioTexto').textContent = 'Você precisa entrar na sua conta para acessar esta área.';
    el('bloqueio').hidden = false;
    return;
  }

  const { data: perfil } = await db.from('perfis')
    .select('id, nome, papel').eq('id', session.user.id).single();
  perfilAtual = perfil;

  if(!perfil || perfil.papel !== 'admin'){
    el('bloqueioTexto').textContent = 'Sua conta não tem permissão de administrador.';
    el('bloqueio').hidden = false;
    return;
  }

  el('usuarioNome').hidden = false;
  el('usuarioNome').textContent = '@' + perfil.nome;
  el('painel').hidden = false;
  carregar();
}

el('btnEntrar').addEventListener('click', async ()=>{
  await db.auth.signOut();
  location.href = 'index.html';
});

/* ============================================================
   NAVEGAÇÃO
   ============================================================ */
document.querySelector('.painel-abas').addEventListener('click', e=>{
  const b = e.target.closest('.painel-aba'); if(!b) return;
  aba = b.dataset.painel;
  document.querySelectorAll('.painel-aba').forEach(x=>x.setAttribute('aria-pressed', String(x.dataset.painel===aba)));
  el('tituloPainel').textContent = ({denuncias:'Denúncias', eventos:'Eventos', usuarios:'Usuários', auditoria:'Auditoria'})[aba];
  carregar();
});

function carregar(){
  el('lista').innerHTML = '<div class="esqueleto" style="min-height:70px;margin-bottom:10px"></div>'.repeat(3);
  if(aba==='denuncias') listarDenuncias();
  if(aba==='eventos')   listarEventos();
  if(aba==='usuarios')  listarUsuarios();
  if(aba==='auditoria') listarAuditoria();
}

function vazio(msg){
  el('lista').innerHTML = '<div class="vazio"><strong>Tudo limpo</strong>'+msg+'</div>';
  el('contagemPainel').textContent = '0';
}

/* ============================================================
   DENÚNCIAS
   ============================================================ */
async function listarDenuncias(){
  // Prazos são processados automaticamente pelo Supabase Cron.
  const [contadores, adminsResp] = await Promise.all([
    contarPorStatus(),
    db.from('perfis').select('id,nome').eq('papel','admin').order('nome')
  ]);
  adminsDisponiveis = adminsResp.data || [];

  let q = db.from('denuncias_lista').select('*', { count:'exact' });

  if(filtros.status)    q = q.eq('status', filtros.status);
  if(filtros.categoria) q = q.eq('categoria', filtros.categoria);
  if(filtros.admin)     q = q.eq('admin_id', filtros.admin);
  if(filtros.de)        q = q.gte('criado_em', filtros.de);
  if(filtros.ate)       q = q.lte('criado_em', filtros.ate + 'T23:59:59');

  const termo = filtros.busca.replace(/[,()%\\]/g,' ').trim();
  if(termo){
    const partes = [
      'motivo.ilike.%'+termo+'%',
      'descricao.ilike.%'+termo+'%',
      'autor_nome.ilike.%'+termo+'%',
      'evento_nome.ilike.%'+termo+'%',
      'categoria.ilike.%'+termo+'%'
    ];
    if(/^\d+$/.test(termo)) partes.unshift('numero.eq.'+termo);
    q = q.or(partes.join(','));
  }

  const inicio = filtros.pagina * POR_PAGINA_ADMIN;
  const { data, error, count } = await q
    .order('criado_em', { ascending: filtros.ordem === 'antigas' })
    .range(inicio, inicio + POR_PAGINA_ADMIN - 1);

  if(error){ avisar('Erro: ' + error.message); return; }
  totalDenuncias = count || 0;

  const pendentes = (contadores.recebida||0) + (contadores.em_analise||0) + (contadores.aguardando_info||0) + (contadores.em_recurso||0);
  const cnt = el('cntDenuncias');
  cnt.hidden = !pendentes;
  cnt.textContent = pendentes;

  el('contagemPainel').textContent = totalDenuncias + (totalDenuncias===1?' denúncia':' denúncias');
  el('lista').innerHTML =
    painelContadores(contadores) +
    barraDeFiltros() +
    (data.length ? data.map(fichaDenuncia).join('') : semResultado()) +
    paginacao();

  restaurarFiltros();
}

async function contarPorStatus(){
  const contas = {};
  await Promise.all(Object.keys(STATUS).map(async s=>{
    const { count } = await db.from('denuncias')
      .select('id', { count:'exact', head:true }).eq('status', s);
    contas[s] = count || 0;
  }));
  return contas;
}

function painelContadores(c){
  return '<div class="contadores">' +
    Object.entries(STATUS).map(([valor, s])=>
      '<button class="contador-card'+(filtros.status===valor?' ativo':'')+'" data-status-rapido="'+valor+'">' +
        '<span class="contador-numero">'+(c[valor]||0)+'</span>' +
        '<span class="contador-rotulo">'+s.rotulo+'</span>' +
      '</button>').join('') +
  '</div>';
}

function barraDeFiltros(){
  return '<div class="filtros-admin">' +
    '<input id="fBusca" type="search" placeholder="Buscar por número, pessoa, assunto ou conteúdo...">' +
    '<select id="fStatus"><option value="">Todos os status</option>' +
      Object.entries(STATUS).map(([v,s])=>'<option value="'+v+'">'+s.rotulo+'</option>').join('') +
    '</select>' +
    '<select id="fCategoria"><option value="">Todas as categorias</option>' +
      CATEGORIAS_DENUNCIA.map(c=>'<option value="'+escapa(c)+'">'+escapa(c)+'</option>').join('') +
    '</select>' +
    '<select id="fAdmin"><option value="">Qualquer responsável</option>' +
      adminsDisponiveis.map(a=>'<option value="'+a.id+'">'+escapa(a.nome)+(a.id===perfilAtual.id?' (eu)':'')+'</option>').join('') +
    '</select>' +
    '<select id="fOrdem">' +
      '<option value="recentes">Mais recentes</option>' +
      '<option value="antigas">Mais antigas</option>' +
    '</select>' +
    '<label class="filtro-data">De <input id="fDe" type="date"></label>' +
    '<label class="filtro-data">Até <input id="fAte" type="date"></label>' +
    '<button class="mini" id="fLimpar">Limpar</button>' +
  '</div>';
}

function semResultado(){
  const filtrando = filtros.busca || filtros.status || filtros.categoria || filtros.de || filtros.ate;
  return '<div class="vazio"><strong>'+(filtrando?'Nada encontrado':'Tudo limpo')+'</strong>' +
    (filtrando ? 'Nenhuma denúncia bate com esses filtros.' : 'Nenhuma denúncia recebida até agora.') + '</div>';
}

function paginacao(){
  const paginas = Math.ceil(totalDenuncias / POR_PAGINA_ADMIN);
  if(paginas <= 1) return '';
  return '<div class="paginacao">' +
    '<button class="mini" id="pAnterior"'+(filtros.pagina===0?' disabled':'')+'>← Anterior</button>' +
    '<span>Página '+(filtros.pagina+1)+' de '+paginas+'</span>' +
    '<button class="mini" id="pProxima"'+(filtros.pagina>=paginas-1?' disabled':'')+'>Próxima →</button>' +
  '</div>';
}

function fichaDenuncia(d){
  const s = STATUS[d.status] || STATUS.recebida;
  const aberta = ['recebida','em_analise','aguardando_info'].includes(d.status);
  const emRecurso = d.status === 'em_recurso';

  return '<div class="ficha ficha-denuncia'+(d.urgente?' urgente':'')+'">' +
    '<div class="corpo">' +
      '<h4>' +
        '<span class="numero-denuncia">#'+d.numero+'</span> ' +
        escapa(d.alvo_nome || d.evento_nome || 'Conteúdo removido') +
        (d.urgente ? '<span class="tarja-urgente">parada há mais de 3 dias</span>' : '') +
      '</h4>' +
      '<div class="meta">' +
        'ABERTA EM '+fmtDataHora(d.criado_em)+'<br>' +
        'ALVO: '+escapa(({evento:'Evento',comentario:'Comentário',usuario:'Usuário'})[d.alvo_tipo] || d.alvo_tipo || 'Conteúdo')+'<br>' +
        'CATEGORIA: '+escapa(d.categoria || d.motivo)+'<br>' +
        'MOTIVO: '+escapa(d.motivo)+'<br>' +
        (d.descricao ? '<span class="descricao-denuncia">'+escapa(d.descricao)+'</span><br>' : '') +
        'DENUNCIANTE: '+escapa(d.autor_nome)+
        (d.denunciado_nome ? ' · DENUNCIADO: '+escapa(d.denunciado_nome) : '')+'<br>' +
        (d.admin_nome ? 'RESPONSÁVEL: '+escapa(d.admin_nome)+'<br>' : 'SEM RESPONSÁVEL AINDA<br>') +
        (d.decisao ? 'DECISÃO: '+escapa(DECISOES[d.decisao]||d.decisao)+'<br>' : '') +
        (d.medida  ? 'MEDIDA: '+escapa(MEDIDAS[d.medida]||d.medida)+'<br>' : '') +
        (d.evidencia_url ? '<button class="mini link-evidencia" data-evidencia="'+escapa(d.evidencia_url)+'">Ver evidência anexada</button><br>' : '') +
        (d.info_solicitada ? '<span class="recurso">INFORMAÇÃO SOLICITADA: '+escapa(d.info_solicitada)+'</span><br>' : '') +
        (d.info_resposta ? '<span class="recurso">RESPOSTA DO USUÁRIO: '+escapa(d.info_resposta)+'</span><br>' : '') +
        (d.recurso_texto ? '<span class="recurso">RECURSO: '+escapa(d.recurso_texto)+'</span><br>' : '') +
        (d.recurso_decisao ? '<span class="recurso">DECISÃO DO RECURSO: '+escapa(d.recurso_decisao==='aceito'?'Aceito':'Negado')+(d.recurso_resposta?' · '+escapa(d.recurso_resposta):'')+'</span><br>' : '') +
        (d.dias_de_prazo !== null && d.dias_de_prazo !== undefined
          ? '<span class="prazo">PRAZO DE RECURSO: '+d.dias_de_prazo+' DIA(S)</span><br>' : '') +
      '</div>' +
      '<button class="mini" data-historico="'+d.id+'">Ver histórico</button>' +
      '<div class="historico" id="hist-'+d.id+'" hidden></div>' +
    '</div>' +
    '<span class="selo '+s.cor+'">'+s.rotulo+'</span>' +
    '<div class="botoes">' +
      (aberta ? '<button class="mini" data-status="em_analise" data-id="'+d.id+'">Analisar</button>' : '') +
      (aberta ? '<button class="mini" data-pedir-info="'+d.id+'">Pedir informações</button>' : '') +
      (emRecurso ? '<button class="mini ok" data-recurso-aceitar="'+d.id+'">Aceitar recurso</button><button class="mini perigo" data-recurso-negar="'+d.id+'">Negar recurso</button>' : '') +
      (d.status !== 'resolvida' && d.status !== 'arquivada' && d.status !== 'em_recurso'
        ? '<button class="mini ok" data-resolver="'+d.id+'">Resolver</button>' : '') +
      (d.status !== 'arquivada' && d.status !== 'em_recurso'
        ? '<button class="mini" data-status="arquivada" data-id="'+d.id+'">Arquivar</button>' : '') +
      (d.alvo_tipo==='evento' && d.evento_id && d.evento_ativo
        ? '<button class="mini perigo" data-ocultar="'+d.evento_id+'">Ocultar evento</button>' : '') +
    '</div>' +
  '</div>';
}

async function mostrarHistorico(id){
  const caixa = el('hist-'+id);
  if(!caixa.hidden){ caixa.hidden = true; return; }

  caixa.hidden = false;
  caixa.innerHTML = '<p class="dica">Carregando...</p>';

  const { data, error } = await db.from('denuncia_historico')
    .select('*').eq('denuncia_id', id).order('criado_em', { ascending:true });

  if(error){ caixa.innerHTML = '<p class="dica">Não foi possível carregar.</p>'; return; }

  caixa.innerHTML = data.map(h=>
    '<div class="hist-item">' +
      '<span class="hist-quando">'+fmtDataHora(h.criado_em)+'</span>' +
      '<strong>'+escapa(h.ator_nome || 'sistema')+'</strong> · '+escapa(h.detalhe || h.acao) +
    '</div>').join('') || '<p class="dica">Sem registros.</p>';
}

/* fluxo de resolução: decisão + medida + resposta, tudo numa passada */
async function resolverDenuncia(id){
  const {data:denuncia,error:erroDenuncia}=await db.from('denuncias')
    .select('id,alvo_tipo').eq('id',id).single();
  if(erroDenuncia || !denuncia){ avisar('Não foi possível carregar a denúncia'); return; }

  const opcoes = Object.entries(DECISOES).map(([k,v],i)=>(i+1)+') '+v).join('\n');
  const escolha = prompt('Qual foi a decisão?\n\n'+opcoes+'\n\nDigite o número:');
  if(escolha === null) return;
  const decisao = Object.keys(DECISOES)[Number(escolha)-1];
  if(!decisao){ avisar('Opção inválida'); return; }

  const medidasPermitidas = denuncia.alvo_tipo==='usuario'
    ? Object.entries(MEDIDAS).filter(([k])=>k!=='remocao')
    : Object.entries(MEDIDAS);

  const listaMedidas = medidasPermitidas.map(([k,v],i)=>(i+1)+') '+v).join('\n');
  const qual = prompt('Medida a aplicar:\n\n'+listaMedidas+'\n\nDigite o número:');
  if(qual === null) return;
  const itemMedida = medidasPermitidas[Number(qual)-1];
  const medida = itemMedida ? itemMedida[0] : null;
  if(!medida){ avisar('Opção inválida'); return; }

  let dias = 7;
  if(medida === 'suspensao'){
    const d = prompt('Suspender por quantos dias?', '7');
    if(d === null) return;
    dias = Number(d) || 7;
  }

  const resposta = prompt('Mensagem para quem denunciou (opcional):', '');
  if(resposta === null) return;

  const dados = { status:'resolvida', decisao };
  if(resposta.trim()) dados.resposta = resposta.trim();

  const r = await db.from('denuncias').update(dados).eq('id', id);
  if(r.error){ avisar('Erro: ' + r.error.message); return; }

  if(medida !== 'nenhuma'){
    const m = await db.rpc('aplicar_medida', { p_denuncia:id, p_medida:medida, p_dias:dias });
    if(m.error){ avisar('Status salvo, mas a medida falhou: ' + m.error.message); }
  }else{
    await db.from('denuncias').update({ medida:'nenhuma' }).eq('id', id);
  }

  avisar('Denúncia resolvida. Quem denunciou foi notificado.');
  listarDenuncias();
}

function restaurarFiltros(){
  const busca = el('fBusca');
  busca.value = filtros.busca;
  el('fStatus').value = filtros.status;
  el('fCategoria').value = filtros.categoria;
  el('fAdmin').value = filtros.admin;
  el('fOrdem').value = filtros.ordem;
  el('fDe').value = filtros.de;
  el('fAte').value = filtros.ate;

  let espera;
  busca.addEventListener('input', e=>{
    filtros.busca = e.target.value; filtros.pagina = 0;
    clearTimeout(espera);
    espera = setTimeout(listarDenuncias, 350);
  });
  if(document.activeElement !== busca && filtros.busca){
    busca.focus();
    busca.setSelectionRange(busca.value.length, busca.value.length);
  }

  const trocar = (id, campo)=> el(id).addEventListener('change', e=>{
    filtros[campo] = e.target.value; filtros.pagina = 0; listarDenuncias();
  });
  trocar('fStatus','status'); trocar('fCategoria','categoria');
  trocar('fAdmin','admin');   trocar('fOrdem','ordem');
  trocar('fDe','de');         trocar('fAte','ate');

  el('fLimpar').addEventListener('click', ()=>{
    Object.assign(filtros, { busca:'', status:'', categoria:'', admin:'', de:'', ate:'', ordem:'recentes', pagina:0 });
    listarDenuncias();
  });

  document.querySelectorAll('[data-status-rapido]').forEach(b=>b.addEventListener('click', ()=>{
    filtros.status = filtros.status === b.dataset.statusRapido ? '' : b.dataset.statusRapido;
    filtros.pagina = 0; listarDenuncias();
  }));

  const ant = el('pAnterior'), prox = el('pProxima');
  if(ant)  ant.addEventListener('click',  ()=>{ filtros.pagina--; listarDenuncias(); });
  if(prox) prox.addEventListener('click', ()=>{ filtros.pagina++; listarDenuncias(); });
}

/* ============================================================
   EVENTOS  (o admin enxerga inclusive os ocultos)
   ============================================================ */
async function listarEventos(){
  const { data, error } = await db
    .from('eventos')
    .select('id, nome, data_evento, cidade, ativo, situacao, imagem_url, criador_id, perfis:criador_id(nome)')
    .order('criado_em', { ascending:false });

  if(error){ avisar('Erro: ' + error.message); return; }
  el('contagemPainel').textContent = data.length + (data.length===1?' evento':' eventos');
  if(!data.length){ vazio('Nenhum evento publicado ainda.'); return; }

  el('lista').innerHTML = data.map(ev=>
    '<div class="ficha">' +
      '<div class="corpo">' +
        '<h4>'+escapa(ev.nome)+'</h4>' +
        '<div class="meta">'+fmtData(ev.data_evento)+' · '+escapa(ev.cidade||'—')+
          ' · POR '+escapa(ev.perfis ? ev.perfis.nome : '—')+'</div>' +
      '</div>' +
      (ev.situacao && ev.situacao!=='agendado' ? '<span class="selo '+(ev.situacao==='cancelado'?'bloqueado':'oculto')+'">'+escapa(ev.situacao)+'</span>' : '') +
      (ev.ativo ? '' : '<span class="selo oculto">oculto</span>') +
      '<div class="botoes">' +
        (ev.ativo
          ? '<button class="mini perigo" data-ocultar="'+ev.id+'">Ocultar</button>'
          : '<button class="mini ok" data-mostrar="'+ev.id+'">Publicar de novo</button>') +
        '<button class="mini perigo" data-apagar="'+ev.id+'">Excluir</button>' +
      '</div>' +
    '</div>').join('');
}

/* ============================================================
   USUÁRIOS
   ============================================================ */
async function listarUsuarios(){
  const { data, error } = await db
    .from('perfis')
    .select('id, nome, email, papel, bloqueado, criado_em')
    .order('criado_em', { ascending:false });

  if(error){ avisar('Erro: ' + error.message); return; }
  el('contagemPainel').textContent = data.length + (data.length===1?' conta':' contas');

  el('lista').innerHTML = data.map(u=>{
    const souEu = u.id === perfilAtual.id;
    return '<div class="ficha">' +
      '<div class="corpo">' +
        '<h4>'+escapa(u.nome)+(souEu?' (você)':'')+'</h4>' +
        '<div class="meta">'+escapa(u.email||'—')+' · DESDE '+fmtData(u.criado_em)+'</div>' +
      '</div>' +
      (u.papel==='admin' ? '<span class="selo admin">admin</span>' : '') +
      (u.bloqueado ? '<span class="selo bloqueado">bloqueado</span>' : '') +
      '<div class="botoes">' +
        (souEu ? '' :
          (u.bloqueado
            ? '<button class="mini ok" data-desbloquear="'+u.id+'">Desbloquear</button>'
            : '<button class="mini perigo" data-bloquear="'+u.id+'">Bloquear</button>') +
          (u.papel==='admin'
            ? '<button class="mini" data-rebaixar="'+u.id+'">Tirar admin</button>'
            : '<button class="mini" data-promover="'+u.id+'">Tornar admin</button>') +
          '<button class="mini perigo" data-excluir-conta="'+u.id+'">Excluir conta</button>'
        ) +
      '</div>' +
    '</div>';
  }).join('');
}

/* ============================================================
   AUDITORIA — tudo que os administradores fizeram
   ============================================================ */
async function listarAuditoria(){
  const { data, error } = await db.from('log_admin')
    .select('*').order('criado_em', { ascending:false }).limit(200);

  if(error){ avisar('Erro: ' + error.message); return; }
  el('contagemPainel').textContent = data.length + (data.length===1?' registro':' registros');

  if(!data.length){ vazio('Nenhuma ação registrada ainda.'); return; }

  el('lista').innerHTML = data.map(l=>
    '<div class="ficha">' +
      '<div class="corpo">' +
        '<h4>'+escapa(l.detalhe || l.acao)+'</h4>' +
        '<div class="meta">' +
          escapa(l.admin_nome || 'administrador removido') + ' · ' + fmtDataHora(l.criado_em) +
          (l.alvo_tipo ? '<br>ALVO: '+escapa(l.alvo_tipo) : '') +
        '</div>' +
      '</div>' +
      '<span class="selo oculto">'+escapa(l.acao)+'</span>' +
    '</div>').join('');
}

/* ============================================================
   AÇÕES
   ============================================================ */
document.addEventListener('click', async e=>{
  const alvo = e.target.closest('button[data-ocultar],button[data-mostrar],button[data-apagar],' +
    'button[data-bloquear],button[data-desbloquear],button[data-promover],button[data-rebaixar],' +
    'button[data-excluir-conta],button[data-status],button[data-historico],button[data-resolver],' +
    'button[data-evidencia],button[data-pedir-info],button[data-recurso-aceitar],button[data-recurso-negar]');
  if(!alvo) return;

  const d = alvo.dataset;
  let r;

  if(d.historico){ await mostrarHistorico(d.historico); return; }
  if(d.resolver){ await resolverDenuncia(d.resolver); return; }
  if(d.evidencia){
    const { data, error } = await db.storage.from('denuncias').createSignedUrl(d.evidencia, 120);
    if(error || !data){ avisar('Não foi possível abrir a evidência'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
    return;
  }
  if(d.pedirInfo){
    const pergunta = prompt('Que informação você precisa do denunciante?');
    if(pergunta === null) return;
    if(pergunta.trim().length < 5){ avisar('Escreva uma solicitação mais clara'); return; }
    r = await db.from('denuncias').update({ status:'aguardando_info', info_solicitada:pergunta.trim(), info_resposta:null, info_respondida_em:null }).eq('id', d.pedirInfo);
    if(!r.error) avisar('Solicitação enviada ao denunciante.');
  }
  if(d.recursoAceitar || d.recursoNegar){
    const id = d.recursoAceitar || d.recursoNegar;
    const decisao = d.recursoAceitar ? 'aceito' : 'negado';
    const resposta = prompt(decisao==='aceito' ? 'Resposta ao aceitar o recurso (opcional):' : 'Explique por que a decisão foi mantida (opcional):', '');
    if(resposta === null) return;
    r = await db.rpc('admin_decidir_recurso', { p_denuncia:id, p_decisao:decisao, p_resposta:resposta.trim() || null });
    if(!r.error) avisar(decisao==='aceito' ? 'Recurso aceito. A denúncia voltou para análise.' : 'Recurso negado. O usuário foi notificado.');
  }

  if(d.status){
    const dados = { status: d.status };

    if(d.status === 'arquivada'){
      const resposta = prompt('Mensagem para quem denunciou (opcional):', '');
      if(resposta === null) return;                 // desistiu
      if(resposta.trim()) dados.resposta = resposta.trim();
    }

    r = await db.from('denuncias').update(dados).eq('id', d.id);
    if(!r.error) avisar('Status atualizado. Quem denunciou foi notificado.');
  }

  if(d.ocultar){
    r = await db.from('eventos').update({ ativo:false }).eq('id', d.ocultar);
    if(!r.error) avisar('Evento ocultado do site');
  }
  else if(d.mostrar){
    r = await db.from('eventos').update({ ativo:true }).eq('id', d.mostrar);
    if(!r.error) avisar('Evento voltou a aparecer');
  }
  else if(d.apagar){
    if(!confirm('Excluir este evento em definitivo? Some também dos favoritos e interesses de todo mundo.')) return;
    const anterior=await db.from('eventos').select('id,imagem_url').eq('id',d.apagar).single();
    r = await db.from('eventos').delete().eq('id', d.apagar);
    if(!r.error){
      const caminho=anterior.data && caminhoStoragePublico(anterior.data.imagem_url,'eventos');
      if(caminho) await db.storage.from('eventos').remove([caminho]);
      avisar('Evento excluído');
    }
  }
  else if(d.bloquear){
    if(!confirm('Bloquear esta conta? A pessoa perde o acesso na hora.')) return;
    r = await db.rpc('admin_definir_bloqueio', { p_usuario:d.bloquear, p_bloqueado:true });
    if(!r.error) avisar('Conta bloqueada');
  }
  else if(d.desbloquear){
    r = await db.rpc('admin_definir_bloqueio', { p_usuario:d.desbloquear, p_bloqueado:false });
    if(!r.error) avisar('Conta liberada');
  }
  else if(d.promover){
    if(!confirm('Dar poderes de administrador para esta conta?')) return;
    r = await db.rpc('admin_definir_papel', { p_usuario:d.promover, p_papel:'admin' });
    if(!r.error) avisar('Agora é administrador');
  }
  else if(d.rebaixar){
    r = await db.rpc('admin_definir_papel', { p_usuario:d.rebaixar, p_papel:'usuario' });
    if(!r.error) avisar('Voltou a ser usuário comum');
  }
  else if(d.excluirConta){
    const { data: conta, error: erroConta } = await db.from('perfis')
      .select('id,nome,email,papel')
      .eq('id', d.excluirConta)
      .single();

    if(erroConta || !conta){ avisar('Não foi possível localizar essa conta'); return; }

    const [eventos, comentarios] = await Promise.all([
      db.from('eventos').select('id', { count:'exact', head:true }).eq('criador_id', conta.id),
      db.from('comentarios').select('id', { count:'exact', head:true }).eq('autor_id', conta.id)
    ]);

    const resumo =
      'Excluir definitivamente a conta de '+conta.nome+' ('+(conta.email||'sem e-mail')+')?\n\n' +
      'Serão removidos também '+(eventos.count||0)+' evento(s) e '+(comentarios.count||0)+' comentário(s) dessa conta. ' +
      'Denúncias históricas serão preservadas e ficarão sem vínculo com a pessoa.';

    if(!confirm(resumo)) return;

    const frase = prompt('Para confirmar, digite exatamente: EXCLUIR CONTA');
    if(frase !== 'EXCLUIR CONTA'){
      avisar('Exclusão cancelada');
      return;
    }

    alvo.disabled = true;
    alvo.textContent = 'Excluindo...';
    r = await db.rpc('admin_excluir_conta', { p_usuario: conta.id });
    if(!r.error){
      const limpeza=await Promise.all([
        limparPastaStorage('eventos',conta.id),
        limparPastaStorage('avatares',conta.id),
        limparPastaStorage('denuncias',conta.id)
      ]);
      avisar(limpeza.every(Boolean)
        ? 'Conta excluída definitivamente e imagens pessoais removidas'
        : 'Conta excluída. Algumas imagens antigas podem precisar de limpeza manual.');
    }
  }

  if(r && r.error){
    avisar(r.error.message.toLowerCase().includes('row-level security')
      ? 'O banco recusou: sua conta não tem permissão'
      : 'Erro: ' + r.error.message);
    return;
  }
  carregar();
});

iniciar();