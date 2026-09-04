from pathlib import Path


def replace_between(text, start, end, replacement):
    i = text.find(start)
    if i < 0:
        raise SystemExit(f'Marcador inicial não encontrado: {start[:60]}')
    j = text.find(end, i)
    if j < 0:
        raise SystemExit(f'Marcador final não encontrado: {end[:60]}')
    return text[:i] + replacement.rstrip() + '\n\n' + text[j:]


# 1) Conecta recursos V23 à home.
p = Path('index.html')
s = p.read_text(encoding='utf-8')
if 'css/recursos-v23.css' not in s:
    s = s.replace('<link rel="stylesheet" href="css/google-auth.css">', '<link rel="stylesheet" href="css/google-auth.css">\n<link rel="stylesheet" href="css/recursos-v23.css">')
if 'js/recursos-v23.js' not in s:
    s = s.replace('<script src="js/app.js"></script>', '<script src="js/app.js"></script>\n<script src="js/recursos-v23.js"></script>')
p.write_text(s, encoding='utf-8')


# 2) Perfil: rollback correto de interesse.
p = Path('js/perfil.js')
s = p.read_text(encoding='utf-8')
antigo = """  if(error){
    if(tinha) interesses.add(id); else interesses.delete(id);
    meusEventos = atualizarLista(meusEventos);
    favoritosEventos = atualizarLista(favoritosEventos);
    renderCards(meusEventos, 'gradeMeusEventos', 'vazioMeusEventos');
    renderCards(favoritosEventos, 'gradeFavoritos', 'vazioFavoritos');
    avisar(traduzirErroBanco(error));
    return;
  }"""
novo = """  if(error){
    if(tinha) interesses.add(id); else interesses.delete(id);
    // Volta para a verdade do banco em vez de aplicar a mesma variação duas vezes.
    await carregarEventosPerfil();
    avisar(traduzirErroBanco(error));
    return;
  }"""
if antigo not in s:
    raise SystemExit('Bloco de rollback de interesse não encontrado')
s = s.replace(antigo, novo, 1)


# 3) Exclusão segura para senha e Google OAuth.
exclusao = r"""const FRASE_EXCLUSAO = 'EXCLUIR MINHA CONTA';
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
  const destino = new URL('perfil.html', location.href);
  destino.search = '';
  destino.hash = '';
  destino.searchParams.set('excluir_google','1');
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
"""
s = replace_between(s, "const FRASE_EXCLUSAO = 'EXCLUIR MINHA CONTA';", 'function definirAba(tab){', exclusao)


# 4) Recuperação de senha do perfil com o mesmo cooldown de 10 min da home.
recuperacao = r"""const RECUPERACAO_COOLDOWN_MS_PERFIL = 10 * 60 * 1000;
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
"""
s = replace_between(s, "if(campo('btnEnviarRecuperacao')) campo('btnEnviarRecuperacao').addEventListener", "if(campo('btnSalvarNovaSenha'))", recuperacao)


# 5) Confirmação final de exclusão e retorno do OAuth.
confirmacao = r"""if(campo('btnConfirmarExclusao')) campo('btnConfirmarExclusao').addEventListener('click', async e=>{
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
"""
s = replace_between(s, "if(campo('btnConfirmarExclusao')) campo('btnConfirmarExclusao').addEventListener", '/* ----------------- Inicialização ----------------- */', confirmacao)
s = s.replace("setTimeout(()=>window.aoMudarSessao && window.aoMudarSessao(), 350);", "setTimeout(()=>window.aoMudarSessao && window.aoMudarSessao(), 350);\nsetTimeout(processarRetornoExclusaoGoogle, 500);")
p.write_text(s, encoding='utf-8')


# 6) Espelha a migration já aplicada no Supabase.
src = Path('sql/migrations/016_consolidacao_v24.sql')
dst = Path('supabase/migrations/20260904122830_v24_consolidacao_seguranca_performance.sql')
dst.parent.mkdir(parents=True, exist_ok=True)
dst.write_text(src.read_text(encoding='utf-8'), encoding='utf-8')


# 7) Documentação.
Path('sql/install/README.md').write_text("""# Instalação do banco — Rolê V24

O arquivo `000_instalacao_completa.sql` é o baseline consolidado anterior ao login Google.
Para reproduzir o banco atual em um projeto Supabase novo, execute nesta ordem:

1. `sql/install/000_instalacao_completa.sql`
2. `sql/migrations/013_google_oauth_onboarding.sql`
3. `sql/migrations/015_recursos_sociais_localizacao_metricas_v23.sql`
4. `sql/migrations/016_consolidacao_v24.sql`
5. `sql/deployment/013_configurar_edge_cron.sql` somente depois de configurar os secrets exigidos pela Edge Function.

A pasta `supabase/migrations/` mantém as versões aplicadas no projeto conectado e deve ser a referência para deploy via Supabase CLI/GitHub integration.

Nunca coloque `service_role`, Client Secret do Google ou outros segredos em arquivos públicos do repositório.
""", encoding='utf-8')

