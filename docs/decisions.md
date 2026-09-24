# Besluitenlogboek

Elke regel hier is een keuze van de eigenaar of een keuze die aan mij is overgelaten, met de datum
en wat het verandert. Dit bestand is de reden dat `research.md` en `audit.md` op sommige punten
achterhaald zijn: de besluiten hieronder gaan voor.

---

## 2026-09-22 — De zes beslispunten uit fase 1

**1. Cloudhopper blijft in de app.**
De audit adviseerde hem eruit te halen (te oud, 218 kB, vraagt lezen en verdeelde aandacht). De
eigenaar houdt hem erin, en voegt een doel toe dat in het oorspronkelijke brief niet stond:

> "ik wil naast dit alles ook gewoon leuke games"

*Gevolg:* de app is geen verzameling leerspellen meer met plezier als bijvangst. Plezier is een
eigenstandig doel. Elk spel krijgt daarom naast zijn leerdoel een **aard**: leren, spelen, of
allebei. Een spel dat alleen leuk is, is geldig. Dat verandert ook fase 0 ontwerpprincipe 1
("leerdoel eerst"): dat geldt voor spellen die leren beloven, niet voor alles.

**2. Wereldatlas wordt herbouwd,** niet geschrapt. Zonder leesafhankelijke opdrachten.

**3. De leeftijdsband wordt 2 tot 10 jaar.**

> "Kind mag groeien, anders doen we tot 10 jaar oud, prima"

*Gevolg, en dit is de grootste verandering van de zes.* `research.md` en `audit.md` zijn geschreven
tegen 2-6 en kloppen op dat punt niet meer.
- De vier 6+-spellen zijn niet langer "de kop van de doelgroep" maar het midden.
- De app moet **meegroeien met het kind**, niet alleen aansluiten bij een leeftijd. De adaptieve
  motor die er al ligt (`src/platform/skill.ts`) is daarmee van een aardigheid een dragend deel.
- Commercieel is dit een verbetering: een abonnement dat acht jaar meegaat in plaats van vier.
- De bronnen in `research.md` (NJi, WHO, Hirsh-Pasek) gaan over 0-5 respectievelijk jonge
  kinderen. **Voor 6-10 ontbreekt de onderbouwing nog.** Schermtijdadvies, aandachtsspanne en
  leerdoelen voor die band moeten alsnog onderzocht worden. Gemarkeerd als openstaand.

**4. Stem: aan mij overgelaten,** met de aantekening dat er open-source stemmen bestaan.
Gekozen aanpak staat in `docs/voice.md` zodra die er is. Kort: de stem van het toestel als basis
(gratis, offline, direct beschikbaar), met een opgenomen stem voor de gids en de terugkerende
zinnen zodra het product geld verdient. Onderbouwing en afwegingen volgen bij de bouw.

**5. Foto's live ophalen bij Wikimedia is acceptabel.**

> "Ja acceptable, het is wat het is"

*Gevolg:* het Dierenboek blijft werken zoals het werkt. De open vraag aan een privacyjurist
(`audit.md` §3.6) blijft staan als iets dat vóór inzending bij de Kids Category getoetst moet
worden — dit besluit gaat over het product, niet over de juridische toets.

**6. Volgorde: fundering eerst, en verder naar eigen inzicht.**

> "GA uit van jouw advies. Alles mag gewoon bouw maar hoe jij denkt dat de meest commerciele
> manier zal zijn deze app te verkopen."

*Gevolg:* bouwen mag beginnen. Fase 2 wordt geen document maar werkende code. De commerciële
afweging ligt bij mij; ik schrijf op wat ik kies en waarom, zodat het terug te draaien is.

---

## Mijn commerciële uitgangspunt

Voor de volledigheid, omdat het elke keuze hierna stuurt:

1. **Het kind kiest of de app opengaat, de ouder kiest of hij betaald blijft.** Dus: de spellen
   moeten leuk genoeg zijn om vrijwillig te openen, en de ouderomgeving moet elke maand opnieuw
   laten zien waar het geld heen gaat. Dat zijn twee verschillende producten in één app.
2. **Met 2-10 is de klantlevensduur het verkoopargument geworden.** Een app die een kind ontgroeit
   is een opzegging met een datum erop. Een app die meegroeit niet. Alles wat "meegroeien"
   zichtbaar maakt voor de ouder is dus directe omzet.
