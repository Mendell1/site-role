/* ============================================================
   PERFIL V15 — página dedicada inspirada no protótipo Lovable
   ============================================================ */

const campo = id => document.getElementById(id);
const abrir = id => campo(id) && campo(id).classList.add('aberta');
const fecharTudo = () => document.querySelectorAll('.cortina.aberta').forEach(m=>m.classList.remove('aberta'));
const meuId = () => Sessao.usuario ? Sessao.usuario.id : null;
const escapa = t => String(t==null?'':t).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const hoje = new Date(); hoje.setHours(0,0,0,0);
let avisoTimer;
function avisar(txt){
  const a = campo('aviso');
  if(!a) return;
  a.textContent = txt;
  a.classList.add('mostra');
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(()=>a.classList.remove('mostra'), 3400);
}
window.avisar = avisar;

function traduzirErroBanco(e){
  const m=(e&&e.message||'').toLowerCase();
  if(m.includes('row-level security')) return 'Sem permissão para esta ação. Confira se você está logado.';
  if(m.includes('duplicate')) return 'Esse registro já existe';
  if(m.includes('failed to fetch')) return 'Sem conexão com o servidor';
  return 'Erro: '+(e&&e.message||'desconhecido');
}

function iniciais(nome){
  return String(nome||'?').trim().split(/\s+/).slice(0,2).map(x=>x.charAt(0).toUpperCase()).join('') || '?';
}
function dataDe(ev){ return new Date((ev.data_evento || new Date().toISOString().slice(0,10)) + 'T00:00:00'); }
function hora(ev){ return (ev.hora_evento || '').slice(0,5) || '—'; }
function dataLista(d){ return d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'}).replace('.', ''); }
function dataEntrada(d){ return d.toLocaleDateString('pt-BR',{month:'long', year:'numeric'}); }
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
const SITUACOES_EVENTO = { agendado:'Agendado', adiado:'Adiado', esgotado:'Esgotado', cancelado:'Cancelado', finalizado:'Finalizado' };

let meusEventos=[];
let favoritosEventos=[];
const favoritos = new Set();
const interesses = new Set();
let perfilOriginal = null;

function carregarPreferenciasDoPerfil(p){
  if(!p) return;
  if(campo('sw_interesse')) campo('sw_interesse').checked = p.notif_eventos !== false;
  if(campo('sw_comentarios')) campo('sw_comentarios').checked = p.notif_comentarios !== false;
  if(campo('sw_denuncias')) campo('sw_denuncias').checked = p.notif_denuncias !== false;
  if(campo('sw_resumo')) campo('sw_resumo').checked = p.notif_resumo === true;
}


function preencherFormularioPerfil(p){
  perfilOriginal = { ...p };
  if(campo('p_nome')) campo('p_nome').value = p.nome || '';
  if(campo('p_cidade')) campo('p_cidade').value = p.cidade || '';
  if(campo('p_bio')) campo('p_bio').value = (p.bio || '').slice(0,280);
  if(campo('p_contato')) campo('p_contato').value = p.contato || '';
  if(campo('p_foto')) campo('p_foto').value = '';
  if(campo('a_email')) campo('a_email').value = p.email || (Sessao.usuario && Sessao.usuario.email) || '';
  carregarPreferenciasDoPerfil(p);
}

function renderResumoPerfil(){
  if(!Sessao.perfil) return;
  const p = Sessao.perfil;
  campo('perfilHero').hidden = false;
  campo('perfilMain').hidden = false;
  campo('estadoSemSessao').hidden = true;
  campo('perfilAvatarBloco').innerHTML = p.foto_url ? '<img src="'+escapa(p.foto_url)+'" alt="">' : escapa(iniciais(p.nome));
  campo('perfilNomeTitulo').textContent = p.nome || 'Meu perfil';
  if(campo('perfilKicker')) campo('perfilKicker').textContent = p.papel === 'admin' ? 'ORGANIZADOR VERIFICADO PELA MODERAÇÃO' : 'ORGANIZADOR DO ROLÊ';
  campo('perfilBioResumo').textContent = p.bio || 'Conte para a comunidade quem você é, o que organiza e como as pessoas podem encontrar seus eventos.';
  campo('perfilCidadeResumo').textContent = p.cidade || 'Cidade não informada';
  const totalInteresses = meusEventos.reduce((acc,ev)=>acc + Number(ev.total_interessados || 0), 0);
  campo('perfilTotalEventos').textContent = meusEventos.length + (meusEventos.length === 1 ? ' evento' : ' eventos');
  campo('perfilTotalInteresses').textContent = totalInteresses + (totalInteresses === 1 ? ' interessado' : ' interessados');
  const desde = p.termos_aceitos_em || p.created_at || Sessao.usuario.created_at;
  campo('perfilDesdeResumo').textContent = 'No Rolê desde ' + dataEntrada(new Date(desde || Date.now()));
  preencherFormularioPerfil(p);
}

function renderCards(lista, destinoId, vazioId){
  const alvo = campo(destinoId), vazio = campo(vazioId);
  if(!alvo || !vazio) return;
  if(!lista.length){
    alvo.innerHTML = '';
    vazio.hidden = false;
    return;
  }
  vazio.hidden = true;
  alvo.innerHTML = lista.map(ev=>{
    const d = dataDe(ev);
    const dia = String(d.getDate()).padStart(2,'0');
    const mes = d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase();
    const situacao=(ev.situacao && ev.situacao!=='agendado')
      ? '<span class="situacao-evento situacao-'+escapa(ev.situacao)+'">'+escapa(SITUACOES_EVENTO[ev.situacao] || ev.situacao)+'</span>' : '';
    const fav = favoritos.has(ev.id), interesse = interesses.has(ev.id);
    return '<article class="evento-card" data-ev="'+ev.id+'">'+
      '<div class="evento-media">'+
        '<img class="capa" src="'+escapa(imagemFallback(ev))+'" alt="'+escapa(ev.nome)+'">'+
        '<span class="data-bloco"><strong>'+dia+'</strong><small>'+mes+'</small></span>'+
        '<span class="preco-badge '+(ev.gratuito?'gratis':'')+'">'+(ev.gratuito?'GRÁTIS':'R$ '+Number(ev.valor||0).toFixed(2).replace('.',','))+'</span>'+
      '</div>'+
      '<div class="evento-conteudo">'+
        '<div class="evento-tags"><span class="tag categoria-pill" data-cat="'+escapa(ev.categoria_id)+'"><i aria-hidden="true"></i>'+escapa(ev.categoria_nome||'Evento')+'</span>'+situacao+'</div>'+
        '<h3>'+escapa(ev.nome)+'</h3>'+
        '<ul class="evento-meta">'+
          '<li><span aria-hidden="true">▣</span> '+escapa(dataLista(d))+' <span class="meta-sep">◷</span> '+escapa(hora(ev))+'</li>'+
          '<li><span aria-hidden="true">⌖</span> '+escapa([ev.bairro,ev.cidade].filter(Boolean).join(', ') || 'Local a confirmar')+'</li>'+
          '<li><span aria-hidden="true">♙</span> '+(ev.total_interessados||0)+' pessoas com interesse</li>'+
        '</ul>'+
        '<div class="evento-rodape">'+
          '<div class="organizador-card" role="presentation">'+
            (ev.criador_foto
              ? '<span class="avatar-card avatar-foto"><img src="'+escapa(ev.criador_foto)+'" alt=""></span>'
              : '<span class="avatar-card">'+escapa(iniciais(ev.criador_nome||Sessao.perfil?.nome||'Você'))+'</span>'
            )+
            '<span>'+escapa(ev.criador_nome||Sessao.perfil?.nome||'Você')+'</span></div>'+
          '<div class="evento-acoes">'+
            '<button class="fav-card" data-fav="'+ev.id+'" type="button" aria-pressed="'+(fav?'true':'false')+'">'+(fav?'★':'☆')+'</button>'+
            '<button class="interesse-card '+(interesse?'ativo':'')+'" data-interesse="'+ev.id+'" type="button" aria-pressed="'+(interesse?'true':'false')+'">'+(interesse?'Tenho interesse':'Marcar interesse')+'</button>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</article>';
  }).join('');
}

async function carregarMeusVinculos(){
  favoritos.clear(); interesses.clear();
  if(!Sessao.logado()) return;
  const [fav, itr] = await Promise.all([
    db.from('favoritos').select('evento_id').eq('usuario_id', meuId()),
    db.from('interesses').select('evento_id').eq('usuario_id', meuId())
  ]);
  if(!fav.error) (fav.data||[]).forEach(x=>favoritos.add(x.evento_id));
  if(!itr.error) (itr.data||[]).forEach(x=>interesses.add(x.evento_id));
}

async function carregarEventosPerfil(){
  if(!Sessao.logado()) return;
  await carregarMeusVinculos();
  const [meus, favs] = await Promise.all([
    db.from('eventos_lista').select('*').eq('criador_id', meuId()).eq('ativo', true).order('data_evento',{ascending:true}).order('hora_evento',{ascending:true}),
    favoritos.size ? db.from('eventos_lista').select('*').in('id', [...favoritos]).eq('ativo', true).order('data_evento',{ascending:true}).order('hora_evento',{ascending:true}) : Promise.resolve({data:[], error:null})
  ]);
  meusEventos = meus.data || [];
  favoritosEventos = favs.data || [];
  renderCards(meusEventos, 'gradeMeusEventos', 'vazioMeusEventos');
  renderCards(favoritosEventos, 'gradeFavoritos', 'vazioFavoritos');
  renderResumoPerfil();
}

async function alternarFav(id){
  if(!Sessao.logado()){ abrir('modalLogin'); return; }
  const tinha = favoritos.has(id);
  if(tinha) favoritos.delete(id); else favoritos.add(id);
  renderCards(meusEventos, 'gradeMeusEventos', 'vazioMeusEventos');
  renderCards(favoritosEventos, 'gradeFavoritos', 'vazioFavoritos');

  const {error} = tinha
    ? await db.from('favoritos').delete().eq('usuario_id', meuId()).eq('evento_id', id)
    : await db.from('favoritos').insert({usuario_id:meuId(), evento_id:id});
  if(error){
    if(tinha) favoritos.add(id); else favoritos.delete(id);
    renderCards(meusEventos, 'gradeMeusEventos', 'vazioMeusEventos');
    renderCards(favoritosEventos, 'gradeFavoritos', 'vazioFavoritos');
    avisar(traduzirErroBanco(error));
    return;
  }
  await carregarEventosPerfil();
}

async function alternarInteresse(id){
  if(!Sessao.logado()){ abrir('modalLogin'); return; }
  const tinha = interesses.has(id);
  if(tinha) interesses.delete(id); else interesses.add(id);

  const atualizarLista = lista => lista.map(ev => ev.id === id ? { ...ev, total_interessados: Math.max(0, Number(ev.total_interessados||0) + (tinha ? -1 : 1)) } : ev);
  meusEventos = atualizarLista(meusEventos);
  favoritosEventos = atualizarLista(favoritosEventos);
  renderCards(meusEventos, 'gradeMeusEventos', 'vazioMeusEventos');
  renderCards(favoritosEventos, 'gradeFavoritos', 'vazioFavoritos');

  const {error} = tinha
    ? await db.from('interesses').delete().eq('usuario_id', meuId()).eq('evento_id', id)
    : await db.from('interesses').insert({usuario_id:meuId(), evento_id:id});
  if(error){
    if(tinha) interesses.add(id); else interesses.delete(id);
    // Volta para a verdade do banco em vez de aplicar a mesma variação duas vezes.
    await carregarEventosPerfil();
    avisar(traduzirErroBanco(error));
    return;
  }
  renderResumoPerfil();
}

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

async function salvarPerfilPagina(){
  if(!Sessao.logado()) return;
  const btn = campo('btnSalvarPerfilPagina');
  const nome = campo('p_nome').value.trim();
  if(nome.length < 2){ avisar('Informe seu nome'); return; }

  btn.disabled = true; btn.textContent = 'Salvando...';
  let fotoNova = null;
  const fotoAntiga = Sessao.perfil && Sessao.perfil.foto_url;
  try{
    fotoNova = await enviarAvatar(campo('p_foto').files[0]);
    const dados = {
      nome,
      bio: campo('p_bio').value.trim() || null,
      cidade: campo('p_cidade').value.trim() || null,
      contato: campo('p_contato').value.trim() || null,
      notif_eventos: campo('sw_interesse') ? campo('sw_interesse').checked : true,
      notif_comentarios: campo('sw_comentarios') ? campo('sw_comentarios').checked : true,
      notif_denuncias: campo('sw_denuncias') ? campo('sw_denuncias').checked : true,
      notif_resumo: campo('sw_resumo') ? campo('sw_resumo').checked : false
    };
    if(fotoNova) dados.foto_url = fotoNova.url;

    const { data, error } = await db.from('perfis').update(dados).eq('id', meuId()).select().single();
    if(error) throw error;

    if(fotoNova && fotoAntiga && fotoAntiga!==fotoNova.url) await removerArquivoPublico('avatares', fotoAntiga);
    Sessao.perfil = { ...Sessao.perfil, ...data };
    perfilOriginal = { ...Sessao.perfil };
    atualizarTopo();
    renderResumoPerfil();
    avisar('Perfil atualizado');
  }catch(err){
    if(fotoNova) await db.storage.from('avatares').remove([fotoNova.caminho]);
    avisar(err.message && err.message.includes('18 anos') ? 'A plataforma é restrita a maiores de 18 anos' : traduzirErroBanco(err));
  }finally{
    btn.disabled = false; btn.textContent = 'Salvar alterações';
  }
}

function descartarPerfil(){
  if(!perfilOriginal) return;
  preencherFormularioPerfil(perfilOriginal);
  carregarPreferenciasDoPerfil(perfilOriginal);
  avisar('Alterações descartadas');
}

async function carregarNotificacoes({abrirLista=false}={}){
  if(!Sessao.logado()) return;
  const { data, error } = await db.from('notificacoes').select('*').order('criado_em', { ascending:false }).limit(30);
  if(error) return;
  const naoLidas = data.filter(n=>!n.lida).length;
  if(campo('badgeNotificacoes')){
    campo('badgeNotificacoes').hidden = naoLidas === 0;
    campo('badgeNotificacoes').textContent = naoLidas;
  }

  const html = data.length ? data.map(n=>{
    const tipo = n.denuncia_id ? 'denuncia' : /coment/i.test(n.titulo || '') ? 'comentario' : /adiad|cancelad|evento/i.test((n.titulo||'')+' '+(n.mensagem||'')) ? 'evento' : 'geral';
    const icones = { denuncia:'⚑', comentario:'□', evento:'▣', geral:'○' };
    return '<article class="notificacao-card-lovable'+(n.lida?'':' nova')+'">'+
      '<div class="notificacao-icone">'+icones[tipo]+'</div>'+
      '<div class="notificacao-corpo">'+
        '<strong>'+escapa(n.titulo)+'</strong>'+
        '<p>'+escapa(n.mensagem)+'</p>'+
        '<span class="notificacao-tempo">'+new Date(n.criado_em).toLocaleString('pt-BR')+'</span>'+
      '</div>'+
      (!n.lida ? '<span class="notificacao-ponto" aria-hidden="true"></span>' : '')+
    '</article>';
  }).join('') : '<p class="dica">Nenhuma notificação por aqui.</p>';

  campo('listaNotificacoes').innerHTML = html;
  if(abrirLista) abrir('modalNotificacoes');
}

const STATUS_DENUNCIA_USUARIO = {
  recebida:'Recebida', em_analise:'Em análise', aguardando_info:'Aguardando informações',
  resolvida:'Resolvida', em_recurso:'Em recurso', arquivada:'Arquivada'
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

  if(error){ caixa.innerHTML = '<p class="dica">Não foi possível carregar suas denúncias.</p>'; return; }
  if(!data || !data.length){ caixa.innerHTML = '<p class="dica">Você ainda não enviou nenhuma denúncia.</p>'; return; }

  const agora = new Date();
  caixa.innerHTML = data.map(d=>{
    const prazo = d.prazo_recurso ? new Date(d.prazo_recurso) : null;
    const podeRecorrer = d.status === 'resolvida' && !d.recurso_texto && prazo && prazo > agora;
    const dias = prazo ? Math.max(0, Math.ceil((prazo - agora) / 86400000)) : null;
    const aguardandoInfo = d.status === 'aguardando_info';
    const decisaoRecurso = d.recurso_decisao === 'aceito' ? 'ACEITO' : d.recurso_decisao === 'negado' ? 'NEGADO' : null;

    return '<div class="ficha" style="margin-bottom:12px">'+
      '<div class="corpo">'+
        '<h4>Denúncia #'+d.numero+'</h4>'+
        '<div class="meta">STATUS: '+escapa(STATUS_DENUNCIA_USUARIO[d.status] || d.status)+'<br>MOTIVO: '+escapa(d.motivo || '')+'<br>ENVIADA: '+new Date(d.criado_em).toLocaleString('pt-BR')+'<br>'+
        (d.resposta ? '<span class="descricao-denuncia">RESPOSTA DA MODERAÇÃO: '+escapa(d.resposta)+'</span><br>' : '')+
        (dias !== null && d.status === 'resolvida' && !d.recurso_texto ? 'PRAZO DE RECURSO: '+dias+' DIA(S)<br>' : '')+'</div>'+
        (d.info_solicitada ? '<div class="alerta"><strong>Informações solicitadas pela moderação</strong><p>'+escapa(d.info_solicitada)+'</p></div>' : '') +
        (d.info_resposta ? '<div class="alerta"><strong>Sua resposta</strong><p>'+escapa(d.info_resposta)+'</p></div>' : '') +
        (aguardandoInfo && !d.info_resposta ? '<div class="campo" style="margin-top:10px"><label for="info-'+d.id+'">Enviar informações</label><textarea id="info-'+d.id+'" maxlength="2000" placeholder="Responda ao que a moderação solicitou"></textarea></div><button class="mini" data-enviar-info="'+d.id+'">Enviar informações</button>' : '') +
        (d.recurso_texto ? '<div class="alerta"><strong>Recurso enviado'+(decisaoRecurso?' · '+decisaoRecurso:'')+'</strong><p>'+escapa(d.recurso_texto)+'</p>'+(d.recurso_resposta?'<p><strong>Resposta da moderação:</strong> '+escapa(d.recurso_resposta)+'</p>':'')+'</div>' : '') +
        (podeRecorrer ? '<div class="campo" style="margin-top:10px"><label for="recurso-'+d.id+'">Recurso</label><textarea id="recurso-'+d.id+'" maxlength="1500" placeholder="Explique por que deseja que a decisão seja revista"></textarea></div><button class="mini" data-enviar-recurso="'+d.id+'">Enviar recurso</button>' : '') +
      '</div>'+
    '</div>';
  }).join('');
}

const FRASE_EXCLUSAO = 'EXCLUIR MINHA CONTA';
const GOOGLE_REAUTH_UID = 'role_exclusao_google_uid';
const GOOGLE_REAUTH_AT = 'role_exclusao_google_reauth_at';
const REAUTH_JANELA_MS = 10 * 60 * 1000;

function provedoresDaConta(){
  const u = Sessao.usuario || {};
  const app = u.app_metadata || {};
  const lista = Array.isArray(app.providers) ? app.providers.slice() : [];
  if(app.provider && !lista.includes(app.provider)) lista.push(app.provider);
  (u.identities || []).forEach(i=>{ if(i.provider && !lista.includes(i.provider)) lista.push(i.provider); });
  return lista;
}
function contaSomenteGoogle(){
  const p = provedoresDaConta();
  return p.includes('google') && !p.includes('email');
}
function reauthGoogleValida(){
  const quando = Number(sessionStorage.getItem(GOOGLE_REAUTH_AT) || 0);
  return quando > 0 && Date.now() - quando <= REAUTH_JANELA_MS;
}
function configurarExclusaoPorProvedor(){
  const senha = campo('x_senha');
  const blocoSenha = senha && senha.closest('.campo');
  const acoes = campo('btnConfirmarExclusao') && campo('btnConfirmarExclusao').closest('.acoes');
  let btnGoogle = campo('btnReautenticarGoogleExclusao');
  let info = campo('infoReauthGoogleExclusao');

  if(contaSomenteGoogle()){
    if(blocoSenha) blocoSenha.hidden = true;
    if(!info){
      info = document.createElement('div');
      info.id = 'infoReauthGoogleExclusao';
      info.className = 'alerta';
      info.innerHTML = '<strong>Conta conectada pelo Google</strong><p>Antes de excluir, confirme sua identidade novamente com a mesma conta Google.</p>';
      if(acoes) acoes.parentNode.insertBefore(info, acoes);
    }
    if(!btnGoogle && acoes){
      btnGoogle = document.createElement('button');
      btnGoogle.type = 'button';
      btnGoogle.id = 'btnReautenticarGoogleExclusao';
      btnGoogle.className = 'btn-linha';
      btnGoogle.textContent = 'Confirmar novamente com Google';
      btnGoogle.addEventListener('click', reautenticarGoogleParaExclusao);
      acoes.insertBefore(btnGoogle, campo('btnConfirmarExclusao'));
    }
    if(btnGoogle){
      btnGoogle.hidden = reauthGoogleValida();
      if(reauthGoogleValida()) info.innerHTML = '<strong>Identidade confirmada</strong><p>Agora marque a confirmação e digite a frase abaixo para continuar.</p>';
    }
  }else{
    if(blocoSenha) blocoSenha.hidden = false;
    if(btnGoogle) btnGoogle.hidden = true;
    if(info) info.hidden = true;
  }
}
function validarExclusao(){
  const identidadeOk = contaSomenteGoogle() ? reauthGoogleValida() : campo('x_senha').value.length > 0;
  const ok = campo('x_ciente').checked && identidadeOk && campo('x_confirmacao').value.trim().toUpperCase() === FRASE_EXCLUSAO;
  campo('btnConfirmarExclusao').disabled = !ok;
}
async function reautenticarGoogleParaExclusao(){
  if(!Sessao.usuario) return;
  sessionStorage.setItem(GOOGLE_REAUTH_UID, Sessao.usuario.id);
  sessionStorage.removeItem(GOOGLE_REAUTH_AT);
  // O Supabase já possui index.html na allowlist de Redirect URLs.
  // Voltamos por ele e o google-auth.js encaminha para o perfil.
  const destino = new URL('index.html', location.href);
  destino.search = '';
  destino.hash = '';
  const { error } = await db.auth.signInWithOAuth({
    provider:'google',
    options:{ redirectTo:destino.href, queryParams:{ prompt:'select_account' } }
  });
  if(error) avisar('Não foi possível confirmar pelo Google: '+error.message);
}
async function prepararExclusao(){
  campo('x_ciente').checked = false;
  campo('x_senha').value = '';
  campo('x_confirmacao').value = '';
  configurarExclusaoPorProvedor();
  validarExclusao();
  const [ev, co] = await Promise.all([
    db.from('eventos').select('id', { count:'exact', head:true }).eq('criador_id', meuId()),
    db.from('comentarios').select('id', { count:'exact', head:true }).eq('autor_id', meuId())
  ]);
  campo('resumoExclusao').innerHTML = '<li>seu perfil e sua foto</li><li><strong>'+(ev.count||0)+'</strong> evento(s) que você publicou</li><li><strong>'+(co.count||0)+'</strong> comentário(s) seus</li><li>seus favoritos e interesses</li>';
  abrir('modalExcluirConta');
}

function definirAba(tab){
  document.querySelectorAll('.perfil-aba').forEach(btn=>{
    const ativo = btn.dataset.tab === tab;
    btn.classList.toggle('ativa', ativo);
    btn.setAttribute('aria-selected', String(ativo));
  });
  document.querySelectorAll('[data-pane]').forEach(pane=>pane.hidden = pane.dataset.pane !== tab);
}

window.aoMudarSessao = async function(){
  if(!Sessao.logado()){
    if(campo('btnCriar')) campo('btnCriar').hidden = true;
    campo('perfilHero').hidden = true;
    campo('perfilMain').hidden = true;
    campo('estadoSemSessao').hidden = false;
    if(campo('badgeNotificacoes')) campo('badgeNotificacoes').hidden = true;
    return;
  }
  if(campo('btnCriar')) campo('btnCriar').hidden = false;
  carregarPreferenciasDoPerfil(Sessao.perfil);
  await carregarEventosPerfil();
  await carregarNotificacoes();
};

/* ----------------- Ações de topo ----------------- */
if(campo('btnPerfil')) campo('btnPerfil').addEventListener('click', ()=>location.href='perfil.html');
if(campo('btnAdmin')) campo('btnAdmin').addEventListener('click', ()=>location.href='admin.html');
if(campo('btnCriar')) campo('btnCriar').addEventListener('click', ()=>location.href='index.html?criar=1');
if(campo('btnCriarHero')) campo('btnCriarHero').addEventListener('click', ()=>location.href='index.html?criar=1');
if(campo('btnEntrar')) campo('btnEntrar').addEventListener('click', ()=>abrir('modalLogin'));
if(campo('btnEntrarCentro')) campo('btnEntrarCentro').addEventListener('click', ()=>abrir('modalLogin'));
if(campo('btnCadastroTopo')) campo('btnCadastroTopo').addEventListener('click', ()=>abrir('modalCadastro'));
if(campo('btnSair')) campo('btnSair').addEventListener('click', async ()=>{ await sair(); avisar('Você saiu da conta'); location.href='index.html'; });
if(campo('btnNotificacoes')) campo('btnNotificacoes').addEventListener('click', ()=>carregarNotificacoes({abrirLista:true}));
if(campo('btnMinhasDenuncias')) campo('btnMinhasDenuncias').addEventListener('click', carregarMinhasDenuncias);
if(campo('btnLerTodas')) campo('btnLerTodas').addEventListener('click', async ()=>{
  const { error } = await db.from('notificacoes').update({ lida:true }).eq('usuario_id', meuId()).eq('lida', false);
  if(error){ avisar(traduzirErroBanco(error)); return; }
  await carregarNotificacoes();
  avisar('Notificações marcadas como lidas');
});

/* ----------------- Modais e links internos ----------------- */
document.addEventListener('click', async e=>{
  const fecha = e.target.closest('[data-fecha]');
  if(fecha){ fecharTudo(); return; }

  if(e.target.classList.contains('cortina')){ e.target.classList.remove('aberta'); return; }

  const irCadastro = e.target.closest('[data-ir-cadastro]');
  if(irCadastro){ e.preventDefault(); fecharTudo(); abrir('modalCadastro'); return; }
  const irLogin = e.target.closest('[data-ir-login]');
  if(irLogin){ e.preventDefault(); fecharTudo(); abrir('modalLogin'); return; }
  const esqueci = e.target.closest('[data-esqueci]');
  if(esqueci){ e.preventDefault(); fecharTudo(); abrir('modalEsqueci'); return; }

  const fav = e.target.closest('[data-fav]');
  if(fav){ e.preventDefault(); e.stopPropagation(); await alternarFav(fav.dataset.fav); return; }
  const interesse = e.target.closest('[data-interesse]');
  if(interesse){ e.preventDefault(); e.stopPropagation(); await alternarInteresse(interesse.dataset.interesse); return; }
  const cardEvento = e.target.closest('[data-ev]');
  if(cardEvento){ location.href='index.html?evento='+encodeURIComponent(cardEvento.dataset.ev); return; }

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
    return;
  }
});

