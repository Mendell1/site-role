(() => {
  const topo = document.querySelector('.topo');
  const botao = document.getElementById('btnMenuMobile');
  const menu = document.getElementById('menuTopo');
  if (!topo || !botao || !menu) return;

  const fechar = () => {
    topo.classList.remove('menu-aberto');
    botao.setAttribute('aria-expanded', 'false');
  };

  const alternar = () => {
    const aberto = topo.classList.toggle('menu-aberto');
    botao.setAttribute('aria-expanded', String(aberto));
  };

  botao.addEventListener('click', (event) => {
    event.stopPropagation();
    alternar();
  });

  menu.addEventListener('click', (event) => {
    if (event.target.closest('button, a')) fechar();
  });

  document.addEventListener('click', (event) => {
    if (!topo.contains(event.target)) fechar();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') fechar();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 760) fechar();
  });
})();
