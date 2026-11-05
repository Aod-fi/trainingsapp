import * as store from './store.js';
import { testAccess, isConfigured } from './github.js';
import { BENCHMARKS, EXERCISES, CATEGORIES, FORMATS, TRAINING_TYPES, REHA_EXERCISES, REHA_GUIDE_URL, WEEK_GOALS, findBenchmark } from './data.js';
import { computeRecords, prsOfTraining, fmtValue, recTitle, oneRepMax, RM_REPS } from './pr.js';
import { uid, todayISO, esc, parseTime, fmtTime, num, fmtKg, fmtDate, relDate, roundTo, weekStartISO, addDaysISO } from './util.js';

const $app = document.getElementById('app');
const $nav = document.getElementById('tabbar');

let records = new Map();
const K_DRAFT = 'tapp.draft';
// Training, das gerade bearbeitet wird. Wird gesichert, damit nichts verloren geht,
// wenn iOS die App im Hintergrund beendet oder man kurz den Tab wechselt.
let draft = (() => {
  try {
    return JSON.parse(localStorage.getItem(K_DRAFT)) || null;
  } catch {
    return null;
  }
})();
let lastHash = null;

function persistDraft() {
  try {
    if (draft) localStorage.setItem(K_DRAFT, JSON.stringify(draft));
    else localStorage.removeItem(K_DRAFT);
  } catch {
    /* ignorieren */
  }
}

const isEditRoute = (h = location.hash) => h.startsWith('#/neu') || h.startsWith('#/bearbeiten');
let historyFilter = 'alle';
// Morgen-Check auf dem Startbildschirm: Eingabe, bis gespeichert wird
let chk = null;
let chkEditing = false;
let prSearch = '';

function refreshRecords() {
  records = computeRecords(store.trainings());
}

/* ---------- Routing ---------- */