document.querySelectorAll('.perfil-aba').forEach(btn=>btn.addEventListener('click', ()=>definirAba(btn.dataset.tab)));
if(campo('btnSalvarPerfilPagina')) campo('btnSalvarPerfilPagina').addEventListener('click', salvarPerfilPagina);
if(campo('btnDescartarDados')) campo('btnDescartarDados').addEventListener('click', descartarPerfil);
if(campo('btnTrocarSenhaPagina')) campo('btnTrocarSenhaPagina').addEventListener('click', ()=>abrir('modalTrocarSenha'));
if(campo('btnExcluirContaPagina')) campo('btnExcluirContaPagina').addEventListener('click', prepararExclusao);
if(campo('btnEncerrarOutrasSessoes')) campo('btnEncerrarOutrasSessoes').addEventListener('click', async ()=>{
  try{
    const { error } = await db.auth.signOut({ scope:'others' });
    if(error) throw error;
    avisar('Outras sessões foram encerradas');
  }catch(err){
    avisar('Não foi possível encerrar as outras sessões neste momento');
  }
});

/* ----------------- Login / cadastro / recuperação ----------------- */
ligarMedidorDeSenha('c_senha','c_senha2',{
  barra:'forcaBarra', preenchida:'forcaPreenchida', rotulo:'forcaRotulo', lista:'requisitosSenha', conferencia:'conferenciaSenha'
});
ligarMedidorDeSenha('ps_senha','ps_senha2',{
  barra:'ps_forcaBarra', preenchida:'ps_forcaPreenchida', rotulo:'ps_forcaRotulo', lista:'ps_requisitosSenha', conferencia:'ps_conferenciaSenha'
});

