/* ============================================================
   ROLÊ V25.5 — QR de compartilhamento do evento
   Unifica o QR antigo da V23 com o adaptador usado no ingresso.
   ============================================================ */
(() => {
  'use strict';

  if (window.__roleQrEventoV255Ativo) return;
  window.__roleQrEventoV255Ativo = true;

  function idEventoAtual(){
    const folha = document.getElementById('folhaDetalhe');
    if(!folha) return null;
    const alvo = folha.querySelector('[data-interesse],[data-editar],[data-denuncia-tipo="evento"]');
    if(!alvo) return null;
    return alvo.dataset.interesse || alvo.dataset.editar || alvo.dataset.denunciaId || null;
  }

  function urlEvento(id){
    const u = new URL('index.html', location.href);
    u.search = '';
    u.hash = '';
    u.searchParams.set('evento', id);
    return u.href;
  }

  async function copiar(texto){
    try{
      if(navigator.clipboard && window.isSecureContext){
        await navigator.clipboard.writeText(texto);
        return true;
      }
      const area = document.createElement('textarea');
      area.value = texto;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    }catch(_){
      return false;
    }
  }

  function avisar(texto){
    if(typeof window.avisar === 'function'){
      window.avisar(texto);
      return;
    }
    console.info('[V25.5/QR EVENTO]', texto);
  }

  async function esperarCompatibilidade(){
    if(window.QRCode && typeof window.QRCode.toCanvas === 'function') return window.QRCode;

    let script = document.querySelector('script[src="js/qr-compat-v25.js"]');
    if(!script){
      script = document.createElement('script');
      script.src = 'js/qr-compat-v25.js';
      script.async = false;
      document.head.appendChild(script);
    }

    const inicio = Date.now();
    while(Date.now() - inicio < 4000){
      if(window.QRCode && typeof window.QRCode.toCanvas === 'function') return window.QRCode;
      await new Promise(resolve => setTimeout(resolve, 40));
    }

    throw new Error('Adaptador de QR indisponível');
  }

  function criarModal(link){
    document.querySelectorAll('.v23-modal').forEach(x => x.remove());

    const modal = document.createElement('div');
    modal.className = 'cortina aberta v23-modal';
    modal.id = 'modalQrEventoV255';
    modal.innerHTML = '<div class="folha" role="dialog" aria-modal="true">'+
      '<button class="fechar" data-v255-qr-fecha aria-label="Fechar">×</button>'+
      '<h3>QR Code do evento</h3>'+
      '<p class="v23-modal-intro">Aponte a câmera do celular para abrir este evento diretamente no Rolê.</p>'+
      '<div class="v23-qr-wrap"><canvas id="qrEventoV255" width="220" height="220" aria-label="QR Code do evento"></canvas></div>'+
      '<div class="v23-link-caixa">'+link.replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]))+'</div>'+
      '<div class="v23-modal-acoes"><button class="btn-linha" data-v255-qr-copiar>Copiar link</button></div>'+
      '</div>';

    document.body.appendChild(modal);

    modal.addEventListener('click', async e => {
      if(e.target === modal || e.target.closest('[data-v255-qr-fecha]')){
        modal.remove();
        return;
      }
      if(e.target.closest('[data-v255-qr-copiar]')){
        avisar(await copiar(link) ? 'Link copiado' : 'Não foi possível copiar o link');
      }
    });

    return modal;
  }

  async function abrirQrEvento(){
    const id = idEventoAtual();
    if(!id){
      avisar('Não foi possível identificar este evento.');
      return;
    }

    const link = urlEvento(id);
    const modal = criarModal(link);
    const canvas = modal.querySelector('#qrEventoV255');

    try{
      const QR = await esperarCompatibilidade();
      await QR.toCanvas(canvas, link, {width:220, margin:2, errorCorrectionLevel:'M'});
    }catch(err){
      console.error('[V25.5/QR EVENTO]', err);
      const box = modal.querySelector('.v23-qr-wrap');
      if(box) box.innerHTML = '<span class="dica">Não foi possível desenhar o QR agora. O link abaixo continua funcionando.</span>';
    }
  }

  document.addEventListener('click', e => {
    const botao = e.target.closest('[data-v23-qr]');
    if(!botao) return;

    // Impede que o listener antigo da V23 tente usar `new QRCode(...)`.
    e.preventDefault();
    e.stopImmediatePropagation();
    abrirQrEvento();
  }, true);

  console.info('[V25.5] QR de evento unificado com o adaptador atual');
})();
