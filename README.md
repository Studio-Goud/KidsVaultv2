# Bramblewood

Bramblewood is a small world of games for children, built as one codebase. No advertising, no
third-party tracking, no account. Every game practises something real and ends properly: a session
has a beginning and an end, with no endless loop and no daily reward pulling anyone back.

English is the first language; Dutch is included.

## The games

### Cloudhopper (`index.html`)
Draw a route with your finger from every incoming aircraft to the runway. Aircraft must not touch:
within 60 m is a near miss, within 10 m a collision. Six islands rising in difficulty, plus twelve
real-world airports, with weather, multiple runways, seaplanes and helicopters. After a failed
mission you get a replay and an analysis of what went wrong.
Practises dividing attention, planning ahead, holding back and spatial reasoning. Age 6 and up.

### Night Watch (`nightwatch.html`)
The sky shows a figure in the stars, the lines fade, and you draw it back from memory. Six figures a
session, each with more lines, more look-alike stars and less time to look.
Practises visual working memory. Age 5 and up.

## Stack
- Vite + TypeScript, Canvas 2D (every graphic drawn procedurally, no image assets)
- Capacitor 7 for the native iOS and Android shell
- PWA manifest, so it installs straight from the browser too

## Developing
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/
```

## Android (Android Studio nodig)
```bash
npm run cap:android   # bouwt web, synct naar android/ en opent Android Studio
```
Daarna in Android Studio: Build > Generate Signed Bundle voor de Play Store.

## iOS (Mac met Xcode nodig)
```bash
npm run cap:ios       # bouwt web, synct naar ios/ en opent Xcode
```
Op de Mac eerst eenmalig `cd ios/App && pod install`. Daarna in Xcode: signing team kiezen, archiveren, uploaden naar TestFlight.

## Iconen
`npm run icons` genereert PWA-iconen en Android launcher icons uit een SVG (scripts/icons.mjs).
Voor iOS: `public/icons/icon-1024.png` in Xcode slepen naar Assets > AppIcon.

## Structuur
- `src/game/` simulatie: vliegtuigen (echte types), levels, wind, botsingen, post-mortem analyse
- `src/render/` terrein, decor, vliegtuigtekeningen, effecten, HUD
- `src/ui/` DOM-schermen en de herhaling
