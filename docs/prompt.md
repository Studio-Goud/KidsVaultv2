# Suri — de opdracht

Dit bestand is bedoeld om aan het begin van een nieuwe sessie te plakken. Het zegt wat Suri moet
worden, waar het nu staat, en wat er als eerste aan de beurt is. De vaste werkregels staan in
`CLAUDE.md` en worden vanzelf ingelezen; de redenering achter elke grote keuze staat in
`docs/decisions.md`.

---

## Wat Suri moet zijn

Een plek waar een kind van twee tot tien iets gaat doen dat het de moeite waard vindt, en waar een
ouder na een maand nog steeds weet waarom hij ervoor betaalt.

Dat is één zin, maar er zitten drie beloftes in die elkaar in de weg kunnen zitten:

**Voor het kind: het moet leuk zijn zonder trucjes.** Geen reeks die je kwijtraakt, geen dagelijkse
beloning, geen muntjes, geen "nog één level". Wat een kind terugbrengt moet zijn dat het de vorige
keer leuk was. Dat is een hogere lat dan de markt aanlegt, en het is met opzet de lat.

**Voor de ouder: gemoedsrust, geen content.** Wat een ouder koopt is dat hij de telefoon kan
weggeven zonder erbij te hoeven zitten: geen reclame, geen aankopen, een tijd die afloopt, en
kunnen zien wat zijn kind oefent. Het aantal spellen wint die verkoop niet — het voorkomt alleen
dat hij verloren gaat.

**Voor allebei: eerlijkheid is de marketing.** De sterkste zin op de hele voorpagina is "we zeggen
wat we niet weten". Elke claim in deze app moet waar zijn, en waar hij niet hard te maken is moet
dat erbij staan. Dat is geen bescheidenheid maar positionering: het is precies wat de rest van dit
marktsegment niet doet.

### Wat het níét is

Geen schoolmethode. Geen leerlijn, geen niveaus die met een schooljaar te maken hebben, geen
voortgangsrapport dat doet alsof het iets meet. Geen verzameling minigames die om beurten om
aandacht vragen. En geen app die een kind ontgroeit: een tienjarige moet er nog iets vinden, want
een app die je ontgroeit is een opzegging met een datum erop.

### De vorm

Achttien dingen, in drie soorten, en dat onderscheid is bewust:

- **Spellen** — je doet iets en het lukt of het lukt nog niet.
- **Naslagwerken** — het Dierenboek, waar niets te winnen valt en je gewoon kunt kijken.
- **Ontdekreizen** — je stapt in, drukt op start, en je wordt meegenomen; bij elke halte vertelt
  Suri iets waar je op kunt doorvragen. Dit is het formaat dat de app onderscheidt en het is nog
  het minst uitgebouwd.

Eén gids door alles heen: Suri, een stokstaartje, dat ook de app is. Alles wat ertoe doet wordt
hardop gezegd, want een vierjarige leest niet.

---

## Waar het nu staat

Alles hieronder is nagelopen, niet aangenomen.

**Achttien dingen, van jong naar oud:**

| | | leeftijd | |
|---|---|---|---|
| 1 | Opgraving | 2-8 | fossiel vrijleggen; heeft een aparte eenvoudige vorm voor 2-3 |
| 2 | Klankhuis | 2-9 | negen klankstaven en negen niveaus |
| 3 | Getijdenpoel | 3-7 | sorteren, en dan verandert de regel |
| 4 | Marktdag | 3-7 | uittellen en eerlijk delen |
| 5 | Nachtwacht | 3-10 | sterrenbeeld onthouden en terugtekenen |
| 6 | Dierenboek | 3-10 | 3744 echte dieren met echte foto's |
| 7 | Watermolen | 4-9 | geulen graven, water zoekt zijn weg |
| 8 | Letterbos | 4-7 | woorden bouwen uit klanken |
| 9 | De grote reis | 4-10 | ontdekreis: de zon tot Pluto |
| 10 | De diepzee | 4-10 | ontdekreis: de golven tot de Challengerdiepte |
| 11 | Planetarium | 4-10 | planeten ordenen en verkennen |
| 12 | Stuifzwam | 5-9 | vakjes tellen en een uitweg plannen |
| 13 | Rekenrijk | 5-9 | rekenen met spullen op tafel |
| 14 | Klokkijken | 5-9 | de wijzerplaat en de Nederlandse manier |
| 15 | Stroomkring | 6-10 | schakelingen die wel of niet branden |
| 16 | Moonshot | 6-10 | een raket in trappen bouwen |
| 17 | Wereldatlas | 6-10 | provincies, landen, vlaggen |
| 18 | Cloudhopper | 7-10 | luchtverkeersleiding; het oudste deel |

**Werkt en is nagelopen:** alle vijftien nieuwe spellen praten en dragen Suri in de hoek.
Opgraving en Klankhuis hebben twee vormen, gekozen op de leeftijd die de ouder invult. De ontdekreis-motor
draagt twee reizen en een derde is een databestand. Het ouderscherm heeft een pincode, per kind
een tijdslimiet met de NJi-onderbouwing erbij, en vijftien vragen die vóór de code te lezen zijn.
De dagteller telt. De keuzes van de ouder bereiken de voorpagina: uitgevinkte onderwerpen zijn
weg, en wat nog te oud of al ontgroeid is staat in een eigen rij in plaats van te verdwijnen
(`shelf()` in `src/platform/catalog.ts`). 1385 checks groen, `npm run audit` 0 fouten over 24 schermen x 5 schermmaten.

