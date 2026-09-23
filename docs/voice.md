# De stem

Besluit van 2026-09-22. De eigenaar liet de keuze aan mij, met de aantekening dat er open-source
stemmen bestaan. Dit is wat ik kies en waarom, zodat het terug te draaien is.

## Het probleem, in één getal

Veertien van de zestien ervaringen leggen zichzelf uit in geschreven zinnen. De doelgroep begint
bij twee jaar. Dat is niet één ontbrekende functie, het is de duurste post van het hele project:
elke uitleg, elke hint, elke foutmelding en elke niveaunaam in zestien spellen, in twee talen.

Ruw geteld gaat het om **enkele honderden zinnen**. De vraag is niet óf het gesproken moet worden,
maar wat een zin mag kosten.

## Drie manieren, en waarom het er drie blijven

| | Kosten per zin | Kwaliteit | Offline | Nu beschikbaar |
|---|---|---|---|---|
| **1. De stem van het toestel** (`speechSynthesis`) | nul | vlak, verschilt per toestel, soms afwezig | ja, op iOS en de meeste Android | ja |
| **2. Vooraf gerenderde clips** (open-source model, op de bouwmachine) | eenmalig rekenwerk | goed en overal gelijk | ja | na opzet |
| **3. Een mens met een microfoon** | hoog | het warmst | ja | na opnamedag |

De verleiding is om er één te kiezen. Dat is de fout: ze horen bij verschillende soorten zinnen.

- Een **foutmelding in Stroomkring** wordt door een kind misschien twintig keer gehoord in zijn
  hele leven. Die is de stem van het toestel waard, niet meer.
- **"Tik op een raket"** hoort een kind elke keer dat het Moonshot opent. Die verdient een clip.
- **De gids** hoort een kind elke dag, en die is het gezicht van het product. Die verdient een mens.

## Wat ik heb gebouwd

`src/platform/voice.ts` zoekt eerst een opname en valt anders terug op het toestel:

```ts
say('moonshot.tapARocket', 'Tik op een raket, of sleep zelf onderdelen omhoog.')
```

Het eerste argument is de naam van de regel, het tweede is wat er gezegd moet worden als niemand
hem heeft ingesproken. Een regel klimt van 1 naar 2 naar 3 door een bestand in `public/voice/` te
zetten en een rij aan `public/voice/clips.json` toe te voegen. **Geen enkel spel verandert
daarvoor.** Vandaag is dat bestand leeg en praat alles met de stem van het toestel; dat is genoeg
om alle zestien spellen nú om te bouwen zonder op een opnamedag te wachten.

`recorded()` geeft terug hoeveel regels er echt zijn ingesproken, zodat de voortgang een getal is
en geen gevoel.

## Waarom niet een open-source model óp de telefoon

De eigenaar noemde open-source stemmen, en dat is een goede aanwijzing — maar de plek waar ze
draaien maakt het verschil:

- **Op het toestel**: een neuraal stemmodel is tientallen megabytes en vraagt rekenkracht. Op een
  oude telefoon van een gezin dat €3,99 per maand afweegt, is dat precies het verkeerde compromis.
  En het maakt de app-download veel groter.
- **Op de bouwmachine**: hetzelfde model, één keer gedraaid, levert een audiobestand van enkele
  kilobytes per zin. Gelijke kwaliteit op elk toestel, geen rekenkracht, geen download van een
  model, en offline. Dit is optie 2 hierboven en het is duidelijk de betere plek.

Dus: ja op open-source stemmen, nee op open-source stemmen die op de telefoon draaien.

## Wat nog niet vastligt

- **Welk model** voor optie 2. Piper is de voor de hand liggende kandidaat vanwege de Nederlandse
  stemmen en de licentie, maar ik heb de kwaliteit van de Nederlandse stemmen niet zelf beoordeeld
  en zeg daar dus niets over. Te toetsen vóór er honderden zinnen mee gerenderd worden.
- **Of een gerenderde stem en een mensenstem naast elkaar kunnen** zonder dat het rommelig klinkt.
  Mijn vermoeden is van niet, en dat de gids dan alles moet inspreken wat een kind vaak hoort.
  Te horen, niet te beredeneren.
