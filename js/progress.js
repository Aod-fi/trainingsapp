// Fortschritt: Auswertungen aus vorhandenen Daten (keine neuen Eingaben).
import { WEEK_GOALS, TRAINING_DAY_TYPES } from './data.js';
import { weekStartISO, addDaysISO, esc } from './util.js';

const DAY = 86400000;
const t = (iso) => new Date(`${iso}T12:00:00`).getTime();

// Zählt ein Wochenziel für eine Liste von Trainings (Doppel-Tage zählen bei "days" einfach)
export function goalCount(g, list) {
  const hits = list.filter(g.match);
  return g.days ? new Set(hits.map((x) => x.date)).size : hits.length;
}

// Je Woche (Mo–So) die Zielwerte, älteste zuerst, inkl. laufender Woche
export function weeklyGoals(trainings, today, weeks = 6) {
  const cur = weekStartISO(today);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDaysISO(cur, -7 * i);
    const end = addDaysISO(start, 6);
    const list = trainings.filter((x) => x.date >= start && x.date <= end);
    const counts = {};
    for (const g of WEEK_GOALS) counts[g.key] = goalCount(g, list);
    out.push({ start, current: i === 0, counts });
  }
  return out;
}

// Gewicht: Einzelwerte plus gleitender 7-Tage-Schnitt (alle Werte der letzten 7 Tage bis einschließlich Datum)
export function weightSeries(checkins) {
  const pts = checkins.filter((c) => c.weightKg != null).map((c) => ({ date: c.date, v: Number(c.weightKg) })).sort((a, b) => a.date.localeCompare(b.date));
  return pts.map((p) => {
    const win = pts.filter((q) => q.date <= p.date && t(p.date) - t(q.date) < 7 * DAY);
    return { ...p, avg: win.reduce((s, q) => s + q.v, 0) / win.length };
  });
}

// Trend in kg pro Woche aus dem 7-Tage-Schnitt (letzter Schnitt gegen den Schnitt ~7 Tage davor)
export function weightTrend(series) {
  if (series.length < 3) return null;
  const last = series[series.length - 1];
  const ref = [...series].reverse().find((p) => t(last.date) - t(p.date) >= 6 * DAY);
  if (!ref) return null;
  const days = (t(last.date) - t(ref.date)) / DAY;
  return { perWeek: ((last.avg - ref.avg) / days) * 7, avg: last.avg, since: ref.date };
}

// Typ eines Tages für den Kalender: training > cardio > regen
export function dayKinds(trainings) {
  const map = new Map();
  const rank = { training: 3, cardio: 2, regen: 1 };
  for (const x of trainings) {
    let k = null;
    if (x.type === 'crossfit' && x.kurs === 'faster') k = 'cardio';
    else if (TRAINING_DAY_TYPES.includes(x.type)) k = 'training';
    else if (['cardio', 'laufen', 'padel'].includes(x.type)) k = 'cardio';
    else if (['regeneration', 'mobility', 'reha'].includes(x.type)) k = 'regen';
    if (!k) continue;
    const cur = map.get(x.date);
    if (!cur || rank[k] > rank[cur]) map.set(x.date, k);
  }
  return map;
}

// Geschätztes 1RM (Epley) je Übung und Trainingstag aus allen Kraftsätzen
export function liftProgress(trainings) {
  const byEx = new Map();
  for (const x of trainings) {
    for (const p of x.parts || []) {
      if (p.format !== 'strength') continue;
      for (const s of p.sets || []) {
        const ex = s.exercise || p.exercise;
        const reps = Number(s.reps);
        const kg = Number(s.weightKg);
        if (!ex || !reps || !kg || reps > 12) continue;
        const est = reps === 1 ? kg : kg * (1 + reps / 30);
        if (!byEx.has(ex)) byEx.set(ex, new Map());
        const days = byEx.get(ex);
        const cur = days.get(x.date);
        if (!cur || est > cur.est) days.set(x.date, { date: x.date, est, reps, kg });
      }
    }
  }
  return [...byEx.entries()]
    .map(([name, days]) => {
      const pts = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
      const best = pts.reduce((m, p) => (p.est > m.est ? p : m), pts[0]);
      return { name, pts, best, last: pts[pts.length - 1] };
    })
    .sort((a, b) => b.last.date.localeCompare(a.last.date) || b.best.est - a.best.est);
}

