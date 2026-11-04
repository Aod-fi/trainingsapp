// PRs werden nie gespeichert, sondern immer aus den Trainings berechnet.
import { fmtTime, fmtKg } from './util.js';

export const RM_REPS = [1, 2, 3, 5];

function amrapScore(r) {
  return (r.rounds || 0) * 1000 + (r.reps || 0);
}

// Liefert alle messbaren Ergebnisse eines Trainings als Einträge {key, ...}
export function entriesOf(t) {
  const out = [];
  if (t.type !== 'crossfit') return out;
  for (const p of t.parts || []) {
    if (p.format === 'strength') {
      for (const s of p.sets || []) {
        if (s.exercise && s.reps && s.weightKg) {
          out.push({
            key: `lift|${s.exercise}|${s.reps}`,
            kind: 'lift',
            name: s.exercise,
            reps: Number(s.reps),
            value: Number(s.weightKg),
            higherBetter: true,
          });
        }
      }
    }
    const r = p.result || {};
    if (p.format === 'maxreps' && p.exercise && r.reps) {
      out.push({ key: `max|${p.exercise}`, kind: 'max', name: p.exercise, value: Number(r.reps), higherBetter: true });
    }
    if (p.benchmark) {
      const div = p.rx === false ? 'scaled' : 'rx';
      if (p.format === 'fortime' && r.timeSec && !r.capped) {
        out.push({ key: `bench|${p.benchmark}|${div}`, kind: 'bench', name: p.benchmark, div, format: 'fortime', value: r.timeSec, higherBetter: false });
      }
      if (p.format === 'amrap' && (r.rounds || r.reps)) {
        out.push({ key: `bench|${p.benchmark}|${div}`, kind: 'bench', name: p.benchmark, div, format: 'amrap', value: amrapScore(r), rounds: r.rounds || 0, reps: r.reps || 0, higherBetter: true });
      }
    }
  }
  // pro Training nur das beste Ergebnis je Key
  const best = new Map();
  for (const e of out) {
    const cur = best.get(e.key);
    if (!cur || (e.higherBetter ? e.value > cur.value : e.value < cur.value)) best.set(e.key, e);
  }
  return [...best.values()].map((e) => ({ ...e, trainingId: t.id, date: t.date }));
}

// Baut für jeden Key die Historie und markiert PR-Ereignisse chronologisch.
export function computeRecords(trainings) {
  const chrono = [...trainings].sort((a, b) => (a.date + (a.createdAt || '')).localeCompare(b.date + (b.createdAt || '')));
  const records = new Map();
  for (const t of chrono) {
    for (const e of entriesOf(t)) {
      let rec = records.get(e.key);
      if (!rec) {
        rec = { key: e.key, kind: e.kind, name: e.name, reps: e.reps, div: e.div, format: e.format, higherBetter: e.higherBetter, history: [], best: null };
        records.set(e.key, rec);
      }
      const isPR = !rec.best || (e.higherBetter ? e.value > rec.best.value : e.value < rec.best.value);
      const point = { ...e, isPR };
      rec.history.push(point);
      if (isPR) rec.best = point;
    }
  }
  return records;
}

export function prsOfTraining(records, trainingId) {
  const out = [];
  for (const rec of records.values()) {
    const p = rec.history.find((h) => h.trainingId === trainingId && h.isPR);
    // erster Eintrag überhaupt zählt nicht als "neuer PR" außer es gibt Vorgänger
    if (p && rec.history.indexOf(p) > 0) out.push({ rec, point: p });
  }
  return out;
}

export function fmtValue(rec, point = rec.best) {
  if (!point) return '';
  if (rec.kind === 'lift') return fmtKg(point.value);
  if (rec.kind === 'max') return `${point.value} Wdh.`;
  if (rec.format === 'fortime') return fmtTime(point.value);
  return `${point.rounds} Rd. + ${point.reps}`;
}

export function recTitle(rec) {
  if (rec.kind === 'lift') return `${rec.name} · ${rec.reps}RM`;
  if (rec.kind === 'max') return `${rec.name} · Max`;
  return `${rec.name}${rec.div === 'scaled' ? ' · Scaled' : ''}`;
}

// Bestes bekanntes 1RM (echt) oder Schätzung nach Epley aus allen Kraftsätzen
export function oneRepMax(records, exercise) {
  const real = records.get(`lift|${exercise}|1`);
  let est = null;
  for (const rec of records.values()) {
    if (rec.kind !== 'lift' || rec.name !== exercise || !rec.best) continue;
    const e = rec.reps === 1 ? rec.best.value : rec.best.value * (1 + rec.reps / 30);
    if (!est || e > est) est = e;
  }
  if (real && real.best && real.best.value >= (est || 0)) return { value: real.best.value, estimated: false };
  return est ? { value: est, estimated: true } : null;
}
