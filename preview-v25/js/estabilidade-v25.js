/* ============================================================
   ROLÊ V25 — estabilidade dos módulos dinâmicos
   Evita ciclos de renderização entre Participação (V25.2)
   e Check-in (V25.3) sem impedir atualizações reais de estado.
   ============================================================ */
(() => {
  'use strict';

  if (window.__roleV25EstabilidadeAplicada) return;

  const descritor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (!descritor || !descritor.get || !descritor.set) return;

  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: descritor.configurable,
    enumerable: descritor.enumerable,
    get: descritor.get,
    set(valor) {
      const gerenciado = this.id === 'participacaoV252' ||
        (this.classList && this.classList.contains('v253-extra'));

      if (gerenciado) {
        const html = String(valor == null ? '' : valor);
        if (this.__roleV25UltimoHtml === html) return;
        this.__roleV25UltimoHtml = html;
      }

      return descritor.set.call(this, valor);
    }
  });

  window.__roleV25EstabilidadeAplicada = true;
  console.info('[V25] estabilização de renderização ativada');
})();