3. **Wat een ouder koopt is gemoedsrust, niet content.** Tijdslimiet, geen reclame, en kunnen zien
   wat hun kind oefent. Het aantal spellen wint die verkoop niet; het voorkomt alleen dat hij
   verloren gaat.
4. **Eerlijkheid is de marketing.** De belofte-kaart op de hub is nu al het beste verkooppraatje
   dat er staat, juist omdat er staat wat we *niet* weten. Geen enkele claim die niet waar is.

---

## 2026-09-22 — De gids is een stokstaartje

> "Die maar een dier als mascotte ofzo? Stokstaartje"

Gekozen, en het is een betere keuze dan hij op het eerste gezicht lijkt:

- **De houding ís de functie.** Een stokstaartje staat rechtop en kijkt rond. Dat is wat een gids
  doet, en een kind leest die pose als "kijk hier" voordat er iets gezegd is.
- **Het silhouet houdt stand op duimformaat**: rechtop lijf, donker oogmasker, spitse snuit. Drie
  dingen, en meer heeft een klein plaatje niet.
- **Het is een echt dier**, in een app met een encyclopedie van 3744 echte soorten. De gids hoeft
  geen verzonnen tekenfilmfiguur te zijn, en dat past bij "we zeggen wat we niet weten".
- **"Stokstaartje" is te zeggen door een tweejarige.**

**Zijn naam was Braam.** Braambos → Braam: twee letters van de app-naam, kort, en niet aan een
geslacht gebonden. Het staat als één constante in `src/platform/guide.ts`, dus hernoemen is één
regel.

> **Achterhaald op 2026-09-23.** De app heet geen Braambos meer en de gids heet geen Braam meer;
> beide heten Suri. Zie het besluit onderaan dit document. Wat hieronder staat over waaróm het een
> stokstaartje is, geldt onverkort.

**Eén ding om in de gaten te houden:** de bekendste stokstaart in kindermedia is Timon uit The Lion
King. Braam is met opzet niet zijn evenbeeld — andere verhoudingen, eigen palet, geen kleren, geen
kreet. Als het product groeit is dit iets om door iemand met merkenrechtkennis te laten bekijken.

**Waar hij nu staat:** naast elke regel die de coach uitspreekt, met zijn mond mee bewegend, en een
tik op hem herhaalt wat hij zei. Dat laatste is het "tik op de gids = herhaal" uit fase 2, en het
doet met opzet niets anders: een kind dat de uitleg miste, mag hem niet verliezen door erom te
vragen.

---

## 2026-09-22 — De eenvoudigste vorm, voor twee en drie

De catalogus zei `from: 2` bij twee dingen en het klopte bij geen van beide. Opgraving stond erop
en had vier stukken gereedschap, een regel over hard en zacht gesteente, daglicht dat opraakt, bot
dat breekt en aan het eind een meerkeuzevraag. Dat is een spel voor zes, met het label van twee.

**Besluit: een onderdeel mag een tweede, eenvoudigere vorm hebben, en die vorm wordt gekozen op de
leeftijd die de ouder invult.** Niet een kleiner spel maar hetzelfde spel met de regels eruit.
Voor Opgraving: het gesteente is overal zacht, de kwast is het enige gereedschap en kan per
definitie niets breken, het daglicht raakt niet op, en er wordt niets gevraagd.

Drie dingen die daarbij horen en die voor het volgende spel net zo gelden (`src/platform/who.ts`):

1. **De grens ligt op drie jaar en hij staat op één plek.** Als hij verschuift, verschuift hij
   overal tegelijk.
2. **Geen profiel is geen eenvoudige vorm.** Een volwassene die de app koud opent krijgt het hele
   spel. De andere kant op gokken zou iedereen die binnenkomt begroeten met een spel waar het spel
   uit is.
3. **Dit is wat het ouderscherm eindelijk doet.** Tot nu toe was de leeftijd daar alleen een getal
   waar een tijdslimiet uit volgde. Nu verandert hij het spel zelf, en dat is het eerste
   commerciële argument voor dat scherm dat geen belofte is maar een functie.

