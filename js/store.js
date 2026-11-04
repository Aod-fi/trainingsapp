import { loadFile, saveFile, isConfigured } from './github.js';

const K_DB = 'tapp.db';
const K_CFG = 'tapp.config';
const K_SHA = 'tapp.sha';
const K_DIRTY = 'tapp.dirty';

const emptyDb = () => ({ version: 1, trainings: [] });

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Speicher voll oder gesperrt: App läuft trotzdem im Speicher weiter */
  }
}

let db = read(K_DB, emptyDb());
let status = { state: 'idle', message: '' };
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getConfig = () => read(K_CFG, { owner: 'Aod-fi', repo: 'trainingsapp-daten', path: 'data/trainings.json', branch: 'main', token: '' });
export const setConfig = (cfg) => write(K_CFG, cfg);
export const getStatus = () => status;
export const isDirty = () => read(K_DIRTY, false);

function setStatus(state, message = '') {
  status = { state, message };
  emit();
}

export function trainings() {
  return db.trainings
    .filter((t) => !t.deleted)
    .sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || '')));
}

export function getTraining(id) {
  return db.trainings.find((t) => t.id === id && !t.deleted) || null;
}

function persistLocal() {
  write(K_DB, db);
  write(K_DIRTY, true);
  emit();
}

export function upsertTraining(t) {
  const now = new Date().toISOString();
  const idx = db.trainings.findIndex((x) => x.id === t.id);
  const rec = { ...t, updatedAt: now, createdAt: t.createdAt || now };
  if (idx >= 0) db.trainings[idx] = rec;
  else db.trainings.push(rec);
  persistLocal();
  sync();
  return rec;
}

export function deleteTraining(id) {
  const t = db.trainings.find((x) => x.id === id);
  if (!t) return;
  t.deleted = true;
  t.updatedAt = new Date().toISOString();
  persistLocal();
  sync();
}

function merge(remote, local) {
  const map = new Map();
  for (const t of remote.trainings || []) map.set(t.id, t);
  for (const t of local.trainings || []) {
    const r = map.get(t.id);
    if (!r || (t.updatedAt || '') > (r.updatedAt || '')) map.set(t.id, t);
  }
  return { ...remote, version: 1, trainings: [...map.values()] };
}

let syncing = null;

export function sync() {
  if (syncing) return syncing.then(() => doSync());
  syncing = doSync().finally(() => (syncing = null));
  return syncing;
}

async function doSync(retry = true) {
  const cfg = getConfig();
  if (!isConfigured(cfg)) {
    setStatus('local', 'Nur auf diesem Gerät gespeichert');
    return;
  }
  if (!navigator.onLine) {
    setStatus('offline', isDirty() ? 'Offline – wird später synchronisiert' : 'Offline');
    return;
  }
  setStatus('syncing', 'Synchronisiere …');
  try {
    const { data: remote, sha } = await loadFile(cfg);
    const merged = merge(remote || emptyDb(), db);
    const changed = !remote || JSON.stringify(merged.trainings) !== JSON.stringify(remote.trainings);
    let newSha = sha;
    if (changed) {
      newSha = await saveFile(cfg, merged, sha, `Trainings aktualisiert (${new Date().toLocaleString('de-DE')})`);
    }
    db = merged;
    write(K_DB, db);
    write(K_SHA, newSha);
    write(K_DIRTY, false);
    setStatus('ok', 'Synchronisiert');
  } catch (e) {
    if (e.conflict && retry) return doSync(false);
    console.error(e);
    setStatus('error', e.message || 'Sync fehlgeschlagen');
  }
}

window.addEventListener('online', () => sync());

// Für Tests und Import
export function replaceDb(newDb) {
  db = newDb;
  persistLocal();
}
export const exportDb = () => db;