const routes = [
  [/^#?\/?$/, viewHome],
  [/^#\/neu(?:\?(.*))?$/, viewEdit],
  [/^#\/bearbeiten\/(.+)$/, viewEdit],
  [/^#\/verlauf$/, viewHistory],
  [/^#\/training\/(.+)$/, viewTraining],
  [/^#\/prs$/, viewPRs],
  [/^#\/pr\/(.+)$/, viewPR],
  [/^#\/benchmarks$/, viewBenchmarks],
  [/^#\/einstellungen$/, viewSettings],
  [/^#\/check$/, viewChecks],
];

function render() {
  refreshRecords();
  const hash = location.hash || '#/';
  // Fokus merken, damit ein Neuzeichnen das gerade angetippte Feld nicht verliert
  const focusBind = hash === lastHash ? document.activeElement?.dataset?.bind : null;
  for (const [re, view] of routes) {
    const m = hash.match(re);
    if (m) {
      $app.innerHTML = view(...m.slice(1).map((x) => (x ? decodeURIComponent(x) : x)), hash);
      if (focusBind) {
        const el = $app.querySelector(`[data-bind="${CSS.escape(focusBind)}"]`);
        if (el) el.focus({ preventScroll: true });
      }
      afterRender(hash);
      updateNav(hash);
      return;
    }
  }
  location.hash = '#/';
}

function updateNav(hash) {
  const tab = hash.startsWith('#/verlauf') || hash.startsWith('#/training')
    ? 'verlauf'
    : hash.startsWith('#/benchmarks')
      ? 'bench'
      : hash.startsWith('#/pr')
      ? 'prs'
      : hash.startsWith('#/neu') || hash.startsWith('#/bearbeiten')
        ? 'neu'
        : hash.startsWith('#/einstellungen') ? 'none' : 'home';
  $nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
}

function afterRender(hash) {
  // nur beim Seitenwechsel nach oben, nicht beim Neuzeichnen derselben Seite
  if (hash !== lastHash) window.scrollTo({ top: 0 });
  lastHash = hash;
  persistDraft();
}

window.addEventListener('hashchange', () => render());
store.onChange(() => {
  // Während der Eingabe nicht neu zeichnen, nur Status aktualisieren
  if (isEditRoute()) return updateSyncPill();
  render();
});

/* ---------- Bausteine ---------- */

function syncPill() {
  const s = store.getStatus();
  const map = { ok: 'ok', syncing: 'busy', error: 'err', offline: 'warn', local: 'warn', idle: 'busy' };
  return `<a href="#/einstellungen" class="pill pill-${map[s.state] || 'busy'}" id="syncpill" title="${esc(s.message)}"><span class="dot"></span>${esc(shortStatus(s))}</a>`;
}
function shortStatus(s) {
  return { ok: 'Sync', syncing: 'Sync …', error: 'Fehler', offline: 'Offline', local: 'Lokal', idle: '…' }[s.state] || '';
}
function updateSyncPill() {
  const el = document.getElementById('syncpill');
  if (el) el.outerHTML = syncPill();
}

function header(title, { back, right = '' } = {}) {
  return `<header class="top">
    ${back ? `<a class="icon-btn" href="${back}" aria-label="Zurück">${icon('back')}</a>` : ''}
    <h1>${esc(title)}</h1>
    <div class="top-right">${right}</div>
  </header>`;
}

function icon(name) {
  const p = {
    back: '<path d="M15 18l-6-6 6-6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    up: '<path d="M18 15l-6-6-6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
  }[name];
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

function trainingSummary(t) {
  const reha = (t.reha || []).length ? `Schulter-Programm ${t.reha.length}/${REHA_EXERCISES.length}` : '';
  if (t.type !== 'crossfit') {
    const bits = [];
    if (t.durationMin) bits.push(`${t.durationMin} min`);
    if (reha) bits.push(reha);
    if (t.notes) bits.push(t.notes.split('\n')[0]);
    return bits.join(' · ');
  }
  return [reha, ...(t.parts || [])
    .map((p) => {
      const name = p.benchmark || p.exercise || p.title || FORMATS[p.format] || '';
      const res = resultText(p);
      return `${name}${res ? ` ${res}` : ''}`;
    })]
    .filter(Boolean)
    .join(' · ');
}

function resultText(p) {
  const r = p.result || {};
  if (p.format === 'fortime') {
    if (r.capped) return `Cap${r.reps ? ` +${r.reps}` : ''}`;
    return r.timeSec ? fmtTime(r.timeSec) : '';
  }
  if (p.format === 'amrap') return r.rounds || r.reps ? `${r.rounds || 0}+${r.reps || 0}` : '';
  if (p.format === 'maxreps') return r.reps ? `${r.reps} Wdh.` : '';
  if (p.format === 'strength') {
    const top = (p.sets || []).filter((s) => s.weightKg).sort((a, b) => b.weightKg - a.weightKg)[0];
    return top ? `bis ${fmtKg(top.weightKg)}` : '';
  }
  return r.text || '';
}

function trainingCard(t) {
  const type = TRAINING_TYPES[t.type] || TRAINING_TYPES.sonstiges;
  const prs = prsOfTraining(records, t.id);
  return `<a class="card tcard" href="#/training/${t.id}">
    <div class="tcard-icon">${type.icon}</div>
    <div class="tcard-body">
      <div class="tcard-top"><span class="tcard-date">${esc(relDate(t.date))}</span><span class="tag">${esc(type.label)}</span>${prs.length ? `<span class="tag tag-pr">${prs.length} PR</span>` : ''}${painTag(t.shoulderPain)}</div>
      <div class="tcard-sum">${esc(trainingSummary(t)) || '<span class="muted">Ohne Details</span>'}</div>
    </div>
  </a>`;
}

function painLevel(v) {
  return v == null ? '' : v <= 3 ? 'ok' : v <= 6 ? 'warn' : 'bad';
}
function painTag(v) {
  return v == null ? '' : `<span class="tag tag-pain-${painLevel(v)}">Schulter ${v}</span>`;
}

// Tipp-Skala, z. B. Schulter 0–10 oder Schlaf 1–5
function scale({ action, field, from, to, value, kind = 'pain', labels }) {
  const btns = [];
  for (let n = from; n <= to; n++) {
    const cls = value === n ? ` on ${kind === 'pain' ? `lv-${painLevel(n)}` : 'lv-sleep'}` : '';
    btns.push(`<button type="button" class="sc${cls}" data-action="${action}" ${field ? `data-field="${field}"` : ''} data-value="${n}" aria-pressed="${value === n}">${n}</button>`);
  }
  return `<div class="scale" style="--n:${to - from + 1}">${btns.join('')}</div>${labels ? `<div class="scale-lbl"><span>${labels[0]}</span><span>${labels[1]}</span></div>` : ''}`;
}

function sparkline(rec, w = 280, h = 64) {
  const pts = rec.history;
  if (pts.length < 2) return '';
  const vals = pts.map((p) => p.value);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = 6;
  const x = (i) => pad + (i * (w - 2 * pad)) / (pts.length - 1);
  // bei Zeiten ist kleiner besser -> nach oben zeichnen
  const y = (v) => {
    const r = (v - min) / (max - min);
    return pad + (rec.higherBetter ? 1 - r : r) * (h - 2 * pad);
  };
  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const dots = pts
    .map((p, i) => (p.isPR ? `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3.5" class="spark-pr"/>` : ''))
    .join('');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Verlauf"><polyline points="${line}" class="spark-line"/>${dots}</svg>`;
}

/* ---------- Start ---------- */

function viewHome() {
  const all = store.trainings();
  const today = todayISO();
  const weekStart = weekStartISO(today);
  const month = today.slice(0, 7);
  const thisWeek = all.filter((t) => t.date >= weekStart).length;
  const thisMonth = all.filter((t) => t.date.startsWith(month)).length;

  const recentPRs = [];
  for (const rec of records.values()) {
    rec.history.forEach((p, i) => {
      if (p.isPR && i > 0) recentPRs.push({ rec, p });
    });
  }
  recentPRs.sort((a, b) => b.p.date.localeCompare(a.p.date));

  return `${header('Trainingsbuch', { right: `${syncPill()}<a class="icon-btn" href="#/einstellungen" aria-label="Einstellungen">${icon('gear')}</a>` })}
  <main class="page">
    <section class="stats">
      <div class="stat"><div class="stat-num">${thisWeek}</div><div class="stat-lbl">diese Woche</div></div>
      <div class="stat"><div class="stat-num">${thisMonth}</div><div class="stat-lbl">diesen Monat</div></div>
      <div class="stat"><div class="stat-num">${records.size ? [...records.values()].filter((r) => r.best).length : 0}</div><div class="stat-lbl">Bestwerte</div></div>
    </section>
    ${morningCheck(today)}
    <a class="cta" href="#/neu">${icon('plus')}<span>Training eintragen</span></a>
    ${weekGoals(all.filter((t) => t.date >= weekStart && t.date <= addDaysISO(weekStart, 6)))}
    ${!isConfigured(store.getConfig()) ? `<a class="card notice" href="#/einstellungen"><strong>GitHub verbinden</strong><span>Noch wird nur auf diesem Gerät gespeichert. Tippe hier, um iPhone und Laptop zu synchronisieren.</span></a>` : ''}
    ${recentPRs.length ? `<h2 class="sec">Neue PRs</h2><div class="hscroll">${recentPRs.slice(0, 8).map(({ rec, p }) => `<a class="card prmini" href="#/pr/${encodeURIComponent(rec.key)}"><div class="prmini-val">${esc(fmtValue(rec, p))}</div><div class="prmini-name">${esc(recTitle(rec))}</div><div class="muted small">${esc(relDate(p.date))}</div></a>`).join('')}</div>` : ''}
    <h2 class="sec">Letzte Trainings</h2>
    ${all.length ? all.slice(0, 6).map(trainingCard).join('') : `<div class="empty"><div class="empty-big">📓</div><p>Dein Trainingsbuch ist noch leer.<br>Trag dein erstes Training ein oder schick Claude ein Foto vom Whiteboard.</p></div>`}
    ${all.length > 6 ? `<a class="link-more" href="#/verlauf">Alle ${all.length} Trainings</a>` : ''}
  </main>`;
}

function weekGoals(week) {
  return `<section class="card goals"><div class="goals-head"><strong>Diese Woche</strong><span class="muted small">Ziel laut Plan</span></div>
    ${WEEK_GOALS.map((g) => {
      const n = week.filter(g.match).length;
      const pct = Math.min(100, Math.round((n / g.goal) * 100));
      return `<div class="goal"><span>${esc(g.label)}</span><span class="goal-bar"><i style="width:${pct}%" class="${n >= g.goal ? 'done' : ''}"></i></span><span class="goal-num">${n}/${g.goal}</span></div>`;
    }).join('')}
  </section>`;
}

function lastCheckBefore(date) {
  return store.checkins().find((c) => c.date < date && c.date >= addDaysISO(date, -3)) || null;
}

// Hinweis nach der Schmerzregel: am nächsten Morgen nicht schlechter als vorher
function painHint(c) {
  if (c?.shoulder == null) return '';
  const prev = lastCheckBefore(c.date);
  if (c.shoulder >= 6) return `<p class="hint hint-bad">Schulter ${c.shoulder}/10: Heute kein Kipping, keine Snatches, keine Push-ups. Nur Schulter-Programm und Isometrie. Bleibt es so hoch, ärztlich abklären lassen.</p>`;
  if (prev?.shoulder != null && c.shoulder > prev.shoulder) return `<p class="hint hint-warn">Schlechter als beim letzten Check (${prev.shoulder} → ${c.shoulder}). Vermutlich war das letzte Training zu viel: heute bei Schulter-Übungen eine Stufe zurück.</p>`;
  if (c.shoulder <= 3) return `<p class="hint hint-ok">Im grünen Bereich. Die Schmerzregel hält.</p>`;
  return '';
}

function morningCheck(today) {
  const saved = store.getCheckin(today);
  if (saved && !chkEditing) {
    const bits = [];
    if (saved.shoulder != null) bits.push(`Schulter ${saved.shoulder}`);
    if (saved.sleep != null) bits.push(`Schlaf ${saved.sleep}/5`);
    if (saved.weightKg != null) bits.push(fmtKg(saved.weightKg));
    return `<section class="card chk chk-done">
      <div class="chk-row"><strong>Morgen-Check ✓</strong><span class="muted small">${esc(bits.join(' · '))}</span></div>
      ${painHint(saved)}
      <div class="row gap"><button type="button" class="btn btn-ghost sm" data-action="chkedit">Ändern</button><a class="btn btn-ghost sm" href="#/check">Verlauf</a></div>
    </section>`;
  }
  if (!chk || chk.date !== today) chk = saved ? { ...saved } : { date: today, shoulder: null, sleep: null, weightKg: null };
  return `<section class="card chk">
    <div class="chk-row"><strong>Morgen-Check</strong><a class="muted small" href="#/check">Verlauf</a></div>
    <div class="chk-q">Linke Schulter jetzt <span class="muted">(0 = nichts, 10 = maximal)</span></div>
    ${scale({ action: 'chk', field: 'shoulder', from: 0, to: 10, value: chk.shoulder })}
    <div class="chk-q">Wie hast du geschlafen?</div>
    ${scale({ action: 'chk', field: 'sleep', from: 1, to: 5, value: chk.sleep, kind: 'sleep', labels: ['sehr schlecht', 'sehr gut'] })}
    <div class="row chk-weight">
      <label class="field"><span>Gewicht (kg, optional)</span><input type="text" inputmode="decimal" data-bind="chkweight" data-chk="weightKg" value="${esc(chk.weightKg ?? '')}" placeholder="z. B. 58,0"></label>
      <button type="button" class="btn btn-primary" data-action="chksave">Speichern</button>
    </div>
    ${painHint(chk)}
  </section>`;
}

/* ---------- Morgen-Check-Verlauf ---------- */

function lineChart(points, { min, max, invert = false, w = 300, h = 90, cls = '' }) {
  if (points.length < 2) return '<p class="muted small">Ab zwei Einträgen siehst du hier einen Verlauf.</p>';
  const pad = 8;
  const t0 = new Date(points[0].date).getTime();
  const t1 = new Date(points[points.length - 1].date).getTime() || t0 + 1;
  const x = (d) => pad + ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0)) * (w - 2 * pad);
  const y = (v) => {
    const r = (v - min) / Math.max(0.001, max - min);
    return pad + (invert ? r : 1 - r) * (h - 2 * pad);
  };
  const line = points.map((p) => `${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const dots = points.map((p) => `<circle cx="${x(p.date).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3" class="ch-dot ${p.cls || ''}"/>`).join('');
  return `<svg class="spark ch ${cls}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Verlauf"><polyline points="${line}" class="spark-line"/>${dots}</svg>`;
}

function viewChecks() {
  const list = store.checkins();
  const asc = [...list].reverse().slice(-60);
  const sh = asc.filter((c) => c.shoulder != null).map((c) => ({ date: c.date, v: c.shoulder, cls: `lv-${painLevel(c.shoulder)}` }));
  const sl = asc.filter((c) => c.sleep != null).map((c) => ({ date: c.date, v: c.sleep }));
  const wt = asc.filter((c) => c.weightKg != null).map((c) => ({ date: c.date, v: c.weightKg }));
  const wMin = wt.length ? Math.min(...wt.map((p) => p.v)) - 0.5 : 0;
  const wMax = wt.length ? Math.max(...wt.map((p) => p.v)) + 0.5 : 1;
  const sore = store.trainings().filter((t) => t.shoulderPain >= 4).slice(0, 10);
  const last = (arr, f = (v) => v) => (arr.length ? f(arr[arr.length - 1].v) : '–');
  return `${header('Morgen-Check', { back: '#/', right: syncPill() })}
  <main class="page">
    <section class="card"><div class="goals-head"><strong>Schulter links</strong><span class="muted small">zuletzt ${esc(last(sh))}/10</span></div>${lineChart(sh, { min: 0, max: 10, invert: true })}<p class="muted small">Oben = schmerzfrei. Ziel: dauerhaft 0–3.</p></section>
    <section class="card"><div class="goals-head"><strong>Schlaf</strong><span class="muted small">zuletzt ${esc(last(sl))}/5</span></div>${lineChart(sl, { min: 1, max: 5 })}</section>
    <section class="card"><div class="goals-head"><strong>Gewicht</strong><span class="muted small">zuletzt ${esc(last(wt, fmtKg))}</span></div>${lineChart(wt, { min: wMin, max: wMax })}</section>
    ${sore.length ? `<h2 class="sec">Trainings mit Schulter ab 4</h2>${sore.map(trainingCard).join('')}` : ''}
    <h2 class="sec">Einträge</h2>
    ${list.length ? `<div class="card chk-list">${list.slice(0, 30).map((c) => `<div class="chk-li"><span>${esc(relDate(c.date))}</span><span>${c.shoulder != null ? painTag(c.shoulder) : ''}</span><span class="muted small">${c.sleep != null ? `Schlaf ${c.sleep}/5` : ''}${c.weightKg != null ? ` · ${esc(fmtKg(c.weightKg))}` : ''}</span></div>`).join('')}</div>` : '<div class="empty"><p>Noch kein Morgen-Check. Mach den ersten auf dem Startbildschirm.</p></div>'}
    <p class="muted small center"><a class="accent" href="${REHA_GUIDE_URL}" target="_blank" rel="noopener">Schulter-Programm ansehen</a></p>
  </main>`;
}

/* ---------- Eintragen / Bearbeiten ---------- */

function newPart(label, init = {}) {
  return { id: uid(), label, category: 'wod', format: 'fortime', movements: [], sets: [], result: {}, rx: true, text: '', ...init };
}

function partFromBenchmark(label, b) {
  return newPart(label, {
    category: 'wod',
    format: b.format,
    benchmark: b.name,
    rounds: b.rounds || null,
    durationMin: b.durationMin || null,
    scheme: b.scheme || '',
    movements: b.movements.map((m) => ({ exercise: m.exercise, reps: m.reps, weightKg: m.weightKg ? num(m.weightKg.split('/')[0]) : null, note: m.note || '' })),
  });
}

function nextLabel() {
  return String.fromCharCode(65 + (draft.parts || []).length);
}

function viewEdit(arg, hash) {
  if (hash.startsWith('#/bearbeiten')) {
    if (!draft || draft.id !== arg) {
      const t = store.getTraining(arg);
      if (!t) return viewNotFound();
      draft = structuredClone(t);
    }
  } else {
    const b = findBenchmark(new URLSearchParams(arg || '').get('benchmark'));
    // Offenen Entwurf eines neuen Trainings fortsetzen, sonst neu beginnen
    const resumable = draft && !store.getTraining(draft.id) && !(b && !(draft.parts || []).length);
    if (!resumable) {
      draft = { id: uid(), date: todayISO(), type: 'crossfit', parts: [], notes: '', source: 'app' };
      if (b) draft.parts.push(partFromBenchmark('A', b));
    }
  }
  const isNew = !store.getTraining(draft.id);
  return `${header(isNew ? 'Training eintragen' : 'Training bearbeiten', { back: isNew ? '#/' : `#/training/${draft.id}`, right: syncPill() })}
  <main class="page form" id="editform">
    <div class="row">
      <label class="field grow"><span>Datum</span><input type="date" data-bind="date" value="${esc(draft.date)}"></label>
    </div>
    <div class="chips" role="radiogroup" aria-label="Art">
      ${Object.entries(TRAINING_TYPES).map(([k, v]) => `<button type="button" class="chip ${draft.type === k ? 'on' : ''}" data-action="type" data-value="${k}">${v.icon} ${esc(v.label)}</button>`).join('')}
    </div>
    ${draft.type === 'crossfit' ? editCrossfit() : editOther()}
    ${editShoulder()}
    <label class="field"><span>Notizen</span><textarea data-bind="notes" rows="3" placeholder="Wie lief's? Schmerzen, Skalierung, Gefühl …">${esc(draft.notes)}</textarea></label>
    <div class="actions sticky-actions">
      <button type="button" class="btn btn-primary btn-big" data-action="save">Speichern</button>
    </div>
    <button type="button" class="btn btn-danger" data-action="discard">${isNew ? 'Entwurf verwerfen' : 'Änderungen verwerfen'}</button>
  </main>`;
}

function editShoulder() {
  const done = new Set(draft.reha || []);
  const open = draft.type === 'reha' || done.size > 0 || draft.rehaOpen;
  return `<section class="card shoulder">
    <div class="chk-q"><strong>Linke Schulter im Training</strong> <span class="muted">(0–10, bis 3 ist okay)</span></div>
    ${scale({ action: 'pain', from: 0, to: 10, value: draft.shoulderPain ?? null })}
    ${open ? `<div class="chk-q reha-head"><strong>Schulter-Programm</strong><button type="button" class="link-btn" data-action="rehaall">${done.size === REHA_EXERCISES.length ? 'Keine' : 'Alle'}</button></div>
    <div class="chips chips-sm">${REHA_EXERCISES.map((r) => `<button type="button" class="chip chip-sm ${done.has(r.id) ? 'on' : ''}" data-action="reha" data-value="${r.id}">${esc(r.name)} <span class="chip-dose">${esc(r.dose)}</span></button>`).join('')}</div>
    <a class="muted small" href="${REHA_GUIDE_URL}" target="_blank" rel="noopener">Anleitung mit Bildern öffnen</a>`
    : `<button type="button" class="btn btn-ghost sm" data-action="rehaopen">${icon('plus')} Schulter-Programm gemacht</button>`}
  </section>`;
}

function editOther() {
  return `<div class="row">
    <label class="field"><span>Dauer (min)</span><input type="number" inputmode="numeric" data-bind="durationMin" data-type="num" value="${esc(draft.durationMin ?? '')}" placeholder="z. B. 45"></label>
  </div>`;
}

function editCrossfit() {
  const parts = draft.parts || [];
  return `${parts.map((p, i) => editPart(p, i)).join('')}
  <div class="addpart">
    <button type="button" class="btn btn-ghost" data-action="addpart" data-value="strength">${icon('plus')} Kraft</button>
    <button type="button" class="btn btn-ghost" data-action="addpart" data-value="wod">${icon('plus')} WOD</button>
    <label class="btn btn-ghost select-btn">${icon('plus')} Benchmark
      <select data-action="addbenchmark"><option value="">Benchmark wählen</option>${BENCHMARKS.map((b) => `<option>${esc(b.name)}</option>`).join('')}</select>
    </label>
    <button type="button" class="btn btn-ghost" data-action="addpart" data-value="other">${icon('plus')} Sonstiges</button>
  </div>`;
}

function exerciseInput(bind, value, extra = '') {
  return `<input list="exlist" data-bind="${bind}" value="${esc(value || '')}" placeholder="Übung" autocomplete="off" ${extra}>`;
}

function lastTimeHint(exercise) {
  if (!exercise) return '';
  const all = store.trainings().filter((t) => t.id !== draft.id);
  for (const t of all) {
    for (const p of t.parts || []) {
      if (p.format === 'strength' && p.exercise === exercise && (p.sets || []).length) {
        const sets = p.sets.filter((s) => s.reps || s.weightKg);
        const txt = sets.map((s) => `${s.reps ?? '?'}×${s.weightKg ?? '?'}`).join(', ');
        return `<div class="hint">Letztes Mal (${esc(relDate(t.date))}): ${esc(txt)} kg</div>`;
      }
    }
  }
  return '';
}

function percentHelper(p, i) {
  if (!p.exercise) return '';
  const orm = oneRepMax(records, p.exercise);
  if (!orm) return '';
  const pct = num(p.percent);
  const kg = pct ? roundTo((orm.value * pct) / 100, 0.5) : null;
  return `<div class="pct">
    <span class="muted">1RM ${orm.estimated ? '≈ ' : ''}${esc(fmtKg(roundTo(orm.value, 0.5)))}</span>
    <label class="pct-in"><input type="number" inputmode="decimal" data-bind="parts.${i}.percent" data-rerender="1" value="${esc(p.percent ?? '')}" placeholder="%"> %</label>
    ${kg ? `<strong class="accent">= ${esc(fmtKg(kg))}</strong>` : '<span class="muted small">Prozent eingeben</span>'}
  </div>`;
}

function editPart(p, i) {
  const fmtOpts = Object.entries(FORMATS).map(([k, v]) => `<option value="${k}" ${p.format === k ? 'selected' : ''}>${esc(v)}</option>`).join('');
  const catChips = Object.entries(CATEGORIES).map(([k, v]) => `<button type="button" class="chip chip-sm ${p.category === k ? 'on' : ''}" data-action="cat" data-i="${i}" data-value="${k}">${esc(v)}</button>`).join('');
  let body = '';

  if (p.format === 'strength') {
    body = `
      <div class="row">
        <label class="field grow"><span>Übung</span>${exerciseInput(`parts.${i}.exercise`, p.exercise, 'data-rerender="1"')}</label>
        <label class="field w-35"><span>Schema</span><input data-bind="parts.${i}.scheme" value="${esc(p.scheme || '')}" placeholder="5-5-3-3"></label>
      </div>
      ${lastTimeHint(p.exercise)}
      ${percentHelper(p, i)}
      <div class="sets">
        <div class="sets-head"><span>Satz</span><span>Wdh.</span><span>kg</span><span></span></div>
        ${(p.sets || []).map((s, j) => `<div class="set">
          <span class="set-no">${j + 1}</span>
          <input type="number" inputmode="numeric" data-bind="parts.${i}.sets.${j}.reps" data-type="num" value="${esc(s.reps ?? '')}" placeholder="Wdh.">
          <input type="number" inputmode="decimal" step="0.5" data-bind="parts.${i}.sets.${j}.weightKg" data-type="num" value="${esc(s.weightKg ?? '')}" placeholder="kg">
          <button type="button" class="icon-btn sm" data-action="delset" data-i="${i}" data-j="${j}" aria-label="Satz löschen">${icon('x')}</button>
        </div>`).join('')}
        <div class="row gap">
          <button type="button" class="btn btn-ghost sm" data-action="addset" data-i="${i}">${icon('plus')} Satz</button>
          ${p.scheme ? `<button type="button" class="btn btn-ghost sm" data-action="fromscheme" data-i="${i}">Sätze aus Schema</button>` : ''}
        </div>
      </div>`;
  } else if (p.format === 'maxreps') {
    body = `<div class="row">
        <label class="field grow"><span>Übung</span>${exerciseInput(`parts.${i}.exercise`, p.exercise)}</label>
        <label class="field w-30"><span>Wdh.</span><input type="number" inputmode="numeric" data-bind="parts.${i}.result.reps" data-type="num" value="${esc(p.result?.reps ?? '')}"></label>
      </div>`;
  } else if (p.format === 'other') {
    body = `<label class="field"><span>Titel</span><input data-bind="parts.${i}.title" value="${esc(p.title || '')}" placeholder="z. B. Mobility-Routine, Skill-Arbeit"></label>`;
  } else {
    const r = p.result || {};
    body = `
      <div class="row">
        ${p.format === 'fortime' ? `<label class="field"><span>Runden</span><input type="number" inputmode="numeric" data-bind="parts.${i}.rounds" data-type="num" value="${esc(p.rounds ?? '')}" placeholder="1"></label>
          <label class="field"><span>Cap (min)</span><input type="number" inputmode="numeric" data-bind="parts.${i}.timeCapMin" data-type="num" value="${esc(p.timeCapMin ?? '')}"></label>` : ''}
        ${p.format === 'amrap' ? `<label class="field"><span>Dauer (min)</span><input type="number" inputmode="numeric" data-bind="parts.${i}.durationMin" data-type="num" value="${esc(p.durationMin ?? '')}"></label>` : ''}
        ${p.format === 'emom' ? `<label class="field"><span>Alle … min</span><input type="number" inputmode="decimal" data-bind="parts.${i}.intervalMin" data-type="num" value="${esc(p.intervalMin ?? '')}" placeholder="1"></label>
          <label class="field"><span>Dauer (min)</span><input type="number" inputmode="numeric" data-bind="parts.${i}.durationMin" data-type="num" value="${esc(p.durationMin ?? '')}"></label>` : ''}
        <label class="field"><span>Schema</span><input data-bind="parts.${i}.scheme" value="${esc(p.scheme || '')}" placeholder="21-15-9"></label>
      </div>
      <div class="movs">
        ${(p.movements || []).map((m, j) => `<div class="mov">
          ${exerciseInput(`parts.${i}.movements.${j}.exercise`, m.exercise)}
          <input class="mov-reps" data-bind="parts.${i}.movements.${j}.reps" value="${esc(m.reps ?? '')}" placeholder="Wdh. (z. B. 21-15-9)">
          <input class="mov-kg" type="number" inputmode="decimal" step="0.5" data-bind="parts.${i}.movements.${j}.weightKg" data-type="num" value="${esc(m.weightKg ?? '')}" placeholder="kg">
          <button type="button" class="icon-btn sm" data-action="delmov" data-i="${i}" data-j="${j}" aria-label="Bewegung löschen">${icon('x')}</button>
        </div>`).join('')}
        <button type="button" class="btn btn-ghost sm" data-action="addmov" data-i="${i}">${icon('plus')} Bewegung</button>
      </div>
      <div class="result">
        <div class="result-title">Ergebnis</div>
        ${p.format === 'fortime' ? `<div class="row">
            <label class="field grow"><span>Zeit (mm:ss)</span><input inputmode="numeric" data-bind="parts.${i}.result.timeSec" data-type="time" value="${esc(r.timeSec ? fmtTime(r.timeSec) : '')}" placeholder="10:15" ${r.capped ? 'disabled' : ''}></label>
            <label class="toggle"><input type="checkbox" data-bind="parts.${i}.result.capped" data-type="bool" data-rerender="1" ${r.capped ? 'checked' : ''}><span>Time Cap</span></label>
          </div>
          ${r.capped ? `<label class="field"><span>Wdh. beim Cap</span><input type="number" inputmode="numeric" data-bind="parts.${i}.result.reps" data-type="num" value="${esc(r.reps ?? '')}"></label>` : ''}` : ''}
        ${p.format === 'amrap' ? `<div class="row">
            <label class="field"><span>Runden</span><input type="number" inputmode="numeric" data-bind="parts.${i}.result.rounds" data-type="num" value="${esc(r.rounds ?? '')}"></label>
            <label class="field"><span>+ Wdh.</span><input type="number" inputmode="numeric" data-bind="parts.${i}.result.reps" data-type="num" value="${esc(r.reps ?? '')}"></label>
          </div>` : ''}
        ${p.format === 'emom' ? `<label class="field"><span>Ergebnis</span><input data-bind="parts.${i}.result.text" value="${esc(r.text || '')}" placeholder="z. B. alle Runden geschafft"></label>` : ''}
        <div class="seg" role="radiogroup" aria-label="Rx oder Scaled">
          <button type="button" class="${p.rx !== false ? 'on' : ''}" data-action="rx" data-i="${i}" data-value="1">Rx</button>
          <button type="button" class="${p.rx === false ? 'on' : ''}" data-action="rx" data-i="${i}" data-value="0">Scaled</button>
        </div>
      </div>`;
  }

  return `<section class="card part" data-i="${i}">
    <div class="part-head">
      <span class="part-label">${esc(p.label)}</span>
      <div class="part-title">${p.benchmark ? `<strong>${esc(p.benchmark)}</strong><span class="tag">Benchmark</span>` : `<select class="fmt" data-bind="parts.${i}.format" data-rerender="1" aria-label="Format">${fmtOpts}</select>`}</div>
      <div class="part-tools">
        ${i > 0 ? `<button type="button" class="icon-btn sm" data-action="moveup" data-i="${i}" aria-label="Nach oben">${icon('up')}</button>` : ''}
        <button type="button" class="icon-btn sm" data-action="delpart" data-i="${i}" aria-label="Teil löschen">${icon('trash')}</button>
      </div>
    </div>
    <div class="chips chips-sm">${catChips}</div>
    ${body}
    <label class="field"><span>Freitext</span><textarea rows="2" data-bind="parts.${i}.text" placeholder="Beschreibung wie auf dem Whiteboard">${esc(p.text || '')}</textarea></label>
  </section>`;
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let k = 0; k < keys.length - 1; k++) {
    const key = keys[k];
    if (o[key] == null) o[key] = /^\d+$/.test(keys[k + 1]) ? [] : {};
    o = o[key];
  }
  o[keys[keys.length - 1]] = value;
}

function readInput(el) {
  const t = el.dataset.type;
  if (t === 'num') return num(el.value);
  if (t === 'time') return parseTime(el.value);
  if (t === 'bool') return el.checked;
  return el.value;
}

$app.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.chk && chk) {
    chk[el.dataset.chk] = num(el.value);
    return;
  }
  if (!draft || !el.dataset.bind || el.dataset.rerender || !isEditRoute()) return;
  setPath(draft, el.dataset.bind, readInput(el));
  persistDraft();
});

$app.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.action === 'addbenchmark' && el.value) {
    const b = findBenchmark(el.value);
    draft.parts.push(partFromBenchmark(nextLabel(), b));
    return render();
  }
  if (el.dataset.action === 'prsearch' || el.dataset.chk) return;
  if (!draft || !el.dataset.bind || !isEditRoute()) return;
  setPath(draft, el.dataset.bind, readInput(el));
  persistDraft();
  if (el.dataset.rerender) {
    // Beim Wechsel der Übung im Kraftteil letzte Werte vorschlagen
    const m = el.dataset.bind.match(/^parts\.(\d+)\.exercise$/);
    if (m) prefillSets(draft.parts[Number(m[1])]);
    // erst nach dem Fokuswechsel neu zeichnen, damit das neu angetippte Feld aktiv bleibt
    setTimeout(render, 0);
    return;
  }
});

function prefillSets(p) {
  if (p.format !== 'strength' || (p.sets || []).some((s) => s.reps || s.weightKg)) return;
  for (const t of store.trainings()) {
    if (t.id === draft.id) continue;
    const prev = (t.parts || []).find((x) => x.format === 'strength' && x.exercise === p.exercise && (x.sets || []).length);
    if (prev) {
      p.sets = prev.sets.map((s) => ({ reps: s.reps, weightKg: s.weightKg }));
      return;
    }
  }
}

$app.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.tagName === 'SELECT') return;
  const a = btn.dataset.action;
  const i = btn.dataset.i != null ? Number(btn.dataset.i) : null;
  const j = btn.dataset.j != null ? Number(btn.dataset.j) : null;
  const v = btn.dataset.value;

  switch (a) {
    case 'chk': {
      const f = btn.dataset.field;
      const n = Number(v);
      chk[f] = chk[f] === n ? null : n;
      return render();
    }
    case 'chksave': {
      const w = document.querySelector('[data-chk="weightKg"]');
      if (w) chk.weightKg = num(w.value);
      if (chk.shoulder == null && chk.sleep == null && chk.weightKg == null) return toast('Bitte mindestens einen Wert antippen', true);
      const c = { ...chk };
      for (const k of ['shoulder', 'sleep', 'weightKg']) if (c[k] == null) delete c[k];
      store.upsertCheckin(c);
      chkEditing = false;
      chk = null;
      toast('Morgen-Check gespeichert');
      return render();
    }
    case 'chkedit':
      chkEditing = true;
      chk = null;
      return render();
    case 'pain': {
      const n = Number(v);
      draft.shoulderPain = draft.shoulderPain === n ? null : n;
      return render();
    }
    case 'rehaopen':
      draft.rehaOpen = true;
      return render();
    case 'reha': {
      const set = new Set(draft.reha || []);
      if (set.has(v)) set.delete(v);
      else set.add(v);
      draft.reha = REHA_EXERCISES.map((r) => r.id).filter((id) => set.has(id));
      return render();
    }
    case 'rehaall':
      draft.reha = (draft.reha || []).length === REHA_EXERCISES.length ? [] : REHA_EXERCISES.map((r) => r.id);
      draft.rehaOpen = true;
      return render();
    case 'type':
      draft.type = v;
      if (v === 'crossfit' && !draft.parts) draft.parts = [];
      return render();
    case 'addpart': {
      const init = v === 'strength'
        ? { category: 'strength', format: 'strength', sets: [{ reps: null, weightKg: null }] }
        : v === 'other'
          ? { category: 'skill', format: 'other' }
          : { category: 'wod', format: 'fortime', movements: [{ exercise: '', reps: '', weightKg: null }] };
      draft.parts.push(newPart(nextLabel(), init));
      render();
      document.querySelector(`.part[data-i="${draft.parts.length - 1}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    case 'delpart':
      if (!confirm(`Teil ${draft.parts[i].label} löschen?`)) return;
      draft.parts.splice(i, 1);
      relabel();
      return render();
    case 'moveup':
      [draft.parts[i - 1], draft.parts[i]] = [draft.parts[i], draft.parts[i - 1]];
      relabel();
      return render();
    case 'cat':
      draft.parts[i].category = v;
      return render();
    case 'rx':
      draft.parts[i].rx = v === '1';
      return render();
    case 'addset': {
      const sets = draft.parts[i].sets || (draft.parts[i].sets = []);
      const last = sets[sets.length - 1];
      sets.push(last ? { ...last } : { reps: null, weightKg: null });
      return render();
    }
    case 'delset':
      draft.parts[i].sets.splice(j, 1);
      return render();
    case 'fromscheme': {
      const p = draft.parts[i];
      const reps = String(p.scheme).split(/[-–x×,\s]+/).map(Number).filter((n) => n > 0);
      const old = p.sets || [];
      p.sets = reps.map((r, k) => ({ reps: r, weightKg: old[k]?.weightKg ?? null }));
      return render();
    }
    case 'addmov':
      (draft.parts[i].movements ||= []).push({ exercise: '', reps: '', weightKg: null });
      return render();
    case 'delmov':
      draft.parts[i].movements.splice(j, 1);
      return render();
    case 'save':
      return save();
    case 'discard': {
      const wasNew = !store.getTraining(draft.id);
      if (!confirm(wasNew ? 'Entwurf verwerfen?' : 'Änderungen verwerfen?')) return;
      const id = draft.id;
      draft = null;
      persistDraft();
      location.hash = wasNew ? '#/' : `#/training/${id}`;
      return;
    }
    case 'delete': {
      const id = btn.dataset.id;
      if (!confirm('Training wirklich löschen?')) return;
      store.deleteTraining(id);
      toast('Training gelöscht');
      location.hash = '#/verlauf';
      return;
    }
    case 'filter':
      historyFilter = v;
      return render();
    case 'savecfg':
      return saveSettings();
    case 'syncnow':
      await store.sync();
      toast(store.getStatus().message);
      return;
    case 'export':
      return exportData();
    case 'closecele':
      document.querySelector('.cele')?.remove();
      return;
  }
});

function relabel() {
  draft.parts.forEach((p, k) => (p.label = String.fromCharCode(65 + k)));
}

function cleanDraft(t) {
  const c = structuredClone(t);
  delete c.rehaOpen;
  if (!(c.reha || []).length) delete c.reha;
  if (c.shoulderPain == null) delete c.shoulderPain;
  if (c.type !== 'crossfit') {
    delete c.parts;
  } else {
    delete c.durationMin;
    for (const p of c.parts) {
      p.movements = (p.movements || []).filter((m) => m.exercise || m.reps);
      p.sets = (p.sets || []).filter((s) => s.reps || s.weightKg);
      for (const k of Object.keys(p)) if (p[k] === '' || p[k] == null) delete p[k];
      if (p.result) for (const k of Object.keys(p.result)) if (p.result[k] === '' || p.result[k] == null || p.result[k] === false) delete p.result[k];
      // Strength-Sätze erben die Übung des Teils
      if (p.format === 'strength') p.sets = p.sets.map((s) => ({ ...s, exercise: p.exercise }));
    }
  }
  return c;
}

function save() {
  // alle Felder noch einmal einlesen (z. B. bei Autofill ohne input-Event)
  document.querySelectorAll('#editform [data-bind]').forEach((el) => setPath(draft, el.dataset.bind, readInput(el)));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date || '')) draft.date = todayISO();
  const saved = store.upsertTraining(cleanDraft(draft));
  draft = null;
  persistDraft();
  refreshRecords();
  const prs = prsOfTraining(records, saved.id);
  location.hash = `#/training/${saved.id}`;
  if (prs.length) celebrate(prs);
  else toast('Gespeichert');
}

/* ---------- Training-Detail ---------- */

function viewTraining(id) {
  const t = store.getTraining(id);
  if (!t) return viewNotFound();
  const type = TRAINING_TYPES[t.type] || TRAINING_TYPES.sonstiges;
  const prs = prsOfTraining(records, t.id);
  const prKeys = new Set(prs.map((x) => x.rec.key));
  return `${header(fmtDate(t.date), { back: '#/verlauf', right: `<a class="icon-btn" href="#/bearbeiten/${t.id}" aria-label="Bearbeiten">${icon('edit')}</a>` })}
  <main class="page">
    <div class="detail-type">${type.icon} ${esc(type.label)}${t.durationMin ? ` · ${t.durationMin} min` : ''}${t.source === 'claude' ? ' · <span class="muted">von Claude eingetragen</span>' : ''}</div>
    ${t.shoulderPain != null || (t.reha || []).length ? `<section class="card"><div class="part-sub">Linke Schulter</div>${t.shoulderPain != null ? `<p>${painTag(t.shoulderPain)}</p>` : ''}${(t.reha || []).length ? `<div class="chips chips-sm">${REHA_EXERCISES.filter((r) => t.reha.includes(r.id)).map((r) => `<span class="chip chip-sm on">${esc(r.name)}</span>`).join('')}</div>` : ''}</section>` : ''}
    ${prs.length ? `<div class="card prbanner">${icon('trophy')}<div>${prs.map(({ rec, point }) => `<div><strong>Neuer PR:</strong> ${esc(recTitle(rec))} – ${esc(fmtValue(rec, point))}</div>`).join('')}</div></div>` : ''}
    ${(t.parts || []).map((p) => partDetail(p, prKeys)).join('')}
    ${t.notes ? `<section class="card"><div class="part-sub">Notizen</div><p class="pre">${esc(t.notes)}</p></section>` : ''}
    <button type="button" class="btn btn-danger" data-action="delete" data-id="${t.id}">${icon('trash')} Training löschen</button>
  </main>`;
}

function partDetail(p) {
  const head = p.benchmark || p.exercise || p.title || FORMATS[p.format];
  const meta = [];
  if (p.category) meta.push(CATEGORIES[p.category]);
  if (!p.benchmark && p.format !== 'strength' && p.format !== 'other' && head !== FORMATS[p.format]) meta.push(FORMATS[p.format]);
  if (p.rounds) meta.push(`${p.rounds} Runden`);
  if (p.durationMin) meta.push(`${p.durationMin} min`);
  if (p.intervalMin) meta.push(`alle ${p.intervalMin} min`);
  if (p.timeCapMin) meta.push(`TC ${p.timeCapMin} min`);
  if (p.scheme) meta.push(p.scheme);
  if (p.percent) meta.push(`@ ${p.percent} %`);
  const res = resultText(p);
  return `<section class="card part-detail">
    <div class="part-head"><span class="part-label">${esc(p.label || '')}</span><div class="part-title"><strong>${esc(head)}</strong>${p.format !== 'strength' && p.format !== 'other' && p.format !== 'maxreps' ? `<span class="tag ${p.rx === false ? '' : 'tag-rx'}">${p.rx === false ? 'Scaled' : 'Rx'}</span>` : ''}</div></div>
    <div class="muted small">${esc(meta.filter(Boolean).join(' · '))}</div>
    ${(p.movements || []).length ? `<ul class="movlist">${p.movements.map((m) => `<li><span>${esc(m.reps || '')}</span> ${esc(m.exercise)}${m.weightKg ? ` <span class="muted">${esc(fmtKg(m.weightKg))}</span>` : ''}${m.note ? ` <span class="muted">(${esc(m.note)})</span>` : ''}</li>`).join('')}</ul>` : ''}
    ${(p.sets || []).length ? `<div class="setlist">${p.sets.map((s, k) => `<span class="setchip"><small>${k + 1}</small>${esc(s.reps ?? '?')} × ${esc(s.weightKg ?? '?')} kg</span>`).join('')}</div>` : ''}
    ${res && p.format !== 'strength' ? `<div class="bigresult">${esc(res)}</div>` : ''}
    ${p.text ? `<p class="pre muted">${esc(p.text)}</p>` : ''}
  </section>`;
}

/* ---------- Verlauf ---------- */

function viewHistory() {
  const all = store.trainings().filter((t) => historyFilter === 'alle' || t.type === historyFilter);
  const groups = new Map();
  for (const t of all) {
    const key = t.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  const monthName = (k) => {
    const [y, m] = k.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  };
  return `${header('Verlauf', { right: syncPill() })}
  <main class="page">
    <div class="chips">
      <button type="button" class="chip ${historyFilter === 'alle' ? 'on' : ''}" data-action="filter" data-value="alle">Alle</button>
      ${Object.entries(TRAINING_TYPES).map(([k, v]) => `<button type="button" class="chip ${historyFilter === k ? 'on' : ''}" data-action="filter" data-value="${k}">${v.icon} ${esc(v.label)}</button>`).join('')}
    </div>
    ${all.length ? [...groups.entries()].map(([k, list]) => `<h2 class="sec">${esc(monthName(k))} <span class="muted">${list.length}</span></h2>${list.map(trainingCard).join('')}`).join('') : `<div class="empty"><div class="empty-big">🗓️</div><p>Noch keine Trainings${historyFilter !== 'alle' ? ' in dieser Kategorie' : ''}.</p></div>`}
  </main>`;
}

/* ---------- PRs ---------- */

function viewPRs() {
  const q = prSearch.trim().toLowerCase();
  const recs = [...records.values()].filter((r) => r.best && (!q || r.name.toLowerCase().includes(q)));
  const lifts = new Map();
  for (const r of recs.filter((r) => r.kind === 'lift')) {
    if (!lifts.has(r.name)) lifts.set(r.name, []);
    lifts.get(r.name).push(r);
  }
  const benches = recs.filter((r) => r.kind === 'bench').sort((a, b) => a.name.localeCompare(b.name));
  const maxes = recs.filter((r) => r.kind === 'max');

  return `${header('Personal Records', { right: syncPill() })}
  <main class="page">
    <input class="search" type="search" placeholder="Übung oder Benchmark suchen" value="${esc(prSearch)}" data-action="prsearch" id="prsearch">
    ${!recs.length ? `<div class="empty"><div class="empty-big">🏆</div><p>Noch keine Bestwerte.<br>Sie entstehen automatisch, sobald du Kraftsätze oder Benchmarks einträgst.</p></div>` : ''}
    ${lifts.size ? `<h2 class="sec">Kraft</h2>${[...lifts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, list]) => {
      const byReps = new Map(list.map((r) => [r.reps, r]));
      const shown = [...new Set([...RM_REPS, ...list.map((r) => r.reps)])].filter((n) => byReps.has(n)).sort((a, b) => a - b);
      return `<div class="card liftcard"><div class="liftname">${esc(name)}</div><div class="rmrow">${shown.map((n) => {
        const r = byReps.get(n);
        return `<a class="rm" href="#/pr/${encodeURIComponent(r.key)}"><small>${n}RM</small><strong>${esc(String(r.best.value).replace('.', ','))}</strong><small>kg</small></a>`;
      }).join('')}</div></div>`;
    }).join('')}` : ''}
    ${benches.length ? `<h2 class="sec">Benchmarks</h2>${benches.map(prRow).join('')}` : ''}
    ${maxes.length ? `<h2 class="sec">Max Wiederholungen</h2>${maxes.map(prRow).join('')}` : ''}
  </main>`;
}

function prRow(r) {
  return `<a class="card prrow" href="#/pr/${encodeURIComponent(r.key)}">
    <div><div class="prrow-name">${esc(recTitle(r))}</div><div class="muted small">${esc(relDate(r.best.date))} · ${r.history.length}× gemacht</div></div>
    <div class="prrow-val">${esc(fmtValue(r))}</div>
  </a>`;
}

document.addEventListener('input', (e) => {
  if (e.target.id === 'prsearch') {
    prSearch = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const el = document.getElementById('prsearch');
    el.focus();
    el.setSelectionRange(pos, pos);
  }
});

function viewPR(key) {
  const rec = records.get(key);
  if (!rec) return viewNotFound();
  return `${header(recTitle(rec), { back: '#/prs' })}
  <main class="page">
    <section class="card hero">
      <div class="muted small">Bestwert · ${esc(fmtDate(rec.best.date, false))}</div>
      <div class="hero-val">${esc(fmtValue(rec))}</div>
      ${sparkline(rec)}
    </section>
    <h2 class="sec">Alle Ergebnisse</h2>
    ${[...rec.history].reverse().map((p) => `<a class="card prrow" href="#/training/${p.trainingId}">
      <div><div>${esc(fmtDate(p.date))}</div></div>
      <div class="prrow-val ${p.isPR ? 'accent' : ''}">${p.isPR ? '★ ' : ''}${esc(fmtValue(rec, p))}</div>
    </a>`).join('')}
  </main>`;
}

/* ---------- Benchmarks ---------- */

function viewBenchmarks() {
  const group = (g) => BENCHMARKS.filter((b) => b.group === g).map((b) => {
    const rx = records.get(`bench|${b.name}|rx`);
    const sc = records.get(`bench|${b.name}|scaled`);
    return `<section class="card bench">
      <div class="bench-head"><strong>${esc(b.name)}</strong><span class="tag">${b.format === 'amrap' ? `AMRAP ${b.durationMin}` : 'For Time'}</span></div>
      <div class="muted small">${b.rounds ? `${b.rounds} Runden: ` : ''}${b.movements.map((m) => `${m.reps} ${m.exercise}${m.weightKg ? ` (${m.weightKg} kg)` : ''}${m.note ? ` (${m.note})` : ''}`).join(', ')}${b.note ? ` · ${b.note}` : ''}</div>
      <div class="bench-foot">
        <div>${rx ? `<a href="#/pr/${encodeURIComponent(rx.key)}" class="accent">Rx ${esc(fmtValue(rx))}</a>` : ''} ${sc ? `<a href="#/pr/${encodeURIComponent(sc.key)}" class="muted">Scaled ${esc(fmtValue(sc))}</a>` : ''}${!rx && !sc ? '<span class="muted small">noch nicht gemacht</span>' : ''}</div>
        <a class="btn btn-ghost sm" href="#/neu?benchmark=${encodeURIComponent(b.name)}">Eintragen</a>
      </div>
    </section>`;
  }).join('');
  return `${header('Benchmarks', { right: syncPill() })}
  <main class="page">
    <h2 class="sec">The Girls</h2>${group('Girl')}
    <h2 class="sec">Hero WODs</h2>${group('Hero')}
  </main>`;
}

/* ---------- Einstellungen ---------- */

function viewSettings() {
  const cfg = store.getConfig();
  const s = store.getStatus();
  return `${header('Einstellungen', { back: '#/' })}
  <main class="page form">
    <section class="card">
      <h2 class="card-title">GitHub-Speicher</h2>
      <p class="muted small">Deine Trainings werden als JSON-Datei in einem privaten GitHub-Repo gespeichert. So sind iPhone und Laptop synchron, und Claude kann Einträge aus Fotos ergänzen.</p>
      <div class="row">
        <label class="field"><span>Owner</span><input id="cfg-owner" value="${esc(cfg.owner)}" autocapitalize="off"></label>
        <label class="field"><span>Repo</span><input id="cfg-repo" value="${esc(cfg.repo)}" autocapitalize="off"></label>
      </div>
      <label class="field"><span>Datei</span><input id="cfg-path" value="${esc(cfg.path)}" autocapitalize="off"></label>
      <label class="field"><span>Zugangs-Token (fine-grained, nur dieses Repo, Contents: Read & Write)</span><input id="cfg-token" type="password" value="${esc(cfg.token)}" autocapitalize="off" autocomplete="off" placeholder="github_pat_…"></label>
      <div class="row gap">
        <button type="button" class="btn btn-primary" data-action="savecfg">Speichern & testen</button>
        <button type="button" class="btn btn-ghost" data-action="syncnow">Jetzt synchronisieren</button>
      </div>
      <div class="status status-${esc(s.state)}">${esc(s.message || '')}</div>
    </section>
    <section class="card">
      <h2 class="card-title">Daten</h2>
      <p class="muted small">${store.trainings().length} Trainings gespeichert.</p>
      <button type="button" class="btn btn-ghost" data-action="export">Als JSON exportieren</button>
    </section>
    <p class="muted small center">TrainingsApp v0.0.3.1</p>
  </main>`;
}

async function saveSettings() {
  const cfg = {
    owner: document.getElementById('cfg-owner').value.trim(),
    repo: document.getElementById('cfg-repo').value.trim(),
    path: document.getElementById('cfg-path').value.trim() || 'data/trainings.json',
    branch: 'main',
    token: document.getElementById('cfg-token').value.trim(),
  };
  store.setConfig(cfg);
  try {
    await testAccess(cfg);
    await store.sync();
    toast(store.getStatus().state === 'ok' ? 'Verbunden und synchronisiert' : store.getStatus().message);
  } catch (e) {
    toast(`Verbindung fehlgeschlagen: ${e.message}`, true);
  }
  render();
}

function exportData() {
  const blob = new Blob([JSON.stringify(store.exportDb(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `trainings-${todayISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function viewNotFound() {
  return `${header('Nicht gefunden', { back: '#/' })}<main class="page"><div class="empty"><p>Diesen Eintrag gibt es nicht (mehr).</p></div></main>`;
}

/* ---------- Feedback ---------- */

function toast(msg, isErr = false) {
  const el = document.createElement('div');
  el.className = `toast ${isErr ? 'toast-err' : ''}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

function celebrate(prs) {
  const colors = ['#c8ff2e', '#ffb020', '#4cc9f0', '#ff4d6d', '#ffffff'];
  const confetti = Array.from({ length: 40 }, (_, k) => `<i style="left:${Math.random() * 100}%;background:${colors[k % colors.length]};animation-delay:${Math.random() * 0.4}s;animation-duration:${1.6 + Math.random()}s"></i>`).join('');
  const el = document.createElement('div');
  el.className = 'cele';
  el.dataset.action = 'closecele';
  el.innerHTML = `<div class="confetti">${confetti}</div><div class="cele-card"><div class="cele-trophy">🏆</div><div class="cele-title">Neuer PR!</div>${prs.map(({ rec, point }) => `<div class="cele-row"><span>${esc(recTitle(rec))}</span><strong>${esc(fmtValue(rec, point))}</strong></div>`).join('')}<button class="btn btn-primary" data-action="closecele">Stark!</button></div>`;
  document.body.appendChild(el);
  if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
  el.addEventListener('click', () => el.remove());
}

/* ---------- Start ---------- */

document.getElementById('exlist').innerHTML = EXERCISES.map((e) => `<option value="${esc(e.name)}">`).join('');
render();
store.sync();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // Neue Versionen sofort holen: beim Start und bei jeder Rückkehr in die App nachsehen,
  // und neu laden, sobald der neue Service Worker übernimmt (nicht mitten in einer Eingabe).
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded || isEditRoute()) return;
    reloaded = true;
    location.reload();
  });
  navigator.serviceWorker
    .register('./sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    })
    .catch(() => {});
}
