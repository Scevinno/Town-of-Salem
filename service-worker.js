self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  // No caching needed for now
});