/* ---------- SVG-Bausteine ---------- */

// Fortschrittsring für ein Wochenziel
export function ring(n, goal, label) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, n / goal);
  return `<div class="ring ${n >= goal ? 'done' : ''}">
    <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="ring-bg"/><circle cx="32" cy="32" r="${r}" class="ring-fg" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)"/></svg>
    <div class="ring-num">${n}<span>/${goal}</span></div>
    <div class="ring-lbl">${esc(label)}</div>
  </div>`;
}

// Kleine Säulen (z. B. Trainingstage je Woche), Ziel als Linie
export function miniBars(values, goal, { w = 120, h = 40, highlightLast = true } = {}) {
  const max = Math.max(goal, ...values, 1);
  const gap = 4;
  const bw = (w - gap * (values.length - 1)) / values.length;
  const y = (v) => h - (v / max) * h;
  const bars = values
    .map((v, i) => `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(h - y(v)).toFixed(1)}" rx="2" class="mb ${v >= goal ? 'mb-ok' : ''} ${highlightLast && i === values.length - 1 ? 'mb-cur' : ''}"/>`)
    .join('');
  return `<svg class="minibars" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${bars}<line x1="0" x2="${w}" y1="${y(goal).toFixed(1)}" y2="${y(goal).toFixed(1)}" class="mb-goal"/></svg>`;
}

// Linie über die Zeit, optional zweite Linie (z. B. Einzelwerte + Schnitt)
export function timeLine(points, { key = 'v', key2 = null, min, max, invert = false, w = 300, h = 90, dots = true, cls = '' } = {}) {
  if (points.length < 2) return '<p class="muted small">Ab zwei Werten siehst du hier einen Verlauf.</p>';
  const pad = 6;
  const t0 = t(points[0].date);
  const t1 = t(points[points.length - 1].date);
  const x = (d) => pad + ((t(d) - t0) / Math.max(1, t1 - t0)) * (w - 2 * pad);
  const y = (v) => {
    const r = (v - min) / Math.max(0.001, max - min);
    return pad + (invert ? r : 1 - r) * (h - 2 * pad);
  };
  const line = (k) => points.map((p) => `${x(p.date).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ');
  const pts = dots ? points.map((p) => `<circle cx="${x(p.date).toFixed(1)}" cy="${y(p[key]).toFixed(1)}" r="2.5" class="tl-dot ${p.cls || ''}"/>`).join('') : '';
  return `<svg class="tl ${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="Verlauf">
    ${key2 ? `<polyline points="${line(key)}" class="tl-raw"/><polyline points="${line(key2)}" class="tl-main"/>` : `<polyline points="${line(key)}" class="tl-main"/>`}${pts}</svg>`;
}

// Kalender der letzten Wochen (Mo–So), Zellen nach Art des Tages gefärbt
export function calendar(kinds, today, weeks = 6) {
  const start = addDaysISO(weekStartISO(today), -7 * (weeks - 1));
  const head = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => `<span class="cal-h">${d}</span>`).join('');
  let cells = '';
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDaysISO(start, i);
    const k = kinds.get(d);
    const future = d > today;
    cells += `<span class="cal-d ${k ? `cal-${k}` : ''} ${d === today ? 'cal-today' : ''} ${future ? 'cal-future' : ''}" title="${d}">${Number(d.slice(8))}</span>`;
  }
  return `<div class="cal">${head}${cells}</div>
  <div class="cal-legend"><span><i class="cal-training"></i>Training</span><span><i class="cal-cardio"></i>Cardio</span><span><i class="cal-regen"></i>Regeneration</span><span><i></i>Ruhetag</span></div>`;
}
