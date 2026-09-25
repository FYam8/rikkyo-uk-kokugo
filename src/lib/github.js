import { bytesToB64, b64ToBytes } from './crypto.js';

function headers(token) {
  return {
    'Accept':'application/vnd.github+json',
    'Authorization':`Bearer ${token}`,
    'X-GitHub-Api-Version':'2022-11-28'
  };
}

export async function ghGetFile(owner, repo, path, token) {
  const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(path)}`, {
    headers: headers(token),
    cache:'no-store'
  });
  if (!r.ok) throw new Error(`GitHub GET ${r.status}`);
  const j = await r.json();
  return b64ToBytes(j.content);
}

export async function ghPutNewFile(owner, repo, path, bytes, token, message, retries=3) {
  const expectedB64 = bytesToB64(bytes).replace(/\s+/g,'');
  for (let i=0; i<retries; i++) {
    const url=`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(path)}`;
    const r = await fetch(url, {
      method:'PUT',
      headers:{...headers(token), 'Content-Type':'application/json'},
      body: JSON.stringify({ message, content: expectedB64 })
    });
    if (r.ok) return await r.json();

    // If a previous request was committed but its response was lost, retrying
    // the same create returns 422. Treat it as success only when ciphertext
    // at the UUID path is byte-for-byte identical.
    if (r.status === 422) {
      const existing = await fetch(url, {headers:headers(token), cache:'no-store'});
      if (existing.ok) {
        const j=await existing.json();
        if ((j.content||'').replace(/\s+/g,'') === expectedB64) {
          return {alreadyExists:true, content:j};
        }
      }
    }

    if (![409,422].includes(r.status) || i === retries-1) {
      throw new Error(`GitHub PUT ${r.status}: ${await r.text()}`);
    }
    await new Promise(res => setTimeout(res, 500 + Math.random()*1200));
  }
}

export async function ghListEventPaths(owner, repo, token) {
  const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`, {
    headers: headers(token),
    cache:'no-store'
  });
  if (!r.ok) throw new Error(`GitHub TREE ${r.status}`);
  const j = await r.json();
  if (j.truncated) throw new Error('GitHub event tree was truncated; compact/archive old events before syncing.');
  return (j.tree || [])
    .filter(x => x.type === 'blob' && x.path.endsWith('.enc') &&
      (x.path.startsWith('events/') || x.path.startsWith('claims/')))
    .map(x => x.path);
}

