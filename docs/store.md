# Suri in Google Play

Status: klaar om te uploaden, op één beslissing en drie handelingen na die alleen de eigenaar kan
doen (zie "Wat nog van jou is"). Het pakket bouwt, ondertekend, en is hier uit elkaar gehaald om te
zien wat erin zit. De teksten, de banner en de schermafbeeldingen liggen klaar. Het heeft nog op geen
echte telefoon gedraaid.

## Wat er klaarligt

| Wat | Waar |
|---|---|
| App-ID `com.studiogoud.suri`, naam Suri | `android/app/build.gradle`, `strings.xml`, `capacitor.config.ts` |
| Versie: naam uit `package.json` (1.0.0), nummer per build | `android/app/build.gradle` |
| Doel-API 36 (Android 16), minimaal API 23 (Android 6) | `android/variables.gradle` |
| Geen back-up van het toestel naar de cloud (`allowBackup=false`): regel 1 | `AndroidManifest.xml` |
| Opstartscherm met Suri in plaats van het Capacitor-logo | `scripts/icons.mjs`, `values/styles.xml` |
| Ondertekenen met de uploadsleutel, zonder dat die in de repo staat | `android/app/build.gradle` |
| Automatische build van het .aab | `.github/workflows/android.yml` |
| Privacyverklaring, NL en EN | `privacy.html`, live op `https://kids-vaultv2.vercel.app/privacy.html` |
| Winkelteksten, formulierantwoorden | dit bestand |
| Schermafbeeldingen en bannerafbeelding | `docs/store/` |

### Waarom deze keuzes

**Het app-ID.** Het Android-project heette nog `nl.studiogoud.wolkenhaven` en de app "Cloudhopper",
van voor Suri Suri heette; `capacitor.config.ts` zei al `com.studiogoud.suri`. Een app-ID staat na
de eerste upload voor altijd vast, dus dit was het laatste moment om ze gelijk te trekken. iOS is
meegegaan, zodat beide winkels dezelfde naam kennen.

**API 36.** Google Play neemt sinds 31 augustus 2026 alleen nieuwe apps aan die op Android 16 (API
36) mikken. Het project stond op 35. De build is met 36 gedaan en slaagt; Capacitor 7 zegt officieel
35, dus dit is een stap voor Capacitor uit, en precies het soort ding dat op een echte telefoon moet
worden nagekeken.

**Rand tot rand.** Vanaf Android 15 tekent een app onder de statusbalk en de navigatiebalk door. Of
de WebView die balken dan doorgeeft aan `env(safe-area-inset-*)` hangt af van zijn versie. Capacitor
houdt de pagina daarom zelf vrij van de balken (`adjustMarginsForEdgeToEdge: 'auto'`); `safeArea()`
ziet dan nul en er komt niets onder een balk. De prijs is een smalle band in de achtergrondkleur
boven en onder, en dat is een betere fout dan een knop onder de klok.

**Het versienummer.** Play weigert een upload waarvan het nummer al eens gezien is. De Action geeft
elke build `100 + runnummer`, dat alleen maar oploopt. Met de hand bouwen: `-PversionCode=…`.

**De grootte.** Het pakket is ongeveer 113 MB, waarvan 114 MB onverpakt de stem (12.147 opnamen van
Ruth, NL en EN) en 13 MB de geluiden. Dat past ruim onder de grens van Play (200 MB per download) en
het is de prijs van rule 1: niets wordt achteraf opgehaald.

## Wat nog van jou is

### 1. De beslissing: hoe er betaald wordt

Het afrekenen is niet gebouwd (`src/parents/main.ts` zegt dat ook, eerlijk, in de app). Voor de
eerste versie in Play zijn er drie wegen:

1. **Eerst een gesloten test.** Gratis, een lijst met e-mailadressen van testers. Kost niets aan code
   en is sowieso verplicht: een nieuw persoonlijk ontwikkelaarsaccount moet eerst twaalf testers
   veertien dagen laten testen voordat een app openbaar mag. **Mijn advies: begin hier.**
2. **Een betaalde app, eenmalig.** Stel een prijs in in de Play Console, geen regel code. Past niet
   bij €3,99 per maand, maar wel bij "niets te koop in de app".
3. **Het abonnement van €3,99 per maand** via Google Play Billing. Dat vraagt een native plug-in (een
   tweede runtime-afhankelijkheid), een scherm voor ouders achter de code, en een proefperiode. Een
   eigen klus, die pas zin heeft na de test.

### 2. Het ontwikkelaarsaccount

Op <https://play.google.com/console>: eenmalig $25, identiteitsbewijs, en een e-mailadres dat in de
winkel komt te staan. De privacyverklaring verwijst voor vragen naar dat adres, zodat er geen
persoonlijk adres in de repo hoeft.