Dit sluit de kloof niet. Van de achttien dingen passen er nu drie bij een tweejarige in plaats van
twee. Het volgende dat deze behandeling verdient is Klankhuis, dat in zijn vrije stand al bijna
goed is.

---

## 2026-09-22 — De ontdekreis is een formaat, geen spel

Fase 5 uit de opdracht: stap in, druk op start, het ding brengt je, en bij elke halte vertelt de
gids iets waar je op kunt doorvragen. Gevraagd werd één reis; gebouwd is een motor met twee.

**Besluit: het is data, niet code.** Een reis is een lijst haltes met kleuren, plaatjes, een schaal
en een voertuig; al het gedrag staat één keer in `src/journey/`. De diepzee kostte daardoor geen
regel motor, en dat was de hele toets: de tijd van de dino's, het lichaam en een fabriek zijn nu
elk een databestand.

Drie keuzes die erin zitten en die ik apart wil kunnen terugvinden:

1. **Tijdens het rijden staat er geen enkele knop op het scherm.** Een kind dat moet blijven
   drukken om vooruit te komen speelt een spel, en daar is de hub vol mee. Wat de rijtijd doet is
   de volgende wereld laten opkomen.
2. **Elk been duurt even lang, ongeacht de echte afstand.** Neptunus ligt dertig keer zo ver als de
   aarde. Een kind dat daar dertig keer zo lang op wacht legt de telefoon neer. De meter langs de
   zijkant vertelt de echte schaal wel, stuksgewijs.
3. **In het overzicht zit niets op slot.** Ook een halte waar je nooit geweest bent mag open. Het
   is een boek, en een boek mag je in het midden opendoen. Wat het overzicht wél laat zien is welke
   je gehad hebt, want dat is het enige wat een kind eraan vraagt.

Bij elke foto staat vanaf nu de fotograaf en de licentie, op het scherm waar hij groot te zien is.
Dat is geen nettigheid: een deel van wat het dierenboek en de duik gebruiken is CC BY-SA, en die
licentie vraagt erom.

Volledige beschrijving: `docs/journeys.md`.

---

## 2026-09-22 — De ouderpagina staat vóór de code, niet erachter

De vragenlijst uit fase 6 zit in het ouderscherm, maar níét achter de pincode. De code houdt een
kind uit de instellingen; de vragen zijn geen instelling. En het is de pagina die een ouder die nog
niet besloten heeft moet kunnen lezen — daar om een code vragen die ze nog niet gekozen hebben is
een merkwaardig antwoord op "waar is dit voor".

**Wat er niet in staat, en niet in mag komen:** "pedagogisch goedgekeurd". Niemand met een
pedagogische opleiding heeft deze app gezien. De vraag staat er letterlijk in, met dat antwoord.
De volledige lijst van wat er getoetst zou moeten worden staat in `docs/claims.md`, en die lijst is
eerlijk over hoe groot hij is: elf van de achttien onderdelen zeggen iets te oefenen op grond van
mijn inschatting en niets anders.

De regel die overal geldt en waar dit uit volgt: **"oefent" mag, "leert" niet.**

---

## 2026-09-22 — Open: `reads` in de catalogus klopt niet meer

Alle vijftien spellen praten sinds deze week, dus `speaks` is bijgewerkt en nagemeten. `reads` is
dat niet: die vlag stamt uit de tijd dat niets hardop ging, en is nu waarschijnlijk te pessimistisch.
Er staat nu bij dat hij niet nagekeken is, en niemand mag hem citeren tot dat wel zo is. Dit is de
eerste van de open posten omdat hij goedkoop is: het is achttien keer kijken wat er op het scherm
staat dat gelezen moet worden.

---

## 2026-09-23 — De app heet Suri, en dat is de gids

> "En Braambos slaat echt nergens op."

Klopt, en om een scherpere reden dan hij op het eerste gezicht lijkt: **een stokstaartje in een
braambos is dubbel onzin.** Stokstaartjes leven in de Kalahari, niet in een doornstruik. Ik had een
naam gekozen, er daarna een mascotte bij gezet die er niet in paste, en vervolgens een icoon
getekend van een braamboog. Eén verhaal dat niet klopt, drie keer uitgevoerd.

