// Trainings-Timer: For Time, AMRAP, EMOM und Intervall (z. B. Isometrie 5 × 45 s).
import { esc, fmtTime } from './util.js';

export const MODES = {
  fortime: 'For Time',
  amrap: 'AMRAP',
  emom: 'EMOM',
  interval: 'Intervall',
};

const PRESETS = [
  { label: 'Isometrie 5 × 45 s', cfg: { mode: 'interval', work: 45, rest: 90, rounds: 5 } },
  { label: 'AMRAP 12', cfg: { mode: 'amrap', min: 12 } },
  { label: 'EMOM 10', cfg: { mode: 'emom', every: 60, rounds: 10 } },
  { label: 'For Time, Cap 15', cfg: { mode: 'fortime', cap: 15 } },
];

const PREP = 10; // Sekunden Countdown vor dem Start

let cfg = { mode: 'fortime', cap: null, min: 12, every: 60, rounds: 10, work: 45, rest: 60 };
let T = null; // laufender Timer
let tick = null;
let ctx = null;
let wake = null;
let link = null; // { part, back } wenn aus einem Trainingsteil gestartet
let onTransfer = null;

export function setTransferHandler(fn) {
  onTransfer = fn;
}

export function setField(k, v) {
  cfg[k] = v.trim() === '' ? null : Number(v.replace(',', '.'));
}

export const isRunning = () => !!T && T.phase !== 'done';

// Parameter aus der Adresse übernehmen, solange kein Timer läuft
let lastQuery = null;
export function applyParams(query) {
  if (isRunning() || (query || '') === lastQuery) return;
  lastQuery = query || '';
  const q = new URLSearchParams(query || '');
  if (!q.toString()) {
    link = null;
    return;
  }
  T = null;
  const n = (k) => (q.get(k) != null && q.get(k) !== '' ? Number(q.get(k)) : null);
  if (q.get('mode') in MODES) cfg.mode = q.get('mode');
  if (cfg.mode === 'fortime') cfg.cap = n('cap');
  if (n('min')) cfg.min = n('min');
  if (n('every')) cfg.every = n('every');
  if (n('rounds')) cfg.rounds = n('rounds');
  if (n('work')) cfg.work = n('work');
  if (n('rest') != null) cfg.rest = n('rest');
  link = q.get('part') != null ? { part: Number(q.get('part')), back: q.get('back') || '#/neu' } : null;
}

function beep(freq = 880, dur = 0.15) {
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = freq;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch {
    /* ohne Ton weiter */
  }
}

function totalSec() {
  if (cfg.mode === 'amrap') return cfg.min * 60;
  if (cfg.mode === 'emom') return cfg.every * cfg.rounds;
  if (cfg.mode === 'interval') return cfg.rounds * (cfg.work + cfg.rest) - cfg.rest;
  return cfg.cap ? cfg.cap * 60 : null;
}

// Zustand zu einem Zeitpunkt: angezeigte Zeit, Untertitel, Fortschritt, nächster Wechsel
function stateAt(el) {
  if (el < 0) return { big: fmtTime(Math.ceil(-el)), sub: 'Gleich geht’s los', pct: 0, next: -el, prep: true };
  const tot = totalSec();
  if (tot != null && el >= tot) return { end: true };
  if (cfg.mode === 'fortime') {
    return { big: fmtTime(el), sub: `${cfg.cap ? `Cap ${cfg.cap} min` : 'Läuft'}${T.rounds ? ` · ${T.rounds} Runden` : ''}`, pct: tot ? el / tot : 0, next: tot ? tot - el : null };
  }
  if (cfg.mode === 'amrap') {
    return { big: fmtTime(Math.ceil(tot - el)), sub: `${T.rounds} Runden`, pct: el / tot, next: tot - el };
  }
  if (cfg.mode === 'emom') {
    const r = Math.floor(el / cfg.every);
    const left = cfg.every - (el - r * cfg.every);
    return { big: fmtTime(Math.ceil(left)), sub: `Runde ${r + 1} von ${cfg.rounds}`, pct: el / tot, next: left, key: `r${r}` };
  }
  const cyc = cfg.work + cfg.rest;
  const r = Math.floor(el / cyc);
  const inC = el - r * cyc;
  const work = inC < cfg.work;
  const left = work ? cfg.work - inC : cyc - inC;
  return { big: fmtTime(Math.ceil(left)), sub: `${work ? 'Arbeit' : 'Pause'} · Runde ${r + 1} von ${cfg.rounds}`, pct: el / tot, next: left, rest: !work, key: `${r}${work}` };
}

