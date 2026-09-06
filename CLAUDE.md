# BS Spieleparadies

Private, werbefreie Spielesammlung für zwei Personen. Wird fast ausschließlich
auf dem Handy gespielt, oft nebenbei und mit einer Hand.

## Rahmen

Diese Punkte sind gesetzt. Wenn eine Aufgabe dagegen läuft, erst nachfragen.

- **Handy zuerst.** Jede Oberfläche wird für Touch auf einem schmalen Display
  entworfen. Desktop darf funktionieren, ist aber nie der Maßstab.
- **Keine Werbung, kein Tracking, keine Analytics.** Auch nicht "nur zum Testen".
- **Kostenlos hostbar.** Alles muss im kostenlosen Tarif von Cloudflare Pages
  und D1 laufen. Keine Dienste, die eine Kreditkarte oder ein Abo verlangen.
- **Wenige Abhängigkeiten.** Spiele werden selbst gebaut, nicht eingebunden.
  Eine neue Laufzeit-Abhängigkeit braucht einen Grund, der im Commit steht.
  Für Dinge wie Zustandsverwaltung, Routing oder UI-Bibliotheken gilt: nein.
- **Bestehende Spielstände bleiben lesbar.** Ändert sich das Format eines
  Spielstands, muss der alte Stand weiterhin sinnvoll geladen werden können.
  Niemand soll seine Serie verlieren, weil wir etwas umgebaut haben.

## Technik

| Teil      | Womit                                             |
| --------- | ------------------------------------------------- |
| Frontend  | React 18 + TypeScript, gebaut mit Vite            |
| Backend   | Cloudflare Pages Functions unter `functions/api/` |
| Datenbank | Cloudflare D1 (SQLite)                            |

```bash
npm run dev        # Frontend; /api geht per Proxy an Wrangler auf Port 8788
npm run preview    # Wrangler mit Functions und lokaler D1
npm run typecheck  # prüft Frontend und Functions getrennt
npm run build
```

Voraussetzung ist **Node 22 oder neuer**: Wrangler verlangt >= 22, Vite >= 20.19.

`npm run typecheck` läuft über zwei getrennte Projekte: `tsconfig.json` für
`src/` mit DOM-Typen, `functions/tsconfig.json` für das Backend mit den
Workers-Typen. Beide zusammen in einem Projekt kollidieren bei `Request` und
`Response` – die Trennung bitte nicht zusammenführen.

## Konventionen

- **Sichtbare Texte und Kommentare auf Deutsch**, Bezeichner im Code auf
  Englisch (`function evaluate`, `const guesses`). So liest sich die
  Oberfläche natürlich, ohne dass der Code zum Mischmasch wird.
- Kommentare erklären das *Warum*, nicht das *Was*. Wenn eine Zeile nur
  wiederholt, was daneben steht, gehört sie weg.
- Kein CSS-Framework. Styling läuft über `src/styles.css` mit den dort oben
  definierten Variablen. Neue Farben werden dort ergänzt, nicht inline gesetzt.
- Touch-Ziele mindestens 44 px hoch. Eingabefelder mindestens 16 px Schriftgröße,
  sonst zoomt iOS beim Fokussieren hinein.
- Layouts benutzen `dvh` statt `vh` und berücksichtigen `env(safe-area-inset-*)`.

## Anmeldung und Profile

Es gibt **ein gemeinsames Passwort** für die ganze Seite (`SITE_PASSWORD`).
Nach dem Login setzt `functions/lib/auth.ts` ein signiertes HttpOnly-Cookie.

Die Profile dahinter sind **reine Namensschilder, kein Sicherheitsmerkmal**.
Wer die Seite offen hat, kann jedes Profil auswählen und dessen Spielstände
ändern. Das ist so gewollt. Also: keine Funktion bauen, die sich darauf
verlässt, dass ein Profil "dem richtigen Menschen gehört" – kein Passwortschutz
pro Profil, keine privaten Inhalte, keine Zugriffsprüfung anhand des Profils.

## Ein Spiel hinzufügen

1. Ordner `src/games/<name>/` mit einer Komponente, die `GameProps`
   (`user`, `onExit`) entgegennimmt.
2. Spiellogik in eine eigene Datei ohne React (siehe `wordle/logic.ts`), damit
   sie für sich prüfbar bleibt.
3. Spielstand über `useGameSave(user.id, '<spiel-id>', startwert)`. Der Hook
   verzögert das Schreiben und schreibt erst, nachdem er geladen hat – ein
   leerer Startzustand darf nie einen echten Stand überschreiben.
4. Eintrag in `src/games/registry.ts`. Launchpad und Routing lesen von dort;
   sonst muss nichts angefasst werden.

Die Spiel-ID ist der Schlüssel in der Datenbank. Einmal veröffentlicht, wird
sie nicht mehr umbenannt.

## Datenbank

Schema steht in `schema.sql` und ist idempotent (`CREATE TABLE IF NOT EXISTS`).
Änderungen werden dort ergänzt und mit `npm run db:local` sowie `npm run db:remote`
eingespielt. Es gibt kein Migrationswerkzeug – Spalten also nur hinzufügen,
nicht umbenennen oder entfernen.

## Nicht ins Repo

`.dev.vars`, echte Passwörter, `SESSION_SECRET`. Secrets für die
veröffentlichte Seite gehören zu `wrangler pages secret put`.

## Stand der Dinge

- Fertig: Login, Profile, Launchpad, Spielstände, Wörtchen (deutsches Wordle).
- Es gibt noch **keine Tests** und kein Testframework. Wird eins gebraucht,
  vorher kurz abstimmen.
- Die Wortlisten in `src/games/wordle/*.json` sind erzeugt, nicht handgepflegt.
  Neu bauen mit `npm run words`, nicht direkt bearbeiten.
