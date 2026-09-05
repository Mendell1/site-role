/* ============================================================
   ROLÊ V25.1 — comunidade
   - seguir organizadores
   - alertas personalizados
   - verificação de organizadores (admin)
   ============================================================ */
(() => {
  const pagina = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const esc = v => String(v == null ? '' : v).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const fmt = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

  function avisarV25(texto){
    const a = document.getElementById('aviso');
    if(!a){ console.log('[Rolê V25]', texto); return; }
    a.textContent = texto;
    a.classList.add('mostra');
    clearTimeout(avisarV25._t);
    avisarV25._t = setTimeout(() => a.classList.remove('mostra'), 3400);
  }

  async function sessaoAtual(){
    const { data } = await db.auth.getSession();
    return data && data.session ? data.session : null;
  }

  function perfilUrl(id){
    const u = new URL('organizador.html', location.href);
    u.searchParams.set('id', id);
    return u.href;
  }

  /* ---------------- Perfil público: seguir organizador ---------------- */
  async function iniciarOrganizador(){
    const id = new URLSearchParams(location.search).get('id');
    if(!id) return;

    const { data, error } = await db.rpc('perfil_publico_v25', { p_usuario:id });
    const perfil = Array.isArray(data) ? data[0] : data;
    if(error || !perfil) return;

    let tentativas = 0;
    const decorar = async () => {
      const hero = document.querySelector('.organizador-publico-hero');
      const titulo = hero && hero.querySelector('h1');
      const meta = hero && hero.querySelector('.organizador-publico-meta');
      if(!hero || !titulo || !meta){
        if(tentativas++ < 30) setTimeout(decorar, 120);
        return;
      }
      if(hero.dataset.v25Decorado === '1') return;
      hero.dataset.v25Decorado = '1';

      if(perfil.verificado){
        const selo = document.createElement('span');
        selo.className = 'selo-verificado-v25';
        selo.title = 'Organizador verificado pela moderação do Rolê';
        selo.innerHTML = '<span aria-hidden="true">✓</span> Verificado';
        titulo.insertAdjacentElement('afterend', selo);
      }

      const seguidores = document.createElement('span');
      seguidores.id = 'seguidoresTotalV25';
      seguidores.textContent = '👥 ' + Number(perfil.seguidores_total || 0) + ' seguidor(es)';
      meta.appendChild(seguidores);

      const area = document.createElement('div');
      area.className = 'organizador-acoes-v25';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-seguir-v25';
      area.appendChild(btn);
      meta.insertAdjacentElement('afterend', area);

      const session = await sessaoAtual();
      if(!session){
        btn.textContent = '＋ Seguir organizador';
        btn.addEventListener('click', () => {
          avisarV25('Entre na sua conta para seguir este organizador.');
          setTimeout(() => location.href = 'index.html', 700);
        });
        return;
      }
      if(session.user.id === id){
        btn.textContent = 'Este é seu perfil';
        btn.disabled = true;
        return;
      }

      const estado = await db.from('seguidores_organizadores')
        .select('organizador_id')
        .eq('seguidor_id', session.user.id)
        .eq('organizador_id', id)
        .maybeSingle();
      let seguindo = !!estado.data;

      const atualizar = () => {
        btn.classList.toggle('seguindo', seguindo);
        btn.textContent = seguindo ? '✓ Seguindo' : '＋ Seguir organizador';
      };
      atualizar();

      btn.addEventListener('click', async () => {
        btn.disabled = true;
        let resposta;
        if(seguindo){
          resposta = await db.from('seguidores_organizadores')
            .delete().eq('seguidor_id', session.user.id).eq('organizador_id', id);
        }else{
          resposta = await db.from('seguidores_organizadores')
            .insert({ seguidor_id:session.user.id, organizador_id:id });
        }
        btn.disabled = false;
        if(resposta.error){ avisarV25('Não foi possível atualizar agora: ' + resposta.error.message); return; }
        seguindo = !seguindo;
        perfil.seguidores_total = Math.max(0, Number(perfil.seguidores_total || 0) + (seguindo ? 1 : -1));
        seguidores.textContent = '👥 ' + perfil.seguidores_total + ' seguidor(es)';
        atualizar();
        avisarV25(seguindo ? 'Você agora segue este organizador.' : 'Você deixou de seguir este organizador.');
      });
    };
    decorar();
  }

  /* ---------------- Meu perfil: alertas + seguindo ---------------- */
  let categoriasV25 = [];
  let coordsAlerta = null;

  function inserirAbaComunidade(){
    const abas = document.querySelector('.perfil-abas');
    const main = document.getElementById('perfilMain');
    if(!abas || !main || document.querySelector('[data-tab="comunidade-v25"]')) return;

    const botao = document.createElement('button');
    botao.className = 'perfil-aba';
    botao.dataset.tab = 'comunidade-v25';
    botao.setAttribute('role','tab');
    botao.setAttribute('aria-selected','false');
    botao.textContent = 'Alertas e seguindo';
    abas.appendChild(botao);

    const painel = document.createElement('section');
    painel.className = 'perfil-painel';
    painel.dataset.pane = 'comunidade-v25';
    painel.hidden = true;
    painel.innerHTML = `
      <div class="comunidade-grid-v25">
        <section class="superficie-lovable comunidade-card-v25">
          <p class="bloco-kicker">ALERTAS DE EVENTOS</p>
          <h3>Avise quando aparecer algo para mim</h3>
          <p class="dica">Combine categoria, cidade, gratuidade, fim de semana e distância. Você pode manter até 10 alertas.</p>
          <div class="campo"><label for="v25_nome_alerta">Nome do alerta</label><input id="v25_nome_alerta" maxlength="60" placeholder="Ex.: Música grátis perto de casa"></div>
          <div class="linha-form-lovable linha-2">
            <div class="campo"><label for="v25_categoria_alerta">Categoria</label><select id="v25_categoria_alerta"><option value="">Qualquer categoria</option></select></div>
            <div class="campo"><label for="v25_cidade_alerta">Cidade</label><input id="v25_cidade_alerta" maxlength="80" placeholder="Qualquer cidade"></div>
          </div>
          <div class="alerta-opcoes-v25">
            <label class="item-switch-lovable"><span>Somente eventos gratuitos</span><input type="checkbox" id="v25_gratis_alerta"></label>
            <label class="item-switch-lovable"><span>Somente sábado e domingo</span><input type="checkbox" id="v25_fds_alerta"></label>
          </div>
          <div class="linha-form-lovable linha-2 alerta-local-v25">
            <div class="campo"><label for="v25_raio_alerta">Distância</label><select id="v25_raio_alerta"><option value="">Sem limite de distância</option><option value="5">Até 5 km</option><option value="10">Até 10 km</option><option value="25">Até 25 km</option><option value="50">Até 50 km</option></select></div>
            <div class="campo"><label>Local de referência</label><button type="button" class="btn-linha" id="v25_usar_local">⌖ Usar minha localização</button><p class="dica" id="v25_local_status">Necessário apenas se escolher um raio.</p></div>
          </div>
          <div class="acoes"><button type="button" class="btn-escuro" id="v25_criar_alerta">Criar alerta</button></div>
        </section>

        <section class="superficie-lovable comunidade-card-v25">
          <div class="comunidade-titulo-v25"><div><p class="bloco-kicker">MEUS ALERTAS</p><h3>Alertas ativos e pausados</h3></div><span class="contagem" id="v25_qtd_alertas"></span></div>
          <div id="v25_lista_alertas"><p class="dica">Carregando...</p></div>
        </section>

        <section class="superficie-lovable comunidade-card-v25 comunidade-seguindo-v25">
          <div class="comunidade-titulo-v25"><div><p class="bloco-kicker">SEGUINDO</p><h3>Organizadores que acompanho</h3></div><span class="contagem" id="v25_qtd_seguindo"></span></div>
          <div id="v25_lista_seguindo"><p class="dica">Carregando...</p></div>
        </section>
      </div>`;
    main.appendChild(painel);

    botao.addEventListener('click', async () => {
      document.querySelectorAll('.perfil-aba').forEach(b => {
        const ativo = b === botao;
        b.classList.toggle('ativa', ativo);
        b.setAttribute('aria-selected', String(ativo));
      });
      document.querySelectorAll('[data-pane]').forEach(p => p.hidden = p !== painel);
      await carregarComunidadePerfil();
    });

    document.getElementById('v25_usar_local').addEventListener('click', capturarLocalAlerta);
    document.getElementById('v25_criar_alerta').addEventListener('click', criarAlerta);
    painel.addEventListener('click', tratarAcoesAlertas);
  }

  async function carregarCategoriasV25(){
    const { data } = await db.from('categorias').select('id,nome,emoji').order('ordem');
    categoriasV25 = data || [];
    const sel = document.getElementById('v25_categoria_alerta');
    if(sel && sel.options.length <= 1){
      categoriasV25.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = (c.emoji ? c.emoji + ' ' : '') + c.nome;
        sel.appendChild(o);
      });
    }
  }

  function nomeCategoria(id){
    const c = categoriasV25.find(x => x.id === id);
    return c ? c.nome : 'Qualquer categoria';
  }

  async function capturarLocalAlerta(){
    const status = document.getElementById('v25_local_status');
    const btn = document.getElementById('v25_usar_local');
    if(!navigator.geolocation){ status.textContent = 'Seu navegador não oferece geolocalização.'; return; }
    btn.disabled = true; status.textContent = 'Obtendo sua localização...';
    navigator.geolocation.getCurrentPosition(pos => {
      coordsAlerta = { latitude:pos.coords.latitude, longitude:pos.coords.longitude };
      status.textContent = '✓ Localização registrada para este alerta.';
      btn.textContent = '✓ Localização registrada';
      btn.disabled = false;
    }, err => {
      status.textContent = err.code === 1 ? 'Permissão de localização negada.' : 'Não foi possível obter sua localização.';
      btn.disabled = false;
    }, { enableHighAccuracy:false, timeout:10000, maximumAge:300000 });
  }

  async function criarAlerta(){
    const session = await sessaoAtual();
    if(!session){ avisarV25('Entre na conta para criar alertas.'); return; }
    const nome = document.getElementById('v25_nome_alerta').value.trim();
    const categoria = document.getElementById('v25_categoria_alerta').value || null;
    const cidade = document.getElementById('v25_cidade_alerta').value.trim() || null;
    const gratis = document.getElementById('v25_gratis_alerta').checked;
    const fds = document.getElementById('v25_fds_alerta').checked;
    const raioRaw = document.getElementById('v25_raio_alerta').value;
    const raio = raioRaw ? Number(raioRaw) : null;
    if(nome.length < 2){ avisarV25('Dê um nome para o alerta.'); return; }
    if(raio && !coordsAlerta){ avisarV25('Use sua localização antes de criar um alerta por distância.'); return; }

    const btn = document.getElementById('v25_criar_alerta');
    btn.disabled = true; btn.textContent = 'Criando...';
    const { error } = await db.from('alertas_eventos').insert({
      usuario_id:session.user.id,
      nome,
      categoria_id:categoria,
      cidade,
      somente_gratuitos:gratis,
      fim_de_semana:fds,
      raio_km:raio,
      latitude:raio ? coordsAlerta.latitude : null,
      longitude:raio ? coordsAlerta.longitude : null
    });
    btn.disabled = false; btn.textContent = 'Criar alerta';
    if(error){ avisarV25(error.message); return; }

    document.getElementById('v25_nome_alerta').value = '';
    document.getElementById('v25_categoria_alerta').value = '';
    document.getElementById('v25_cidade_alerta').value = '';
    document.getElementById('v25_gratis_alerta').checked = false;
    document.getElementById('v25_fds_alerta').checked = false;
    document.getElementById('v25_raio_alerta').value = '';
    coordsAlerta = null;
    document.getElementById('v25_usar_local').textContent = '⌖ Usar minha localização';
    document.getElementById('v25_local_status').textContent = 'Necessário apenas se escolher um raio.';
    avisarV25('Alerta criado. Você será avisado quando um novo evento combinar com ele.');
    await listarAlertas();
  }

  async function listarAlertas(){
    const lista = document.getElementById('v25_lista_alertas');
    const qtd = document.getElementById('v25_qtd_alertas');
    if(!lista) return;
    const session = await sessaoAtual();
    if(!session){ lista.innerHTML = '<p class="dica">Entre para ver seus alertas.</p>'; return; }
    const { data, error } = await db.from('alertas_eventos').select('*').eq('usuario_id',session.user.id).order('criado_em',{ascending:false});
    if(error){ lista.innerHTML = '<p class="dica">Não foi possível carregar os alertas.</p>'; return; }
    const itens = data || [];
    qtd.textContent = itens.length + '/10';
    if(!itens.length){ lista.innerHTML = '<div class="vazio alerta-vazio-v25"><strong>Nenhum alerta criado</strong><p>Crie combinações para o Rolê procurar novos eventos por você.</p></div>'; return; }
    lista.innerHTML = itens.map(a => {
      const filtros = [
        a.categoria_id ? nomeCategoria(a.categoria_id) : 'qualquer categoria',
        a.cidade ? a.cidade : null,
        a.somente_gratuitos ? 'grátis' : null,
        a.fim_de_semana ? 'fim de semana' : null,
        a.raio_km ? 'até '+a.raio_km+' km' : null
      ].filter(Boolean).join(' · ');
      return '<article class="alerta-item-v25'+(a.ativo?'':' pausado')+'">'+
        '<div><strong>'+esc(a.nome)+'</strong><p>'+esc(filtros)+'</p><small>Criado em '+esc(fmt(a.criado_em))+'</small></div>'+
        '<div class="alerta-item-acoes-v25">'+
          '<button type="button" class="mini" data-v25-toggle-alerta="'+a.id+'" data-ativo="'+String(a.ativo)+'">'+(a.ativo?'Pausar':'Ativar')+'</button>'+
          '<button type="button" class="mini perigo" data-v25-excluir-alerta="'+a.id+'">Excluir</button>'+
        '</div></article>';
    }).join('');
  }

  async function listarSeguindo(){
    const lista = document.getElementById('v25_lista_seguindo');
    const qtd = document.getElementById('v25_qtd_seguindo');
    if(!lista) return;
    const session = await sessaoAtual();
    if(!session){ lista.innerHTML = '<p class="dica">Entre para ver os organizadores que você segue.</p>'; return; }
    const { data, error } = await db.rpc('meus_organizadores_seguidos_v25');
    if(error){ lista.innerHTML = '<p class="dica">Não foi possível carregar os organizadores.</p>'; return; }
    const itens = data || [];
    qtd.textContent = itens.length + (itens.length===1?' seguindo':' seguindo');
    if(!itens.length){ lista.innerHTML = '<div class="vazio alerta-vazio-v25"><strong>Você ainda não segue ninguém</strong><p>Abra o perfil de um organizador e toque em Seguir.</p></div>'; return; }
    lista.innerHTML = '<div class="seguindo-grade-v25">'+itens.map(p =>
      '<a class="seguindo-card-v25" href="'+esc(perfilUrl(p.id))+'">'+
        '<span class="seguindo-avatar-v25">'+(p.foto_url?'<img src="'+esc(p.foto_url)+'" alt="">':esc((p.nome||'?').slice(0,2).toUpperCase()))+'</span>'+
        '<span><strong>'+esc(p.nome)+(p.verificado?' <span class="mini-verificado-v25" title="Verificado">✓</span>':'')+'</strong><small>'+esc(p.cidade||'Cidade não informada')+' · '+Number(p.seguidores_total||0)+' seguidor(es)</small></span>'+
      '</a>'
    ).join('')+'</div>';
  }

  async function tratarAcoesAlertas(e){
    const t = e.target.closest('[data-v25-toggle-alerta],[data-v25-excluir-alerta]');
    if(!t) return;
    if(t.dataset.v25ToggleAlerta){
      const ativo = t.dataset.ativo === 'true';
      const { error } = await db.from('alertas_eventos').update({ ativo:!ativo }).eq('id',t.dataset.v25ToggleAlerta);
      if(error){ avisarV25(error.message); return; }
      avisarV25(ativo ? 'Alerta pausado.' : 'Alerta ativado.');
      await listarAlertas();
    }else if(t.dataset.v25ExcluirAlerta){
      if(!confirm('Excluir este alerta?')) return;
      const { error } = await db.from('alertas_eventos').delete().eq('id',t.dataset.v25ExcluirAlerta);
      if(error){ avisarV25(error.message); return; }
      avisarV25('Alerta excluído.');
      await listarAlertas();
    }
  }

  async function carregarComunidadePerfil(){
    await carregarCategoriasV25();
    await Promise.all([listarAlertas(), listarSeguindo()]);
  }

  /* ---------------- Admin: selo de verificação ---------------- */
  function inserirAbaVerificacao(){
    const abas = document.querySelector('.painel-abas');
    if(!abas || document.querySelector('[data-painel="verificacao"]')) return;
    const b = document.createElement('button');
    b.className = 'painel-aba';
    b.dataset.painel = 'verificacao';
    b.setAttribute('aria-pressed','false');
    b.textContent = 'Verificação';
    abas.appendChild(b);

    b.addEventListener('click', () => setTimeout(listarVerificacaoAdmin, 0));
    document.addEventListener('click', async e => {
      const btn = e.target.closest('[data-v25-verificar]');
      if(!btn) return;
      const id = btn.dataset.v25Verificar;
      const atual = btn.dataset.verificado === 'true';
      const acao = atual ? 'remover a verificação' : 'verificar este organizador';
      if(!confirm('Deseja '+acao+'?')) return;
      btn.disabled = true;
      const { error } = await db.rpc('admin_definir_verificacao_v25',{ p_usuario:id, p_verificado:!atual });
      if(error){ btn.disabled=false; avisarV25(error.message); return; }
      avisarV25(atual ? 'Verificação removida.' : 'Organizador verificado.');
      await listarVerificacaoAdmin();
    });
  }

  async function listarVerificacaoAdmin(){
    const lista = document.getElementById('lista');
    const titulo = document.getElementById('tituloPainel');
    const contagem = document.getElementById('contagemPainel');
    if(!lista || !titulo) return;
    titulo.textContent = 'Verificação de organizadores';
    lista.innerHTML = '<div class="esqueleto" style="min-height:70px"></div>'.repeat(3);
    const { data, error } = await db.from('perfis')
      .select('id,nome,email,cidade,papel,bloqueado,verificado,verificado_em,seguidores_total,criado_em')
      .order('verificado',{ascending:false}).order('criado_em',{ascending:false});
    if(error){ lista.innerHTML='<div class="vazio"><strong>Erro ao carregar</strong>'+esc(error.message)+'</div>'; return; }
    const itens = data || [];
    contagem.textContent = itens.filter(x=>x.verificado).length+' verificado(s) de '+itens.length+' conta(s)';
    lista.innerHTML = '<div class="verificacao-intro-v25"><strong>Selo de organizador verificado</strong><p>Use o selo para instituições, coletivos, espaços culturais ou organizadores cuja identidade foi conferida pela equipe.</p></div>'+
      itens.map(u => '<div class="ficha verificacao-ficha-v25">'+
        '<div class="corpo"><h4>'+esc(u.nome)+(u.verificado?' <span class="selo-verificado-v25 compacto"><span>✓</span> Verificado</span>':'')+'</h4>'+
        '<div class="meta">'+esc(u.email||'—')+(u.cidade?' · '+esc(u.cidade):'')+' · '+Number(u.seguidores_total||0)+' seguidor(es)'+(u.verificado_em?'<br>VERIFICADO EM '+esc(fmt(u.verificado_em)):'')+'</div></div>'+
        (u.bloqueado?'<span class="selo bloqueado">bloqueado</span>':'')+
        '<div class="botoes"><button type="button" class="mini '+(u.verificado?'':'ok')+'" data-v25-verificar="'+u.id+'" data-verificado="'+String(u.verificado)+'">'+(u.verificado?'Remover selo':'✓ Verificar')+'</button></div>'+
      '</div>').join('');
  }

  async function iniciar(){
    if(pagina === 'organizador.html') await iniciarOrganizador();
    if(pagina === 'perfil.html') inserirAbaComunidade();
    if(pagina === 'admin.html') inserirAbaVerificacao();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