**Besluit: de app heet Suri, en de gids heet Suri.** Een stokstaartje is een *suricata*; de naam
komt dus uit het dier zelf. Wat het oplost:

1. **Het verhaal klopt weer.** Eén naam, één dier, één icoon. Er valt niets meer uit te leggen.
2. **Een tweejarige zegt het.** Twee lettergrepen, open klanken, geen medeklinkercluster.
3. **Het reist.** "Braambos" had bij export per markt een andere naam nodig; "Suri" gaat onvertaald
   mee. De app is vanaf dag één tweetalig gebouwd en dit was de laatste Nederlandse knoop erin.
4. **Het merk is een karakter en geen woord.** Dat is commercieel het punt: kinderen binden zich aan
   een figuur, niet aan een productnaam, en de figuur stond er al op elk scherm.

Het icoon is nu zijn kop: zandkleurig, donker masker, ronde oren, spitse snuit, tegen de schemer
met het heuveltje waar hij op de uitkijk staat. De geometrie is met opzet dezelfde als in
`src/platform/guide.ts`, zodat het icoon en het dier in de app niet uit elkaar kunnen groeien.
Twee dingen die ik onderweg heb weggegooid: een halo achter zijn kop die als een muts las, en een
borst in dezelfde vacht die met de snuit tot één klont samenviel. Kop en oren alleen is wat op
achtenveertig pixels overeind blijft.

**Wat ik niet kan nakijken vanaf hier:** of "Suri" vrij is als merknaam, als domein en in de app
stores. Dat is een van de eerste dingen om te doen voordat er geld in marketing gaat.

---

## 2026-09-23 — De ouder-ingang staat bovenaan

De voorpagina begroette je met de naam in witte letters op een lichtblauwe lucht, wat alleen leesbaar
was door er een donkere waas achter te schilderen — en die waas las als een vlek. Donkere letters op
een lichte lucht hebben niets achter zich nodig, dus de waas is weg en de naam is inkt.

Daarnaast: de enige ingang naar het ouderscherm stond onder aan de pagina, achter achttien
spelkaarten. Een ouder die deze app voor het eerst opent zoekt zijn eigen instellingen, en die
achter het hele schap verstoppen was de verkeerde volgorde. Er staat nu een knop rechtsboven, naast
de naam. De link onder aan de beloftekaart blijft, maar is nu de stillere van de twee: dat is het
eind van een verkooppraatje en niet de plek waar je iets zoekt.

---

## 2026-09-23 — De leeftijd bergt niets op, het onderwerp wel

Het ouderscherm liet een ouder onderwerpen uitvinken en een leeftijd invullen, en de voorpagina las
geen van beide. Nu wel, via één functie, `shelf()` in `src/platform/catalog.ts`, die ook het getal
"zoveel van de achttien passen nu" op het ouderscherm levert, zodat die twee niet uit elkaar kunnen
lopen.

De twee keuzes werken met opzet verschillend:

1. **Een uitgevinkt onderwerp is weg.** Dat is wat de ouder vroeg, en het ouderscherm zegt het al
   met zoveel woorden ("dan wordt de rest opgeborgen").
2. **De leeftijd verschuift alleen.** Wat nog te oud is komt onder "Hier groei je nog naartoe", wat
   ontgroeid is onder "Van toen je kleiner was". Een tienjarige zou anders op zijn verjaardag negen
   kaartjes kwijtraken, en een schap dat leegloopt terwijl je ouder wordt voelt als straf. Andersom
   is een kaartje dat een vijfjarige al ziet maar nog niet helemaal kan een reden om terug te komen.
   Niets zit op slot: elk kaartje opent nog steeds.
3. **Geen profiel is alles**, op de oude volgorde, zonder rijen. Wie de app koud opent ziet het hele
   schap; dat is dezelfde regel als bij de eenvoudige vorm in `src/platform/who.ts`.

Wat nog niet klopt: de koppen boven de twee rijen worden niet uitgesproken. Een vierjarige ziet
twee groepen kaartjes zonder te weten waarom. Dat hoort bij de gids op de voorpagina, die er nu
alleen is voor "je laatste spelletje".

---

## 2026-09-23 — Klankhuis voor twee en drie: het instrument, en strijken

