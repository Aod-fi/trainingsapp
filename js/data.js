// Stammdaten: Übungen und Benchmark-WODs.
// Rx-Gewichte Männer/Frauen in kg. Bitte bei Abweichungen hier anpassen.

export const CATEGORIES = {
  warmup: 'Warm-up',
  skill: 'Skill',
  strength: 'Strength',
  wod: 'WOD',
  core: 'Core',
};

export const FORMATS = {
  strength: 'Kraft (Sätze)',
  fortime: 'For Time',
  amrap: 'AMRAP',
  emom: 'EMOM',
  maxreps: 'Max Wdh.',
  other: 'Freitext',
};

export const TRAINING_TYPES = {
  crossfit: { label: 'CrossFit', icon: '🏋️' },
  laufen: { label: 'Laufen', icon: '🏃' },
  padel: { label: 'Padel', icon: '🎾' },
  mobility: { label: 'Mobility', icon: '🧘' },
  sonstiges: { label: 'Sonstiges', icon: '✨' },
};

const ex = (name, cat) => ({ name, cat });

export const EXERCISES = [
  // Gewichtheben
  ex('Back Squat', 'Gewichtheben'),
  ex('Front Squat', 'Gewichtheben'),
  ex('Overhead Squat', 'Gewichtheben'),
  ex('Deadlift', 'Gewichtheben'),
  ex('Sumo Deadlift High Pull', 'Gewichtheben'),
  ex('Strict Press', 'Gewichtheben'),
  ex('Push Press', 'Gewichtheben'),
  ex('Push Jerk', 'Gewichtheben'),
  ex('Split Jerk', 'Gewichtheben'),
  ex('Bench Press', 'Gewichtheben'),
  ex('Clean', 'Gewichtheben'),
  ex('Power Clean', 'Gewichtheben'),
  ex('Hang Power Clean', 'Gewichtheben'),
  ex('Squat Clean', 'Gewichtheben'),
  ex('Clean & Jerk', 'Gewichtheben'),
  ex('Snatch', 'Gewichtheben'),
  ex('Power Snatch', 'Gewichtheben'),
  ex('Hang Squat Snatch', 'Gewichtheben'),
  ex('Squat Snatch', 'Gewichtheben'),
  ex('Muscle Snatch', 'Gewichtheben'),
  ex('Snatch Balance', 'Gewichtheben'),
  ex('Thruster', 'Gewichtheben'),
  ex('Wall Ball', 'Gewichtheben'),
  ex('Kettlebell Swing', 'Gewichtheben'),
  ex('Kettlebell Snatch', 'Gewichtheben'),
  ex('Dumbbell Snatch', 'Gewichtheben'),
  ex('Lunge', 'Gewichtheben'),
  // Turnen
  ex('Pull-up', 'Turnen'),
  ex('Strict Pull-up', 'Turnen'),
  ex('Chest-to-Bar Pull-up', 'Turnen'),
  ex('Bar Muscle-up', 'Turnen'),
  ex('Ring Muscle-up', 'Turnen'),
  ex('Toes-to-Bar', 'Turnen'),
  ex('Knees-to-Elbow', 'Turnen'),
  ex('Handstand Push-up', 'Turnen'),
  ex('Strict Handstand Push-up', 'Turnen'),
  ex('Handstand Walk', 'Turnen'),
  ex('Ring Dip', 'Turnen'),
  ex('Push-up', 'Turnen'),
  ex('Air Squat', 'Turnen'),
  ex('Pistol', 'Turnen'),
  ex('Burpee', 'Turnen'),
  ex('Burpee Box Jump', 'Turnen'),
  ex('Box Jump', 'Turnen'),
  ex('Sit-up', 'Turnen'),
  ex('GHD Sit-up', 'Turnen'),
  ex('Back Extension', 'Turnen'),
  ex('Rope Climb', 'Turnen'),
  ex('Plank', 'Turnen'),
  ex('Russian Twist', 'Turnen'),
  // Ausdauer
  ex('Double Under', 'Ausdauer'),
  ex('Single Under', 'Ausdauer'),
  ex('Run', 'Ausdauer'),
  ex('Row', 'Ausdauer'),
  ex('Ski Erg', 'Ausdauer'),
  ex('Assault Bike', 'Ausdauer'),
  ex('Bike Erg', 'Ausdauer'),
];