if(campo('btnLogar')) campo('btnLogar').addEventListener('click', async e=>{
  const btn=e.currentTarget, email=campo('l_email').value.trim(), senha=campo('l_senha').value;
  if(!email||!senha){ avisar('Preencha e-mail e senha'); return; }
  btn.disabled=true; btn.textContent='Entrando...';
  try{
    const login = await entrar(email,senha);
    campo('l_senha').value='';
    const id = login && login.user && login.user.id;
    const perfil = id ? await carregarPerfil(id) : null;
    if(perfil) Sessao.perfil = perfil;
    fecharTudo();
    avisar('Bem-vindo de volta!');
    await window.aoMudarSessao();
  }catch(err){ avisar(traduzirErro(err)); }
  finally{ btn.disabled=false; btn.textContent='Entrar'; }
});

if(campo('btnCadastrar')) campo('btnCadastrar').addEventListener('click', async e=>{
  const btn=e.currentTarget, nome=campo('c_nome').value.trim(), email=campo('c_email').value.trim(),
        senha=campo('c_senha').value, senha2=campo('c_senha2').value, nascimento=campo('c_nascimento').value;

  if(!nome||!email){ avisar('Preencha nome e e-mail'); return; }
  if(!nascimento){ avisar('Informe sua data de nascimento'); return; }
  const analise = analisarSenha(senha);
  if(!analise.aprovada){ avisar('A senha ainda não cumpre todos os requisitos'); return; }
  if(senha !== senha2){ avisar('As senhas não são iguais'); return; }
  if(!campo('c_regras').checked){ avisar('É preciso aceitar as regras'); return; }

  btn.disabled=true; btn.textContent='Criando...';
  try{
    const cadastro = await cadastrar(nome,email,senha,nascimento,true);
    fecharTudo();
    if(cadastro && cadastro.session){ avisar('Conta criada. Bem-vindo, '+nome+'!'); }
    else { avisar('Conta criada. Confira seu e-mail e confirme o cadastro antes de entrar.'); }
  }catch(err){ avisar(traduzirErro(err)); }
  finally{ btn.disabled=false; btn.textContent='Criar conta'; }
});