De tweede eenvoudige vorm, naar het patroon van Opgraving. Klankhuis opende al met negen staven die
je kunt aanslaan; voor drie en jonger is dat nu het hele spel. De knop naar de niveaus is weg, omdat
elk niveau iets vraagt met een fout antwoord. De knop naar de sequencer is weg, omdat een raster
van vakjes een gereedschap is dat je kiest vóór het gebaar. De staven worden groter nu ze de
onderkant van het scherm er ook bij krijgen.

Eén ding is erbij gekomen in plaats van weggehaald: een vinger die over de staven strijkt laat elke
staaf klinken die hij binnengaat. Dat is wat een tweejarige met een echt klokkenspel doet, en op het
scherm deed het tot nu toe niets. Het werkt alleen op het openingsscherm, voor elke leeftijd: in
een echoniveau zou een veeg over drie staven drie antwoorden zijn die niemand bedoelde.

De regel die gezegd wordt ("Tik op de klokjes. Of strijk er met je vinger overheen.") wordt
uitgesproken bij het openen en herhaald door Suri in de hoek. In de grote vorm zegt het
openingsscherm niets, zoals voorheen.

De audit opent nu ook Opgraving en Klankhuis als tweejarige en de voorpagina als drie- en
tienjarige, via de `__years`-haak. Tot nu toe zag hij geen van die schermen.

Wat nog niet klopt: er is geen einde. De eenvoudige Opgraving eindigt als het fossiel eruit is;
het instrument eindigt pas als de dag op is. Voor een vrij instrument vind ik dat verdedigbaar,
maar het is een uitzondering op "elke sessie eindigt" en die hoort hier te staan.

---

## 2026-09-23 — Opgenomen stem en geluidseffecten, met de oude eronder

Tot vandaag was elk geluid in Suri in code gemaakt, en de stem was die van de telefoon. De eigenaar
vond dat het als een robot klonk, heeft een ElevenLabs-account, en vroeg om een natuurlijke
vrouwenstem en om echte geluidseffecten in elk spel.

**Besluit: opnames vóór de code, nooit in plaats van.** Ruth spreekt alle vaste Nederlandse regels
(`docs/voice.md`), en 138 effecten in veertien spellen en Cloudhopper zijn opgenomen
(`src/platform/sfxspec.ts`). Alles wordt één keer op de bouwmachine gemaakt en gaat als bestand mee
in de app. Wat er niet is - een regel die tijdens het spelen wordt samengesteld, een effect zonder
opname, een bestand dat nog niet geladen is - valt terug op wat er altijd was. Een ontbrekend
bestand is dus nooit een stil spel.

Drie grenzen:

1. **De noten van Klankhuis blijven code.** Klokjes, aftellen en trommel moeten zuiver gestemd en
   precies op de audioklok staan. Alleen de knoppen en het applaus van Klankhuis zijn opgenomen.
2. **Doorlopende geluiden blijven code**: motoren en zoemers die met het spel meebewegen.
3. **De telefoon praat met niemand.** ElevenLabs ziet alleen de zinnen van de app, tijdens het
   bouwen. Er gaat niets over een kind heen, en regel 1 uit `CLAUDE.md` blijft waar.

De prijs: 13 MB stem en 1,5 MB effecten in de download, en een regel of effect dat verandert moet
opnieuw door het script. Wat ik niet heb kunnen doen, is ernaar luisteren: deze omgeving heeft
geen luidspreker. Dat een opname laadt en afspeelt is nagelopen, niet hoe hij klinkt.

---

## 2026-09-23 — Geluid overal, en alles Ruth

De eigenaar: "letterlijk alles in de hele app moet de stem van Ruth zijn", en "het allerbelangrijkste
is dat alle geluidseffecten er zijn, van klikken tot misschien wel dierengeluiden".

**Stem.** De 3737 Nederlandse diernamen zijn ingesproken, want het Dierenboek zegt de naam als kop van
elke pagina. Het Engels is ook met Ruth ingesproken (`npm run voice -- render <id> --lang en`), met de
Engelse diernamen als laatste in de rij zodat die wachten als het tegoed op is. Letterbos houdt zijn
Nederlandse woorden en klanken ook in de Engelse app. De radio van Cloudhopper is opgenomen in
stukjes (`scripts/radio.mjs`): de toren is Ruth, de piloten zijn "Chris", een Engelse mannenstem uit
het account van de eigenaar, en de radio zet een oproep uit de langste passende stukjes in elkaar en
speelt die door de smalle band van een echte portofoon.

