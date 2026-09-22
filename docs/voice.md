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