### 3. De uploadsleutel maken en aan GitHub geven

Eén keer, op je eigen computer (Java moet erop staan):

```
keytool -genkeypair -v -keystore suri-upload.jks -alias suri -keyalg RSA -keysize 2048 -validity 10000
```

Bewaar `suri-upload.jks` en het wachtwoord op een plek die je niet kwijtraakt. Play App Signing
bewaart de echte sleutel bij Google; deze uploadsleutel kan bij verlies opnieuw worden aangevraagd,
maar dat kost dagen.

Dan in GitHub, bij de repository onder *Settings → Secrets and variables → Actions*, vier geheimen:

| Naam | Inhoud |
|---|---|
| `SURI_KEYSTORE_BASE64` | de uitvoer van `base64 -w0 suri-upload.jks` (macOS: `base64 -i suri-upload.jks`) |
| `SURI_KEYSTORE_PASSWORD` | het wachtwoord van de keystore |
| `SURI_KEY_ALIAS` | `suri` |
| `SURI_KEY_PASSWORD` | het wachtwoord van de sleutel (meestal hetzelfde) |

### 4. Bouwen en uploaden

GitHub → *Actions* → *Android bundle* → *Run workflow*. Na een minuut of zes staat onder de run een
bestand `suri-<nummer>` met daarin `app-release.aab`. Dat upload je in de Play Console bij
*Testen → Gesloten testen → Nieuwe release*. Een tag als `v1.0.1` pushen start dezelfde build.

Zelf bouwen kan ook: `npm run cap:sync`, dan in `android/` `./gradlew bundleRelease`, met een
`android/keystore.properties` ernaast (staat in `.gitignore`):

```
storeFile=/pad/naar/suri-upload.jks
storePassword=…
keyAlias=suri
keyPassword=…
```

## De winkelpagina

Limieten van Play: naam 30 tekens, korte beschrijving 80, volledige beschrijving 4000. Alles
hieronder past en is geteld. Geen "leert", geen "pedagogisch goedgekeurd" (CLAUDE.md, regels 3 en 4).

### Nederlands (standaardtaal)

**Naam:** Suri: spelen en ontdekken

**Korte beschrijving:** Spellen, reizen en verhalen voor 2 tot 8 jaar. Geen reclame, geen tracking.

**Volledige beschrijving:**

> Suri is een stokstaartje, en hij is de hele app. Hij zegt alles hardop, zodat een kind dat nog niet
> leest overal zelf de weg vindt, en hij herhaalt het zo vaak als je vraagt.
>
> Er zitten zesentwintig dingen in, voor kinderen van twee tot acht:
>
> Spellen die iets echts oefenen: tellen en eerlijk delen op de markt, klokkijken, woorden bouwen uit
> hun klanken, een dinosaurus opgraven, een stroomkring leggen, sterrenbeelden onthouden, water naar
> de molen leiden, een raket bouwen die echt moet vliegen, en de hele wereld op de kaart.
>
> Ontdekreizen die je meenemen: van de zon tot de rand van het zonnestelsel, van de golven tot de
> diepste plek van de zee, terug naar de tijd van de dino's, en van je kruin tot je tenen.
>
> Verhalen waarin je zelf meedoet: Suri vindt een reuzentand, ziet een lichtje in de diepte, gaat een
> verloren satelliet halen en krijgt buikpijn. En Van cel tot mens: het hele verhaal van het leven,
> van de allereerste cel tot jou, met een spel waarin jij zelf de natuurlijke selectie doet.
>
> Wat we beloven:
> • Geen reclame en niets te koop in de app.
> • Geen account, geen tracking. Wat je kind doet blijft op dit apparaat.
> • Geen reeksen, geen dagelijkse beloningen, geen muntjes. Elk spel heeft een laatste ronde.
> • Voor ouders, achter een code: een tijdslimiet per kind, en wat elk ding oefent.
> • Nederlands en Engels, ingesproken.
> • We zeggen wat we niet weten. Waar een getal van ons komt en niet uit onderzoek, staat dat erbij.
>
> Suri werkt zonder internet. Alleen een deel van de foto's (dieren, fossielen) komt van Wikimedia
> Commons en verschijnt als er verbinding is.

### English

**Name:** Suri: play and discover

**Short description:** Games, journeys and stories for ages 2 to 8. No ads, no tracking.

**Full description:**