Path('README.md').write_text("""# Rolê — eventos do seu bairro

Plataforma web colaborativa para divulgar e descobrir eventos locais. O projeto reúne eventos que normalmente ficam espalhados em grupos de WhatsApp, redes sociais, cartazes e divulgação boca a boca.

## Funcionalidades

- mural com busca, categorias e filtros;
- mapa e calendário de eventos;
- localização **Perto de mim** por distância;
- publicação e edição de eventos com endereço, CEP, mapa, imagem e status;
- favoritos, interesse e comentários;
- compartilhamento por link/WhatsApp, QR Code e Google Agenda/ICS;
- perfil público compartilhável do organizador;
- login por e-mail/senha e Google OAuth;
- onboarding obrigatório para maiores de 18 anos e aceite dos termos;
- notificações de mudanças nos eventos e resumo semanal opcional;
- denúncias com evidência privada, acompanhamento, recurso e auditoria;
- painel administrativo com moderação, usuários, eventos, auditoria e métricas;
- exclusão de conta com prazo de 7 dias e reautenticação recente.

## Tecnologias

Frontend em HTML, CSS e JavaScript, com Leaflet para mapas. Backend em Supabase: PostgreSQL, Auth, Storage, Realtime, Row Level Security, funções SQL/PLpgSQL, Cron e Edge Functions. Publicação do frontend via GitHub Pages.

## Estrutura principal

- `index.html` — mural e descoberta;
- `perfil.html` — conta, perfil, favoritos e eventos do usuário;
- `organizador.html` — perfil público compartilhável;
- `admin.html` — moderação e métricas;
- `js/` — autenticação, eventos, perfil, admin e recursos sociais;
- `css/` — identidade visual e responsividade;
- `supabase/migrations/` — histórico aplicado no banco conectado;
- `sql/` — baseline, migrations legíveis e scripts de deployment;
- `supabase/functions/` — Edge Functions do projeto.

## Executar localmente

Sirva a pasta por HTTP para que autenticação, geolocalização e APIs do navegador funcionem corretamente. O `js/config.js` deve conter apenas a URL do projeto e uma chave pública/publishable do Supabase.

## Banco de dados

Para uma instalação nova, siga `sql/install/README.md`. A instalação usa RLS como camada principal de autorização; esconder botões no frontend não é considerado controle de segurança.

## Segurança

- evidências de denúncia ficam em bucket privado;
- uploads de eventos e avatares possuem limite de tamanho e MIME no Storage;
- operações administrativas validam o papel no banco;
- contas bloqueadas, suspensas, incompletas ou em exclusão não podem operar normalmente;
- exclusão de conta exige autenticação recente no servidor;
- nenhum `service_role` ou Client Secret deve ser publicado no GitHub.

## Testes

O workflow de CI executa validação sintática dos arquivos JavaScript e testes estáticos de integração em `tests/smoke.py`. Antes de uma entrega, também é recomendado testar manualmente os fluxos de e-mail, Google OAuth, publicação, mapa, notificações, denúncias, recurso, moderação e exclusão.

## Deploy

O frontend é publicado pelo GitHub Pages. Alterações de banco devem ser registradas em migration e aplicadas ao Supabase antes de depender delas no frontend.
""", encoding='utf-8')


# 8) Smoke tests permanentes.
Path('tests').mkdir(exist_ok=True)
Path('tests/smoke.py').write_text("""from pathlib import Path

root = Path(__file__).resolve().parents[1]

def read(path):
    return (root / path).read_text(encoding='utf-8')

required = [
    'index.html','perfil.html','admin.html','organizador.html',
    'js/app.js','js/auth.js','js/google-auth.js','js/perfil.js','js/recursos-v23.js',
    'js/admin.js','js/admin-dashboard.js','js/organizador.js',
    'css/estilo.css','css/mobile-responsive.css','css/google-auth.css','css/recursos-v23.css',
    'supabase/migrations/20260904040500_google_oauth_onboarding.sql',
    'supabase/migrations/20260904122830_v24_consolidacao_seguranca_performance.sql'
]
for rel in required:
    assert (root / rel).exists(), f'Arquivo obrigatório ausente: {rel}'

index = read('index.html')
assert 'css/recursos-v23.css' in index
assert 'js/recursos-v23.js' in index
assert index.index('js/app.js') < index.index('js/recursos-v23.js')

perfil = read('js/perfil.js')
assert 'role_exclusao_google_reauth_at' in perfil
assert 'RECUPERACAO_COOLDOWN_MS_PERFIL' in perfil
assert 'await carregarEventosPerfil();' in perfil

config = read('js/config.js').lower()
for linha in config.splitlines():
    if '=' not in linha:
        continue
    assert 'service_role' not in linha, 'service_role atribuído no frontend'
    assert 'sb_secret_' not in linha, 'chave secreta atribuída no frontend'

print('Smoke tests: OK')
""", encoding='utf-8')

print('V24 repository patch prepared.')
