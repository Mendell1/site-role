/* ============================================================
   ROLÊ V26 — foto de perfil em Conta e segurança
   Versão estável: monta uma única vez e não observa o DOM inteiro.
   ============================================================ */
(() => {
  'use strict';
  if (window.__rolePerfilFotoContaV26Stable) return;
  window.__rolePerfilFotoContaV26Stable = true;

  const $ = (s, r=document) => r.querySelector(s);

  function avisarFoto(msg){
    if (typeof window.avisar === 'function') window.avisar(msg);
    else console.info('[perfil-foto]', msg);
  }

  function iniciais(nome){
    return String(nome || '?').trim().split(/\s+/).slice(0,2)
      .map(p => (p[0] || '').toUpperCase()).join('') || '?';
  }

  function sessaoAtual(){ return window.Sessao || null; }

  function caminhoStoragePublico(url, bucket){
    if(!url) return null;
    const marca = '/storage/v1/object/public/' + bucket + '/';
    const i = String(url).indexOf(marca);
    if(i < 0) return null;
    return decodeURIComponent(String(url).slice(i + marca.length).split('?')[0]);
  }

  function renderPreview(url, nome){
    const preview = $('#perfilFotoContaPreviewV26');
    if(!preview) return;
    const chave = (url || '') + '|' + (nome || '');
    if(preview.dataset.chaveFoto === chave) return;
    preview.dataset.chaveFoto = chave;
    preview.innerHTML = url
      ? '<img src="' + String(url).replace(/"/g,'&quot;') + '" alt="Foto de perfil">'
      : '<span>' + iniciais(nome) + '</span>';
  }

  function preencherAtual(){
    const sessao = sessaoAtual();
    if(!sessao || !sessao.perfil) return false;
    renderPreview(sessao.perfil.foto_url, sessao.perfil.nome);
    return true;
  }

  function montar(){
    const pane = $('.perfil-painel[data-pane="conta"]');
    const pilha = pane && $('.pilha-paineis', pane);
    if(!pane || !pilha) return false;

    let bloco = $('#perfilFotoContaV26');
    if(!bloco){
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
    }

    const antigo = $('#p_foto');
    if(antigo && antigo.closest('.campo')) antigo.closest('.campo').hidden = true;

    if(bloco.dataset.ligado === '1'){
      preencherAtual();
      return true;
    }
    bloco.dataset.ligado = '1';

    const input = $('#a_foto_v26', bloco);
    const botao = $('#btnSalvarFotoContaV26', bloco);
    const arquivoTxt = $('#perfilFotoArquivoV26', bloco);
    const preview = $('#perfilFotoContaPreviewV26', bloco);
    let objectUrl = null;

    input.addEventListener('change', () => {
      const arq = input.files && input.files[0];
      if(objectUrl){ URL.revokeObjectURL(objectUrl); objectUrl = null; }

      if(!arq){
        botao.disabled = true;
        arquivoTxt.textContent = 'JPG, PNG ou WebP · até 3 MB';
        delete preview.dataset.chaveFoto;
        preencherAtual();
        return;
      }
      if(arq.size > 3*1024*1024){
        input.value=''; botao.disabled=true;
        arquivoTxt.textContent='Arquivo acima de 3 MB';
        avisarFoto('A foto precisa ter no máximo 3 MB.');
        return;
      }
      if(!['image/jpeg','image/png','image/webp'].includes(arq.type)){
        input.value=''; botao.disabled=true;
        arquivoTxt.textContent='Formato não aceito';
        avisarFoto('Use uma foto JPG, PNG ou WebP.');
        return;
      }

      arquivoTxt.textContent = arq.name;
      objectUrl = URL.createObjectURL(arq);
      delete preview.dataset.chaveFoto;
      preview.innerHTML = '<img src="' + objectUrl + '" alt="Prévia da nova foto">';
      botao.disabled = false;
    });

    botao.addEventListener('click', async () => {
      const arq = input.files && input.files[0];
      const sessao = sessaoAtual();
      if(!arq) return;
      if(!sessao || !sessao.usuario || !sessao.usuario.id){
        avisarFoto('Entre na sua conta para alterar a foto.');
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
          const caminhoAntigo = caminhoStoragePublico(fotoAnterior, 'avatares');
          if(caminhoAntigo) await db.storage.from('avatares').remove([caminhoAntigo]);
        }

        sessao.perfil = { ...(sessao.perfil || {}), ...(atualizacao.data || {}), foto_url:url };
        const heroAvatar = $('#perfilAvatarBloco');
        if(heroAvatar) heroAvatar.innerHTML = '<img src="' + url.replace(/"/g,'&quot;') + '" alt="">';

        input.value='';
        arquivoTxt.textContent='JPG, PNG ou WebP · até 3 MB';
        if(objectUrl){ URL.revokeObjectURL(objectUrl); objectUrl=null; }
        delete preview.dataset.chaveFoto;
        preencherAtual();
        avisarFoto('Foto de perfil atualizada.');
      }catch(err){
        console.error('[perfil-foto]',err);
        avisarFoto((err && err.message) ? err.message : 'Não foi possível atualizar a foto.');
        delete preview.dataset.chaveFoto;
        preencherAtual();
      }finally{
        botao.textContent='Salvar nova foto';
        botao.disabled=true;
      }
    });

    preencherAtual();
    return true;
  }

  function iniciar(){
    montar();

    // A sessão chega de forma assíncrona; apenas atualiza a prévia e encerra.
    let tentativas = 0;
    const timer = setInterval(() => {
      tentativas++;
      if(preencherAtual() || tentativas >= 20) clearInterval(timer);
    }, 300);

    document.addEventListener('click', e => {
      if(e.target.closest('.perfil-aba[data-tab="conta"]')){
        montar();
        setTimeout(preencherAtual, 0);
      }
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once:true });
  else iniciar();
})();