function elapsed() {
  const now = T.pausedAt || performance.now();
  return (now - T.t0 - T.pausedTotal) / 1000 - PREP;
}

function loop() {
  if (!T || T.phase !== 'run') return;
  const el = elapsed();
  const s = stateAt(el);
  if (s.end) return finish(false);
  // Signaltöne: 3-2-1 vor jedem Wechsel, langer Ton beim Wechsel
  if (s.next != null) {
    const sec = Math.ceil(s.next);
    const mark = `${Math.floor(el + s.next)}|${sec}`;
    if (sec <= 3 && sec >= 1 && T.lastBeep !== mark) {
      T.lastBeep = mark;
      beep(660, 0.12);
    }
  }
  const key = s.prep ? 'prep' : s.key || 'run';
  if (T.lastPhase && T.lastPhase !== key && !s.prep) beep(990, 0.4);
  T.lastPhase = key;
  const $t = document.getElementById('tm-time');
  if (!$t) return;
  $t.textContent = s.big;
  document.getElementById('tm-sub').textContent = s.sub;
  document.getElementById('tm-bar').style.width = `${Math.min(100, Math.round((s.pct || 0) * 100))}%`;
  document.getElementById('tm-run').classList.toggle('rest', !!s.rest);
  document.getElementById('tm-run').classList.toggle('prep', !!s.prep);
}

async function lockScreen() {
  try {
    wake = await navigator.wakeLock?.request('screen');
  } catch {
    wake = null;
  }
}

function stopLoop() {
  clearInterval(tick);
  tick = null;
  try {
    wake?.release();
  } catch {
    /* ignorieren */
  }
  wake = null;
}

function finish(stopped) {
  const el = Math.max(0, elapsed());
  const tot = totalSec();
  stopLoop();
  T.phase = 'done';
  T.result = {
    timeSec: cfg.mode === 'fortime' ? Math.round(Math.min(el, tot ?? el)) : null,
    capped: cfg.mode === 'fortime' && tot != null && el >= tot,
    rounds: T.rounds,
    stopped,
  };
  beep(990, 0.6);
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  rerender();
}

let rerender = () => {};
export function setRerender(fn) {
  rerender = fn;
}

export function action(a, btn) {
  switch (a) {
    case 'tmmode':
      cfg.mode = btn.dataset.value;
      return rerender();
    case 'tmpreset':
      Object.assign(cfg, PRESETS[Number(btn.dataset.value)].cfg);
      link = null;
      return rerender();
    case 'tmstart': {
      document.querySelectorAll('#tm-setup [data-tm]').forEach((el) => {
        const v = el.value.trim() === '' ? null : Number(el.value.replace(',', '.'));
        cfg[el.dataset.tm] = v;
      });
      if (cfg.mode === 'amrap' && !(cfg.min > 0)) cfg.min = 12;
      if (cfg.mode === 'emom') {
        cfg.every = cfg.every > 0 ? cfg.every : 60;
        cfg.rounds = cfg.rounds > 0 ? cfg.rounds : 10;
      }
      if (cfg.mode === 'interval') {
        cfg.work = cfg.work > 0 ? cfg.work : 45;
        cfg.rest = cfg.rest >= 0 ? cfg.rest : 60;
        cfg.rounds = cfg.rounds > 0 ? cfg.rounds : 5;
      }
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume?.();
      } catch {
        ctx = null;
      }
      T = { phase: 'run', t0: performance.now(), pausedTotal: 0, pausedAt: null, rounds: 0 };
      lockScreen();
      rerender();
      tick = setInterval(loop, 200);
      loop();
      return;
    }
    case 'tmround':
      T.rounds++;
      if (navigator.vibrate) navigator.vibrate(30);
      return loop();
    case 'tmpause':
      if (T.pausedAt) {
        T.pausedTotal += performance.now() - T.pausedAt;
        T.pausedAt = null;
        tick = setInterval(loop, 200);
        lockScreen();
      } else {
        T.pausedAt = performance.now();
        stopLoop();
      }
      rerender();
      return loop();
    case 'tmstop':
      return finish(true);
    case 'tmreset':
      stopLoop();
      T = null;
      return rerender();
    case 'tmtransfer':
      if (onTransfer && link && T?.result) onTransfer(link, cfg.mode, T.result);
      T = null;
      return;
  }
}

