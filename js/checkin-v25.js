/* ============================================================
   ROLÊ V25.3 — Ingresso QR + check-in + painel presencial
   ============================================================ */
(() => {
  'use strict';

  const PREFIXO='[V25.3]';
  const QR_LIB='https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js';
  let qrPromise=null;
  let observerDetalhe=null;
  let scannerStream=null;
  let scannerFrame=null;
  let scannerAtivo=false;
  let ultimoCodigo='';
  let ultimoScanEm=0;
  let eventoScanner=null;

  const escapa=v=>String(v==null?'':v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const logado=()=>typeof Sessao!=='undefined'&&Sessao&&typeof Sessao.logado==='function'&&Sessao.logado();

  function avisar253(txt){
    if(typeof window.avisar==='function') return window.avisar(txt);
    console.info(PREFIXO,txt);
  }

  function idEventoNoDetalhe(){
    const folha=document.getElementById('folhaDetalhe');
    if(!folha) return null;
    const alvo=folha.querySelector('[data-editar],[data-interesse],[data-denuncia-tipo="evento"]');
    return alvo ? (alvo.dataset.editar||alvo.dataset.interesse||alvo.dataset.denunciaId||null) : null;
  }

  function fmtData(iso){
    if(!iso) return '—';
    const d=new Date(iso+'T00:00:00');
    return Number.isNaN(d.getTime())?iso:d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  }
  function fmtHora(h){ return String(h||'').slice(0,5)||'—'; }
  function fmtDataHora(iso){ return iso?new Date(iso).toLocaleString('pt-BR'):'—'; }
  function parseCodigo(valor){
    const bruto=String(valor||'').trim();
    const codigo=bruto.toUpperCase().startsWith('ROLE:')?bruto.slice(5).trim():bruto;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(codigo)?codigo:null;
  }

  function abrirModal(id){ const m=document.getElementById(id); if(m) m.classList.add('aberta'); }
  function fecharModal(id){ const m=document.getElementById(id); if(m) m.classList.remove('aberta'); }

  function carregarQrLib(){
    if(window.QRCode) return Promise.resolve(window.QRCode);
    if(qrPromise) return qrPromise;
    qrPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=QR_LIB; s.async=true; s.crossOrigin='anonymous';
      s.onload=()=>window.QRCode?resolve(window.QRCode):reject(new Error('Biblioteca de QR indisponível'));
      s.onerror=()=>reject(new Error('Não foi possível carregar o gerador de QR'));
      document.head.appendChild(s);
    });
    return qrPromise;
  }

  function criarModais(){
    if(!document.getElementById('modalIngressoV253')){
      const m=document.createElement('div');
      m.className='cortina'; m.id='modalIngressoV253';
      m.innerHTML='<div class="folha v253-modal-ingresso" role="dialog" aria-modal="true">'+
        '<button class="fechar" data-v253-fechar="modalIngressoV253">×</button>'+
        '<div id="conteudoIngressoV253"><p class="dica">Carregando ingresso...</p></div></div>';
      document.body.appendChild(m);
    }
    if(!document.getElementById('modalScannerV253')){
      const m=document.createElement('div');
      m.className='cortina'; m.id='modalScannerV253';
      m.innerHTML='<div class="folha v253-modal-scanner" role="dialog" aria-modal="true">'+
        '<button class="fechar" data-v253-fechar="modalScannerV253">×</button>'+
        '<p class="v253-kicker">V25.3 · CHECK-IN</p><h3>Escanear participante</h3>'+
        '<p class="dica">Aponte a câmera para o QR do ingresso. Se a câmera não estiver disponível, cole o código manualmente.</p>'+
        '<div class="v253-camera-wrap"><video id="videoScannerV253" playsinline muted></video><div class="v253-mira"><span></span></div><div id="scannerEstadoV253" class="v253-camera-estado">Câmera desligada</div></div>'+
        '<div class="v253-scanner-acoes"><button class="v253-btn" id="btnIniciarScannerV253">Iniciar câmera</button><button class="v253-btn v253-sec" id="btnPararScannerV253">Parar câmera</button></div>'+
        '<div class="v253-manual"><label for="codigoManualV253">Código do ingresso</label><div><input id="codigoManualV253" placeholder="ROLE:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"><button class="v253-btn" id="btnValidarManualV253">Validar</button></div></div>'+
        '<div id="resultadoScannerV253"></div></div>';
      document.body.appendChild(m);
    }
    if(!document.getElementById('modalPainelV253')){
      const m=document.createElement('div');
      m.className='cortina'; m.id='modalPainelV253';
      m.innerHTML='<div class="folha v253-modal-painel" role="dialog" aria-modal="true">'+
        '<button class="fechar" data-v253-fechar="modalPainelV253">×</button>'+
        '<div id="conteudoPainelV253"><p class="dica">Carregando painel...</p></div></div>';
      document.body.appendChild(m);
    }
  }

  async function abrirIngresso(eventoId){
    if(!logado()){ avisar253('Entre na conta para abrir seu ingresso'); return; }
    criarModais(); abrirModal('modalIngressoV253');
    const caixa=document.getElementById('conteudoIngressoV253');
    caixa.innerHTML='<p class="dica">Carregando ingresso...</p>';
    const {data,error}=await db.rpc('meu_ingresso_v25_3',{p_evento:eventoId});
    if(error||!data){
      caixa.innerHTML='<div class="v253-erro">'+escapa(error?.message||'Ingresso indisponível')+'</div>';
      return;
    }
    const presente=!!data.checkin_em;
    caixa.innerHTML='<p class="v253-kicker">MEU INGRESSO</p><h3>'+escapa(data.evento_nome)+'</h3>'+
      '<div class="v253-ingresso-status '+(presente?'ok':'')+'">'+(presente?'✓ Check-in realizado':'Inscrição confirmada')+'</div>'+
      '<div class="v253-ticket-meta"><p><strong>'+escapa(data.participante_nome)+'</strong></p><p>'+escapa(fmtData(data.data_evento))+' · '+escapa(fmtHora(data.hora_evento))+'</p><p>⌖ '+escapa([data.bairro,data.cidade].filter(Boolean).join(', '))+'</p></div>'+
      '<div class="v253-qr-box"><canvas id="qrIngressoV253" width="260" height="260" aria-label="QR Code do ingresso"></canvas></div>'+
      '<p class="v253-codigo">Código: <code>'+escapa(data.ingresso_codigo)+'</code></p>'+
      (presente?'<p class="dica">Entrada registrada em '+escapa(fmtDataHora(data.checkin_em))+'.</p>':'<p class="dica">Apresente este QR ao organizador na entrada. O código não contém seu nome nem e-mail.</p>');
    try{
      const QR=await carregarQrLib();
      const canvas=document.getElementById('qrIngressoV253');
      await QR.toCanvas(canvas,data.qr_payload,{width:260,margin:2,errorCorrectionLevel:'M'});
    }catch(err){
      console.warn(PREFIXO,err);
      const box=caixa.querySelector('.v253-qr-box');
      if(box) box.innerHTML='<div class="v253-erro">Não foi possível desenhar o QR agora. Use o código abaixo.</div>';
    }
  }

  async function validarCodigo(codigo){
    const uuid=parseCodigo(codigo);
    const resultado=document.getElementById('resultadoScannerV253');
    if(!uuid){ if(resultado) resultado.innerHTML='<div class="v253-resultado erro"><strong>Código inválido</strong><span>Confira o QR ou cole o código completo.</span></div>'; return; }
    if(!eventoScanner){ avisar253('Abra o scanner pelo evento'); return; }
    if(resultado) resultado.innerHTML='<div class="v253-resultado"><strong>Validando...</strong></div>';
    const {data,error}=await db.rpc('checkin_ingresso_v25_3',{p_codigo:uuid});
    if(error){
      if(resultado) resultado.innerHTML='<div class="v253-resultado erro"><strong>Check-in recusado</strong><span>'+escapa(error.message||'Ingresso inválido')+'</span></div>';
      return;
    }
    if(data.evento_id!==eventoScanner){
      if(resultado) resultado.innerHTML='<div class="v253-resultado erro"><strong>Ingresso de outro evento</strong><span>Este QR pertence a '+escapa(data.evento_nome||'outro evento')+'.</span></div>';
      return;
    }
    const repetido=!!data.ja_realizado;
    if(resultado) resultado.innerHTML='<div class="v253-resultado '+(repetido?'aviso':'ok')+'"><strong>'+(repetido?'Check-in já realizado':'✓ Check-in realizado')+'</strong><span>'+escapa(data.participante_nome)+'</span><small>'+escapa(fmtDataHora(data.checkin_em))+'</small></div>';
    ultimoCodigo=uuid; ultimoScanEm=Date.now();
    carregarMiniMetricasScanner();
  }

  async function carregarMiniMetricasScanner(){
    if(!eventoScanner) return;
    const estado=document.getElementById('scannerEstadoV253');
    const {data}=await db.rpc('painel_evento_v25_3',{p_evento:eventoScanner});
    if(data&&estado) estado.textContent=data.presentes+' presentes de '+data.inscritos+' inscritos · '+data.taxa_comparecimento+'%';
  }

  async function iniciarScanner(){
    if(scannerAtivo) return;
    const video=document.getElementById('videoScannerV253');
    const estado=document.getElementById('scannerEstadoV253');
    if(!navigator.mediaDevices?.getUserMedia){
      if(estado) estado.textContent='Câmera não disponível neste navegador. Use o código manual.';
      return;
    }
    if(typeof BarcodeDetector==='undefined'){
      if(estado) estado.textContent='Leitura automática de QR não disponível. Use o código manual.';
      return;
    }
    let detector;
    try{
      const formatos=BarcodeDetector.getSupportedFormats?await BarcodeDetector.getSupportedFormats():['qr_code'];
      if(!formatos.includes('qr_code')) throw new Error('QR não suportado');
      detector=new BarcodeDetector({formats:['qr_code']});
      scannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      video.srcObject=scannerStream; await video.play(); scannerAtivo=true;
      if(estado) estado.textContent='Câmera ativa · procurando QR...';
    }catch(err){
      console.warn(PREFIXO,err);
      if(estado) estado.textContent='Não foi possível abrir a câmera. Use o código manual.';
      pararScanner(); return;
    }
    const detectar=async()=>{
      if(!scannerAtivo) return;
      try{
        const codigos=await detector.detect(video);
        if(codigos.length){
          const bruto=codigos[0].rawValue||'';
          const parsed=parseCodigo(bruto);
          if(parsed && (parsed!==ultimoCodigo || Date.now()-ultimoScanEm>2500)) await validarCodigo(bruto);
        }
      }catch(err){ }
      scannerFrame=requestAnimationFrame(detectar);
    };
    detectar();
  }

  function pararScanner(){
    scannerAtivo=false;
    if(scannerFrame){ cancelAnimationFrame(scannerFrame); scannerFrame=null; }
    if(scannerStream){ scannerStream.getTracks().forEach(t=>t.stop()); scannerStream=null; }
    const video=document.getElementById('videoScannerV253'); if(video) video.srcObject=null;
    const estado=document.getElementById('scannerEstadoV253'); if(estado) estado.textContent='Câmera desligada';
  }

  async function abrirScanner(eventoId){
    criarModais(); eventoScanner=eventoId; ultimoCodigo=''; ultimoScanEm=0;
    document.getElementById('resultadoScannerV253').innerHTML='';
    document.getElementById('codigoManualV253').value='';
    abrirModal('modalScannerV253');
    await carregarMiniMetricasScanner();
    iniciarScanner();
  }

  function avatar(p){
    if(p.foto_url) return '<span class="v253-avatar"><img src="'+escapa(p.foto_url)+'" alt=""></span>';
    const iniciais=String(p.nome||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
    return '<span class="v253-avatar">'+escapa(iniciais||'?')+'</span>';
  }

  async function abrirPainel(eventoId){
    criarModais(); abrirModal('modalPainelV253');
    const caixa=document.getElementById('conteudoPainelV253');
    caixa.innerHTML='<p class="dica">Carregando painel...</p>';
    const [m,p]=await Promise.all([
      db.rpc('painel_evento_v25_3',{p_evento:eventoId}),
      db.rpc('participantes_evento_v25_3',{p_evento:eventoId})
    ]);
    if(m.error||p.error){
      caixa.innerHTML='<div class="v253-erro">'+escapa(m.error?.message||p.error?.message||'Não foi possível carregar')+'</div>';
      return;
    }
    const metricas=m.data||{}; const pessoas=p.data||[];
    const inscritos=pessoas.filter(x=>x.status==='inscrito');
    const fila=pessoas.filter(x=>x.status==='espera');
    caixa.innerHTML='<p class="v253-kicker">PAINEL DO ORGANIZADOR</p><div class="v253-painel-titulo"><div><h3>'+escapa(metricas.evento_nome)+'</h3><p>'+escapa(fmtData(metricas.data_evento))+' · '+escapa(fmtHora(metricas.hora_evento))+'</p></div><button class="v253-btn" data-v253-scanner="'+escapa(eventoId)+'">Escanear QR</button></div>'+
      '<div class="v253-metricas"><article><strong>'+Number(metricas.inscritos||0)+'</strong><span>Inscritos</span></article><article><strong>'+Number(metricas.presentes||0)+'</strong><span>Presentes</span></article><article><strong>'+Number(metricas.espera||0)+'</strong><span>Na fila</span></article><article><strong>'+Number(metricas.taxa_comparecimento||0)+'%</strong><span>Comparecimento</span></article></div>'+
      '<div class="v253-painel-lista"><h4>Participantes</h4>'+(inscritos.length?inscritos.map(x=>'<article class="v253-pessoa">'+avatar(x)+'<div><strong>'+escapa(x.nome)+'</strong><span>'+(x.checkin_em?'✓ Presente · '+escapa(fmtDataHora(x.checkin_em)):'Inscrito · ainda não chegou')+'</span></div>'+(x.checkin_em?'<button class="v253-link-acao" data-v253-desfazer="'+escapa(x.usuario_id)+'" data-evento="'+escapa(eventoId)+'">Desfazer</button>':'')+'</article>').join(''):'<p class="dica">Nenhum inscrito.</p>')+'</div>'+
      (fila.length?'<div class="v253-painel-lista"><h4>Lista de espera</h4>'+fila.map((x,i)=>'<article class="v253-pessoa">'+avatar(x)+'<div><strong>'+escapa(x.nome)+'</strong><span>Posição '+(i+1)+'</span></div></article>').join('')+'</div>':'');
  }

  async function desfazerCheckin(eventoId,usuarioId){
    if(!confirm('Desfazer o check-in deste participante?')) return;
    const {data,error}=await db.rpc('desfazer_checkin_v25_3',{p_evento:eventoId,p_usuario:usuarioId});
    if(error){ avisar253(error.message||'Não foi possível desfazer'); return; }
    avisar253('Check-in de '+(data?.participante_nome||'participante')+' desfeito.');
    abrirPainel(eventoId);
  }

  async function sincronizarDetalhe(){
    const eventoId=idEventoNoDetalhe();
    const card=document.getElementById('participacaoV252');
    if(!eventoId||!card) return;
    let extra=card.querySelector('.v253-extra');
    if(!extra){ extra=document.createElement('div'); extra.className='v253-extra'; card.appendChild(extra); }
    const organizador=!!card.querySelector('[data-v252-participantes]');
    if(organizador){
      extra.innerHTML='<button class="v253-btn" data-v253-scanner="'+escapa(eventoId)+'">▣ Check-in por QR</button><button class="v253-btn v253-sec" data-v253-painel="'+escapa(eventoId)+'">Painel presencial</button>';
      return;
    }
    if(!logado()){ extra.innerHTML=''; return; }
    const {data,error}=await db.rpc('meu_ingresso_v25_3',{p_evento:eventoId});
    if(error||!data){ extra.innerHTML=''; return; }
    extra.innerHTML='<button class="v253-btn" data-v253-ingresso="'+escapa(eventoId)+'">🎟 Meu ingresso</button>'+(data.checkin_em?'<span class="v253-ja-presente">✓ Presença confirmada</span>':'');
  }

  function observarDetalhe(){
    const folha=document.getElementById('folhaDetalhe');
    if(!folha||observerDetalhe) return;
    let timer;
    observerDetalhe=new MutationObserver(()=>{ clearTimeout(timer); timer=setTimeout(sincronizarDetalhe,100); });
    observerDetalhe.observe(folha,{childList:true,subtree:true});
  }

  function enriquecerPerfil(){
    const caixa=document.getElementById('listaInscricoesV252');
    if(!caixa) return;
    const aplicar=()=>{
      caixa.querySelectorAll('.v252-inscricao-card').forEach(card=>{
        if(card.querySelector('[data-v253-ingresso]')) return;
        if(!card.querySelector('.v252-status-inscrito')) return;
        const link=card.querySelector('a[href*="?evento="]'); if(!link) return;
        const u=new URL(link.href,location.href); const id=u.searchParams.get('evento'); if(!id) return;
        const b=document.createElement('button'); b.type='button'; b.className='v253-btn v253-perfil-ticket'; b.dataset.v253Ingresso=id; b.textContent='🎟 Meu ingresso';
        link.parentElement.appendChild(b);
      });
    };
    aplicar(); new MutationObserver(aplicar).observe(caixa,{childList:true,subtree:true});
  }

  function ligarEventos(){
    document.addEventListener('click',async e=>{
      const ingresso=e.target.closest('[data-v253-ingresso]'); if(ingresso){ e.preventDefault(); await abrirIngresso(ingresso.dataset.v253Ingresso); return; }
      const scanner=e.target.closest('[data-v253-scanner]'); if(scanner){ e.preventDefault(); fecharModal('modalPainelV253'); await abrirScanner(scanner.dataset.v253Scanner); return; }
      const painel=e.target.closest('[data-v253-painel]'); if(painel){ e.preventDefault(); await abrirPainel(painel.dataset.v253Painel); return; }
      const desf=e.target.closest('[data-v253-desfazer]'); if(desf){ e.preventDefault(); await desfazerCheckin(desf.dataset.evento,desf.dataset.v253Desfazer); return; }
      const fechar=e.target.closest('[data-v253-fechar]'); if(fechar){ if(fechar.dataset.v253Fechar==='modalScannerV253') pararScanner(); fecharModal(fechar.dataset.v253Fechar); return; }
      if(e.target.id==='modalScannerV253'){ pararScanner(); fecharModal('modalScannerV253'); return; }
      if(e.target.id==='modalIngressoV253') fecharModal('modalIngressoV253');
      if(e.target.id==='modalPainelV253') fecharModal('modalPainelV253');
    },true);

    document.addEventListener('click',e=>{
      if(e.target.id==='btnIniciarScannerV253') iniciarScanner();
      if(e.target.id==='btnPararScannerV253') pararScanner();
      if(e.target.id==='btnValidarManualV253') validarCodigo(document.getElementById('codigoManualV253')?.value);
    });
    document.addEventListener('keydown',e=>{
      if(e.key==='Enter'&&e.target.id==='codigoManualV253') validarCodigo(e.target.value);
      if(e.key==='Escape'&&document.getElementById('modalScannerV253')?.classList.contains('aberta')) pararScanner();
    });
    window.addEventListener('pagehide',pararScanner);
  }

  function iniciar(){
    criarModais(); observarDetalhe(); ligarEventos(); enriquecerPerfil();
    setTimeout(()=>{ observarDetalhe(); sincronizarDetalhe(); enriquecerPerfil(); },900);
    console.info(PREFIXO,'módulo de ingresso e check-in carregado');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true}); else iniciar();
})();
