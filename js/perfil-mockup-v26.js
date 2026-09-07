/* ROLÊ V26 — estrutura visual complementar do perfil */
(() => {
  'use strict';
  if(window.__rolePerfilMockupV26) return;
  window.__rolePerfilMockupV26 = true;

  const qs = (sel,ctx=document)=>ctx.querySelector(sel);

  function criar(tag,classe,html){
    const el=document.createElement(tag);
    if(classe) el.className=classe;
    if(html!=null) el.innerHTML=html;
    return el;
  }

  function marcarPagina(){
    document.body.classList.add('v26-perfil-mockup');
  }

  function normalizarMarca(){
    const marca=qs('.marca');
    const legenda=marca?.querySelector('small');
    if(legenda) legenda.textContent='EVENTOS DO SEU BAIRRO';
  }

  function montarNav(){
    const topo=qs('.topo-inner');
    const marca=qs('.marca',topo || document);
    if(!topo || !marca) return;

    const antiga=qs('.perfil-nav-v26',topo);
    if(antiga) antiga.remove();

    const nav=criar('nav','perfil-nav-v26',
      '<a class="ativo" href="index.html#explorar">Explorar</a>'+
      '<a href="index.html#sobreRole">Sobre</a>'+
      '<a href="index.html#comoFunciona">Como funciona</a>'
    );
    nav.setAttribute('aria-label','Navegação do Rolê');
    marca.insertAdjacentElement('afterend',nav);
  }

  function moverVoltarParaHero(){
    const voltar=qs('.btn-voltar-mural');
    const acoes=qs('.perfil-hero-acoes');
    const publicar=qs('#btnCriarHero',acoes || document);
    if(!voltar || !acoes || voltar.parentElement===acoes) return;
    voltar.textContent='← Voltar ao mural';
    acoes.insertBefore(voltar,publicar || acoes.firstChild);
  }

  function decorarHero(){
    const hero=qs('.perfil-hero');
    if(!hero || qs('.perfil-decor-v26',hero)) return;

    const esquerda=criar('span','perfil-decor-v26 esquerda','BOAS\nPESSOAS\nBONS ROLÊS');
    const direita=criar('span','perfil-decor-v26 direita','MAIS ENCONTROS\nMENOS ROTINA');
    esquerda.setAttribute('aria-hidden','true');
    direita.setAttribute('aria-hidden','true');
    hero.append(esquerda,direita);
  }

  function moverAbas(){
    const hero=qs('.perfil-hero');
    const main=qs('.perfil-main');
    const abas=qs('.perfil-abas');
    if(!hero || !main || !abas || qs('.perfil-abas-faixa-v26')) return;

    const faixa=criar('div','perfil-abas-faixa-v26');
    faixa.appendChild(abas);
    main.parentNode.insertBefore(faixa,main);
  }

  function cabecalhoEventos(){
    const painel=qs('.perfil-painel[data-pane="eventos"]');
    const grade=qs('#gradeMeusEventos',painel || document);
    if(!painel || !grade || qs('.perfil-eventos-cabecalho-v26',painel)) return;

    const cab=criar('div','perfil-eventos-cabecalho-v26',
      '<div>'+
        '<small>Meus eventos</small>'+
        '<h2>Eventos que <span>eu organizo</span></h2>'+
        '<p>Crie, gerencie e acompanhe seus eventos. É aqui que a cidade se encontra.</p>'+
      '</div>'+
      '<span class="perfil-eventos-resumo-v26">SEUS EVENTOS PUBLICADOS</span>'
    );
    painel.insertBefore(cab,grade);
  }

  function ajustarTextoPerfil(){
    const kicker=qs('#perfilKicker');
    if(kicker && /organizador/i.test(kicker.textContent||'')) kicker.textContent='ADMINISTRADOR DO ROLÊ';
  }

  function iniciar(){
    marcarPagina();
    normalizarMarca();
    montarNav();
    moverVoltarParaHero();
    decorarHero();
    moverAbas();
    cabecalhoEventos();
    ajustarTextoPerfil();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
