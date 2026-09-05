/* ============================================================
   ROLÊ V25.5 — Service Worker / PWA
   Cacheia somente recursos públicos do frontend.
   Nunca intercepta ou persiste respostas do Supabase.
   ============================================================ */
const CACHE_ATUAL = 'role-v25-5-shell-v2';
const PREFIXO_CACHE = 'role-v25-';
const BASE = self.registration.scope;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/estilo.css',
  './css/mobile-responsive.css',
  './css/revisao-v25.css',
  './js/config.js',
  './js/revisao-v25.js',
  './assets/icon-192.png',
  './assets/icon-512.png'
].map(caminho => new URL(caminho, BASE).href);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_ATUAL);
    await Promise.allSettled(SHELL.map(async url => {
      try {
        const resposta = await fetch(url, {cache: 'reload'});
        if (resposta.ok) await cache.put(url, resposta.clone());
      } catch (_) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes
      .filter(nome => nome.startsWith(PREFIXO_CACHE) && nome !== CACHE_ATUAL)
      .map(nome => caches.delete(nome)));
    await self.clients.claim();
  })());
});

function requisicaoPrivadaOuApi(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return true;
  return /\/(rest|auth|storage|realtime|functions)\/v1\//.test(url.pathname);
}

async function navegacaoNetworkFirst(request) {
  const cache = await caches.open(CACHE_ATUAL);
  try {
    const resposta = await fetch(request, {cache:'no-cache'});
    if (resposta && resposta.ok) await cache.put(request, resposta.clone());
    return resposta;
  } catch (_) {
    return (await cache.match(request)) ||
      (await cache.match(new URL('./index.html', BASE).href)) ||
      Response.error();
  }
}

async function recursoStaleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_ATUAL);
  const armazenado = await cache.match(request);
  const rede = fetch(request).then(async resposta => {
    if (resposta && resposta.ok) await cache.put(request, resposta.clone());
    return resposta;
  }).catch(() => null);
  return armazenado || (await rede) || Response.error();
}

self.addEventListener('fetch', event => {
  const {request} = event;
  if (request.method !== 'GET' || requisicaoPrivadaOuApi(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(navegacaoNetworkFirst(request));
    return;
  }

  const destino = request.destination;
  if (['script','style','image','font','manifest'].includes(destino)) {
    event.respondWith(recursoStaleWhileRevalidate(request));
  }
});

self.addEventListener('message', event => {
  if (event.data?.tipo === 'ROLE_SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('push', event => {
  let dados = {};
  try { dados = event.data ? event.data.json() : {}; } catch (_) {
    dados = {titulo: 'Rolê', mensagem: event.data?.text() || 'Você tem uma novidade no Rolê.'};
  }
  const titulo = dados.titulo || 'Rolê';
  const opcoes = {
    body: dados.mensagem || dados.body || 'Você tem uma novidade no Rolê.',
    icon: new URL('./assets/icon-192.png', BASE).href,
    badge: new URL('./assets/icon-192.png', BASE).href,
    data: {url: dados.url || './'},
    tag: dados.tag || 'role-notificacao',
    renotify: false
  };
  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || './', BASE).href;
  event.waitUntil((async () => {
    const janelas = await clients.matchAll({type: 'window', includeUncontrolled: true});
    for (const janela of janelas) {
      if ('focus' in janela) {
        if ('navigate' in janela) await janela.navigate(destino);
        return janela.focus();
      }
    }
    if (clients.openWindow) return clients.openWindow(destino);
  })());
});
