// Downstream safety mode: no shared-origin CacheStorage writes.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
