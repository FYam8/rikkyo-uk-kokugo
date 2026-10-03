import fs from 'node:fs';import assert from 'node:assert/strict';
for(const file of ['index.html','dist/index.html']){
 const html=fs.readFileSync(file,'utf8'),csp=html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1];assert.ok(csp,file+' needs CSP');
 const connect=csp.split(';').map(x=>x.trim()).find(x=>x.startsWith('connect-src '))?.split(/\s+/).slice(1);
 assert.deepEqual(connect,["'self'",'https://api.github.com','https://rikkyo-uk-progress-api.fyam8.workers.dev'],file+' must allow only the intended Cloud endpoint');
}
console.log('Source and built document allow isolated Rikkyo Cloud origin PASS');
