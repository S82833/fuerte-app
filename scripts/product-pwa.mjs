import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export function finalizeProductPwa(directory) {
  const root=path.resolve(directory);
  const html=fs.readFileSync(path.join(root,'product.html'),'utf8');
  const entryAssets=[...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(match=>match[1]);
  if (!entryAssets.some(file=>file.endsWith('.js')) || !entryAssets.some(file=>file.endsWith('.css'))) throw new Error('Product entry assets missing');
  const files=[...new Set([
    '/pwa/offline.html','/pwa/offline.css','/pwa/manifest.webmanifest',
    '/pwa/icon-192.png','/pwa/icon-512.png','/pwa/icon-maskable-512.png','/pwa/apple-touch-icon.png','/pwa/brand-96.png',
    '/assets/literata.woff2','/assets/nunito.woff2','/assets/family.jpg',...entryAssets
  ])].sort((a,b)=>a<b?-1:a>b?1:0);
  const workerFile=path.join(root,'fuerte-sw.js');
  const source=fs.readFileSync(workerFile,'utf8');
  if (!source.includes('__BUILD_VERSION__') || !source.includes('__PRECACHE_FILES__')) throw new Error('Worker template missing');
  const hash=createHash('sha256').update(source);
  for(const file of files)hash.update(file).update(fs.readFileSync(path.join(root,file.slice(1))));
  const version=hash.digest('hex').slice(0,16);
  fs.writeFileSync(workerFile,source.replace('__BUILD_VERSION__',version).replace('__PRECACHE_FILES__',JSON.stringify(files)));
  console.log(`Product PWA: ${files.length} public resources, version ${version}`);
}
