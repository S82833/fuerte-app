import fs from 'node:fs';
import path from 'node:path';
const root='dist/client';
const walk=(dir)=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);
const files=walk(root).filter(file=>/\.(js|css|woff2|png|jpg|webmanifest)$/.test(file)).map(file=>'/'+path.relative(root,file).replaceAll('\\','/')).sort();
fs.writeFileSync(path.join(root,'precache.json'),JSON.stringify(files));
console.log(`Offline assets: ${files.length}`);
