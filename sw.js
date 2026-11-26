/* «¿Vale?» · service worker mínimo.
   Precarga index.html, el manifiesto y los iconos. Navegación: red primero (para ver enseguida una versión nueva) y, sin red o con red lenta,
   la copia guardada. Solo atiende peticiones GET del mismo origen: nunca intercepta las del intermediario de IA ni ninguna otra de otro origen.
   La versión de la caché la fija construir.py (versión de la app y huella del index.html). */
'use strict';
const VERSION = '1.8.1-c3e9568f96';
const CACHE = 'vale-' + VERSION;
const ESPERA_RED_MS = 8000;
const BASE = new URL('./', self.location.href).href;
const PAGINA = BASE + 'index.html';
const PRECARGA = [PAGINA, BASE + 'manifest.webmanifest', BASE + 'icono-192.png', BASE + 'icono-512.png', BASE + 'icono-512-maskable.png', BASE + 'apple-touch-icon.png'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECARGA.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((c) => c.startsWith('vale-') && c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

function conEspera(promesa, ms) {
  return new Promise((resolver, rechazar) => {
    const t = setTimeout(() => rechazar(new Error('espera agotada')), ms);
    promesa.then((r) => { clearTimeout(t); resolver(r); }, (e) => { clearTimeout(t); rechazar(e); });
  });
}

function navegacion(peticion) {
  const red = fetch(peticion);
  // La respuesta de red se guarda en caché aunque llegue después de la espera (así la siguiente carga ya es la actual).
  red.then((respuesta) => {
    if (respuesta && respuesta.ok && respuesta.type === 'basic') {
      const copia = respuesta.clone();
      caches.open(CACHE).then((cache) => cache.put(PAGINA, copia)).catch(() => {});
    }
  }).catch(() => {});
  return conEspera(red, ESPERA_RED_MS)
    .catch(() => caches.match(PAGINA).then((guardada) => guardada || red));
}

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;
  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;
  if (peticion.mode === 'navigate') {
    evento.respondWith(navegacion(peticion));
    return;
  }
  if (PRECARGA.indexOf(url.origin + url.pathname) >= 0) {
    evento.respondWith(caches.match(url.origin + url.pathname).then((guardada) => guardada || fetch(peticion)));
  }
});
