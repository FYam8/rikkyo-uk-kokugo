const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64ToBytes(s) {
  const bin = atob(s.replace(/\s+/g, ''));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
export function bytesToB64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export async function deriveKek(passphrase, salt, iterations) {
  const material = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name:'PBKDF2', hash:'SHA-256', salt, iterations },
    material,
    { name:'AES-GCM', length:256 },
    false,
    ['decrypt']
  );
}

export async function unlockKeyring(envelope, passphrase) {
  const salt = b64ToBytes(envelope.saltB64);
  const iv = b64ToBytes(envelope.ivB64);
  const ct = b64ToBytes(envelope.ciphertextB64);
  const key = await deriveKek(passphrase, salt, envelope.iterations);
  const plain = await crypto.subtle.decrypt(
    { name:'AES-GCM', iv, additionalData:enc.encode(envelope.aad) },
    key, ct
  );
  return JSON.parse(dec.decode(plain));
}

export async function hkdf(rootBytes, info) {
  const material = await crypto.subtle.importKey('raw', rootBytes, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name:'HKDF', hash:'SHA-256', salt:new Uint8Array(), info:enc.encode(info) },
    material,
    { name:'AES-GCM', length:256 },
    false,
    ['encrypt','decrypt']
  );
}

export async function decryptPacked(key, packed, aad) {
  const bytes = packed instanceof Uint8Array ? packed : new Uint8Array(packed);
  const iv = bytes.slice(0,12);
  const ct = bytes.slice(12);
  const plain = await crypto.subtle.decrypt(
    { name:'AES-GCM', iv, additionalData:enc.encode(aad) },
    key, ct
  );
  return new Uint8Array(plain);
}

export async function encryptPacked(key, plainBytes, aad) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name:'AES-GCM', iv, additionalData:enc.encode(aad) },
    key, plainBytes
  ));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0); out.set(ct, iv.length);
  return out;
}

export async function decryptManifest(rootBytes, version, kind, packed) {
  const key = await hkdf(rootBytes, `${kind}-manifest:${version}`);
  const plain = await decryptPacked(key, packed, `${kind}-manifest:${version}`);
  return JSON.parse(dec.decode(plain));
}

export async function deriveYearKey(rootBytes, year, version, kind) {
  return hkdf(rootBytes, `${kind}:${year}:${version}`);
}

export async function deriveSyncKey(rootBytes) {
  return hkdf(rootBytes, 'sync:v1');
}

export { enc, dec };