- **Vlaams of Nederlands** als de app ook naar Vlaanderen gaat (open punt 6 uit `research.md`).

## 2026-09-23 — "Elke gesproken tekst is nu zo'n AI-robot"

De eigenaar wil een zo natuurlijk mogelijke vrouwenstem. Twee dingen zijn gedaan, en één niet.

**Gedaan: het toestel kiest nu zijn beste vrouwenstem.** Tot nu toe nam `voice.ts` de eerste
Nederlandse stem die op het toestel stond. Op een Linux-machine is dat eSpeak, en op andere
toestellen vaak een mannenstem of een compacte versie terwijl er een betere naast staat.
`voiceScore()` rangschikt nu op naam: Claire, Ellen, Fenna, Colette, Dena en "Google Nederlands"
omhoog, Xander, Maarten, Arnaud en Frank omlaag, "Enhanced", "Premium" en "Natural" omhoog, eSpeak
en "compact" helemaal onderaan. De toonhoogte wordt niet meer opgeschroefd; dat maakte elke stem
kunstmatiger in plaats van jonger.

Een stem die op het toestel draait wint altijd van een betere via het netwerk, want een
netwerkstem stuurt de zin naar iemands server. Dat was al zo en het blijft zo. Het betekent wel dat
de mooiste stemmen die een browser kent (Edge's "Natural" stemmen, Chrome's "Google Nederlands")
alleen worden gebruikt als er op het toestel helemaal niets Nederlands staat.

Op een iPhone helpt het de ouder als die in Instellingen → Toegankelijkheid → Gesproken materiaal
→ Stemmen de verbeterde versie van Claire downloadt. Dat is niet iets wat de app kan doen.

**Niet gedaan: het echt oplossen.** Hoe goed een toestelstem ook gekozen wordt, het blijft een
toestelstem, en die verschilt per telefoon. Een natuurlijke stem die op elk toestel hetzelfde
klinkt betekent optie 2 uit de tabel hierboven: elke zin één keer renderen op de bouwmachine en als
audiobestand meeleveren. De code kan dat al. Wat open staat is waarmee:

- **Een commerciële neurale stem** (ElevenLabs, Azure, Google): het natuurlijkst dat er te koop is,
  kost geld per teken en een account van de eigenaar. De tekst gaat één keer naar die dienst, op
  de bouwmachine; er gaat niets over een kind heen en op de telefoon gebeurt niets via het netwerk.
- **Een open-source model** (Piper en verwanten): gratis en volledig eigen, maar voor zover ik weet
  minder natuurlijk dan de commerciële stemmen. Dat heb ik niet zelf beluisterd.
- **Een mens**: het warmst, en het duurst om te veranderen.

Eén complicatie voor elke keuze: niet elke zin ligt vast. Rekenrijk zegt "acht plus vijf is
dertien", Klokkijken zegt tijden, en die zinnen worden samengesteld. Die moeten ofwel in stukjes
worden gerenderd en aan elkaar gezet, of op de toestelstem blijven.

## 2026-09-23 — ElevenLabs, via een script op de bouwmachine

De eigenaar heeft een ElevenLabs-account met tegoed en koos daarvoor. `scripts/voice.mjs` doet het
hele traject: het leest alle Nederlandse zinnen uit de broncode (735 op dit moment, 39.304 tekens),
laat ze één keer inspreken, zet de mp3's in `public/voice/nl/` en schrijft `clips.json`. De app
zoekt een opname op de woorden zelf (`lineKey()` in `src/platform/voicekey.ts`), dus geen enkel
spel hoefde te veranderen. Een zin die van woorden verandert valt terug op de toestelstem tot het
script opnieuw draait; een andere stem of ander model laat het alles opnieuw doen.

De sleutel staat als `ELEVENLABS_API_KEY` in de omgeving en nergens in de repo. Zinnen die pas
tijdens het spelen worden samengesteld (sommen, tijden, dierennamen) blijven op de toestelstem.