function setupView() {
  const f = (key, label, val, ph) => `<label class="field"><span>${label}</span><input type="text" inputmode="numeric" data-tm="${key}" value="${esc(val ?? '')}" placeholder="${ph}"></label>`;
  let fields = '';
  if (cfg.mode === 'fortime') fields = f('cap', 'Time Cap (min, optional)', cfg.cap, 'ohne');
  if (cfg.mode === 'amrap') fields = f('min', 'Dauer (min)', cfg.min, '12');
  if (cfg.mode === 'emom') fields = `${f('every', 'Alle … Sekunden', cfg.every, '60')}${f('rounds', 'Runden', cfg.rounds, '10')}`;
  if (cfg.mode === 'interval') fields = `${f('work', 'Arbeit (s)', cfg.work, '45')}${f('rest', 'Pause (s)', cfg.rest, '60')}${f('rounds', 'Runden', cfg.rounds, '5')}`;
  return `<main class="page form" id="tm-setup">
    <div class="chips" role="radiogroup" aria-label="Art">
      ${Object.entries(MODES).map(([k, v]) => `<button type="button" class="chip ${cfg.mode === k ? 'on' : ''}" data-action="tmmode" data-value="${k}">${v}</button>`).join('')}
    </div>
    <div class="row">${fields}</div>
    <button type="button" class="btn btn-primary btn-big" data-action="tmstart">Start</button>
    ${link ? '<p class="muted small center">Das Ergebnis kannst du am Ende direkt ins Training übernehmen.</p>' : ''}
    <h2 class="sec">Schnellwahl</h2>
    <div class="chips">${PRESETS.map((p, k) => `<button type="button" class="chip" data-action="tmpreset" data-value="${k}">${esc(p.label)}</button>`).join('')}</div>
    <p class="muted small">Vor dem Start laufen 10 Sekunden Countdown. Pieptöne bei 3-2-1 und bei jedem Wechsel, der Bildschirm bleibt an.</p>
  </main>`;
}

function runView() {
  const counter = cfg.mode === 'fortime' || cfg.mode === 'amrap';
  return `<main class="page tm-run" id="tm-run">
    <div class="tm-mode">${MODES[cfg.mode]}</div>
    <div class="tm-time" id="tm-time">0:00</div>
    <div class="tm-sub" id="tm-sub"></div>
    <div class="tm-track"><i id="tm-bar"></i></div>
    ${counter ? '<button type="button" class="btn btn-primary btn-big tm-round" data-action="tmround">+1 Runde</button>' : ''}
    <div class="row gap tm-ctrl">
      <button type="button" class="btn btn-ghost" data-action="tmpause">${T.pausedAt ? 'Weiter' : 'Pause'}</button>
      <button type="button" class="btn btn-ghost" data-action="tmstop">${cfg.mode === 'fortime' ? 'Fertig' : 'Stopp'}</button>
    </div>
  </main>`;
}

function doneView() {
  const r = T.result;
  let res = '';
  if (cfg.mode === 'fortime') res = r.capped ? `Time Cap${r.rounds ? ` · ${r.rounds} Runden` : ''}` : fmtTime(r.timeSec);
  else if (cfg.mode === 'amrap') res = `${r.rounds} Runden`;
  else res = r.stopped ? 'Abgebrochen' : 'Geschafft';
  const canTransfer = link && (cfg.mode === 'fortime' || cfg.mode === 'amrap');
  return `<main class="page tm-run done">
    <div class="tm-mode">${MODES[cfg.mode]}</div>
    <div class="tm-time">${esc(res)}</div>
    ${cfg.mode === 'amrap' ? '<div class="tm-sub">Die Wiederholungen der angefangenen Runde trägst du im Training nach.</div>' : ''}
    ${canTransfer ? '<button type="button" class="btn btn-primary btn-big" data-action="tmtransfer">Ins Training übernehmen</button>' : ''}
    <button type="button" class="btn btn-ghost" data-action="tmreset">Neuer Timer</button>
  </main>`;
}

export function view(headerHtml) {
  const body = !T ? setupView() : T.phase === 'done' ? doneView() : runView();
  if (T && T.phase === 'run' && !tick && !T.pausedAt) tick = setInterval(loop, 200);
  if (T && T.phase === 'run') setTimeout(loop, 0);
  return headerHtml + body;
}