const RECUPERACAO_COOLDOWN_MS_PERFIL = 10 * 60 * 1000;
let timerRecuperacaoPerfil = null;
function chaveCooldownRecuperacaoPerfil(){
  const email = (campo('r_email')?.value || '').trim().toLowerCase();
  return 'role_recuperacao_10min_' + encodeURIComponent(email || 'sem-email');
}
function formatarCronometroPerfil(segundos){
  const min = Math.floor(segundos/60), seg = segundos%60;
  return String(min).padStart(2,'0')+':'+String(seg).padStart(2,'0');
}
function atualizarCooldownRecuperacaoPerfil(){
  const btn=campo('btnEnviarRecuperacao'), info=campo('estadoRecuperacao');
  if(!btn || !info) return;
  clearTimeout(timerRecuperacaoPerfil);
  const ultimo=Number(localStorage.getItem(chaveCooldownRecuperacaoPerfil())||0);
  const restante=Math.ceil((RECUPERACAO_COOLDOWN_MS_PERFIL-(Date.now()-ultimo))/1000);
  if(restante>0){
    const tempo=formatarCronometroPerfil(restante);
    btn.disabled=true; btn.textContent='Novo link em '+tempo;
    info.textContent='Link solicitado. Você poderá pedir outro em '+tempo+'. Confira também Spam/Lixo eletrônico.';
    timerRecuperacaoPerfil=setTimeout(atualizarCooldownRecuperacaoPerfil,1000);
  }else{
    btn.disabled=false; btn.textContent='Enviar link';
  }
}
function iniciarCooldownRecuperacaoPerfil(){
  localStorage.setItem(chaveCooldownRecuperacaoPerfil(),String(Date.now()));
  atualizarCooldownRecuperacaoPerfil();
}
if(campo('r_email')) campo('r_email').addEventListener('input', atualizarCooldownRecuperacaoPerfil);
document.addEventListener('click',e=>{ if(e.target.closest('[data-esqueci]')) setTimeout(atualizarCooldownRecuperacaoPerfil,0); });

