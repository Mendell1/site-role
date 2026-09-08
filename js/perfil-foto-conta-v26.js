/* ============================================================
   ROLÊ V26 — foto de perfil em Conta e segurança
   Versão robusta: garante que o bloco exista e seja inicializado
   mesmo quando os outros módulos do perfil carregam depois.
   ============================================================ */
(() => {
  'use strict';
  if (window.__rolePerfilFotoContaV26_2) return;
  window.__rolePerfilFotoContaV26_2 = true;

  const $ = (s, r=document) => r.querySelector(s);

  function avisar(msg){
    if (typeof window.avisar === 'function') window.avisar(msg);
    else console.info('[perfil-foto]', msg);
  }

  function iniciais(nome){
    return String(nome || '?').trim().split(/\s+/).slice(0,2)
      .map(p => (p[0] || '').toUpperCase()).join('') || '?';
  }

  function caminhoStoragePublico(url, bucket){
    if(!url) return null;
    const marca = '/storage/v1/object/public/' + bucket + '/';
    const i = String(url).indexOf(marca);
    if(i < 0) return null;
    return decodeURIComponent(String(url).slice(i + marca.length).split('?')[0]);
  }

  function sessaoAtual(){
    return window.Sessao || null;
  }

  function htmlFoto(url, nome){
    return url
      ? '<img src="' + String(url).replace(/"/g,'&quot;') + '" alt="Foto de perfil">'
      : '<span>' + iniciais(nome) + '</span>';
  }

  function preencherAtual(){
    const preview = $('#perfilFotoContaPreviewV26');
    const sessao = sessaoAtual();
    if(!preview || !sessao || !sessao.perfil) return;
    preview.innerHTML = htmlFoto(sessao.perfil.foto_url, sessao.perfil.nome);
  }

  function criarBloco(pilha){
    let bloco = $('#perfilFotoContaV26');
    if(bloco) return bloco;

    bloco = document.createElement('section');
    bloco.id = 'perfilFotoContaV26';
    bloco.className = 'superficie-lovable max-2col bloco-form-lovable perfil-foto-conta-v26';
    bloco.innerHTML = `
      <div class="perfil-foto-conta-cabecalho-v26">
        <div>
          <p class="bloco-kicker">FOTO DE PERFIL</p>
          <h3>Alterar foto do perfil</h3>
          <p class="dica">Escolha a imagem que aparece no seu perfil, nos seus eventos e para outras pessoas da comunidade.</p>
        </div>
      </div>
      <div class="perfil-foto-conta-corpo-v26">
        <div class="perfil-foto-conta-preview-v26" id="perfilFotoContaPreviewV26" aria-label="Prévia da foto de perfil"><span>?</span></div>
        <div class="perfil-foto-conta-acoes-v26">
          <input id="a_foto_v26" class="perfil-foto-input-v26" type="file" accept="image/jpeg,image/png,image/webp">
          <label class="btn-linha perfil-foto-escolher-v26" for="a_foto_v26">Escolher nova foto</label>
          <p class="perfil-foto-arquivo-v26" id="perfilFotoArquivoV26">JPG, PNG ou WebP · até 3 MB</p>
          <button class="btn-escuro" id="btnSalvarFotoContaV26" type="button" disabled>Salvar nova foto</button>
        </div>
      </div>`;

    pilha.insertBefore(bloco, pilha.firstChild);
    return bloco;
  }

  function ocultarCampoAntigo(){
    const fotoAntiga = $('#p_foto');
    const campo = fotoAntiga && fotoAntiga.closest('.campo');
    if(campo) campo.hidden = true;
  }

  function vincular(bloco){
    if(!bloco || bloco.dataset.fotoContaV26Ligado === '1') return;
    bloco.dataset.fotoContaV26Ligado = '1';

    const input = $('#a_foto_v26', bloco);
    const botao = $('#btnSalvarFotoContaV26', bloco);
    const arquivoTxt = $('#perfilFotoArquivoV26', bloco);
    const preview = $('#perfilFotoContaPreviewV26', bloco);
    if(!input || !botao || !arquivoTxt || !preview) return;

    let objectUrl = null;

    input.addEventListener('change', () => {
      const arq = input.files && input.files[0];
      if(objectUrl){ URL.revokeObjectURL(objectUrl); objectUrl = null; }

      if(!arq){
        botao.disabled = true;
        arquivoTxt.textContent = 'JPG, PNG ou WebP · até 3 MB';
        preencherAtual();
        return;
      }

      if(arq.size > 3 * 1024 * 1024){
        input.value = '';
        botao.disabled = true;
        arquivoTxt.textContent = 'Arquivo acima de 3 MB';
        avisar('A foto precisa ter no máximo 3 MB.');
        preencherAtual();
        return;
      }

      if(!['image/jpeg','image/png','image/webp'].includes(arq.type)){
        input.value = '';
        botao.disabled = true;
        arquivoTxt.textContent = 'Formato não aceito';
        avisar('Use uma foto JPG, PNG ou WebP.');
        preencherAtual();
        return;
      }

      arquivoTxt.textContent = arq.name;
      objectUrl = URL.createObjectURL(arq);
      preview.innerHTML = '<img src="' + objectUrl + '" alt="Prévia da nova foto">';
      botao.disabled = false;
    });

    botao.addEventListener('click', async () => {
      const arq = input.files && input.files[0];
      const sessao = sessaoAtual();
      if(!arq) return;
      if(!sessao || !sessao.usuario || !sessao.usuario.id){
        avisar('Entre na sua conta para alterar a foto.');
        return;
      }

      const id = sessao.usuario.id;
      const ext = (arq.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
      const caminho = id + '/' + Date.now() + '.' + ext;
      const fotoAnterior = sessao.perfil && sessao.perfil.foto_url;

      botao.disabled = true;
      botao.textContent = 'Salvando...';

      try{
        const envio = await db.storage.from('avatares').upload(caminho, arq, { upsert:false });
        if(envio.error) throw envio.error;

        const url = db.storage.from('avatares').getPublicUrl(caminho).data.publicUrl;
        const atualizacao = await db.from('perfis').update({ foto_url:url }).eq('id', id).select().single();
        if(atualizacao.error){
          await db.storage.from('avatares').remove([caminho]);
          throw atualizacao.error;
        }

        if(fotoAnterior && fotoAnterior !== url){
          const antigo = caminhoStoragePublico(fotoAnterior, 'avatares');
          if(antigo) await db.storage.from('avatares').remove([antigo]);
        }

        sessao.perfil = { ...(sessao.perfil || {}), ...(atualizacao.data || {}), foto_url:url };

        const heroAvatar = $('#perfilAvatarBloco');
        if(heroAvatar) heroAvatar.innerHTML = '<img src="' + url.replace(/"/g,'&quot;') + '" alt="">';

        input.value = '';
        arquivoTxt.textContent = 'JPG, PNG ou WebP · até 3 MB';
        if(objectUrl){ URL.revokeObjectURL(objectUrl); objectUrl = null; }
        preencherAtual();
        avisar('Foto de perfil atualizada.');
      }catch(err){
        console.error('[perfil-foto]', err);
        avisar((err && err.message) ? err.message : 'Não foi possível atualizar a foto.');
        preencherAtual();
      }finally{
        botao.textContent = 'Salvar nova foto';
        botao.disabled = true;
      }
    });
  }

  function montar(){
    const pane = $('.perfil-painel[data-pane="conta"]');
    if(!pane) return false;

    let pilha = $('.pilha-paineis', pane);
    if(!pilha){
      pilha = document.createElement('div');
      pilha.className = 'pilha-paineis';
      while(pane.firstChild) pilha.appendChild(pane.firstChild);
      pane.appendChild(pilha);
    }

    const bloco = criarBloco(pilha);
    ocultarCampoAntigo();
    vincular(bloco);
    preencherAtual();
    return true;
  }

  function garantir(){
    montar();
    setTimeout(montar, 100);
    setTimeout(montar, 500);
    setTimeout(montar, 1500);
  }

  document.addEventListener('click', e => {
    const abaConta = e.target.closest('.perfil-aba[data-tab="conta"]');
    if(abaConta) setTimeout(garantir, 0);
  });

  function iniciar(){
    garantir();

    let tentativas = 0;
    const timer = setInterval(() => {
      tentativas++;
      montar();
      preencherAtual();
      if(tentativas >= 30) clearInterval(timer);
    }, 500);

    const obs = new MutationObserver(() => montar());
    obs.observe(document.body, { childList:true, subtree:true });
    setTimeout(() => obs.disconnect(), 15000);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once:true });
  else iniciar();
})();
