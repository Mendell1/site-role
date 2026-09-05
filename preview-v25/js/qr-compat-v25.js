/* ============================================================
   ROLÊ V25.3 — compatibilidade de geração de QR no navegador
   ============================================================ */
(() => {
  'use strict';

  if (window.QRCode && typeof window.QRCode.toCanvas === 'function') return;

  const FONTES = [
    'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
  ];

  let construtorQr = null;
  let carregamento = null;

  const apiCompat = {
    async toCanvas(canvas, texto, opcoes = {}) {
      if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Destino do QR precisa ser um canvas');
      const QRCodeJs = await carregarBiblioteca();
      const tamanho = Number(opcoes.width || 256);
      const suporte = document.createElement('div');
      suporte.style.position = 'fixed';
      suporte.style.left = '-9999px';
      suporte.style.top = '-9999px';
      suporte.style.opacity = '0';
      suporte.style.pointerEvents = 'none';
      document.body.appendChild(suporte);

      try {
        new QRCodeJs(suporte, {
          text: String(texto || ''),
          width: tamanho,
          height: tamanho,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCodeJs.CorrectLevel ? QRCodeJs.CorrectLevel.M : undefined
        });

        await new Promise(resolve => requestAnimationFrame(resolve));
        const qrCanvas = suporte.querySelector('canvas');
        const qrImagem = suporte.querySelector('img');
        canvas.width = tamanho;
        canvas.height = tamanho;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tamanho, tamanho);

        if (qrCanvas) {
          ctx.drawImage(qrCanvas, 0, 0, tamanho, tamanho);
          return canvas;
        }

        if (qrImagem) {
          if (!qrImagem.complete) {
            await new Promise((resolve, reject) => {
              qrImagem.onload = resolve;
              qrImagem.onerror = reject;
            });
          }
          ctx.drawImage(qrImagem, 0, 0, tamanho, tamanho);
          return canvas;
        }

        throw new Error('A biblioteca de QR não gerou uma imagem');
      } finally {
        suporte.remove();
      }
    }
  };

  function carregarFonte(indice, resolve, reject) {
    if (indice >= FONTES.length) {
      reject(new Error('Não foi possível carregar nenhuma fonte do gerador de QR'));
      return;
    }

    const script = document.createElement('script');
    script.src = FONTES[indice];
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      const carregado = window.QRCode;
      if (typeof carregado === 'function') {
        construtorQr = carregado;
        window.QRCode = apiCompat;
        resolve(construtorQr);
        return;
      }
      script.remove();
      carregarFonte(indice + 1, resolve, reject);
    };
    script.onerror = () => {
      script.remove();
      window.QRCode = apiCompat;
      carregarFonte(indice + 1, resolve, reject);
    };
    document.head.appendChild(script);
  }

  function carregarBiblioteca() {
    if (construtorQr) return Promise.resolve(construtorQr);
    if (carregamento) return carregamento;
    carregamento = new Promise((resolve, reject) => carregarFonte(0, resolve, reject)).catch(erro => {
      carregamento = null;
      window.QRCode = apiCompat;
      throw erro;
    });
    return carregamento;
  }

  window.QRCode = apiCompat;
  console.info('[V25.3] compatibilidade de QR ativada');
})();