**Geluid.** Wat stil was, klinkt nu: de voorpagina, de ronde knoppen in elke hoek, het ouderscherm
(één luisteraar voor alles), het hele Dierenboek, en de twee ontdekreizen, met vertrek, aankomst en
een zacht achtergrondgeluid zolang het voertuig reist. En 340 dieren hebben hun eigen geluid: de
bekendste zoogdieren en vogels, kikkers en padden, en insecten die echt zoemen of tjirpen. Het speelt
na de naam als je het dier opent, en nog eens als je op de foto tikt; een ♪ in de hoek zegt dat er iets
te horen is.

Grenzen die blijven: Suri in de hoek maakt geen klik, want hij praat al; de noten van Klankhuis en de
doorlopende motoren blijven code. De meeste van de 3744 dieren hebben geen geluid, omdat een vis of
een spin er geen heeft dat een kind kent, en de generator er dan een verzint.

---

## 2026-09-23 — Het Dierenboek: vegen, en een liniaal in plaats van het kind

De eigenaar vond de kaart met het getekende kind naast het dier storend, en vroeg om een meetlat
in centimeters en millimeters: iets waar een kind nog iets van leert. Die kaart is weg. Onder de
foto staat nu hoe lang het dier is, groot geschreven, en daaronder een houten liniaal met het dier
erop op zijn echte lengte op die liniaal. De liniaal is altijd een ronde maat en iets langer dan het
dier, en zijn streepjes zijn zo fijn als het scherm toelaat (`rulerFor()` in rules.ts): millimeters
bij een lieveheersbeestje, centimeters bij een kat, meters bij een blauwe vinvis.

Met de kaart verdwenen ook de knoppen waarmee je de lengte van het kind instelde, en daarom ook de
zin "ongeveer zo vaak zo lang als jij" bij de weetjes. Die rekende met een lengte die het kind niet
meer zelf instelt, en een zin over "jou" die niet over jou gaat is niet waar.

Daarnaast: op de pagina van een dier veeg je naar links voor het volgende dier op dezelfde plank en
naar rechts voor het vorige. De pagina schuift mee onder de vinger, veert terug bij een korte veeg,
en geeft aan het eind van de plank een beetje mee en stopt dan. De knoppen Vorige en Volgende
blijven staan voor wie niet veegt.

## 2026-09-24 — Het jaar rond: een levend landschap in plaats van plaatjes

De eigenaar vroeg om een spel over dagen, maanden en seizoenen, "met leuke interactieve elementen,
uitleg en bewegende illustraties". De eerste versie had per niveau een los plaatje: een boom in vier
standen, een hemel met een zon. Na zijn opmerking over de Wereldatlas ("we leven anno 2026") is dat
vervangen door één getekend Hollands landschap dat alle niveaus delen (`src/games/seasons/world.ts`):
een boom, een huis met een trapgevel, een molen, een sloot, en een hemel.

Een seizoen is daarin geen schakelaar maar een getal. Een kind dat over de tekening veegt ziet de
bloesem dunner worden, het blad verkleuren en vallen, de sneeuw komen en de sloot bevriezen, en niet
vier dia's. Hetzelfde voor de dag: de zon komt links op en gaat rechts onder, de lucht kleurt mee,
en 's nachts gaan de ramen aan. De achtergrond van de week en van het jaarwiel is het seizoen van
vandaag, en bij het jaarwiel het seizoen van de maand onder de wijzer.

De zon staat 's winters lager dan 's zomers, op schaal: op 52 graden noorderbreedte staat hij 's
middags op 90 - 52 plus de declinatie, ongeveer 48 graden half april, 59 half juli, 29 half oktober
en 17 half januari. Dat is het enige getal in de tekening dat iets beweert, en het is natuurkunde,
geen inschatting.

Het spel zegt elke vraag hardop, na de uitleg van het niveau bij de eerste, en zegt bij een fout
antwoord het goede antwoord. Dat deed de eerste versie niet, en dan is het een leesspel voor een
kind dat niet leest.
