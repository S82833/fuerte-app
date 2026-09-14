import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('dist-pages/index.html', 'utf8');
function checkPaths(text) {
  const urls = [...text.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]).filter(url => !url.startsWith('#'));
  assert.ok(urls.length >= 5);
  for (const url of urls) {
    assert.ok(url.startsWith('/fuerte-app/'), `Asset outside project: ${url}`);
    assert.ok(fs.existsSync(`dist-pages/${url.slice('/fuerte-app/'.length)}`));
  }
}
assert.throws(() => checkPaths(html.replaceAll('/fuerte-app/', '/')));
console.log('RED: incorrect root asset paths detected');
checkPaths(html);
console.log('GREEN: HTML assets resolve inside the Pages project');

const manifest = JSON.parse(fs.readFileSync('dist-pages/manifest.webmanifest', 'utf8'));
const base = 'https://example.github.io/fuerte-app/';
function checkManifest(value) {
  for (const key of ['start_url', 'scope']) assert.equal(new URL(value[key], base).href, base);
  for (const icon of value.icons) assert.ok(new URL(icon.src, base).href.startsWith(base));
}
assert.throws(() => checkManifest({ ...manifest, scope: '/' }));
console.log('RED: manifest escaping project scope detected');
checkManifest(manifest);
console.log('GREEN: installed app opens within the project');

const source = fs.readFileSync('dist-pages/sw.js', 'utf8');
assert.ok(!source.includes('__BUILD_VERSION__'));
async function checkWorker(code) {
  const handlers = {};
  let added, requested;
  const deleted = [];
  const prefix = `fuerte:${base}:`;
  vm.runInNewContext(code, {
    URL, Response,
    self: { location: { href: `${base}sw.js` }, addEventListener: (name, handler) => { handlers[name] = handler; }, skipWaiting: async () => {}, clients: { claim: async () => {}, matchAll: async () => [] } },
    caches: { open: async () => ({ addAll: async urls => { added = urls; }, match: async () => new Response('cached app') }), keys: async () => [`${prefix}old`, 'another-app-cache'], delete: async key => { deleted.push(key); } },
    fetch: async url => { requested = String(url); return { ok: true, json: async () => ['assets/demo.js'] }; },
  });
  let pending = Promise.resolve();
  handlers.install({ waitUntil: promise => { pending = promise; } });
  await pending;
  assert.equal(requested, `${base}precache.json`);
  assert.deepEqual(Array.from(added), [base, `${base}assets/demo.js`]);
  handlers.activate({ waitUntil: promise => { pending = promise; } });
  await pending;
  assert.deepEqual(deleted, [`${prefix}old`]);
  let intercepted = false;
  handlers.fetch({ request: { method: 'GET', url: 'https://example.github.io/other-app/' }, respondWith: () => { intercepted = true; } });
  assert.equal(intercepted, false);
}
const mutated = source.replace("new URL('./', self.location.href)", "new URL('/', self.location.href)");
assert.notEqual(mutated, source);
await assert.rejects(() => checkWorker(mutated));
console.log('RED: worker using domain root detected');
await checkWorker(source);
console.log('GREEN: precache and cache cleanup stay within the project');
console.log('3/3 Pages checks; 3/3 mutations detected.');