const mv = (exercise, reps, weightKg, extra = {}) => ({ exercise, reps, weightKg, ...extra });

export const BENCHMARKS = [
  { name: 'Fran', group: 'Girl', format: 'fortime', scheme: '21-15-9', movements: [mv('Thruster', '21-15-9', '43/29'), mv('Pull-up', '21-15-9')] },
  { name: 'Grace', group: 'Girl', format: 'fortime', movements: [mv('Clean & Jerk', '30', '61/43')] },
  { name: 'Isabel', group: 'Girl', format: 'fortime', movements: [mv('Snatch', '30', '61/43')] },
  { name: 'Diane', group: 'Girl', format: 'fortime', scheme: '21-15-9', movements: [mv('Deadlift', '21-15-9', '102/70'), mv('Handstand Push-up', '21-15-9')] },
  { name: 'Elizabeth', group: 'Girl', format: 'fortime', scheme: '21-15-9', movements: [mv('Clean', '21-15-9', '61/43'), mv('Ring Dip', '21-15-9')] },
  { name: 'Helen', group: 'Girl', format: 'fortime', rounds: 3, movements: [mv('Run', '400 m'), mv('Kettlebell Swing', '21', '24/16'), mv('Pull-up', '12')] },
  { name: 'Jackie', group: 'Girl', format: 'fortime', movements: [mv('Row', '1000 m'), mv('Thruster', '50', '20/15'), mv('Pull-up', '30')] },
  { name: 'Karen', group: 'Girl', format: 'fortime', movements: [mv('Wall Ball', '150', '9/6')] },
  { name: 'Annie', group: 'Girl', format: 'fortime', scheme: '50-40-30-20-10', movements: [mv('Double Under', '50-40-30-20-10'), mv('Sit-up', '50-40-30-20-10')] },
  { name: 'Nancy', group: 'Girl', format: 'fortime', rounds: 5, movements: [mv('Run', '400 m'), mv('Overhead Squat', '15', '43/29')] },
  { name: 'Kelly', group: 'Girl', format: 'fortime', rounds: 5, movements: [mv('Run', '400 m'), mv('Box Jump', '30', null, { note: '60/50 cm' }), mv('Wall Ball', '30', '9/6')] },
  { name: 'Amanda', group: 'Girl', format: 'fortime', scheme: '9-7-5', movements: [mv('Ring Muscle-up', '9-7-5'), mv('Squat Snatch', '9-7-5', '61/43')] },
  { name: 'Angie', group: 'Girl', format: 'fortime', movements: [mv('Pull-up', '100'), mv('Push-up', '100'), mv('Sit-up', '100'), mv('Air Squat', '100')] },
  { name: 'Cindy', group: 'Girl', format: 'amrap', durationMin: 20, movements: [mv('Pull-up', '5'), mv('Push-up', '10'), mv('Air Squat', '15')] },
  { name: 'Mary', group: 'Girl', format: 'amrap', durationMin: 20, movements: [mv('Handstand Push-up', '5'), mv('Pistol', '10'), mv('Pull-up', '15')] },
  { name: 'Murph', group: 'Hero', format: 'fortime', movements: [mv('Run', '1,6 km'), mv('Pull-up', '100'), mv('Push-up', '200'), mv('Air Squat', '300'), mv('Run', '1,6 km')], note: 'Weste 9/6 kg' },
  { name: 'DT', group: 'Hero', format: 'fortime', rounds: 5, movements: [mv('Deadlift', '12', '70/47'), mv('Hang Power Clean', '9', '70/47'), mv('Push Jerk', '6', '70/47')] },
  { name: 'JT', group: 'Hero', format: 'fortime', scheme: '21-15-9', movements: [mv('Handstand Push-up', '21-15-9'), mv('Ring Dip', '21-15-9'), mv('Push-up', '21-15-9')] },
  { name: 'Michael', group: 'Hero', format: 'fortime', rounds: 3, movements: [mv('Run', '800 m'), mv('Back Extension', '50'), mv('Sit-up', '50')] },
  { name: 'Nate', group: 'Hero', format: 'amrap', durationMin: 20, movements: [mv('Ring Muscle-up', '2'), mv('Handstand Push-up', '4'), mv('Kettlebell Swing', '8', '32/24')] },
];

export function findBenchmark(name) {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  return BENCHMARKS.find((b) => b.name.toLowerCase() === n) || null;
}