if(campo('btnEnviarRecuperacao')) campo('btnEnviarRecuperacao').addEventListener('click', async e=>{
  const btn=e.currentTarget, email=campo('r_email').value.trim(), info=campo('estadoRecuperacao');
  if(!email){ avisar('Informe seu e-mail'); return; }
  const ultimo=Number(localStorage.getItem(chaveCooldownRecuperacaoPerfil())||0);
  if(Date.now()-ultimo < RECUPERACAO_COOLDOWN_MS_PERFIL){ atualizarCooldownRecuperacaoPerfil(); return; }
  info.textContent=''; btn.disabled=true; btn.textContent='Enviando...';
  const destino=location.origin+location.pathname.replace(/[^/]*$/,'')+'redefinir.html';
  const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:destino});
  if(error){
    const msg=(error.message||'').toLowerCase();
    if(msg.includes('rate limit')){
      iniciarCooldownRecuperacaoPerfil();
      avisar('Limite de e-mails atingido. Aguarde antes de pedir outro link.');
      return;
    }
    btn.disabled=false; btn.textContent='Enviar link'; avisar(traduzirErro(error)); return;
  }
  iniciarCooldownRecuperacaoPerfil();
  avisar('Se existir conta com esse e-mail, o link foi solicitado. Confira a caixa de entrada e o spam.');
});

