/* ============================================================
   ROLÊ V26 — foto de perfil em Conta e segurança
   Adiciona troca de avatar dedicada sem alterar a lógica base.
   ============================================================ */
(() => {
  'use strict';
  if (window.__rolePerfilFotoContaV26) return;
  window.__rolePerfilFotoContaV26 = true;

  const $ = (s, r=document) => r.querySelector(s);
  const avisar = (msg) => {
    if (typeof window.avisar === 'function') window.avisar(msg);
    else console.info('[perfil-foto]', msg);
  };

  function iniciais(nome){
    return String(nome || '?').trim().split(/\s+/).slice(0,2).map(p => (p[0] || '').toUpperCase()).join('') || '?';
  }

  function caminhoStoragePublico(url, bucket){
    if(!url) return null;
    const marca = '/storage/v1/object/public/' + bucket + '/';
    const i = String(url).indexOf(marca);
    if(i < 0) return null;
    return decodeURIComponent(String(url).slice(i + marca.length).split('?')[0]);
  }

  function htmlFoto(url, nome){
    return url
      ? '<img src="' + String(url).replace(/"/g,'&quot;') + '" alt="Foto de perfil">'
      : '<span>' + iniciais(nome) + '</span>';
  }

  function preencherAtual(){
    const preview = $('#perfilFotoContaPreviewV26');
    if(!preview) return;
    const perfil = (window.Sessao && Sessao.perfil) || null;
    if(!perfil) return;
    preview.innerHTML = htmlFoto(perfil.foto_url, perfil.nome);
  }

  function montar(){
    const pane = $('.perfil-painel[data-pane="conta"]');
    const pilha = pane && $('.pilha-paineis', pane);
    if(!pilha || $('#perfilFotoContaV26')) return false;

    const bloco = document.createElement('section');
    bloco.id = 'perfilFotoContaV26';
    bloco.className = 'superficie-lovable max-2col bloco-form-lovable perfil-foto-conta-v26';
    bloco.innerHTML = `
      <div class="perfil-foto-conta-cabecalho-v26">
        <div>
          <p class="bloco-kicker">FOTO DE PERFIL</p>
          <h3>Sua imagem no Rolê</h3>
          <p class="dica">Essa foto aparece no seu perfil, nos seus eventos e para outras pessoas da comunidade.</p>
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

    // A troca de foto passa a morar em Conta e segurança; mantém o input antigo
    // no DOM para compatibilidade com a lógica existente, mas não o exibe.
    const fotoAntigaCampo = $('#p_foto');
    if(fotoAntigaCampo && fotoAntigaCampo.closest('.campo')) {
      fotoAntigaCampo.closest('.campo').hidden = true;
    }

    const input = $('#a_foto_v26');
    const botao = $('#btnSalvarFotoContaV26');
    const arquivoTxt = $('#perfilFotoArquivoV26');
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
      arquivoTxt.textContent = arq.name;
      objectUrl = URL.createObjectURL(arq);
      $('#perfilFotoContaPreviewV26').innerHTML = '<img src="' + objectUrl + '" alt="Prévia da nova foto">';
      botao.disabled = false;
    });

    botao.addEventListener('click', async () => {
      const arq = input.files && input.files[0];
      if(!arq) return;
      if(!window.Sessao || !Sessao.usuario || !Sessao.usuario.id){ avisar('Entre na sua conta para alterar a foto.'); return; }
      if(arq.size > 3 * 1024 * 1024){ avisar('A foto precisa ter no máximo 3 MB.'); return; }
      if(!['image/jpeg','image/png','image/webp'].includes(arq.type)){ avisar('Use uma foto JPG, PNG ou WebP.'); return; }

      const id = Sessao.usuario.id;
      const ext = (arq.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
      const caminho = id + '/' + Date.now() + '.' + ext;
      const fotoAnterior = Sessao.perfil && Sessao.perfil.foto_url;

      botao.disabled = true;
      const rotuloAnterior = botao.textContent;
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

        Sessao.perfil = { ...(Sessao.perfil || {}), ...(atualizacao.data || {}), foto_url:url };
        preencherAtual();

        const heroAvatar = $('#perfilAvatarBloco');
        if(heroAvatar) heroAvatar.innerHTML = '<img src="' + url.replace(/"/g,'&quot;') + '" alt="">';

        input.value = '';
        arquivoTxt.textContent = 'JPG, PNG ou WebP · até 3 MB';
        if(objectUrl){ URL.revokeObjectURL(objectUrl); objectUrl = null; }
        avisar('Foto de perfil atualizada.');
      }catch(err){
        console.error('[perfil-foto]', err);
        avisar((err && err.message) ? err.message : 'Não foi possível atualizar a foto.');
        preencherAtual();
      }finally{
        botao.disabled = true;
        botao.textContent = rotuloAnterior;
      }
    });

    preencherAtual();

    let tentativas = 0;
    const timer = setInterval(() => {
      tentativas++;
      preencherAtual();
      if((window.Sessao && Sessao.perfil) || tentativas > 20) clearInterval(timer);
    }, 250);

    return true;
  }

  function iniciar(){
    if(montar()) return;
    const obs = new MutationObserver(() => { if(montar()) obs.disconnect(); });
    obs.observe(document.documentElement, { childList:true, subtree:true });
    setTimeout(() => obs.disconnect(), 10000);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once:true });
  else iniciar();
})();
