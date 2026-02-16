self.addEventListener("install", e => {
  e.waitUntil(caches.open("kw-v1").then(c => c.addAll(["./"])))
});