/* ============================================================
   ROLÊ V26.1 — composição visual da home
   Não altera regras de negócio; só acrescenta estrutura visual.
   ============================================================ */
(() => {
  'use strict';

  if(window.__roleV261HomeAtiva) return;
  window.__roleV261HomeAtiva=true;

  function criar(tag,classe,html){
    const el=document.createElement(tag);
    if(classe) el.className=classe;
    if(html!=null) el.innerHTML=html;
    return el;
  }

  function garantirNav(){
    const topo=document.querySelector('.topo-inner');
    if(!topo || topo.querySelector('.v26-nav')) return;
    const nav=criar('nav','v26-nav','<a href="#explorar" aria-current="page">Explorar</a><a href="#sobreRole">Sobre</a><a href="#comoFunciona">Como funciona</a>');
    nav.setAttribute('aria-label','Navegação principal');
    const antes=topo.querySelector('.topo-mobile-acoes');
    topo.insertBefore(nav,antes || topo.querySelector('.direita'));
  }

  function garantirHero(){
    const hero=document.querySelector('.hero');
    const conteudo=hero?.querySelector('.hero-conteudo');
    if(!hero || !conteudo || hero.querySelector('.v26-hero-grid')) return;
    hero.id='explorar';

    const grid=criar('div','v26-hero-grid');
    conteudo.parentNode.insertBefore(grid,conteudo);
    grid.appendChild(conteudo);

    const arte=criar('aside','v26-hero-arte',
      '<span class="v26-wordmark">ROLÊ</span>'+
      '<div class="v26-slogan">Mais Eventos<br>Mais Pessoas<br>Mais Cidade</div>'+
      '<div class="v26-palavras"><span>Cultura</span><span>Encontros</span><span>Ideias</span><span>Pessoas</span><span>Bairros</span><span>Movimento</span></div>'+
      '<div class="v26-cityline"><span></span><span></span><span></span><span></span><span></span><span></span></div>'
    );
    arte.setAttribute('aria-hidden','true');
    grid.appendChild(arte);

    const busca=document.getElementById('busca');
    if(busca) busca.placeholder='Ex: grátis sábado à noite perto de Itaquera';
  }

  function garantirCabecalhoLista(){
    const linha=document.querySelector('.linha-topo');
    if(!linha || linha.querySelector('.v26-secao-cabecalho')) return;
    const grupo=linha.querySelector(':scope > div');
    if(!grupo) return;

    const tituloAntigo=document.getElementById('tituloLista');
    if(tituloAntigo) tituloAntigo.classList.add('sr-only');

    const cab=criar('div','v26-secao-cabecalho','<h2>Eventos perto de você</h2><p>Descubra o que vai rolar na sua região</p>');
    grupo.insertBefore(cab,grupo.firstChild);

    const link=criar('a','v26-ver-todos','Ver todos os eventos&nbsp; →');
    link.href='#grade';
    linha.appendChild(link);
  }

  function garantirInfo(){
    const footer=document.querySelector('.rodape-site');
    if(!footer || document.querySelector('.v26-info')) return;
    const info=criar('section','v26-info',
      '<article id="sobreRole"><small>Sobre o Rolê</small><h3>Eventos locais em um só lugar.</h3><p>O Rolê aproxima moradores, organizadores e iniciativas da cidade para que feiras, oficinas, encontros, campeonatos e cultura de bairro sejam mais fáceis de descobrir.</p></article>'+
      '<article id="comoFunciona"><small>Como funciona</small><h3>Descubra, participe e acompanhe.</h3><p>Use busca inteligente, filtros por data e distância, salve favoritos, confirme presença, receba seu ingresso e acompanhe organizadores que você curte.</p></article>'
    );
    footer.parentNode.insertBefore(info,footer);
  }

  function marcarPagina(){
    document.body.classList.add('v26-home');
    const mural=document.querySelector('.mural'); if(mural) mural.id='muralPrincipal';
  }

  function iniciar(){
    marcarPagina();
    garantirNav();
    garantirHero();
    garantirCabecalhoLista();
    garantirInfo();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
