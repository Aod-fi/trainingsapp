// Minimaler GitHub-Contents-API-Client. Die Daten liegen als eine JSON-Datei
// im (privaten) Daten-Repo, z. B. Aod-fi/trainingsapp-daten:data/trainings.json

const API = 'https://api.github.com';

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function b64decode(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function headers(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function url(cfg) {
  return `${API}/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`;
}

export function isConfigured(cfg) {
  return !!(cfg && cfg.owner && cfg.repo && cfg.path && cfg.token);
}

export async function loadFile(cfg) {
  const res = await fetch(`${url(cfg)}?ref=${encodeURIComponent(cfg.branch || 'main')}`, {
    headers: headers(cfg.token),
    cache: 'no-store',
  });
  if (res.status === 404) return { data: null, sha: null };
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  const json = await res.json();
  let text;
  if (json.content) {
    text = b64decode(json.content);
  } else {
    // Dateien > 1 MB kommen ohne content, dann über download_url laden
    const raw = await fetch(json.download_url, { headers: headers(cfg.token) });
    text = await raw.text();
  }
  return { data: JSON.parse(text), sha: json.sha };
}

export async function saveFile(cfg, data, sha, message) {
  const body = {
    message,
    content: b64encode(JSON.stringify(data, null, 2) + '\n'),
    branch: cfg.branch || 'main',
  };
  if (sha) body.sha = sha;
  const res = await fetch(url(cfg), {
    method: 'PUT',
    headers: { ...headers(cfg.token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 409 || res.status === 422) {
    const err = new Error('conflict');
    err.conflict = true;
    throw err;
  }
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.content.sha;
}

export async function testAccess(cfg) {
  const res = await fetch(`${API}/repos/${cfg.owner}/${cfg.repo}`, { headers: headers(cfg.token) });
  if (!res.ok) throw new Error(res.status === 404 ? 'Repo nicht gefunden oder kein Zugriff' : `GitHub ${res.status}`);
  const repo = await res.json();
  if (repo.permissions && !repo.permissions.push) throw new Error('Token hat keine Schreibrechte');
  return repo;
}
