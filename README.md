# TrainingsApp – persönliches CrossFit-Trainingsbuch

Web-App (PWA) für iPhone und Laptop: Workouts eintragen, Personal Records automatisch erkennen, Verlauf und Benchmarks (Girls, Hero-WODs).

- **App:** https://aod-fi.github.io/trainingsapp/ (auf dem iPhone in Safari öffnen → Teilen → „Zum Home-Bildschirm“)
- **Daten:** liegen nicht hier, sondern im privaten Repo `Aod-fi/trainingsapp-daten` in `data/trainings.json`
- **Format der Daten:** siehe [DATENFORMAT.md](DATENFORMAT.md)

## Aufbau

Kein Build-Schritt, reines HTML/CSS/JavaScript (ES-Module).

| Datei | Inhalt |
| --- | --- |
| `index.html` | Grundgerüst, Tab-Leiste |
| `css/app.css` | Design (dunkel, Akzentfarbe Lime) |
| `js/app.js` | Ansichten: Start, Eintragen, Verlauf, PRs, Benchmarks, Einstellungen |
| `js/store.js` | Lokaler Speicher + Synchronisation mit GitHub |
| `js/github.js` | GitHub-Contents-API |
| `js/pr.js` | PR-Berechnung (1/2/3/5RM, Max-Wdh., Benchmarks Rx/Scaled) |
| `js/data.js` | Übungen und Benchmark-Definitionen |
| `sw.js` | Offline-Cache (bei Änderungen `VERSION` erhöhen) |

## Lokal starten

```
python3 -m http.server 8000
```
Dann http://localhost:8000 öffnen.

## Einrichtung GitHub-Sync

1. Fine-grained Token erstellen: https://github.com/settings/personal-access-tokens/new
   - Repository access: *Only select repositories* → `trainingsapp-daten`
   - Permissions: *Contents* → *Read and write*
2. In der App: Zahnrad → Token einfügen → „Speichern & testen“.