> Suri is a meerkat, and he is the whole app. He says everything out loud, so a child who cannot read
> yet finds their own way everywhere, and he says it again as often as they ask.
>
> There are twenty-six things inside, for children from two to eight:
>
> Games that practise something real: counting out and sharing fairly at the market, telling the
> time, building words from their sounds, digging up a dinosaur, wiring a circuit, remembering star
> figures, bringing water to the mill, building a rocket that really has to fly, and the whole world
> on the map.
>
> Journeys that take you along: from the sun to the edge of the solar system, from the waves to the
> deepest place in the sea, back to the time of the dinosaurs, and from the top of your head to your
> toes.
>
> Stories you take part in: Suri finds a giant tooth, sees a light in the deep, goes to fetch a lost
> satellite and gets a tummy ache. And From cell to human: the whole story of life, from the very
> first cell to you, with a game in which you do the natural selection yourself.
>
> What we promise:
> • No advertising and nothing to buy inside the app.
> • No account, no tracking. What your child does stays on this device.
> • No streaks, no daily rewards, no coins. Every game has a last round.
> • For parents, behind a code: a time limit per child, and what each thing practises.
> • Dutch and English, spoken.
> • We say what we do not know. Where a number is ours and not research, it says so.
>
> Suri works without the internet. Only some of the photographs (animals, fossils) come from
> Wikimedia Commons and appear when there is a connection.

### Afbeeldingen

In `docs/store/`, gemaakt uit de echte app in een browser, in het Nederlands (niet nagetekend):

- `icon-512.png`: het app-icoon, 512 × 512 (hetzelfde als `public/icons/icon-512.png`).
- `feature-graphic.png`: de banner, 1024 × 500: Suri, de naam, één regel, en drie van de
  schermafbeeldingen hieronder.
- `phone-*.png`: acht schermafbeeldingen, liggend, 1920 × 1080, in deze volgorde: de voorpagina,
  de ringen van Saturnus, de bacteriën in de darm, de hengelaarsvis, de splitsing naar de
  chimpansees, de maanlander, de witte bloedcellen, de triceratops.
- `tablet-*.png`: vier schermafbeeldingen, 2048 × 1536, voor tablets.

Ze zijn gemaakt met een script in de kladruimte dat elk verhaal naar het goede moment stuurt via de
debug-handvatten (`__satelliet`, `__buikpijn`, …). Verandert een scherm, maak ze dan opnieuw; een
schermafbeelding die niet meer klopt met de app is precies wat Play afkeurt.

## De formulieren in de Play Console

Wat hieronder staat volgt uit de code, niet uit hoop. Klopt de code niet meer, dan klopt dit ook
niet meer.

**Categorie:** Onderwijs. **Tags:** Kinderen, Educatief.

**Doelgroep en inhoud:** leeftijden *5 en jonger*, *6 tot 8* en *9 tot 12* (Play kent geen groep die
bij tien stopt). Daarmee valt Suri onder het Families-beleid: geen reclame-SDK's, geen
advertentie-ID, geen locatie, en elke SDK moet op Google's lijst voor gezinnen staan. Suri heeft
alleen Capacitor en de haptics-plug-in, geen van beide verzamelt iets.

**Gegevensveiligheid (Data safety):**
- Verzamelt of deelt de app gebruikersgegevens? **Nee.** De voortgang staat in `localStorage` op het
  apparaat en gaat nergens heen (`src/util/storage.ts`).
- De foto-aanvragen aan Wikimedia sturen geen gegevens over de gebruiker mee; het IP-adres dat elke
  internetverbinding meestuurt telt voor Play niet als verzamelen door de app.
- Versleuteld onderweg: ja (alleen https). Gegevens verwijderen: niet van toepassing, er is niets.

**Inhoudsclassificatie (IARC):** geen geweld, geen angstaanjagende inhoud, geen seks, geen taal,
geen gokken, geen gebruikers die met elkaar praten, geen aankopen, geen locatie delen. Verwachte
uitkomst: PEGI 3. (De inslag van de meteoriet en de bacterie in het lichaam zijn getekend en rustig
verteld; vul bij "angstaanjagend" *nee* in, maar kijk ze zelf even na.)

**Advertenties:** nee. **App-toegang:** alles is zonder inlog bereikbaar; de ouderomgeving vraagt
een zelfgekozen code, die bij de eerste keer wordt ingesteld.

**Rechten die de app vraagt:** internet (de foto's) en trillen (de knoppen). Geen andere.

## Wat nog niet klopt

- Het pakket heeft op geen echte telefoon gedraaid. Er is hier geen emulator. Eerste keer openen op
  een Android-telefoon: kijk naar het opstartscherm, of er iets onder de statusbalk valt, of het
  geluid speelt en of het trillen werkt.
- Het abonnement is niet gebouwd (zie boven).
- iOS: het app-ID is meegegaan, verder niets. De App Store heeft een eigen rondje nodig.