**Wat er níét is, en wat dus niet beweerd mag worden:** geen pedagoog heeft hier ooit naar
gekeken. Er is geen afrekening, dus de €3,99 bestaat nog niet. Er is geen service worker, dus
"offline" is "zolang de browser hem nog in zijn cache heeft". De stem is de stem van de telefoon.

---

## Wat er als eerste aan de beurt is

Op volgorde van wat het meeste oplevert per uur werk. Werk van boven naar beneden, tenzij de
gebruiker anders zegt.

### 1. De kloof bij twee en drie jaar

Van de achttien dingen passen er drie bij een tweejarige, en twee daarvan hebben een eenvoudige vorm. De eenvoudige vorm uit
`src/platform/who.ts` is één keer uitgevoerd (Opgraving) en het patroon staat er nu: hetzelfde
spel met de regels eruit, niet een kleiner spel.

Klankhuis is nu de tweede: voor drie en jonger is het alleen de negen staven, groter, zonder de
knoppen naar de niveaus en de sequencer, en een vinger die eroverheen strijkt laat elke staaf
klinken die hij raakt. Daarna Getijdenpoel (één regel in plaats van wisselende regels) en het Dierenboek
(bladeren zonder zoeken).

### 2. Drie ontdekreizen erbij

De motor draagt ze al: `src/journey/` is af en `docs/journeys.md` beschrijft het formaat. Een
nieuwe reis is een databestand met haltes, kleuren, foto's en een voertuig — de diepzee kostte
geen regel motor. Gevraagd zijn: **de tijd van de dino's**, **het menselijk lichaam** en **een
fabriek**. Die laatste loopt horizontaal en dat is het enige stuk tekenwerk dat de motor nog mist
(de as kan nu `up` of `down`).

Dit is waarschijnlijk het beste rendement in de hele lijst: het is het formaat dat Suri
onderscheidt van elke andere kinderapp, en de kosten per reis zijn laag.

### 3. Echt offline werken

Een service worker, zodat de app in een auto of een trein gewoon opengaat. De vraag staat
letterlijk in de ouder-FAQ en het antwoord is nu eerlijk maar zwak. Voor een kinderapp is dit geen
detail: de achterbank is de belangrijkste plek waar hij gebruikt wordt.

### 4. Ingesproken stem

De zwakste kant van een app die "audio-first" heet, is dat hij klinkt als een routeplanner.
`src/platform/voice.ts` kiest al een opname boven de machine als die er is, en `docs/voice.md`
beschrijft het manifest. Er hoeft dus niets aan de code te veranderen om dit te repareren — alleen
iemand die het inspreekt.

**Grotendeels gedaan.** De eigenaar koos Ruth uit de ElevenLabs-bibliotheek; alle 1354 vaste
Nederlandse regels zijn met haar ingesproken (`npm run voice`), en `npm run voicecheck` laat zien
welke regels nog op de telefoonstem vallen. Wat overblijft: regels met getallen, tijden en namen
die tijdens het spelen worden samengesteld, Letterbos' klanken, en al het Engels. Zie
`docs/voice.md`. Een regel die van woorden verandert, moet opnieuw door het script.

### 5. Afrekenen

€3,99 per maand via de App Store en Google Play. Zolang dit er niet is, is er geen product, alleen
een demo. De tekst op het ouderscherm zegt nu al eerlijk dat het nog niet gebouwd is.

### Kleiner, maar het blijft anders liggen

- **`reads` in de catalogus** is niet opnieuw nagekeken sinds alles hardop praat, en staat
  waarschijnlijk te pessimistisch. Achttien keer kijken wat er op het scherm staat dat gelezen
  moet worden. Zie de kop van `src/platform/catalog.ts`.
- **De 7-10-schermtijd** is van mij en niet van het NJi. Staat zo in `src/platform/session.ts` en
  in het ouderscherm, maar het hoort onderzocht te worden.
- **Geluid op de ontdekreizen.** Een duik hoort te klinken; nu is hij stil op de stem na.
- **Cloudhopper praat niet** en draagt Suri niet, als enige van de achttien.

### Niet-code, maar wel blokkerend

- **Een orthopedagoog** die `docs/claims.md` doorneemt. Elf van de achttien onderdelen zeggen iets
  te oefenen op grond van mijn inschatting en niets anders.
- **Merknaam, domein en app stores** nakijken op "Suri". Een naam die je later moet inruilen is
  duurder dan een rename nu.

---

## Hoe je hier werkt

Staat in `CLAUDE.md`, maar de drie dingen die het vaakst misgaan:

1. **Draai `npm run audit` voordat je zegt dat een scherm werkt.** Unit tests zien niet dat twee
   dingen op dezelfde plek staan. De audit heeft in dit project al meer echte fouten gevonden dan
   alle andere controles samen.
2. **Open het ding in een browser en speel het.** Bijna elke fout die de gebruiker zelf vond, was
   zichtbaar op één screenshot en onzichtbaar voor elke test.
3. **Beweer niets wat je niet gecontroleerd hebt.** Dit project heeft een commit-geschiedenis vol
   zinnen als "nagelopen op 390x844" en die moeten allemaal waar zijn.
