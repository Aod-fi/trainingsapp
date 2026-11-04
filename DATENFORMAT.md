# Datenformat (`data/trainings.json` im Repo trainingsapp-daten)

Eine Datei mit allen Trainings. Claude trägt Trainings aus Whiteboard-Fotos direkt hier ein (`"source": "claude"`).

```json
{
  "version": 1,
  "trainings": [
    {
      "id": "eindeutig, z. B. c-2026-11-04-1",
      "date": "2026-11-04",
      "type": "crossfit | laufen | padel | mobility | sonstiges",
      "durationMin": 60,
      "notes": "Freitext",
      "source": "app | claude",
      "createdAt": "ISO-Zeitstempel",
      "updatedAt": "ISO-Zeitstempel (bei Änderung immer neu setzen, sonst wird sie beim Sync verworfen)",
      "deleted": false,
      "parts": [
        {
          "id": "…", "label": "A",
          "category": "warmup | skill | strength | wod | core",
          "format": "strength | fortime | amrap | emom | maxreps | other",
          "title": "nur bei format other",
          "exercise": "bei strength und maxreps, Namen wie in js/data.js",
          "scheme": "5-5-3-3 oder 21-15-9",
          "percent": 60,
          "sets": [{ "exercise": "Back Squat", "reps": 5, "weightKg": 90 }],
          "benchmark": "Jackie (Name exakt wie in js/data.js)",
          "rounds": 3, "durationMin": 12, "intervalMin": 2, "timeCapMin": 12,
          "movements": [{ "exercise": "Thruster", "reps": "50", "weightKg": 15, "note": "" }],
          "result": { "timeSec": 615, "capped": false, "rounds": 14, "reps": 5, "text": "" },
          "rx": false,
          "text": "Originaltext vom Whiteboard"
        }
      ]
    }
  ]
}
```

PRs werden nie gespeichert, die App berechnet sie aus `sets` (Kraft), `result.reps` (Max-Wdh.) und Benchmark-Ergebnissen.
