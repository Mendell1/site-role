/* ============================================================
   AUTENTICAÇÃO — sessão, perfil e papel do usuário
   ============================================================ */

const Sessao = {
  usuario: null,
  perfil: null,
  logado(){ return !!this.usuario; },
  ativa(){
    if(!this.usuario || !this.perfil) return false;
    if(this.perfil.bloqueado) return false;
    if(this.perfil.exclusao_prevista) return false;
    if(this.perfil.suspenso_ate && new Date(this.perfil.suspenso_ate) > new Date()) return false;
    return true;
  },
  eAdmin(){ return this.ativa() && this.perfil.papel === 'admin'; }
};
window.Sessao = Sessao;

/* idade em anos completos a partir da data de nascimento */
function idadeEmAnos(nascimento){
  const n = new Date(nascimento + 'T00:00:00');
  if(isNaN(n)) return NaN;
  const hoje = new Date();
  let idade = hoje.getFullYear() - n.getFullYear();
  const mes = hoje.getMonth() - n.getMonth();
  if(mes < 0 || (mes === 0 && hoje.getDate() < n.getDate())) idade--;   // ainda não fez aniversário
  return idade;
}

/* A checagem aqui é só conforto: dá o aviso antes de gastar a viagem
   até o servidor. Quem vale é o gatilho validar_maioridade() no banco,
   que roda mesmo se alguém contornar o formulário pelo console. */
const TERMOS_VERSAO = '1.0';

async function cadastrar(nome, email, senha, nascimento, aceitouRegras){
  const idade = idadeEmAnos(nascimento);
  if(isNaN(idade))  throw new Error('Informe uma data de nascimento válida');
  if(idade < 18)    throw new Error('menor de idade');
  if(idade > 120)   throw new Error('Confira a data de nascimento');

  const { data, error } = await db.auth.signUp({
    email,
    password: senha,
    options: {
      data: {
        nome,
        data_nascimento: nascimento,
        aceitou_regras: !!aceitouRegras,
        termos_versao: TERMOS_VERSAO
      }
    }
  });
  if (error) throw error;
  return data;
}

async function entrar(email, senha){
  const normalizado = email.trim().toLowerCase();

  // A proteção contra força bruta fica a cargo do Supabase Auth
  // (rate limits/CAPTCHA). Não mantemos um bloqueio por e-mail no
  // banco, pois um visitante poderia abusar desse contador contra terceiros.
  const { data, error } = await db.auth.signInWithPassword({
    email: normalizado,
    password: senha
  });

  if (error){
    const msg = (error.message || '').toLowerCase();

    if(msg.includes('email not confirmed')){
      const reenviar = await db.auth.resend({ type:'signup', email: normalizado });
      if(reenviar.error && (reenviar.error.message || '').toLowerCase().includes('rate limit')){
        throw new Error('Confirme seu e-mail antes de entrar. O limite de reenvios foi atingido; aguarde e tente novamente.');
      }
      throw new Error('Confirme seu e-mail antes de entrar. Um novo link de confirmação foi solicitado.');
    }

    throw error;
  }

  return data;
}

async function sair(){
  await db.auth.signOut();
}

async function carregarPerfil(id){
  const { data, error } = await db
    .from('perfis')
    .select('id, nome, email, papel, bloqueado, foto_url, bio, data_nascimento, cidade, contato, suspenso_ate, advertencias, exclusao_pedida_em, exclusao_prevista, termos_versao, termos_aceitos_em, notif_eventos, notif_comentarios, notif_denuncias, notif_resumo')
    .eq('id', id)
    .single();
  if (error) { console.error('Erro ao carregar perfil:', error.message); return null; }
  return data;
}

