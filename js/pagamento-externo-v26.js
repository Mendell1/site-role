/* ============================================================
   ROLÊ V26 — pagamento externo / ingresso
   Usa o campo contato existente como link de compra quando o
   evento é pago. Não processa pagamentos dentro do Rolê.
   ============================================================ */
(() => {
  'use strict';
  if (window.__rolePagamentoExternoV26) return;
  window.__rolePagamentoExternoV26 = true;

  const PAGINA = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (PAGINA !== 'index.html') return;

  function urlHttpValida(valor){
    if(!valor) return null;
    try{
      const u = new URL(String(valor).trim());
      return ['http:','https:'].includes(u.protocol) ? u.href : null;
    }catch(_){
      return null;
    }
  }

  function fmtPreco(valor){
    return Number(valor || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  }

  function avisarLocal(msg){
    if(typeof window.avisar === 'function') return window.avisar(msg);
    console.info('[Pagamento externo]', msg);
  }

  function configurarFormulario(){
    const preco = document.getElementById('f_preco');
    const contato = document.getElementById('f_contato');
    const publicar = document.getElementById('btnPublicar');
    if(!preco || !contato || !publicar || contato.dataset.pagamentoV26 === '1') return false;

    contato.dataset.pagamentoV26 = '1';
    preco.setAttribute('inputmode','decimal');
    preco.setAttribute('autocomplete','off');

    const campoContato = contato.closest('.campo');
    const labelContato = campoContato?.querySelector('label[for="f_contato"]');
    const labelPreco = document.querySelector('label[for="f_preco"]');
    if(labelPreco) labelPreco.textContent = 'Valor do ingresso (0 = grátis)';

    let secao = preco.closest('.duas')?.previousElementSibling;
    if(secao?.classList?.contains('publicar-secao') && secao.textContent.trim()==='Participação'){
      secao.textContent = 'Participação e ingresso';
    }

    const ajuda = document.createElement('div');
    ajuda.className = 'pagamento-externo-ajuda';
    ajuda.id = 'pagamentoExternoAjudaV26';
    ajuda.innerHTML = '<strong>Pagamento externo.</strong> O Rolê não recebe o dinheiro. Ao comprar, a pessoa será direcionada para o site informado pelo organizador.';
    campoContato?.appendChild(ajuda);

    function atualizar(){
      const pago = (Number(preco.value) || 0) > 0;
      ajuda.dataset.pago = String(pago);
      if(pago){
        if(labelContato) labelContato.textContent = 'Link para comprar ingresso (opcional)';
        contato.placeholder = 'https://seu-checkout-ou-pagina-de-ingressos.com';
        contato.setAttribute('inputmode','url');
        contato.setAttribute('autocomplete','url');
      }else{
        if(labelContato) labelContato.textContent = 'Contato ou link (opcional)';
        contato.placeholder = 'WhatsApp, Instagram ou site';
        contato.removeAttribute('inputmode');
        contato.removeAttribute('autocomplete');
      }
    }

    preco.addEventListener('input', atualizar);
    preco.addEventListener('change', atualizar);

    // Valida antes do listener principal de publicação.
    publicar.addEventListener('click', e => {
      const valor = Number(preco.value) || 0;
      const contatoValor = contato.value.trim();
      if(valor > 0 && contatoValor && !urlHttpValida(contatoValor)){
        e.preventDefault();
        e.stopImmediatePropagation();
        avisarLocal('Para evento pago, informe um link completo começando com http:// ou https://.');
        contato.focus();
      }
    }, true);

    const modalCriar = document.getElementById('modalCriar');
    if(modalCriar){
      const obs = new MutationObserver(()=>{
        if(modalCriar.classList.contains('aberta')) setTimeout(atualizar, 0);
      });
      obs.observe(modalCriar,{attributes:true,attributeFilter:['class']});
    }

    atualizar();
    return true;
  }

  function montarCompraDetalhe(){
    const folha = document.getElementById('folhaDetalhe');
    if(!folha) return;

    const antigo = folha.querySelector('.detalhe-compra-externa');
    if(antigo) antigo.remove();

    let ev = null;
    try{
      if(typeof detalheAtual !== 'undefined') ev = detalheAtual;
    }catch(_){ ev = null; }

    if(!ev || ev.gratuito || Number(ev.valor || 0) <= 0) return;
    const href = urlHttpValida(ev.contato);
    if(!href) return;

    const lateral = folha.querySelector('.detalhe-coluna-lateral');
    if(!lateral) return;

    const box = document.createElement('section');
    box.className = 'detalhe-compra-externa';

    const topo = document.createElement('div');
    topo.className = 'detalhe-compra-externa-topo';

    const rotulo = document.createElement('p');
    rotulo.className = 'detalhe-compra-externa-label';
    rotulo.textContent = 'INGRESSO · COMPRA EXTERNA';

    const preco = document.createElement('strong');
    preco.className = 'detalhe-compra-externa-preco';
    preco.textContent = fmtPreco(ev.valor);

    topo.append(rotulo, preco);

    const desc = document.createElement('p');
    desc.textContent = 'A compra é feita fora do Rolê, diretamente na página indicada pelo organizador.';

    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer nofollow';
    link.textContent = 'Comprar ingresso';
    link.setAttribute('aria-label','Comprar ingresso em site externo');

    const aviso = document.createElement('p');
    aviso.className = 'detalhe-compra-externa-aviso';
    aviso.textContent = 'O Rolê não processa nem confirma este pagamento.';

    box.append(topo, desc, link, aviso);

    const organizador = lateral.querySelector('.detalhe-organizador-card');
    if(organizador) lateral.insertBefore(box, organizador);
    else lateral.appendChild(box);
  }

  function configurarDetalhe(){
    const folha = document.getElementById('folhaDetalhe');
    if(!folha || folha.dataset.pagamentoV26 === '1') return false;
    folha.dataset.pagamentoV26 = '1';

    let timer;
    const agenda = () => {
      clearTimeout(timer);
      timer = setTimeout(montarCompraDetalhe, 20);
    };

    const obs = new MutationObserver(agenda);
    obs.observe(folha,{childList:true,subtree:true});

    const modal = document.getElementById('modalDetalhe');
    if(modal){
      const obsModal = new MutationObserver(()=>{
        if(modal.classList.contains('aberta')) agenda();
      });
      obsModal.observe(modal,{attributes:true,attributeFilter:['class']});
    }
    return true;
  }

  function iniciar(tentativa=0){
    const formOk = configurarFormulario();
    const detalheOk = configurarDetalhe();
    if((!formOk || !detalheOk) && tentativa < 80){
      setTimeout(()=>iniciar(tentativa+1), 100);
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',()=>iniciar());
  else iniciar();
})();
