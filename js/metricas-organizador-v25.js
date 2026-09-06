/* ============================================================
   ROLÊ V25.7 — Métricas, painel do organizador e reputação
   ============================================================ */
(() => {
  'use strict';

  if(window.__roleV257MetricasAtivas) return;
  window.__roleV257MetricasAtivas = true;

  const pagina=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const fmtN=new Intl.NumberFormat('pt-BR');
  const esc=v=>String(v==null?'':v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  let observerDetalhe=null;
  let painelCarregado=false;
  let painelCarregando=false;
  const compartilhamentoRecente=new Map();

  function avisar(texto){
    if(typeof window.avisar==='function') window.avisar(texto);
    else console.info('[V25.7]',texto);
  }

  function dataPt(iso){
    if(!iso) return '—';
    return new Date(iso+'T00:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
  }

  function idEventoAtual(){
    const folha=document.getElementById('folhaDetalhe');
    if(!folha) return null;
    const alvo=folha.querySelector('[data-interesse],[data-editar],[data-denuncia-tipo="evento"]');
    if(!alvo) return null;
    return alvo.dataset.interesse||alvo.dataset.editar||alvo.dataset.denunciaId||null;
  }

  function chaveVisualizacao(id){
    const hoje=new Date();
    const dia=[hoje.getFullYear(),String(hoje.getMonth()+1).padStart(2,'0'),String(hoje.getDate()).padStart(2,'0')].join('-');
    return 'role_v257_view_'+id+'_'+dia;
  }

  function jaVisualizado(id){
    try{return localStorage.getItem(chaveVisualizacao(id))==='1';}catch(_){return false;}
  }

  function marcarVisualizado(id){
    try{localStorage.setItem(chaveVisualizacao(id),'1');}catch(_){}
  }

  function desmarcarVisualizado(id){
    try{localStorage.removeItem(chaveVisualizacao(id));}catch(_){}
  }

  async function registrarVisualizacao(id){
    if(!id||jaVisualizado(id)) return;
    marcarVisualizado(id);
    const {error}=await db.rpc('registrar_visualizacao_evento_v25_7',{p_evento:id});
    if(error){
      desmarcarVisualizado(id);
      console.warn('[V25.7] visualização não registrada',error);
    }
  }

  async function registrarCompartilhamento(id){
    if(!id) return;
    const {error}=await db.rpc('registrar_compartilhamento_evento_v25_7',{p_evento:id});
    if(error) console.warn('[V25.7] compartilhamento não registrado',error);
  }

  function observarDetalhe(){
    const folha=document.getElementById('folhaDetalhe');
    if(!folha||observerDetalhe) return;
    let timer;
    const conferir=()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{
        const id=idEventoAtual();
        if(id) registrarVisualizacao(id);
      },120);
    };
    observerDetalhe=new MutationObserver(conferir);
    observerDetalhe.observe(folha,{childList:true,subtree:true});
    conferir();
  }

  function instalarRastreamentoCompartilhamento(){
    // Usa window/capture porque o QR moderno interrompe o listener legado no document.
    window.addEventListener('click',e=>{
      const acao=e.target&&e.target.closest&&e.target.closest('[data-v23-share],[data-v23-whatsapp],[data-v23-copy],[data-v23-qr]');
      if(!acao) return;
      const id=idEventoAtual();
      if(!id) return;
      const tipo=acao.hasAttribute('data-v23-whatsapp')?'whatsapp':acao.hasAttribute('data-v23-copy')?'copiar':acao.hasAttribute('data-v23-qr')?'qr':'compartilhar';
      const chave=id+':'+tipo;
      const agora=Date.now();
      if(agora-Number(compartilhamentoRecente.get(chave)||0)<1200) return;
      compartilhamentoRecente.set(chave,agora);
      registrarCompartilhamento(id);
    },true);
  }

  function ativarAbaPainel(botao,painel){
    if(typeof window.definirAba==='function'){
      window.definirAba('painel-v25-7');
    }else if(typeof definirAba==='function'){
      definirAba('painel-v25-7');
    }else{
      document.querySelectorAll('.perfil-aba').forEach(b=>{
        const ativo=b===botao;
        b.classList.toggle('ativa',ativo);
        b.setAttribute('aria-selected',String(ativo));
      });
      document.querySelectorAll('[data-pane]').forEach(p=>p.hidden=p!==painel);
    }
  }

  function instalarPainel(){
    const abas=document.querySelector('.perfil-abas');
    const main=document.getElementById('perfilMain');
    if(!abas||!main||abas.querySelector('[data-tab="painel-v25-7"]')) return;

    const btn=document.createElement('button');
    btn.className='perfil-aba';
    btn.dataset.tab='painel-v25-7';
    btn.setAttribute('role','tab');
    btn.setAttribute('aria-selected','false');
    btn.textContent='Painel do organizador';
    const eventos=abas.querySelector('[data-tab="eventos"]');
    if(eventos&&eventos.nextSibling) abas.insertBefore(btn,eventos.nextSibling);
    else abas.appendChild(btn);

    const painel=document.createElement('section');
    painel.className='perfil-painel';
    painel.dataset.pane='painel-v25-7';
    painel.hidden=true;
    painel.innerHTML='<div class="v257-dashboard"><div class="v257-dashboard-topo"><div><span class="v257-kicker">V25.7 · IMPACTO</span><h2>Painel do organizador</h2><p>Acompanhe descoberta, intenção e presença nos seus eventos.</p></div><button type="button" class="btn-linha" id="btnAtualizarPainelV257">Atualizar dados</button></div><div id="conteudoPainelV257"><p class="dica">Abra esta aba para carregar as métricas.</p></div></div>';
    const primeiro=main.querySelector('.perfil-painel');
    if(primeiro&&primeiro.nextSibling) main.insertBefore(painel,primeiro.nextSibling);
    else main.appendChild(painel);

    btn.addEventListener('click',async()=>{
      ativarAbaPainel(btn,painel);
      await carregarPainel();
    });
    painel.querySelector('#btnAtualizarPainelV257').addEventListener('click',()=>carregarPainel(true));
  }

  function kpi(rotulo,valor,sub=''){
    return '<article class="v257-kpi"><span>'+esc(rotulo)+'</span><strong>'+esc(valor)+'</strong>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</article>';
  }

  function pct(valor){
    return valor==null?'—':Number(valor).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
  }

  function renderPainel(dados){
    const alvo=document.getElementById('conteudoPainelV257');
    if(!alvo) return;
    const t=dados&&dados.totais?dados.totais:{};
    const rep=dados&&dados.reputacao?dados.reputacao:{};
    const eventos=Array.isArray(dados&&dados.eventos)?dados.eventos:[];

    const totalInteracao=Number(t.favoritos||0)+Number(t.interessados||0)+Number(t.inscritos||0);
    const maxVisual=Math.max(1,...eventos.map(e=>Number(e.visualizacoes||0)));

    alvo.innerHTML=
      '<section class="v257-kpis">'+
        kpi('Visualizações',fmtN.format(Number(t.visualizacoes||0)),'aberturas únicas por navegador/dia')+
        kpi('Favoritos',fmtN.format(Number(t.favoritos||0)))+
        kpi('Interessados',fmtN.format(Number(t.interessados||0)))+
        kpi('Inscritos',fmtN.format(Number(t.inscritos||0)),fmtN.format(Number(t.espera||0))+' na fila')+
        kpi('Check-ins',fmtN.format(Number(t.checkins||0)),pct(t.taxa_comparecimento)+' de comparecimento')+
        kpi('Compartilhamentos',fmtN.format(Number(t.compartilhamentos||0)),'share, WhatsApp, QR e copiar link')+
      '</section>'+
      '<section class="v257-reputacao-painel">'+
        '<div class="v257-reputacao-icone">🏅</div><div><span class="v257-kicker">HISTÓRICO DO ORGANIZADOR</span><h3>'+esc(rep.nivel||'Novo organizador')+'</h3><p>'+fmtN.format(Number(rep.eventos_realizados||0))+' evento(s) realizado(s) · '+fmtN.format(Number(rep.eventos_cancelados||0))+' cancelado(s)'+(rep.taxa_realizacao==null?'':' · '+pct(rep.taxa_realizacao)+' de realização')+'.</p></div>'+
      '</section>'+
      '<section class="v257-funil"><div><span class="v257-kicker">FUNIL</span><h3>Da descoberta à presença</h3></div><div class="v257-funil-linha">'+
        '<span><b>'+fmtN.format(Number(t.visualizacoes||0))+'</b> visualizações</span><i>→</i><span><b>'+fmtN.format(totalInteracao)+'</b> ações</span><i>→</i><span><b>'+fmtN.format(Number(t.inscritos||0))+'</b> inscritos</span><i>→</i><span><b>'+fmtN.format(Number(t.checkins||0))+'</b> presentes</span>'+
      '</div></section>'+
      '<section class="v257-eventos"><div class="v257-secao-titulo"><div><span class="v257-kicker">POR EVENTO</span><h3>Desempenho detalhado</h3></div><span class="contagem">'+eventos.length+' EVENTO(S)</span></div>'+
        (eventos.length?eventos.map(ev=>{
          const largura=Math.max(3,Math.round(Number(ev.visualizacoes||0)/maxVisual*100));
          const rec=ev.serie_id?' · série '+esc(ev.recorrencia_ordem||'')+'/'+esc(ev.recorrencia_total||''):'';
          return '<article class="v257-evento-linha"><div class="v257-evento-identidade"><a href="index.html?evento='+encodeURIComponent(ev.id)+'"><strong>'+esc(ev.nome)+'</strong></a><span>'+esc(dataPt(ev.data_evento))+rec+'</span><div class="v257-barra"><i style="width:'+largura+'%"></i></div></div><div class="v257-evento-metricas">'+
            '<span><b>'+fmtN.format(Number(ev.visualizacoes||0))+'</b> views</span><span><b>'+fmtN.format(Number(ev.favoritos||0))+'</b> fav.</span><span><b>'+fmtN.format(Number(ev.interessados||0))+'</b> interesse</span><span><b>'+fmtN.format(Number(ev.inscritos||0))+'</b> inscritos</span><span><b>'+fmtN.format(Number(ev.checkins||0))+'</b> presentes</span><span><b>'+fmtN.format(Number(ev.compartilhamentos||0))+'</b> shares</span><span><b>'+pct(ev.taxa_comparecimento)+'</b> presença</span></div></article>';
        }).join(''):'<div class="v257-vazio"><strong>Publique seu primeiro evento</strong><p>As métricas aparecem aqui conforme as pessoas descobrem e participam.</p></div>')+
      '</section>';
  }

  async function carregarPainel(forcar=false){
    if(painelCarregando||(!forcar&&painelCarregado)) return;
    const alvo=document.getElementById('conteudoPainelV257');
    if(!alvo) return;
    painelCarregando=true;
    alvo.innerHTML='<div class="v257-carregando"><span></span><p>Calculando impacto dos seus eventos...</p></div>';
    const {data,error}=await db.rpc('painel_organizador_v25_7');
    painelCarregando=false;
    if(error){
      alvo.innerHTML='<div class="v257-vazio"><strong>Não foi possível carregar o painel</strong><p>'+esc(error.message||'Tente novamente em instantes.')+'</p></div>';
      return;
    }
    painelCarregado=true;
    renderPainel(data||{});
  }

  function classeNivel(nivel){
    const n=String(nivel||'').toLowerCase();
    if(n.includes('consistente')) return 'consistente';
    if(n.includes('frequente')) return 'frequente';
    if(n.includes('crescimento')) return 'crescimento';
    return 'novo';
  }

  async function instalarReputacaoPublica(){
    const id=new URLSearchParams(location.search).get('id');
    if(!id) return;
    const {data,error}=await db.rpc('reputacao_organizador_v25_7',{p_usuario:id});
    const rep=Array.isArray(data)?data[0]:data;
    if(error||!rep) return;

    let tentativas=0;
    const colocar=()=>{
      const hero=document.querySelector('.organizador-publico-hero');
      if(!hero){ if(tentativas++<40) setTimeout(colocar,120); return; }
      if(document.querySelector('.v257-reputacao-publica')) return;
      const card=document.createElement('section');
      card.className='v257-reputacao-publica '+classeNivel(rep.nivel);
      card.innerHTML='<div class="v257-reputacao-selo">🏅</div><div><span class="v257-kicker">REPUTAÇÃO POR HISTÓRICO</span><strong>'+esc(rep.nivel||'Novo organizador')+'</strong><p>'+fmtN.format(Number(rep.eventos_realizados||0))+' evento(s) realizado(s) · '+fmtN.format(Number(rep.eventos_cancelados||0))+' cancelado(s)'+(rep.taxa_realizacao==null?'':' · '+pct(rep.taxa_realizacao)+' de realização')+'.</p></div><div class="v257-reputacao-ajuda" title="Baseado no histórico público de eventos, não em avaliações por estrelas.">i</div>';
      hero.insertAdjacentElement('afterend',card);
    };
    colocar();
  }

  function iniciar(){
    if(pagina==='index.html'){
      observarDetalhe();
      instalarRastreamentoCompartilhamento();
    }
    if(pagina==='perfil.html') instalarPainel();
    if(pagina==='organizador.html') instalarReputacaoPublica();
    console.info('[V25.7] métricas e reputação carregadas');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
