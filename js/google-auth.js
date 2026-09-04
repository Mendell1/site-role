/* ============================================================
   GOOGLE OAUTH — login social + conclusão obrigatória do cadastro
   ============================================================ */
(() => {
  const TERMOS_GOOGLE = '1.0';

  const mensagem = (texto) => {
    if (typeof window.avisar === 'function') window.avisar(texto);
    else console.log('[Rolê]', texto);
  };

  const eGoogle = (usuario) => {
    if (!usuario) return false;
    const app = usuario.app_metadata || {};
    const providers = Array.isArray(app.providers) ? app.providers : [];
    return app.provider === 'google' || providers.includes('google');
  };

  const retornoOAuth = () => {
    // Funciona no GitHub Pages em /site-role/ e também no ambiente local.
    const url = new URL('index.html', window.location.href);
    url.search = '';
    url.hash = '';
    return url.href;
  };

  async function entrarComGoogle(botao) {
    if (!window.db || !db.auth) {
      mensagem('A autenticação ainda não está disponível. Atualize a página e tente novamente.');
      return;
    }

    const textoOriginal = botao ? botao.innerHTML : '';
    if (botao) {
      botao.disabled = true;
      botao.innerHTML = '<span class="google-g">G</span><span>Abrindo Google…</span>';
    }

    try {
      const { error } = await db.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: retornoOAuth(),
          queryParams: { prompt: 'select_account' }
        }
      });
      if (error) throw error;
    } catch (erro) {
      console.error('Google OAuth:', erro);
      mensagem('Não foi possível entrar com Google. Confira se o provedor Google está ativado no Supabase.');
      if (botao) {
        botao.disabled = false;
        botao.innerHTML = textoOriginal;
      }
    }
  }

  function criarBotaoGoogle() {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'btn-google-oauth';
    botao.innerHTML = '<span class="google-g" aria-hidden="true">G</span><span>Continuar com Google</span>';
    botao.addEventListener('click', () => entrarComGoogle(botao));
    return botao;
  }

  function inserirGoogleNaFolha(modal) {
    if (!modal || modal.querySelector('.oauth-google-area')) return;
    const folha = modal.querySelector('.folha');
    if (!folha) return;

    const acoes = folha.querySelector('.acoes');
    if (!acoes) return;

    const area = document.createElement('div');
    area.className = 'oauth-google-area';
    area.innerHTML = '<div class="oauth-divisor"><span>ou</span></div>';
    area.appendChild(criarBotaoGoogle());
    acoes.parentNode.insertBefore(area, acoes);
  }

  function instalarBotoes() {
    inserirGoogleNaFolha(document.getElementById('modalLogin'));
    inserirGoogleNaFolha(document.getElementById('modalCadastro'));
  }

  function instalarModalConclusao() {
    if (document.getElementById('modalCadastroGoogle')) return;

    const modal = document.createElement('div');
    modal.className = 'cortina oauth-cortina';
    modal.id = 'modalCadastroGoogle';
    modal.innerHTML = `
      <div class="folha folha-google-onboarding" role="dialog" aria-modal="true" aria-labelledby="googleCadastroTitulo">
        <div class="google-onboarding-marca"><span class="google-g">G</span><span>Conta Google conectada</span></div>
        <h3 id="googleCadastroTitulo">Só falta concluir seu cadastro</h3>
        <p class="google-onboarding-texto">Para usar o Rolê, precisamos confirmar que você tem 18 anos ou mais e registrar o aceite das regras da plataforma.</p>

        <div class="campo">
          <label for="g_nascimento">Data de nascimento</label>
          <input id="g_nascimento" type="date" autocomplete="bday">
          <p class="dica">A plataforma é restrita a maiores de 18 anos.</p>
        </div>

        <label class="aceite google-aceite">
          <input type="checkbox" id="g_regras">
          <span>Li e aceito as regras de convivência, os termos de uso e a política de privacidade.</span>
        </label>

        <p class="google-onboarding-erro" id="g_erro" role="alert"></p>

        <div class="acoes google-onboarding-acoes">
          <button class="btn-escuro" type="button" id="btnConcluirGoogle">Concluir cadastro</button>
          <button class="btn-linha" type="button" id="btnSairGoogle">Sair desta conta</button>
        </div>
      </div>`;

    document.body.appendChild(modal);

    modal.querySelector('#btnConcluirGoogle').addEventListener('click', concluirCadastroGoogle);
    modal.querySelector('#btnSairGoogle').addEventListener('click', async () => {
      await db.auth.signOut();
      modal.classList.remove('aberta');
      document.body.classList.remove('oauth-cadastro-pendente');
      window.location.href = retornoOAuth();
    });
  }

  function idadeEmAnosGoogle(nascimento) {
    if (!nascimento) return NaN;
    const data = new Date(nascimento + 'T00:00:00');
    if (Number.isNaN(data.getTime())) return NaN;
    const hoje = new Date();
    let idade = hoje.getFullYear() - data.getFullYear();
    const diferencaMes = hoje.getMonth() - data.getMonth();
    if (diferencaMes < 0 || (diferencaMes === 0 && hoje.getDate() < data.getDate())) idade--;
    return idade;
  }

  async function concluirCadastroGoogle() {
    const modal = document.getElementById('modalCadastroGoogle');
    if (!modal) return;

    const nascimento = modal.querySelector('#g_nascimento').value;
    const aceitou = modal.querySelector('#g_regras').checked;
    const erroEl = modal.querySelector('#g_erro');
    const botao = modal.querySelector('#btnConcluirGoogle');
    erroEl.textContent = '';

    const idade = idadeEmAnosGoogle(nascimento);
    if (Number.isNaN(idade)) {
      erroEl.textContent = 'Informe sua data de nascimento.';
      return;
    }
    if (idade < 18) {
      erroEl.textContent = 'É preciso ter 18 anos ou mais para usar a plataforma.';
      return;
    }
    if (idade > 120) {
      erroEl.textContent = 'Confira a data de nascimento informada.';
      return;
    }
    if (!aceitou) {
      erroEl.textContent = 'Você precisa aceitar as regras e os termos para continuar.';
      return;
    }

    botao.disabled = true;
    botao.textContent = 'Salvando…';

    try {
      const { error } = await db.rpc('concluir_cadastro_google', {
        p_data_nascimento: nascimento,
        p_aceitou_regras: true,
        p_termos_versao: TERMOS_GOOGLE
      });
      if (error) throw error;

      if (window.Sessao && Sessao.usuario && typeof window.carregarPerfil === 'function') {
        Sessao.perfil = await window.carregarPerfil(Sessao.usuario.id);
      } else if (window.Sessao && Sessao.usuario) {
        const { data } = await db.from('perfis')
          .select('*')
          .eq('id', Sessao.usuario.id)
          .single();
        if (data) Sessao.perfil = data;
      }

      modal.classList.remove('aberta');
      document.body.classList.remove('oauth-cadastro-pendente');
      if (typeof window.atualizarTopo === 'function') window.atualizarTopo();
      mensagem('Cadastro concluído. Bem-vindo ao Rolê!');

      if (typeof window.aoMudarSessao === 'function') await window.aoMudarSessao();
      else if (typeof window.render === 'function') window.render();
    } catch (erro) {
      console.error('Conclusão do cadastro Google:', erro);
      const texto = (erro && erro.message) || 'Não foi possível concluir o cadastro.';
      erroEl.textContent = texto;
    } finally {
      botao.disabled = false;
      botao.textContent = 'Concluir cadastro';
    }
  }

  async function obterEstadoCadastro(usuario) {
    if (!usuario || !eGoogle(usuario)) return null;

    // Preferimos o perfil já carregado pelo auth.js.
    if (window.Sessao && Sessao.usuario && Sessao.usuario.id === usuario.id && Sessao.perfil &&
        Object.prototype.hasOwnProperty.call(Sessao.perfil, 'cadastro_completo')) {
      return Sessao.perfil.cadastro_completo;
    }

    const { data, error } = await db.from('perfis')
      .select('cadastro_completo')
      .eq('id', usuario.id)
      .single();
    if (error) {
      console.warn('Não foi possível verificar o cadastro Google:', error.message);
      return null;
    }
    if (window.Sessao && Sessao.perfil) Sessao.perfil.cadastro_completo = data.cadastro_completo;
    return data.cadastro_completo;
  }

  async function verificarOnboarding(usuario) {
    if (!usuario || !eGoogle(usuario)) return;

    // O listener de auth.js também carrega o perfil; damos alguns instantes
    // para ele terminar antes de consultar diretamente o banco.
    for (let i = 0; i < 12; i++) {
      if (window.Sessao && Sessao.usuario && Sessao.usuario.id === usuario.id && Sessao.perfil) break;
      await new Promise(resolve => setTimeout(resolve, 80));
    }

    const completo = await obterEstadoCadastro(usuario);
    if (completo !== false) return;

    instalarModalConclusao();
    const modal = document.getElementById('modalCadastroGoogle');
    document.querySelectorAll('.cortina.aberta').forEach(item => {
      if (item !== modal) item.classList.remove('aberta');
    });
    modal.classList.add('aberta');
    document.body.classList.add('oauth-cadastro-pendente');
  }

  function iniciar() {
    instalarBotoes();
    instalarModalConclusao();

    if (!window.db || !db.auth) return;

    db.auth.getSession().then(({ data }) => {
      if (data && data.session) verificarOnboarding(data.session.user);
    });

    db.auth.onAuthStateChange((_evento, sessao) => {
      if (sessao && sessao.user) {
        setTimeout(() => verificarOnboarding(sessao.user), 100);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