## 2026-09-23 — Ruth

De eigenaar koos na een proef met vier Nederlandse stemmen uit de ElevenLabs-bibliotheek (Ruth
als kinderverteller, Roos, Emma, Melanie) voor **Ruth, "Friendly Children's Storyteller"**
(`yO6w2xlECAQRFP6pX7Hw`, model `eleven_multilingual_v2`). Alle 1354 Nederlandse regels die het
script in de broncode vindt zijn met haar ingesproken, samen ongeveer 47.000 tekens en 13 MB aan
bestanden.

`npm run voicecheck` opent elke pagina als twee- en als zesjarige en zegt per gesproken regel of
hij van Ruth komt of van de telefoon. De eerste keer waren dat 40 tegen 17, om drie redenen, en
alle drie zijn opgelost:

1. **De openingszin kwam te vroeg.** Een spel zegt zijn eerste regel voordat `clips.json` binnen
   is. Een regel wacht nu maximaal anderhalve seconde op de lijst, en alleen als er intussen niets
   nieuws gevraagd is.
2. **Korte regels waren overgeslagen** ("Zoeken", "Kijk goed", titels), omdat ik dacht dat die
   alleen gelezen worden. Het Dierenboek en de Nachtwacht zeggen ze hardop. Ze zitten er nu in,
   net als het oude woordenboek in `src/i18n.ts` en `NL() ? '…' : '…'`.
3. **Samengestelde regels.** "Welke komt hierna?" plus de naam van het niveau is nergens één
   zin. De app speelt nu de losse opnames achter elkaar als elke zin er een heeft, en anders de
   hele regel op de telefoonstem; twee stemmen door elkaar in één regel klinkt slechter.

Daarna: 55 tegen 0 op dezelfde rondgang. Dat is niet elke regel in de app, alleen wat een kind in
de eerste tikken hoort.

Wat nog op de telefoonstem staat: alles wat met getallen, tijden of namen tijdens het spelen wordt
samengesteld (Rekenrijk, Klokkijken, de 3744 dieren), de klanken en woorden in Letterbos, en alle
Engelse tekst. En op een echte telefoon mag geluid pas na de eerste aanraking; een openingszin die
daarvoor valt, blijft stil of gaat naar de telefoonstem, zoals voorheen.

## 2026-09-23 — "Letterlijk alles Ruth"

Letterbos zei niets meer op "Hoor het woord" en "Klank voor klank". Het had als enige spel een
eigen spraakmodule die alleen de telefoonstem kende, en op de telefoon van de eigenaar bleef die
stil zodra de rest van de app opnames afspeelde. Letterbos vraagt nu eerst Ruth
(`sayRecorded()`): alle woorden, zinnetjes, klanken en "de ei van trein"-regels zijn ingesproken,
en het woord gevolgd door zijn klanken speelt als één reeks. Alleen als er één stukje ontbreekt
spreekt de telefoon, dan de hele reeks, zodat het nooit twee stemmen door elkaar is.

Daarna vroeg de eigenaar dat letterlijk alles Ruth is. `npm run voicecrawl` speelt elke pagina
willekeurig en noteert elke regel die toch naar de telefoon ging. Gevonden en opgelost: namen met
een uitleg achter een streepje (Stroomkring, Moonshot), twee stukken zonder punt ertussen
(Planetarium), een getal in een zin (Opgraving), de diergroepen, "<onderdeel> gedraaid." en de
missies van Moonshot met hun snelheid. "m/s" wordt nu voorgelezen als "meter per seconde".

Wat na die rondes nog niet Ruth is, en waarom:
- **De 3737 diernamen** in het Dierenboek: samen 62.414 tekens, meer dan het tegoed van deze
  maand. Wacht op een besluit van de eigenaar.
- **De radio van Cloudhopper**: Engelse luchtverkeersleiding met wisselende roepnamen, banen en
  windsnelheden, in twee stemmen (toren en piloot), met een eigen spraakcode. Wacht ook op een besluit.
- **Alles in het Engels.** Ruth spreekt alleen de Nederlandse regels.