if(campo('btnSalvarNovaSenha')) campo('btnSalvarNovaSenha').addEventListener('click', async e=>{
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

if(campo('x_ciente')) campo('x_ciente').addEventListener('change', validarExclusao);
if(campo('x_senha')) campo('x_senha').addEventListener('input', validarExclusao);
if(campo('x_confirmacao')) campo('x_confirmacao').addEventListener('input', validarExclusao);
if(campo('btnConfirmarExclusao')) campo('btnConfirmarExclusao').addEventListener('click', async e=>{
  if(!confirm('Confirmar o pedido de exclusão? Você terá 7 dias para cancelar.')) return;
  const btn=e.currentTarget;
  btn.disabled=true; btn.textContent='Confirmando...';
  try{
    if(contaSomenteGoogle()){
      if(!reauthGoogleValida()) throw new Error('Confirme sua identidade novamente com Google');
    }else{
      const senha=campo('x_senha').value;
      const email=Sessao.usuario && Sessao.usuario.email;
      if(!email) throw new Error('Sessão inválida');
      const reauth=await db.auth.signInWithPassword({email,password:senha});
      if(reauth.error) throw new Error('Senha atual incorreta');
    }

    const {data:prazo,error}=await db.rpc('solicitar_exclusao_conta');
    if(error) throw error;
    sessionStorage.removeItem(GOOGLE_REAUTH_UID);
    sessionStorage.removeItem(GOOGLE_REAUTH_AT);
    await db.auth.signOut();
    fecharTudo();
    const quando=prazo?new Date(prazo).toLocaleString('pt-BR'):'daqui a 7 dias';
    avisar('Pedido registrado. A exclusão definitiva está prevista para '+quando+'.');
    setTimeout(()=>location.href='index.html',2200);
  }catch(err){
    const texto=(err && err.message)||'Não foi possível iniciar a exclusão';
    avisar(texto.includes('Confirme sua identidade novamente') ? 'Sua confirmação expirou. Confirme sua identidade novamente.' : texto);
    configurarExclusaoPorProvedor();
    validarExclusao();
  }finally{
    btn.disabled=false; btn.textContent='Iniciar exclusão (7 dias)';
    validarExclusao();
  }
});

async function processarRetornoExclusaoGoogle(){
  const params=new URLSearchParams(location.search);
  if(params.get('excluir_google')!=='1') return;
  params.delete('excluir_google');
  history.replaceState({},'',location.pathname+(params.toString()?'?'+params.toString():'')+location.hash);

  for(let i=0;i<30 && !Sessao.usuario;i++) await new Promise(r=>setTimeout(r,100));
  const esperado=sessionStorage.getItem(GOOGLE_REAUTH_UID);
  if(!Sessao.usuario || !esperado || Sessao.usuario.id!==esperado){
    sessionStorage.removeItem(GOOGLE_REAUTH_UID);
    sessionStorage.removeItem(GOOGLE_REAUTH_AT);
    avisar('A conta Google escolhida não corresponde à conta que estava sendo confirmada.');
    return;
  }
  sessionStorage.setItem(GOOGLE_REAUTH_AT,String(Date.now()));
  sessionStorage.removeItem(GOOGLE_REAUTH_UID);
  await prepararExclusao();
  avisar('Identidade confirmada pelo Google.');
}

/* ----------------- Inicialização ----------------- */
setTimeout(()=>window.aoMudarSessao && window.aoMudarSessao(), 350);
setTimeout(processarRetornoExclusaoGoogle, 500);
definirAba('eventos');