function traduzirErro(e){
  const m = (e && e.message || '').toLowerCase();
  if (m.includes('invalid login'))            return 'E-mail ou senha incorretos';
  if (m.includes('already registered'))       return 'Este e-mail já tem conta. Faça login.';
  if (m.includes('password should be'))       return 'A senha precisa ter pelo menos 6 caracteres';
  if (m.includes('unable to validate email')) return 'E-mail inválido';
  if (m.includes('email not confirmed') || m.includes('confirme seu e-mail'))
                                               return e.message;
  if (m.includes('failed to fetch'))           return 'Sem conexão com o servidor. Confira o config.js';
  if (m.includes('menor de idade') ||
      m.includes('18 anos'))                   return 'É preciso ter 18 anos ou mais para criar uma conta';
  return 'Não foi possível concluir: ' + (e && e.message || 'erro desconhecido');
}

db.auth.onAuthStateChange(async (_evento, sessao) => {
  Sessao.usuario = sessao ? sessao.user : null;
  Sessao.perfil  = sessao ? await carregarPerfil(sessao.user.id) : null;

  if (Sessao.perfil && Sessao.perfil.bloqueado) {
    await sair();
    avisar('Sua conta foi bloqueada pelo administrador');
    return;
  }
  if (Sessao.perfil && Sessao.perfil.suspenso_ate && new Date(Sessao.perfil.suspenso_ate) > new Date()) {
    const ate = new Date(Sessao.perfil.suspenso_ate).toLocaleString('pt-BR');
    await sair();
    avisar('Sua conta está suspensa até ' + ate);
    return;
  }
  atualizarTopo();
  await acompanharPerfil();
  if (window.aoMudarSessao) await window.aoMudarSessao();
  else if (window.render) render();
});

let canalPerfil = null;
async function acompanharPerfil(){
  if(canalPerfil){
    await db.removeChannel(canalPerfil);
    canalPerfil = null;
  }
  if(!Sessao.logado()) return;

  const id = Sessao.usuario.id;
  canalPerfil = db.channel('meu-perfil-' + id)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'perfis', filter: 'id=eq.' + id
    }, async payload => {
      Sessao.perfil = payload.new;
      if(Sessao.perfil && Sessao.perfil.bloqueado){
        avisar('Sua conta foi bloqueada pelo administrador');
        await sair();
        return;
      }
      atualizarTopo();
      if(window.aoMudarSessao) await window.aoMudarSessao();
    })
    .subscribe();
}

function atualizarTopo(){
  const nome = document.getElementById('usuarioNome');
  const btnEntrar = document.getElementById('btnEntrar');
  const btnSair = document.getElementById('btnSair');
  const admin = document.getElementById('btnAdmin');
  const notif = document.getElementById('btnNotificacoes');
  const criarConta = document.getElementById('btnCadastroTopo');
  const perfilBtn = document.getElementById('btnPerfil');
  const avatar = document.getElementById('avatarTopo');

  if (Sessao.logado()){
    if (nome){
      nome.hidden = false;
      nome.textContent = '@' + (Sessao.perfil ? Sessao.perfil.nome : 'usuário');
    }
    if (perfilBtn) perfilBtn.hidden = false;
    if (notif) notif.hidden = false;
    if (btnEntrar) btnEntrar.hidden = true;
    if (btnSair) btnSair.hidden = false;
    if (criarConta) criarConta.hidden = true;
    if (avatar){
      const foto = Sessao.perfil && Sessao.perfil.foto_url;
      avatar.hidden = false;
      avatar.innerHTML = foto
        ? '<img src="' + foto + '" alt="">'
        : (Sessao.perfil ? Sessao.perfil.nome : '?').charAt(0).toUpperCase();
    }
    if (admin) admin.hidden = !Sessao.eAdmin();
  } else {
    if (nome) nome.hidden = true;
    if (btnEntrar) btnEntrar.hidden = false;
    if (btnSair) btnSair.hidden = true;
    if (criarConta) criarConta.hidden = false;
    if (admin) admin.hidden = true;
    if (notif) notif.hidden = true;
    if (perfilBtn) perfilBtn.hidden = true;
    if (avatar) avatar.hidden = true;
  }
}