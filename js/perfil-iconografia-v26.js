/* ============================================================
   ROLÊ V26 — ICONOGRAFIA OFICIAL DO PERFIL
   Ícones vetoriais inline, nítidos em qualquer resolução.
   ============================================================ */
(() => {
  'use strict';
  if (window.__rolePerfilIconografiaV26) return;
  window.__rolePerfilIconografiaV26 = true;

  const S = {
    crown: '<path fill="currentColor" stroke="none" d="M3.2 17.8 1.8 6.7a1 1 0 0 1 1.55-.97l4.18 2.9 3.6-5.83a1 1 0 0 1 1.7 0l3.6 5.83 4.18-2.9a1 1 0 0 1 1.55.97l-1.4 11.1a1.7 1.7 0 0 1-1.68 1.5H4.88a1.7 1.7 0 0 1-1.68-1.5ZM5.1 17.1h13.8l.93-7.35-3.75 2.6-4.08-6.6-4.08 6.6-3.75-2.6.93 7.35Z"/><path fill="currentColor" stroke="none" d="M4.4 20.2h15.2a1 1 0 0 1 0 2H4.4a1 1 0 0 1 0-2Z"/>',
    pin: '<path d="M20 10c0 5.2-8 11-8 11S4 15.2 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M7 3v4M17 3v4M3.5 9.2h17"/><path d="M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01M16 16.5h.01"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3.8 20c.5-4 2.2-6 5.2-6 3.1 0 4.8 2 5.3 6"/><circle cx="17.2" cy="9" r="2.3"/><path d="M15.2 15c2.9-.1 4.7 1.6 5 5"/>',
    chart: '<path d="M3 20.5h18"/><rect x="4" y="14" width="3" height="6.5" rx="1"/><rect x="9" y="10" width="3" height="10.5" rx="1"/><rect x="14" y="5" width="3" height="15.5" rx="1"/><rect x="19" y="12" width="2" height="8.5" rx="1"/>',
    heart: '<path d="M20.7 5.8c-2-2-5.2-1.9-7.1.1L12 7.6l-1.6-1.7c-1.9-2-5.1-2.1-7.1-.1-2.1 2.1-2 5.5.1 7.5L12 21l8.6-7.7c2.1-2 2.2-5.4.1-7.5Z"/>',
    ticket: '<path d="M4 6h16a2 2 0 0 1 2 2v2a2.5 2.5 0 0 0 0 4v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a2.5 2.5 0 0 0 0-4V8a2 2 0 0 1 2-2Z"/><path d="M15.5 7.8v2M15.5 11v2M15.5 14.2v2M6.5 10h5M6.5 14h3.5"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5.2 20c.7-4.4 3-6.5 6.8-6.5s6.1 2.1 6.8 6.5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.55V21h-4v-.09A1.7 1.7 0 0 0 8.96 19.36a1.7 1.7 0 0 0-1.87.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.51-1H3v-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.96 4.64 1.7 1.7 0 0 0 10 3.09V3h4v.09a1.7 1.7 0 0 0 1.04 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9 1.7 1.7 0 0 0 20.91 10H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"/>',
    shield: '<path d="M12 3 20 6v5.5c0 4.6-3.1 7.7-8 9.5-4.9-1.8-8-4.9-8-9.5V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>'
  };

  function svg(nome, extra='') {
    const fill = nome === 'crown' ? 'currentColor' : 'none';
    return `<span class="perfil-icon-v26 perfil-icon-${nome} ${extra}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${S[nome] || S.user}</svg></span>`;
  }

  function stripLeadingSymbols(el) {
    if (!el) return;
    for (const node of [...el.childNodes]) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const novo = node.textContent.replace(/^\s*[⌖🗓👥♙▣◷♛★☆◇▤]+\s*/u, '');
      if (novo !== node.textContent) node.textContent = novo;
      if (novo.trim()) break;
    }
  }

  function prepend(el, nome, classe='') {
    if (!el || el.querySelector(':scope > .perfil-icon-v26')) return;
    stripLeadingSymbols(el);
    el.insertAdjacentHTML('afterbegin', svg(nome, classe));
  }

  function hero() {
    const kicker = document.getElementById('perfilKicker');
    prepend(kicker, 'crown', 'perfil-crown-kicker');

    const avatar = document.getElementById('perfilAvatarBloco');
    if (avatar && !avatar.querySelector(':scope > .perfil-admin-badge-v26')) {
      avatar.insertAdjacentHTML('beforeend', `<span class="perfil-admin-badge-v26" aria-hidden="true">${svg('crown')}</span>`);
    }

    const cidade = document.getElementById('perfilCidadeResumo');
    const eventos = document.getElementById('perfilTotalEventos');
    const interesses = document.getElementById('perfilTotalInteresses');
    const desde = document.getElementById('perfilDesdeResumo');
    prepend(cidade?.closest('li'), 'pin');
    prepend(eventos?.closest('li'), 'calendar');
    prepend(interesses?.closest('li'), 'users');
    prepend(desde, 'calendar');
  }

  function tabs() {
    const mapa = [
      [/^meus eventos$/i, 'calendar'],
      [/^painel do organizador$/i, 'chart'],
      [/^favoritos$/i, 'heart'],
      [/^minhas inscri[cç][oõ]es$/i, 'ticket'],
      [/^dados p[uú]blicos$/i, 'user'],
      [/^organizador$/i, 'gear'],
      [/^conta e seguran[cç]a$/i, 'shield']
    ];
    document.querySelectorAll('.perfil-aba').forEach(btn => {
      const texto = (btn.textContent || '').replace(/\s+/g, ' ').trim();
      const item = mapa.find(([re]) => re.test(texto));
      if (item) prepend(btn, item[1]);
    });
  }

  function cards() {
    document.querySelectorAll('.grade-perfil .evento-card').forEach(card => {
      const lis = card.querySelectorAll('.evento-meta > li');
      lis.forEach((li, i) => {
        const velho = li.querySelector(':scope > span[aria-hidden="true"]');
        if (velho && !velho.classList.contains('perfil-icon-v26')) velho.remove();
        prepend(li, i === 0 ? 'calendar' : i === 1 ? 'pin' : 'users', 'perfil-card-meta-icon');
        if (i === 0) {
          const sep = li.querySelector('.meta-sep');
          if (sep && !sep.querySelector('.perfil-icon-v26')) {
            sep.textContent = '';
            sep.insertAdjacentHTML('beforeend', svg('clock', 'perfil-card-clock'));
          }
        }
      });
    });
  }

  function aplicar() {
    if (!document.body.classList.contains('pagina-perfil-lovable')) return;
    hero();
    tabs();
    cards();
  }

  let raf = 0;
  function agendar() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; aplicar(); });
  }

  function iniciar() {
    aplicar();
    const obs = new MutationObserver(agendar);
    obs.observe(document.body, { childList:true, subtree:true, characterData:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, {once:true});
  else iniciar();
})();
