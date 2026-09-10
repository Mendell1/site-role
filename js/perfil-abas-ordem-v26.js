/* ============================================================
   ROLÊ V26 — ordem visual + aba padrão do perfil
   - Conta e segurança fica no início da barra
   - Meus eventos fica no fim
   - Ao entrar no perfil, Conta e segurança abre por padrão
   - Depois que a pessoa escolhe outra aba, não forçamos mais nada
   ============================================================ */
(() => {
  'use strict';
  if (window.__rolePerfilAbasOrdemV26) return;
  window.__rolePerfilAbasOrdemV26 = true;

  const ORDEM = [
    'conta',
    'painel-v25-7',
    'favoritos',
    'inscricoes',
    'dados',
    'organizador-v25-9',
    'eventos'
  ];

  let usuarioEscolheuAba = false;

  function haRotaExplicita(){
    const params = new URLSearchParams(location.search);
    return params.has('organizador') || params.has('tab') || params.has('aba');
  }

  function aplicarOrdem(){
    const abas = document.querySelector('.perfil-abas');
    if (!abas) return false;

    const botoes = Array.from(abas.querySelectorAll('.perfil-aba'));
    if (!botoes.length) return false;

    const mapa = new Map(botoes.map(btn => [btn.dataset.tab, btn]));
    const desejados = ORDEM.map(tab => mapa.get(tab)).filter(Boolean);
    const conhecidos = new Set(desejados);
    const extras = botoes.filter(btn => !conhecidos.has(btn));
    const final = [...desejados.slice(0, -1), ...extras, ...desejados.slice(-1)];

    const atual = Array.from(abas.children).filter(el => el.classList?.contains('perfil-aba'));
    const igual = atual.length === final.length && atual.every((el, i) => el === final[i]);
    if (igual) return true;

    final.forEach(btn => abas.appendChild(btn));
    return true;
  }

  function abrirContaComoPadrao(){
    if (usuarioEscolheuAba || haRotaExplicita()) return false;

    const abas = document.querySelector('.perfil-abas');
    const main = document.getElementById('perfilMain');
    if (!abas || !main) return false;

    const botaoConta = abas.querySelector('.perfil-aba[data-tab="conta"]');
    const painelConta = main.querySelector('.perfil-painel[data-pane="conta"]');
    if (!botaoConta || !painelConta) return false;

    abas.querySelectorAll('.perfil-aba').forEach(btn => {
      const ativo = btn === botaoConta;
      btn.classList.toggle('ativa', ativo);
      btn.setAttribute('aria-selected', String(ativo));
    });

    main.querySelectorAll('.perfil-painel[data-pane]').forEach(painel => {
      painel.hidden = painel !== painelConta;
    });

    return true;
  }

  function iniciar(){
    document.addEventListener('click', e => {
      const aba = e.target.closest && e.target.closest('.perfil-aba');
      if (aba) usuarioEscolheuAba = true;
    }, true);

    aplicarOrdem();
    abrirContaComoPadrao();

    // Alguns módulos criam abas logo depois do carregamento.
    // Reaplica só no começo para garantir ordem e aba inicial sem
    // atrapalhar a navegação escolhida pela pessoa.
    let tentativas = 0;
    const timer = setInterval(() => {
      tentativas++;
      aplicarOrdem();
      abrirContaComoPadrao();
      if (tentativas >= 12 || usuarioEscolheuAba) clearInterval(timer);
    }, 180);

    const abas = document.querySelector('.perfil-abas');
    if (abas) {
      const obs = new MutationObserver(() => {
        aplicarOrdem();
        abrirContaComoPadrao();
      });
      obs.observe(abas, { childList: true });
      setTimeout(() => obs.disconnect(), 3000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once:true });
  } else {
    iniciar();
  }
})();
