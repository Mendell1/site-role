/* ============================================================
   ROLÊ V26.1 — composição visual da home
   Não altera regras de negócio; acrescenta estrutura visual e
   navegação funcional entre Explorar, Sobre e Como funciona.
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

  function garantirCssComoFunciona(){
    if(document.querySelector('link[data-v26-como-funciona]')) return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='css/como-funciona-v26.css?v=20260907-0315';
    link.dataset.v26ComoFunciona='1';
    document.head.appendChild(link);
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
      '<article id="sobreRole">'+
        '<small>Sobre o Rolê</small>'+
        '<h3>Eventos locais em um só lugar.</h3>'+
        '<p>O Rolê aproxima moradores, organizadores e iniciativas da cidade para que feiras, oficinas, encontros, campeonatos e cultura de bairro sejam mais fáceis de descobrir.</p>'+
      '</article>'
    );

    const como=criar('section','v26-como-section',
      '<div class="v26-como-cabecalho">'+
        '<small>Como funciona</small>'+
        '<h2>Do evento ao seu próximo rolê em poucos passos.</h2>'+
        '<p>Você encontra o que está acontecendo perto de você, organiza o que quer acompanhar e participa sem precisar procurar informações espalhadas em vários lugares.</p>'+
      '</div>'+
      '<div class="v26-como-passos">'+
        '<article><span>01</span><strong>Descubra</strong><p>Use a busca, categorias, data, distância e filtros para encontrar eventos que combinam com você.</p></article>'+
        '<article><span>02</span><strong>Salve e acompanhe</strong><p>Favorite eventos e marque interesse para não perder novidades, mudanças de horário ou atualizações.</p></article>'+
        '<article><span>03</span><strong>Participe</strong><p>Abra o evento para ver local, data, horário, valor, organizador e outras informações importantes.</p></article>'+
        '<article><span>04</span><strong>Publique também</strong><p>Quem tem uma conta pode divulgar eventos locais e ajudar mais pessoas a descobrir o que acontece na região.</p></article>'+
      '</div>'+
      '<div class="v26-como-acoes"><a href="#explorar">Explorar eventos</a><a href="#sobreRole" class="secundario">Conhecer o Rolê</a></div>'
    );
    como.id='comoFunciona';

    footer.parentNode.insertBefore(info,footer);
    footer.parentNode.insertBefore(como,footer);
  }

  function marcarLinkAtivo(hash){
    const alvo=hash || '#explorar';
    document.querySelectorAll('.v26-nav a').forEach(link=>{
      if(link.getAttribute('href')===alvo) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
  }

  function irPara(hash,{suave=true,atualizarUrl=true}={}){
    const alvo=document.querySelector(hash);
    if(!alvo) return false;

    marcarLinkAtivo(hash);
    if(atualizarUrl && location.hash!==hash) history.pushState(null,'',hash);

    alvo.scrollIntoView({behavior:suave?'smooth':'auto',block:'start'});
    alvo.classList.remove('v26-destino-ativo');
    requestAnimationFrame(()=>alvo.classList.add('v26-destino-ativo'));
    window.setTimeout(()=>alvo.classList.remove('v26-destino-ativo'),900);
    return true;
  }

  function garantirNavegacaoFuncional(){
    const nav=document.querySelector('.v26-nav');
    if(!nav || nav.dataset.funcional==='1') return;
    nav.dataset.funcional='1';

    nav.addEventListener('click',event=>{
      const link=event.target.closest('a[href^="#"]');
      if(!link) return;
      const hash=link.getAttribute('href');
      if(!document.querySelector(hash)) return;
      event.preventDefault();
      irPara(hash,{suave:true,atualizarUrl:true});
    });

    document.addEventListener('click',event=>{
      const link=event.target.closest('.v26-como-acoes a[href^="#"]');
      if(!link) return;
      const hash=link.getAttribute('href');
      if(!document.querySelector(hash)) return;
      event.preventDefault();
      irPara(hash,{suave:true,atualizarUrl:true});
    });

    window.addEventListener('popstate',()=>{
      const hash=['#explorar','#sobreRole','#comoFunciona'].includes(location.hash)?location.hash:'#explorar';
      irPara(hash,{suave:false,atualizarUrl:false});
    });

    const inicial=['#explorar','#sobreRole','#comoFunciona'].includes(location.hash)?location.hash:'#explorar';
    marcarLinkAtivo(inicial);
    if(location.hash && inicial!=='#explorar'){
      window.setTimeout(()=>irPara(inicial,{suave:false,atualizarUrl:false}),80);
    }
  }

  function marcarPagina(){
    document.body.classList.add('v26-home');
    const mural=document.querySelector('.mural'); if(mural) mural.id='muralPrincipal';
  }

  function iniciar(){
    garantirCssComoFunciona();
    marcarPagina();
    garantirNav();
    garantirHero();
    garantirCabecalhoLista();
    garantirInfo();
    garantirNavegacaoFuncional();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
