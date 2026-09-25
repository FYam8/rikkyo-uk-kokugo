import { bytesToB64, b64ToBytes, encryptPacked, decryptPacked, enc, dec } from './crypto.js';

const CFG = 'waseshibu.config';
const DEVICE = 'waseshibu.device';
const PENDING = 'waseshibu.pending.enc';

export function loadConfig() {
  try { return JSON.parse(localStorage.getItem(CFG) || '{}'); } catch { return {}; }
}
export function saveConfig(c) {
  localStorage.setItem(CFG, JSON.stringify(c));
}
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE, id);
  }
  return id;
}

async function saveEncrypted(name, value, key, aad) {
  const packed = await encryptPacked(key, enc.encode(JSON.stringify(value)), aad);
  localStorage.setItem(name, bytesToB64(packed));
}
async function loadEncrypted(name, key, aad, fallback) {
  const raw = localStorage.getItem(name);
  if (!raw) return fallback;
  try {
    const plain = await decryptPacked(key, b64ToBytes(raw), aad);
    return JSON.parse(dec.decode(plain));
  } catch {
    return fallback;
  }
}
export function removeLocal(name) {
  localStorage.removeItem(name);
}

export async function loadPending(syncKey) {
  return loadEncrypted(PENDING, syncKey, 'local:pending:v1', []);
}
export async function savePending(items, syncKey) {
  if (!items.length) {
    localStorage.removeItem(PENDING);
    return;
  }
  await saveEncrypted(PENDING, items, syncKey, 'local:pending:v1');
}
function draftKey(year) { return `waseshibu.draft.${year}.enc`; }
export async function saveDraft(year, draft, syncKey) {
  await saveEncrypted(draftKey(year), draft, syncKey, `local:draft:${year}:v1`);
}
export async function loadDraft(year, syncKey) {
  return loadEncrypted(draftKey(year), syncKey, `local:draft:${year}:v1`, null);
}
export function clearDraft(year) {
  localStorage.removeItem(draftKey(year));
}

