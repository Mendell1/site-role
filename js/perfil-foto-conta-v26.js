/* ============================================================
   ROLÊ V26 — foto de perfil + editor antes do envio
   - abre um editor depois de escolher a imagem
   - arraste para reposicionar
   - use o controle para aproximar/afastar
   - só envia a imagem depois de Aplicar e Salvar
   ============================================================ */
(() => {
  'use strict';
  if (window.__rolePerfilFotoContaV26Crop) return;
  window.__rolePerfilFotoContaV26Crop = true;

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

  /* ---------------- editor de imagem ---------------- */
  let editor = null;
  let arquivoEditado = null;
  let previewEditadoUrl = null;

  function montarEditor(){
    if($('#perfilCropModalV26')) return;

    const modal = document.createElement('div');
    modal.id = 'perfilCropModalV26';
    modal.className = 'perfil-crop-modal-v26';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="perfil-crop-dialog-v26" role="dialog" aria-modal="true" aria-labelledby="perfilCropTituloV26">
        <div class="perfil-crop-topo-v26">
          <h2 id="perfilCropTituloV26">Editar imagem</h2>
          <button type="button" class="perfil-crop-fechar-v26" data-crop-cancelar aria-label="Fechar">×</button>
        </div>

        <div class="perfil-crop-area-v26" id="perfilCropAreaV26">
          <img id="perfilCropImagemV26" draggable="false" alt="Prévia para recorte">
          <div class="perfil-crop-mascara-v26" aria-hidden="true"></div>
          <div class="perfil-crop-guia-v26" id="perfilCropGuiaV26" aria-hidden="true"></div>
          <div class="perfil-crop-carregando-v26" id="perfilCropCarregandoV26">Carregando imagem…</div>
        </div>

        <div class="perfil-crop-controles-v26">
          <span class="perfil-crop-zoom-icone-v26 pequeno" aria-hidden="true">▣</span>
          <input id="perfilCropZoomV26" type="range" min="100" max="300" value="100" step="1" aria-label="Zoom da imagem">
          <span class="perfil-crop-zoom-icone-v26 grande" aria-hidden="true">▣</span>
        </div>
        <p class="perfil-crop-ajuda-v26">Arraste a imagem para enquadrar. A área dentro do círculo será usada como foto do perfil.</p>

        <div class="perfil-crop-rodape-v26">
          <button type="button" class="perfil-crop-reset-v26" id="perfilCropResetV26">Redefinir</button>
          <div>
            <button type="button" class="btn-linha" data-crop-cancelar>Cancelar</button>
            <button type="button" class="btn-escuro perfil-crop-aplicar-v26" id="perfilCropAplicarV26" disabled>Aplicar</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const area = $('#perfilCropAreaV26', modal);
    const img = $('#perfilCropImagemV26', modal);
    const guia = $('#perfilCropGuiaV26', modal);
    const zoom = $('#perfilCropZoomV26', modal);
    const reset = $('#perfilCropResetV26', modal);
    const aplicar = $('#perfilCropAplicarV26', modal);

    editor = {
      modal, area, img, guia, zoom, aplicar,
      arquivo:null, sourceUrl:null,
      naturalW:0, naturalH:0,
      baseScale:1, zoomValor:1,
      offsetX:0, offsetY:0,
      dragging:false, pointerId:null,
      startX:0, startY:0, startOffsetX:0, startOffsetY:0
    };

    function diametroCorte(){
      return guia.getBoundingClientRect().width || 250;
    }

    function escalaAtual(){ return editor.baseScale * editor.zoomValor; }

    function limitarOffsets(){
      const d = diametroCorte();
      const escala = escalaAtual();
      const w = editor.naturalW * escala;
      const h = editor.naturalH * escala;
      const maxX = Math.max(0, (w - d) / 2);
      const maxY = Math.max(0, (h - d) / 2);
      editor.offsetX = Math.max(-maxX, Math.min(maxX, editor.offsetX));
      editor.offsetY = Math.max(-maxY, Math.min(maxY, editor.offsetY));
    }

    function desenhar(){
      if(!editor.naturalW || !editor.naturalH) return;
      limitarOffsets();
      const escala = escalaAtual();
      img.style.width = (editor.naturalW * escala) + 'px';
      img.style.height = (editor.naturalH * escala) + 'px';
      img.style.transform = `translate(-50%, -50%) translate(${editor.offsetX}px, ${editor.offsetY}px)`;
    }

    function redefinir(){
      if(!editor.naturalW || !editor.naturalH) return;
      const d = diametroCorte();
      editor.baseScale = Math.max(d / editor.naturalW, d / editor.naturalH);
      editor.zoomValor = 1;
      editor.offsetX = 0;
      editor.offsetY = 0;
      zoom.value = '100';
      desenhar();
    }

    function fecharEditor(cancelado){
      modal.classList.remove('aberto');
      modal.hidden = true;
      document.body.classList.remove('perfil-crop-aberto-v26');
      editor.dragging = false;
      if(editor.sourceUrl){ URL.revokeObjectURL(editor.sourceUrl); editor.sourceUrl = null; }
      img.removeAttribute('src');
      editor.arquivo = null;
      editor.naturalW = editor.naturalH = 0;

      if(cancelado){
        const input = $('#a_foto_v26');
        const botao = $('#btnSalvarFotoContaV26');
        const arquivoTxt = $('#perfilFotoArquivoV26');
        if(input) input.value = '';
        arquivoEditado = null;
        if(botao) botao.disabled = true;
        if(arquivoTxt) arquivoTxt.textContent = 'JPG, PNG ou WebP · até 3 MB';
        const preview = $('#perfilFotoContaPreviewV26');
        if(preview) delete preview.dataset.chaveFoto;
        preencherAtual();
      }
    }

    function gerarArquivoCortado(){
      return new Promise((resolve, reject) => {
        if(!editor.naturalW || !editor.naturalH) return reject(new Error('Imagem ainda não carregou'));

        const d = diametroCorte();
        const escala = escalaAtual();
        const tamanhoFonte = d / escala;
        const centroX = (editor.naturalW / 2) - (editor.offsetX / escala);
        const centroY = (editor.naturalH / 2) - (editor.offsetY / escala);
        let sx = centroX - tamanhoFonte / 2;
        let sy = centroY - tamanhoFonte / 2;
        sx = Math.max(0, Math.min(editor.naturalW - tamanhoFonte, sx));
        sy = Math.max(0, Math.min(editor.naturalH - tamanhoFonte, sy));

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d', { alpha:false });
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0,0,512,512);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, tamanhoFonte, tamanhoFonte, 0, 0, 512, 512);

        canvas.toBlob(blob => {
          if(!blob) return reject(new Error('Não foi possível preparar a imagem'));
          const nomeBase = (editor.arquivo?.name || 'foto').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi,'-');
          resolve(new File([blob], nomeBase + '-perfil.jpg', { type:'image/jpeg', lastModified:Date.now() }));
        }, 'image/jpeg', 0.92);
      });
    }

    zoom.addEventListener('input', () => {
      editor.zoomValor = Number(zoom.value) / 100;
      desenhar();
    });

    reset.addEventListener('click', redefinir);

    area.addEventListener('pointerdown', e => {
      if(!editor.naturalW) return;
      editor.dragging = true;
      editor.pointerId = e.pointerId;
      editor.startX = e.clientX;
      editor.startY = e.clientY;
      editor.startOffsetX = editor.offsetX;
      editor.startOffsetY = editor.offsetY;
      area.setPointerCapture(e.pointerId);
      area.classList.add('arrastando');
      e.preventDefault();
    });

    area.addEventListener('pointermove', e => {
      if(!editor.dragging || e.pointerId !== editor.pointerId) return;
      editor.offsetX = editor.startOffsetX + (e.clientX - editor.startX);
      editor.offsetY = editor.startOffsetY + (e.clientY - editor.startY);
      desenhar();
    });

    function soltar(e){
      if(!editor.dragging || (e && e.pointerId !== editor.pointerId)) return;
      editor.dragging = false;
      area.classList.remove('arrastando');
      try{ if(e) area.releasePointerCapture(e.pointerId); }catch(_){ }
    }
    area.addEventListener('pointerup', soltar);
    area.addEventListener('pointercancel', soltar);

    area.addEventListener('wheel', e => {
      if(!editor.naturalW) return;
      e.preventDefault();
      const atual = Number(zoom.value);
      const proximo = Math.max(100, Math.min(300, atual + (e.deltaY > 0 ? -6 : 6)));
      zoom.value = String(proximo);
      editor.zoomValor = proximo / 100;
      desenhar();
    }, { passive:false });

    modal.querySelectorAll('[data-crop-cancelar]').forEach(btn => btn.addEventListener('click', () => fecharEditor(true)));
    modal.addEventListener('click', e => { if(e.target === modal) fecharEditor(true); });

    aplicar.addEventListener('click', async () => {
      aplicar.disabled = true;
      aplicar.textContent = 'Aplicando…';
      try{
        arquivoEditado = await gerarArquivoCortado();
        const preview = $('#perfilFotoContaPreviewV26');
        const botao = $('#btnSalvarFotoContaV26');
        const arquivoTxt = $('#perfilFotoArquivoV26');

        if(previewEditadoUrl) URL.revokeObjectURL(previewEditadoUrl);
        previewEditadoUrl = URL.createObjectURL(arquivoEditado);
        if(preview){
          delete preview.dataset.chaveFoto;
          preview.innerHTML = '<img src="' + previewEditadoUrl + '" alt="Prévia da foto editada">';
        }
        if(arquivoTxt) arquivoTxt.textContent = 'Imagem enquadrada · pronta para salvar';
        if(botao) botao.disabled = false;
        fecharEditor(false);
      }catch(err){
        avisarFoto(err?.message || 'Não foi possível aplicar o enquadramento.');
      }finally{
        aplicar.textContent = 'Aplicar';
        aplicar.disabled = false;
      }
    });

    document.addEventListener('keydown', e => {
      if(e.key === 'Escape' && !modal.hidden) fecharEditor(true);
    });

    window.addEventListener('resize', () => {
      if(!modal.hidden && editor.naturalW){
        const zoomMantido = editor.zoomValor;
        const d = diametroCorte();
        editor.baseScale = Math.max(d / editor.naturalW, d / editor.naturalH);
        editor.zoomValor = zoomMantido;
        desenhar();
      }
    });
  }

  function abrirEditor(arq){
    montarEditor();
    if(!editor) return;

    editor.arquivo = arq;
    if(editor.sourceUrl) URL.revokeObjectURL(editor.sourceUrl);
    editor.sourceUrl = URL.createObjectURL(arq);
    editor.naturalW = editor.naturalH = 0;
    editor.zoom.value = '100';
    editor.aplicar.disabled = true;
    $('#perfilCropCarregandoV26').hidden = false;

    editor.modal.hidden = false;
    editor.modal.classList.add('aberto');
    document.body.classList.add('perfil-crop-aberto-v26');

    editor.img.onload = () => {
      editor.naturalW = editor.img.naturalWidth;
      editor.naturalH = editor.img.naturalHeight;
      editor.offsetX = 0;
      editor.offsetY = 0;
      editor.zoomValor = 1;
      const d = editor.guia.getBoundingClientRect().width || 250;
      editor.baseScale = Math.max(d / editor.naturalW, d / editor.naturalH);
      $('#perfilCropCarregandoV26').hidden = true;
      editor.aplicar.disabled = false;
      const escala = editor.baseScale;
      editor.img.style.width = (editor.naturalW * escala) + 'px';
      editor.img.style.height = (editor.naturalH * escala) + 'px';
      editor.img.style.transform = 'translate(-50%, -50%) translate(0px, 0px)';
    };
    editor.img.onerror = () => {
      $('#perfilCropCarregandoV26').textContent = 'Não foi possível abrir esta imagem.';
      editor.aplicar.disabled = true;
    };
    editor.img.src = editor.sourceUrl;
  }

  /* ---------------- bloco Conta e segurança ---------------- */
  function montar(){
    const pane = $('.perfil-painel[data-pane="conta"]');
    const pilha = pane && $('.pilha-paineis', pane);
    if(!pane || !pilha) return false;

    montarEditor();

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
            <p class="dica">Escolha uma imagem e ajuste o enquadramento antes de enviar.</p>
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

    input.addEventListener('change', () => {
      const arq = input.files && input.files[0];
      arquivoEditado = null;
      if(previewEditadoUrl){ URL.revokeObjectURL(previewEditadoUrl); previewEditadoUrl = null; }

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

      arquivoTxt.textContent = 'Ajuste o enquadramento e clique em Aplicar';
      botao.disabled = true;
      abrirEditor(arq);
    });

    botao.addEventListener('click', async () => {
      const arq = arquivoEditado;
      const sessao = sessaoAtual();
      if(!arq){
        avisarFoto('Escolha e aplique o enquadramento da foto primeiro.');
        return;
      }
      if(!sessao || !sessao.usuario || !sessao.usuario.id){
        avisarFoto('Entre na sua conta para alterar a foto.');
        return;
      }

      const id = sessao.usuario.id;
      const caminho = id + '/' + Date.now() + '.jpg';
      const fotoAnterior = sessao.perfil && sessao.perfil.foto_url;

      botao.disabled = true;
      botao.textContent = 'Salvando...';
      try{
        const envio = await db.storage.from('avatares').upload(caminho, arq, {
          upsert:false,
          contentType:'image/jpeg'
        });
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
        if(typeof window.atualizarTopo === 'function') window.atualizarTopo();

        input.value='';
        arquivoEditado = null;
        arquivoTxt.textContent='JPG, PNG ou WebP · até 3 MB';
        if(previewEditadoUrl){ URL.revokeObjectURL(previewEditadoUrl); previewEditadoUrl=null; }
        delete preview.dataset.chaveFoto;
        preencherAtual();
        avisarFoto('Foto de perfil atualizada.');
      }catch(err){
        console.error('[perfil-foto]',err);
        avisarFoto((err && err.message) ? err.message : 'Não foi possível atualizar a foto.');
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

    let tentativas = 0;
    const timer = setInterval(() => {
      tentativas++;
      montar();
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
