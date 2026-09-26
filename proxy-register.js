(() => {
  'use strict';
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then(async registration => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller && !sessionStorage.getItem('__px_sw_reload')) {
        sessionStorage.setItem('__px_sw_reload', '1');
        location.reload();
      }
      registration.update().catch(() => {});
    })
    .catch(error => console.warn('[proxy] Service Worker registration failed', error));
})();
