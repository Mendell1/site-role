/* ============================================================
   ROLÊ V25.6 — Eventos recorrentes
   Criação de séries semanais/mensais + identificação e exclusão
   segura de ocorrências. Cada data continua sendo um evento real.
   ============================================================ */
(() => {
  'use strict';

  if(window.__roleV256RecorrenciaAtiva) return;
  window.__roleV256RecorrenciaAtiva = true;

  let metaEditando = null;
  let observerDetalhe = null;

  const $ = id => document.getElementById(id);
  const escapa = valor => String(valor == null ? '' : valor).replace(/[&<>\"]/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'
  }[c]));

  function avisar(texto){
    if(typeof window.avisar === 'function') window.avisar(texto);
    else console.info('[V25.6]', texto);
  }

  function usuarioId(){
    return typeof Sessao !== 'undefined' && Sessao.usuario ? Sessao.usuario.id : null;
  }

  function instalarFormulario(){
    if($('recorrenciaV256')) return;
    const data = $('f_data');
    const blocoData = data && data.closest('.duas');
    if(!blocoData) return;

    const box = document.createElement('section');
    box.id = 'recorrenciaV256';
    box.className = 'v256-recorrencia';
    box.innerHTML =
      '<div class="v256-recorrencia-topo">'+
        '<div><span class="v256-kicker">V25.6 · RECORRÊNCIA</span><strong>Repetir este evento</strong></div>'+
        '<label class="v256-switch"><input id="f_recorrente" type="checkbox"><span></span></label>'+
      '</div>'+
      '<p class="dica">Crie várias datas de uma vez. Vagas, inscrições, ingresso e check-in ficam separados em cada encontro.</p>'+
      '<div id="recorrenciaOpcoesV256" class="v256-recorrencia-opcoes" hidden>'+
        '<div class="duas">'+
          '<div class="campo"><label for="f_rec_tipo">Repetição</label><select id="f_rec_tipo"><option value="semanal">Semanal</option><option value="mensal">Mensal</option></select></div>'+
          '<div class="campo"><label for="f_rec_intervalo">A cada</label><div class="v256-intervalo"><input id="f_rec_intervalo" type="number" min="1" max="12" value="1"><span id="recorrenciaUnidadeV256">semana(s)</span></div></div>'+
        '</div>'+
        '<div class="campo"><label for="f_rec_quantidade">Quantidade de encontros</label><input id="f_rec_quantidade" type="number" min="2" max="52" value="4"></div>'+
        '<div id="recorrenciaResumoV256" class="v256-recorrencia-resumo"></div>'+
      '</div>'+
      '<div id="recorrenciaEdicaoV256" class="v256-recorrencia-edicao" hidden></div>';

    blocoData.insertAdjacentElement('afterend', box);

    $('f_recorrente').addEventListener('change', atualizarFormulario);
    $('f_rec_tipo').addEventListener('change', atualizarFormulario);
    $('f_rec_intervalo').addEventListener('input', atualizarFormulario);
    $('f_rec_quantidade').addEventListener('input', atualizarFormulario);
    $('f_data').addEventListener('change', atualizarFormulario);
    atualizarFormulario();
  }

  function atualizarFormulario(){
    const check = $('f_recorrente');
    if(!check) return;
    const opcoes = $('recorrenciaOpcoesV256');
    const edicao = $('recorrenciaEdicaoV256');

    if(metaEditando){
      check.disabled = true;
      opcoes.hidden = true;
      edicao.hidden = false;
      if(metaEditando.serie_id){
        const ritmo = metaEditando.recorrencia_tipo === 'mensal' ? 'mensal' : 'semanal';
        edicao.innerHTML = '<strong>Esta data faz parte de uma série '+ritmo+'.</strong><span>Ocorrência '+escapa(metaEditando.recorrencia_ordem)+' de '+escapa(metaEditando.recorrencia_total)+'. Salvar alterações afeta somente esta data.</span>';
      }else{
        edicao.innerHTML = '<strong>Evento individual.</strong><span>A recorrência pode ser definida ao criar um novo evento.</span>';
      }
      return;
    }

    check.disabled = false;
    edicao.hidden = true;
    opcoes.hidden = !check.checked;
    if(!check.checked) return;

    const tipo = $('f_rec_tipo').value;
    const intervalo = Math.max(1,Math.min(12,Number($('f_rec_intervalo').value)||1));
    const quantidade = Math.max(2,Math.min(52,Number($('f_rec_quantidade').value)||4));
    $('recorrenciaUnidadeV256').textContent = tipo === 'mensal' ? 'mês(es)' : 'semana(s)';
    $('recorrenciaResumoV256').innerHTML = '<strong>'+quantidade+' encontros</strong><span>'+ (tipo==='mensal' ? 'a cada '+intervalo+' mês(es)' : 'a cada '+intervalo+' semana(s)') +'. A primeira data é '+escapa(formatarData($('f_data').value))+'.</span>';
  }

  function formatarData(iso){
    if(!iso) return 'a data escolhida acima';
    const [a,m,d] = iso.split('-');
    return d+'/'+m+'/'+a;
  }

  function resetNovo(){
    metaEditando = null;
    if(!$('f_recorrente')) return;
    $('f_recorrente').checked = false;
    $('f_recorrente').disabled = false;
    $('f_rec_tipo').value = 'semanal';
    $('f_rec_intervalo').value = '1';
    $('f_rec_quantidade').value = '4';
    atualizarFormulario();
  }

  async function prepararEdicao(id){
    if(!id) return;
    const {data,error} = await db.from('eventos_lista')
      .select('id,serie_id,recorrencia_tipo,recorrencia_intervalo,recorrencia_ordem,recorrencia_total')
      .eq('id',id).single();
    if(error || !data) return;
    metaEditando = data;
    atualizarFormulario();
  }

  function valorOuNull(id){
    const el=$(id); if(!el) return null;
    const texto=String(el.value||'').trim();
    if(!texto) return null;
    const n=Number(texto);
    return Number.isFinite(n) ? n : null;
  }

  function soDigitos(valor){ return String(valor||'').replace(/\D/g,''); }

  function dadosFormulario(imagemUrl){
    const valor = Number($('f_preco').value)||0;
    return {
      nome:$('f_nome').value.trim(),
      descricao:$('f_desc').value.trim()||null,
      categoria_id:$('f_cat').value,
      data_evento:$('f_data').value,
      hora_evento:$('f_hora').value||'19:00',
      endereco:$('f_end').value.trim()||null,
      numero:$('f_numero').value.trim()||null,
      complemento:$('f_complemento').value.trim()||null,
      cep:soDigitos($('f_cep').value)||null,
      bairro:$('f_bairro').value.trim()||null,
      cidade:$('f_cidade').value.trim(),
      gratuito:valor===0,
      valor,
      max_participantes:valorOuNull('f_vagas'),
      contato:$('f_contato').value.trim()||null,
      situacao:$('f_situacao').value||'agendado',
      latitude:valorOuNull('f_lat'),
      longitude:valorOuNull('f_lng'),
      imagem_url:imagemUrl||null
    };
  }

  async function subirImagem(arquivo){
    if(!arquivo) return null;
    if(arquivo.size > 5*1024*1024) throw new Error('Imagem muito grande (máximo 5 MB)');
    if(!['image/jpeg','image/png','image/webp'].includes(arquivo.type)) throw new Error('Use uma imagem JPG, PNG ou WebP');
    const uid=usuarioId();
    if(!uid) throw new Error('Entre na conta para publicar');
    const ext=(arquivo.name.split('.').pop()||'jpg').toLowerCase();
    const caminho=uid+'/'+Date.now()+'-serie.'+ext;
    const {error}=await db.storage.from('eventos').upload(caminho,arquivo,{upsert:false});
    if(error) throw error;
    return {caminho,url:db.storage.from('eventos').getPublicUrl(caminho).data.publicUrl};
  }

  function validarCriacao(){
    if(!usuarioId()) return 'Entre na sua conta para publicar';
    if($('f_nome').value.trim().length < 3) return 'O nome precisa ter pelo menos 3 letras';
    if(!$('f_data').value) return 'Escolha a primeira data do evento';
    if(!$('f_cidade').value.trim()) return 'Informe a cidade';
    const qtd=Number($('f_rec_quantidade').value);
    const intervalo=Number($('f_rec_intervalo').value);
    if(!Number.isInteger(qtd) || qtd<2 || qtd>52) return 'Use entre 2 e 52 encontros';
    if(!Number.isInteger(intervalo) || intervalo<1 || intervalo>12) return 'O intervalo deve ficar entre 1 e 12';
    return null;
  }

  async function criarSerie(botao){
    const erro=validarCriacao();
    if(erro){ avisar(erro); return; }

    const rotulo=botao.textContent;
    botao.disabled=true;
    botao.textContent='Criando série...';
    let imagem=null;

    try{
      imagem=await subirImagem($('f_img').files[0]);
      const evento=dadosFormulario(imagem && imagem.url);
      const tipo=$('f_rec_tipo').value;
      const intervalo=Number($('f_rec_intervalo').value)||1;
      const quantidade=Number($('f_rec_quantidade').value)||4;

      const {data,error}=await db.rpc('criar_eventos_recorrentes_v25_6',{
        p_evento:evento,
        p_tipo:tipo,
        p_intervalo:intervalo,
        p_quantidade:quantidade
      });
      if(error) throw error;

      document.querySelectorAll('.cortina.aberta').forEach(m=>m.classList.remove('aberta'));
      avisar((data||[]).length+' datas criadas para o evento.');
      setTimeout(()=>location.reload(),850);
    }catch(err){
      if(imagem){
        try{ await db.storage.from('eventos').remove([imagem.caminho]); }catch(_){}
      }
      console.error('[V25.6 recorrência]',err);
      avisar(err && err.message ? err.message : 'Não foi possível criar a série');
    }finally{
      botao.disabled=false;
      botao.textContent=rotulo;
    }
  }

  async function limparImagensOrfas(urls){
    for(const url of [...new Set((urls||[]).filter(Boolean))]){
      const {count,error}=await db.from('eventos').select('id',{count:'exact',head:true}).eq('imagem_url',url);
      if(error || Number(count||0)>0) continue;
      const marca='/storage/v1/object/public/eventos/';
      const i=String(url).indexOf(marca);
      if(i<0) continue;
      const caminho=decodeURIComponent(String(url).slice(i+marca.length).split('?')[0]);
      try{ await db.storage.from('eventos').remove([caminho]); }catch(_){}
    }
  }

  async function excluirSimples(id){
    if(!confirm('Excluir este evento? Não dá para desfazer.')) return;
    const {data:ev}=await db.from('eventos').select('id,imagem_url').eq('id',id).single();
    const {error}=await db.from('eventos').delete().eq('id',id);
    if(error){ avisar(error.message || 'Não foi possível excluir'); return; }
    await limparImagensOrfas([ev && ev.imagem_url]);
    avisar('Evento excluído');
    setTimeout(()=>location.reload(),550);
  }

  function modalExcluirSerie(ev){
    document.getElementById('modalExcluirSerieV256')?.remove();
    const modal=document.createElement('div');
    modal.id='modalExcluirSerieV256';
    modal.className='cortina aberta v256-modal-serie';
    modal.innerHTML='<div class="folha" role="dialog" aria-modal="true">'+
      '<button class="fechar" data-v256-cancelar-exclusao aria-label="Fechar">×</button>'+
      '<span class="v256-kicker">EVENTO RECORRENTE</span><h3>Qual parte da série excluir?</h3>'+
      '<p class="dica">Esta é a ocorrência '+escapa(ev.recorrencia_ordem)+' de '+escapa(ev.recorrencia_total)+'. Inscrições e check-ins das datas apagadas também serão removidos.</p>'+
      '<div class="v256-modal-acoes">'+
        '<button class="btn-linha" data-v256-excluir-modo="esta">Só esta data</button>'+
        '<button class="btn-escuro" data-v256-excluir-modo="futuras">Esta e as próximas</button>'+
        '<button class="btn-linha" data-v256-cancelar-exclusao>Cancelar</button>'+
      '</div></div>';
    document.body.appendChild(modal);

    modal.addEventListener('click',async e=>{
      if(e.target===modal || e.target.closest('[data-v256-cancelar-exclusao]')){ modal.remove(); return; }
      const acao=e.target.closest('[data-v256-excluir-modo]');
      if(!acao) return;
      acao.disabled=true;
      const modo=acao.dataset.v256ExcluirModo;
      let query=db.from('eventos').select('id,imagem_url').eq('criador_id',usuarioId());
      query = modo==='futuras'
        ? query.eq('serie_id',ev.serie_id).gte('data_evento',ev.data_evento)
        : query.eq('id',ev.id);
      const {data:alvos,error:erroLista}=await query;
      if(erroLista){ avisar(erroLista.message); acao.disabled=false; return; }
      if(!alvos || !alvos.length){ avisar('Nenhuma data encontrada para excluir'); modal.remove(); return; }
      const ids=alvos.map(x=>x.id);
      const {error}=await db.from('eventos').delete().in('id',ids).eq('criador_id',usuarioId());
      if(error){ avisar(error.message); acao.disabled=false; return; }
      await limparImagensOrfas(alvos.map(x=>x.imagem_url));
      modal.remove();
      avisar(ids.length===1 ? 'Data excluída da série' : ids.length+' datas futuras excluídas');
      setTimeout(()=>location.reload(),650);
    });
  }

  async function tratarExcluir(id){
    const {data,error}=await db.from('eventos').select('id,criador_id,imagem_url,data_evento,serie_id,recorrencia_ordem,recorrencia_total').eq('id',id).single();
    if(error || !data){ avisar('Não foi possível carregar o evento'); return; }
    if(data.criador_id!==usuarioId()){ avisar('Somente o organizador pode excluir este evento'); return; }
    if(!data.serie_id){ await excluirSimples(id); return; }
    modalExcluirSerie(data);
  }

  async function enriquecerDetalhe(){
    const folha=$('folhaDetalhe');
    if(!folha) return;
    const alvo=folha.querySelector('[data-interesse],[data-editar],[data-denuncia-tipo="evento"]');
    const id=alvo && (alvo.dataset.interesse||alvo.dataset.editar||alvo.dataset.denunciaId);
    if(!id) return;
    if(folha.querySelector('.v256-serie-card[data-evento="'+id+'"]')) return;

    const {data:ev,error}=await db.from('eventos_lista')
      .select('id,serie_id,recorrencia_tipo,recorrencia_intervalo,recorrencia_ordem,recorrencia_total')
      .eq('id',id).single();
    if(error || !ev || !ev.serie_id) return;

    const {data:datas}=await db.from('eventos_lista')
      .select('id,data_evento,hora_evento,situacao')
      .eq('serie_id',ev.serie_id)
      .order('data_evento',{ascending:true})
      .limit(12);

    const card=document.createElement('section');
    card.className='v256-serie-card';
    card.dataset.evento=id;
    const ritmo=ev.recorrencia_tipo==='mensal' ? 'mês' : 'semana';
    const intervalo=Number(ev.recorrencia_intervalo||1);
    card.innerHTML='<div class="v256-serie-cabecalho"><span class="v256-kicker">↻ EVENTO RECORRENTE</span><strong>'+escapa(ev.recorrencia_ordem)+' / '+escapa(ev.recorrencia_total)+'</strong></div>'+
      '<p>Repete a cada '+intervalo+' '+ritmo+(intervalo===1?'':'s')+'. Cada data possui vagas, inscrições e check-in próprios.</p>'+
      '<div class="v256-datas-serie">'+(datas||[]).map(d=>
        '<button type="button" class="'+(d.id===id?'ativa':'')+'" data-v256-ocorrencia="'+escapa(d.id)+'">'+escapa(formatarData(d.data_evento))+'</button>'
      ).join('')+'</div>';

    const principal=folha.querySelector('.detalhe-coluna-principal');
    const comentarios=principal && principal.querySelector('#areaComentarios');
    if(principal){
      if(comentarios) principal.insertBefore(card,comentarios);
      else principal.appendChild(card);
    }
  }

  function observarDetalhe(){
    const folha=$('folhaDetalhe');
    if(!folha || observerDetalhe) return;
    let timer;
    observerDetalhe=new MutationObserver(()=>{
      clearTimeout(timer);
      timer=setTimeout(enriquecerDetalhe,90);
    });
    observerDetalhe.observe(folha,{childList:true,subtree:true});
  }

  document.addEventListener('click',e=>{
    const criar=e.target.closest('#btnCriar');
    if(criar) setTimeout(resetNovo,0);

    const editar=e.target.closest('[data-editar]');
    if(editar) setTimeout(()=>prepararEdicao(editar.dataset.editar),80);

    const ocorrencia=e.target.closest('[data-v256-ocorrencia]');
    if(ocorrencia){
      e.preventDefault();
      location.href='index.html?evento='+encodeURIComponent(ocorrencia.dataset.v256Ocorrencia);
    }
  },true);

  document.addEventListener('change',e=>{
    if(e.target && e.target.id==='f_img' && metaEditando && metaEditando.serie_id && e.target.files && e.target.files.length){
      e.target.value='';
      avisar('A imagem é compartilhada pela série. Nesta versão, edite texto/data desta ocorrência sem trocar a imagem.');
    }
  },true);

  // Intercepta publicação somente quando a opção de recorrência está ativa.
  document.addEventListener('click',e=>{
    const btn=e.target.closest('#btnPublicar');
    if(!btn || !$('f_recorrente') || !$('f_recorrente').checked || metaEditando) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    criarSerie(btn);
  },true);

  // Intercepta exclusão para proteger imagens compartilhadas e oferecer
  // exclusão de uma ocorrência ou das próximas datas da série.
  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-excluir]');
    if(!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    tratarExcluir(btn.dataset.excluir);
  },true);

  function iniciar(){
    instalarFormulario();
    observarDetalhe();
    setTimeout(()=>{ instalarFormulario(); enriquecerDetalhe(); },500);
    console.info('[V25.6] recorrência carregada');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
