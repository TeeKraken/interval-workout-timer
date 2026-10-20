import { createHash } from "node:crypto";
import { defineConfig, type Plugin } from "vite";

/**
 * Writes dist/sw.js with the exact list of built files, so the whole app is cached
 * on first visit and keeps working offline. Hand-rolled to avoid a plugin dependency.
 */
function serviceWorker(): Plugin {
  return {
    name: "shuffle-timer-sw",
    apply: "build",
    generateBundle(_options, bundle) {
      const files = ["/", ...Object.keys(bundle).map((f) => `/${f}`)].filter(
        (f) => f !== "/index.html",
      );
      const staticFiles = ["/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png"];
      const precache = [...new Set([...files, ...staticFiles])];
      const version = createHash("sha256")
        .update(JSON.stringify(precache))
        .digest("hex")
        .slice(0, 12);
      const source = `// Generated at build time. Caches the app so it works offline.
const CACHE = "shuffle-timer-${version}";
const PRECACHE = ${JSON.stringify(precache)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    // Fresh page when online, cached page when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
`;
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig({
  plugins: [serviceWorker()],
  build: { target: "es2022" },
});
