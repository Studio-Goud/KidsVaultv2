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

## 2026-09-24 — De Wereldatlas: de aarde van boven, en eerst kijken

De eigenaar vond de atlas een kinderpuzzel: "echt water, echt Nederland, we leven anno 2026", en
een kind dat moet raden waar een stuk rivier hoort zonder dat iemand het ooit de kaart heeft laten
zien. Twee veranderingen.

Onder elke kaart ligt nu de aarde zoals een satelliet haar ziet: NASA's Blue Marble, publiek
domein, één keer op de bouwmachine opgehaald en uitgesneden per kaart (`scripts/atlasimg.mjs`,
1,8 MB samen). De telefoon vraagt niets bij NASA; regel 1 blijft staan. Omdat de atlas al in
lengte- en breedtegraden tekent, ligt de foto zonder passen en meten onder de omtrekken. De zee
glinstert, alleen waar de foto zee is (open zee is in Blue Marble bijna zwart, het donkerste bos is
drie keer zo licht). Een stuk dat thuis is, is getint glas over de echte grond in plaats van verf.
Het IJsselmeer is op de foto zomergroen van de algen en krijgt daarom een waas water, anders leest
het als land. Rivieren stromen: er loopt licht van de bron naar zee, zodat je ziet welke kant het
water op gaat. Daarvoor moest de Westerschelde omgedraaid worden; die stond van zee naar Antwerpen.

Elk niveau begint nu met een kijkronde. Ruth loopt alle plekken van het niveau langs met de naam
en het weetje, de plek licht op de kaart op en alles staat erop met naam, zoals in een atlas. Een
kind kan op de kaart tikken om een plek te horen, of Puzzelen kiezen wie het al weet. In de puzzel
zegt Ruth bij elk goed en elk fout stuk de naam en het weetje hardop (dat deed de atlas niet, en
dan is het een leesspel), en er is een hintknop die het weetje nog eens zegt en een brede gloed
over het deel van de kaart legt waar het stuk hoort, met opzet niet op de plek zelf. Een stuk met
een hint telt niet meer als in één keer goed, net als na een foute poging.

## 2026-09-24 — De liniaal bij het Dierenboek is weg

Een dag later vond de eigenaar de liniaal uit verhouding bij alle dieren, en dat klopte: een platte
getekende vorm op een liniaal naast een echte foto ziet eruit als speelgoed, een kikker werd een
groene vlek, en bij een tussenmaat stond er "streepjes zijn mm" onder streepjes van een halve
centimeter. Voor de meeste dieren is de lengte bovendien een gemiddelde van de familie. Wat waar is,
is het getal, dus onder "Hoe groot" staat nu alleen de lengte, groot, en of die van het dier zelf of
van zijn familie is. `rulerFor()` en zijn tests zijn met de liniaal verdwenen.

## 2026-09-25 — Moonshot: geen twee kegels op elkaar, en geen lucht tussen de trappen

De eigenaar zag dat een neuskegel op een capsule twee punten op elkaar gaf, en dat er tussen de
trappen lucht zat. Allebei klopte. De capsule is zelf al spits; een kegel erop wordt nu getekend als
wat daar bij Apollo, Sojoez en Orion echt staat: een reddingstoren, een dun vakwerk met een klein
raketje en een punt. Een kegel op een enkele booster neemt de plek van diens eigen puntdop in, zodat
er één neus is. De ontkoppelaar werd op zestig procent van zijn hoogte getekend, met een strook
lucht erboven en eronder; hij vult nu zijn hele rij, met de scheidingsnaad erin. En staat er een
motor direct op, dan sluit een tussentrap de ruimte tot de tank erboven, zoals bij elke echte
meertrapsraket: de bovenste motor zie je pas als de trap eronder weg is. In de werkplaats is die
tussentrap van glas, zodat een kind de motor die het net neerzette nog ziet. Alleen de tekening is
veranderd; de luchtweerstand rekende al met de spitsheid van de bovenste punt per kolom.

## 2026-09-26 — De tijd van de dino's: echte fossielen, en boren als terug in de tijd

De derde ontdekreis. Je zit in een boor, omdat diepere grond oudere grond is: dat is hoe de bodem
werkt en hoe de mensen die deze dieren vonden ze vonden. De meter telt miljoenen jaren geleden.
Tien van de elf haltes zijn foto's van echte skeletten en fossielen in echte musea, met maker en
licentie in beeld, omdat niemand ooit een levende dino heeft gezien: wat we weten zijn botten, en
een geschilderde dino naast een gefotografeerde maakt de schildering tot het feit. Alleen de inslag
is getekend. Trix in Leiden, de Mosasaurus uit Maastricht en de Iguanodons uit Bernissart staan
erin omdat ze dichtbij zijn. De leeftijden zijn de gangbare afgeronde per dier; de eerste halte,
de ijstijd van twintigduizend jaar geleden, staat op de meter als nul omdat die in miljoenen telt.

## 2026-09-26 — Het menselijk lichaam: van kruin tot tenen, en organen getekend

De vierde ontdekreis gaat van boven naar beneden door een lichaam, omdat het het lijf van het kind
zelf is: elke halte kan het bij zichzelf aanwijzen. De meter telt centimeters vanaf de kruin van
een kind van 1,20 m, ongeveer een zesjarige volgens de TNO-groeicurven; een productkeuze, en zo
staat het ook in de kop van `body.ts`. De organen zijn getekend en niet gefotografeerd: een foto
van een echt hart of een echte maag komt uit een operatiekamer, en dat maakt een vierjarige bang in
plaats van nieuwsgierig. Wat wel zonder schrik te fotograferen is, is een foto: een oog, bloed
onder de microscoop, röntgenfoto's van een knie en een voet. Elke halte blijft één van de twee,
nooit een tekening en een foto door elkaar (`docs/research.md` §2.3).

## 2026-09-26 — De verhaalreis: Suri en de reuzentand

De eigenaar vond de ontdekreizen gedateerd: een puntje dat langs een lijn zakt, een foto in een
cirkel, en een kind dat alleen kijkt. Hij vroeg om een echt verhaal en een echte reis, zo virtueel
als kan en interactief. Dit is het antwoord: een verhaal met een vraag aan het begin (van wie is de
reuzentand uit opa's kist?) en het antwoord aan het eind (van een T. rex), in zeven hoofdstukken.

Elke plek is een wereld van 360 graden om je heen (`src/story/world.ts`): je kijkt rond door je
telefoon te draaien of met je vinger te vegen (`look.ts`), en het dier waar het om gaat staat vaak
achter je. Dingen die verder weg staan zijn kleiner en waziger, dingen dichtbij groot, en dat is
genoeg om het als een plek te voelen. De dieren (`beasts.ts`) zijn in code getekend met echte
benen: de voet staat op de grond waar hij neerkomt en de knie zoekt zijn plek, zodat ze lopen in
plaats van schuiven. Hun maten zijn de echte; hun kleuren zijn een gok en dat staat erbij.

In elk hoofdstuk doet het kind iets waardoor het verhaal verdergaat: zand wegvegen, de hendel van
de tijdboor overhalen, het dier zoeken door rond te kijken, de tand ernaast houden, een varen voeren,
stil blijven zitten. Niets kan mislukken en niets heeft een klok. Het spannendste moment, stilzitten
terwijl de T. rex langsloopt, loopt altijd goed af: raakt het kind het scherm aan, dan snuffelt hij
even en loopt toch door (regel 2).

Eén ding is voor de eerlijkheid omgebouwd. Een T. rex-tand in een Nederlandse tuin kan niet: de
T. rex leefde in Noord-Amerika. Daarom komt de tand uit een oude kist van opa zonder kaartje, gaat
de tijdboor eerst door de Nederlandse tijd (de ijstijd, de krijtzee boven Limburg) en reist hij
daarna naar Amerika. Het blijft in canvas 2D, zonder 3D-bibliotheek, zodat het ook op een oudere
telefoon soepel loopt en de vaste regels van het project blijven staan.

## 2026-09-27 — De reuzentand: meer leven en meer detail

De eigenaar vond de verhaalreis de goede richting en vroeg om meer detail. De dieren kregen een
huid (schubben en vlekken binnen hun omtrek, een glans waar het licht valt, een dunne rand), ogen
die glanzen en knipperen, klauwen, en de mammoet een vacht. Elke wereld kreeg bewoners die niets van
het kind vragen maar ervoor zorgen dat omdraaien altijd iets oplevert (`src/story/life.ts`): in de
krijtzee scholen vissen, ammonieten en kwallen, in het bos libellen, rennende Ornithomimus en een
Quetzalcoatlus hoog in de lucht, in de ijstijd en de tuin vogels en vlinders. Alles hoort bij zijn
tijd: de dieren in het bos zijn die van de Hell Creek-lagen in Noord-Amerika, waar ook de T. rex
vandaan komt. De mammoet ademt wolkjes in de kou, er vallen zonnestralen door de lucht, de zeebodem
heeft lichtspel, de grond heeft plekken in perspectief en de horizon is nevel in plaats van een
streep.

## 2026-09-27 — De tweede verhaalreis: Suri en het lichtje in de diepte

De eigenaar vond alle reizen de ruimte in, de zee in en terug in de tijd tof, en wilde ze allemaal
zo uitgebreid als de reuzentand. De diepzee is de eerste. Dezelfde vorm: een vraag aan het begin
en het antwoord aan het eind. De camera aan een kabel van een onderzoeksschip ziet op anderhalve
kilometer diepte een lichtje knipperen, waar geen zonlicht komt. Wie maakt daar licht? Met de
duikboot naar beneden: langs het koraalrif en een zeeschildpad, door een school lantaarnvissen in
de schemer, achter een potvis aan het donker in, en onderin met de lampen uit vind je het lichtje.
Het is de hengel van een hengelaarsvis.

Het verhaal begint met een scherm en niet met het lichtje zelf, omdat je zo diep licht vanaf de
boot niet kunt zien; een camera aan een kabel wel. Zo klopt de aanleiding ook.

De zee is geen reeks losse plaatjes maar één diepte (`src/story/licht.ts`). De kleur van het
water, hoeveel daglicht er nog komt, wat er leeft en hoe donker het is volgen allemaal uit hoe diep
de duikboot is. Het kind houdt zelf de knop ingedrukt om te zakken en ziet het rif boven zich in
het blauw verdwijnen, de lantaarnvissen verschijnen en het zwart dichtkomen. Onderin zie je alleen
wat de dieren zelf aan licht maken, en wat de lampen verlichten waar je kijkt. De handelingen: op
het lichtje op het scherm tikken, de schildpad en de potvis zoeken, de knop vasthouden, de school
opzij tikken, de lampen aan en uit doen. Niets kan mislukken en niets heeft een klok (regel 2).

Om dit en de volgende verhalen niet elk opnieuw te bouwen is de motor van de reuzentand gesplitst:
`stage.ts` doet wat elk verhaal deelt (het script afspelen en op Ruth wachten, rondkijken, een dier
vinden, de ondertitel, begin en einde), en een verhaal is een subklasse met alleen zijn eigen
wereld en handelingen. De reuzentand draait daar nu ook op.

Wat nog niet af is: het ElevenLabs-tegoed is op tot 6 oktober, dus Ruth heeft de zinnen van dit
verhaal en de twaalf geluiden (`lichtje.*` in `sfxspec.ts`) nog niet ingesproken. Tot dan praat de
stem van het toestel en klinken de geluiden uit code; de achtergronden zijn tot dan stil.


## 2026-09-28 — Stroomkring: ruimer voor dikkere vingers

De eigenaar vond Stroomkring lastig met dikkere vingers. Drie dingen maakten het krap. Een tik
mocht maar negen pixels bewegen, en een duim die neerkomt rolt verder dan dat, dus een tik werd
een sleep; dat is nu zestien. Een lijn trekken langs de grens tussen twee rijen legde draad in
allebei zodra de vinger wiebelde (nagemeten: tien stukjes zigzag waar zes recht bedoeld waren); een
getrokken lijn blijft nu in zijn vakje tot de vinger er een vijfde vakje voorbij is. En een onderdeel
lag onder de vinger die het droeg, zodat je niet zag waar het zou landen; op een aanraakscherm zweeft
het nu iets boven de vinger, en wie het net naast een vrij vakje loslaat krijgt het vrije buurvakje in
plaats van "Daar ligt al iets". Een aanraking tot een half vakje buiten het bord telt als de rand.

## 2026-09-28 — Van cel tot mens: één lijf dat onder je vinger verandert

De eigenaar vroeg om menselijke evolutie, "van beginsel tot compleet einde", uitgelegd zo goed als
het nog nooit is gedaan, met transformaties en beeldwerk. Het antwoord heeft drie keuzes.

Eerst hoe het werkt, gespeeld in plaats van verteld. Het kind is een vogel en zoekt berkenspanners
op door roet zwartgeworden stammen, het bekende voorbeeld uit Engeland. Het kan alleen tikken wat
het ziet, dus de lichte vlinders gaan en de donkere krijgen jongen; na twee rondes is de boom
donkerder, door wat het kind zelf deed (van 2 naar 4 naar 8 donkere van de tien). Een vogel eet er
vijf per ronde, zodat er van beide soorten overblijft. Zonder dat mechanisme is de rest van de reis
een rij plaatjes; met dat mechanisme is elke volgende stop "en weer een beetje anders".

Dan de lange lijn: één lijf dat alle dieren kan zijn (`src/evo/body.ts`). Elk dier is een rijtje
getallen - hoe rechtop, hoe lang de staart, hoe groot de hersenpan, vin of vingers, schubben of
vacht - en de tekening komt uit de getallen. Halverwege twee dieren is halverwege hun getallen, en
dus altijd een heel dier. Het kind sleept over de tijdlijn en ziet een vis een vis-met-poten worden,
een hagedis een spitsmuis, een aap een mens. De lijn is die van onze eigen voorouders, en waar een
stop een neef is (Acanthostega, de chimpansee) wordt dat gezegd.

En het bewijs dat een kind met eigen ogen kan zien: de röntgen. De botten komen uit hetzelfde
skelet dat het vlees plaatst, in drie vaste kleuren: bovenarm, onderarm, hand. Dezelfde drie
kleuren zitten in de vin van Tiktaalik, de poot van een spitsmuis en een mensenarm. Bij elke stop
doet het kind iets (een cel delen, een ei laten uitkomen, Lucy laten lopen met voetsporen, stenen
kloppen, vuur maken, een hand op de grotwand), en de meteoriet valt als je langs 66 miljoen jaar
sleept. Het eind is de hele tijd als één dag: mensen in de laatste zeven seconden, en een knop die
de hele verandering in één keer afspeelt.

Het blijft canvas 2D zonder bibliotheek. Eerlijk over het beeld: dit is een getekende voorstelling,
geen fotorealisme; de mensen lezen als mensen maar zijn nog vrij strak. Wat nog niet af is: het
ElevenLabs-tegoed is op tot 6 oktober, dus Ruth heeft deze zinnen en de twintig geluiden (`evo.*`
in `sfxspec.ts`) nog niet; tot dan de stem van het toestel en geluid uit code.


## 2026-09-28 — Van cel tot mens: gezichten, oren, haar en handen

De eigenaar wilde de mensen en apen gedetailleerder. Het profiel van het hoofd heeft nu de punten
die een primatengezicht maken: een neus die uitsteekt, de plek waar neus en lip elkaar raken, de
bovenlip, de mond, de onderlip, de plooi eronder, de kin. Bij een dier met een snuit vallen die
punten terug op de gewone lijn van de kaak, zodat de overgang van spitsmuis naar mens vloeiend blijft.
Primaten kregen een echt oor (een omgekrulde rand en een kom), schaduw in de oogkas en onder het
jukbeen, licht op de wang, en bij mensen iets warmere lippen. Het haar groeit nu uit de schedel
boven een haarlijn die langs de slaap over het oor naar de nek loopt, met krullen erin, in plaats
van een losse boog. Hangende handen hebben vingers en een duim, en staande benen een knie en een kuit.

## 2026-09-29 — Van cel tot mens: rijkere decors, elk van zijn eigen tijd

De eigenaar vroeg om rijkere achtergronden. Wat erbij kwam, hoort bij de tijd van de stop: de vis
met kaken zwemt nu in een eigen Silurische zee met zeelelies (crinoïden) en een zeeschorpioen
(eurypteride) op de bodem; het steenkoolmoeras kreeg reuzenpaardenstaarten (Calamites), mist,
plassen en Arthropleura, de duizendpoot van meer dan twee meter; in het vroege Trias loopt een kudde
Lystrosaurus, het meest voorkomende landdier van die tijd; de savanne kreeg antilopen, soms een
giraf en vogels, de schemer de eerste sterren; de grot druipstenen, rijen rode stippen en het licht
van een fakkel; en vandaag staan er windmolens aan de horizon. De Silurische zee staat apart van de
oudere zee, omdat zeelelies bij de cellen van twee miljard jaar geleden niet zouden kloppen.

## 2026-09-29 — Klaar voor Google Play, op het afrekenen na

De eigenaar vroeg om de voorbereiding voor de Play Store. Het Android-project bleek nog van voor
de naam Suri: app-ID `nl.studiogoud.wolkenhaven`, naam "Cloudhopper", en het witte opstartscherm
met het logo van Capacitor. Een app-ID staat na de eerste upload voor altijd vast, dus het is nu
`com.studiogoud.suri`, gelijk aan `capacitor.config.ts`, en iOS is meegegaan. Het opstartscherm is
Suri op de schemering van zijn icoon, uit hetzelfde script als het icoon.

De app mikt op API 36, omdat Play sinds eind augustus 2026 geen nieuwe apps op 35 meer aanneemt; dat
is een stap voor Capacitor 7 uit en moet op een telefoon worden nagekeken. De pagina blijft vrij van
de status- en navigatiebalk doordat Capacitor dat zelf doet in plaats van te vertrouwen op wat de
WebView over die balken zegt. De uploadsleutel staat nooit in de repo: `build.gradle` leest hem uit
een bestand dat in `.gitignore` staat of uit de geheimen van de GitHub Action, die het .aab bouwt.
`privacy.html` zegt wat de code doet: niets over het kind verlaat het toestel, en de enige verzoeken
naar buiten zijn foto's van Wikimedia. Alles wat de eigenaar zelf moet doen, en waarom, staat in
`docs/store.md`.

Nagekeken: het .aab bouwt hier, met een weggooisleutel ondertekend, en bundletool leest er
`com.studiogoud.suri`, versie 1.0.0 en doel-API 36 uit. Niet nagekeken: het heeft op geen telefoon
gedraaid, want hier draait geen emulator. Het afrekenen is niet gebouwd; het advies is eerst een
gesloten test, die voor een nieuw ontwikkelaarsaccount toch verplicht is.

## 2026-09-29 — De derde verhaalreis: Suri en de verloren satelliet

De eigenaar wilde de ruimte als verhaal, zoals de reuzentand en het lichtje. De vraag aan het
begin: Stip, Suri's kleine satelliet, is naar Saturnus gevlogen en antwoordt niet meer; zijn laatste
foto laat de ringen zien. Het antwoord aan het eind: zijn antenne was de verkeerde kant op gedraaid.
Onderweg doet het kind zelf wat het voorstel beloofde: de raket starten en door de wolken omhoog
(knop vasthouden), het ruimtestation zoeken, laag over de maan scheren en de maanlander van Apollo 11
vinden, op Mars een buisje gesteente pakken met de robotarm (slepen), en tussen het ijs van de ringen
sturen, door de telefoon te kantelen of met een vinger. Terug gloeit de capsule, gaan op een tik de
parachutes open en landt hij in zee.

Het buisje op Mars is met opzet een van de echte: Perseverance heeft er tien neergelegd die nog op
iemand wachten, en het verhaal zegt dat hardop. Saturnus is in de ringen zelf getekend en niet
gefotografeerd, omdat je daar de ringen precies van opzij ziet, als één dunne lijn; de bekende brede
ringen zijn het uitzicht van erboven. De aarde, de maan, Mars en Saturnus van ver zijn de NASA-foto's
die de grote reis al had. In de ringen kun je nergens tegen botsen op een manier die iets kost: een
brok ijs geeft een tik en tolt weg, want een stap die mislukt bestaat in deze verhalen niet. Wat niet
waar is, zegt het verhaal aan het eind zelf: zo'n reis duurt in het echt heel veel jaren.

`world.ts` kreeg één uitbreiding die ook andere verhalen kunnen gebruiken: een lucht zonder lucht
(`space`) en een eigen haak (`sky`) om sterren, een harde zon of de aarde boven de heuvels te tekenen.

Nagekeken: tsc, 1496 tests (zestien nieuwe voor dit verhaal), audit zonder fouten over deze pagina
en de voorpagina, en het hele verhaal van begin tot eind gereden in een browser, liggend en staand,
met schermafbeeldingen van elke stap. Ruth heeft alle zinnen ingesproken, in beide talen, en de
negentien geluiden (`satelliet.*`) zijn opgenomen. Niet nagekeken: het kantelen van de telefoon,
omdat de browser hier geen kantelsensor heeft; met een vinger sturen werkt wel. Ik hoor de geluiden
zelf niet.

## 2026-09-29 — De vierde verhaalreis: Suri heeft buikpijn

De eigenaar wilde het lichaam als verhaal. De vraag aan het begin: Suri ligt in bed met buikpijn,
wat is daar aan de hand? Het kind gaat piepklein mee met een hapje appel en volgt de weg die eten
echt gaat: in de mond tikt het om te kauwen, in de slokdarm veegt het omlaag om de spierringen te
helpen knijpen, in de maag tikt het om mee te kneden, in de darm kijkt het rond tussen de
darmvlokken en vindt het de bacteriën die de wand pijnlijk maken. In een bloedvat ernaast sleept het
witte bloedcellen naar de bacteriën, die ze opeten. De volgende ochtend is Suri beter.

Het is getekend om een vierjarige niet bang te maken voor zijn eigen buik: warm roze in plaats van
rood, niets dat bloedt, en de bacteriën als staafjes met sliertjes zoals onder een microscoop, zonder
gezicht. Een gezicht zou ze personages maken, en een personage in je buik is eng. Het verhaal zegt
hardop dat er in je darm ook goede bacteriën wonen, en het eindigt met wat een ouder zou zeggen: rust,
drink, was je handen, en ga naar de dokter als buikpijn niet overgaat. Een app mag een kind niet leren
dat buikpijn altijd vanzelf overgaat; een test bewaakt dat die zin er blijft staan.

Alleen de darm is een gewone wereld om je heen, met de darmvlokken als een bos van vingertjes op de
grond. De mond, de slokdarm, de maag en het bloedvat zijn eigen scènes, omdat je daar niet rondkijkt
maar in een buis of een grot zit.

Nagekeken: tsc, 1511 tests (vijftien nieuwe), audit zonder fouten, en het hele verhaal gereden in een
browser, liggend en staand, ook één keer met Ruths stem erbij. Ruth heeft alle zinnen ingesproken, in
beide talen, en de zestien geluiden (`buikpijn.*`) zijn opgenomen. Ik hoor de geluiden zelf niet.

## 2026-09-30 — Weg uit Suri is stil

De eigenaar zag een verhaal doorpraten nadat Suri al dicht was, met "Suri en het lichtje in de
diepte" in het mediapaneel van het vergrendelscherm; een tik daarop opende Safari op een heel andere
site. Twee oorzaken. Ruths stem speelt via een `<audio>`-element, en iOS zet elk zo'n element in dat
paneel, met de titel en het icoon van de pagina, ook gepauzeerd. En sinds de stille-knopfix staat de
audio van de pagina op "playback", en dat is precies wat iOS toestaat om op de achtergrond door te
spelen. Een tik op het paneel opent Safari, niet Suri: Safari laat dan het tabblad zien dat toevallig
vooraan staat.

Nu laat elke opname, als hij af is of wordt afgebroken, zijn bron los (`release()` in `voice.ts`),
zodat hij niet in het paneel blijft hangen, en het paneel hoort dat er niets speelt. En zodra de
pagina verborgen wordt of wordt verlaten, stopt Ruth, wordt de hele geluidsmotor stilgezet (alle
effecten en achtergronden) en wordt het paneel leeggemaakt (`hush()` in `audio.ts`). De eerste tik bij
terugkomst zet het geluid weer aan. "Playback" blijft, omdat de stille knop anders de effecten weer
dempt en Ruth niet.

Nagekeken: tsc, 1511 tests, audit zonder fouten voor het lichtje en de satelliet, en in een browser:
na het verbergen van de pagina staat de geluidsmotor stil en het mediapaneel op "niets", na een tik
loopt hij weer. Niet nagekeken: een echte iPhone. Chromium speelt hier geen mp3, dus het loslaten van
Ruths opnamen is gelezen en niet gehoord.

## 2026-09-30 — Ruth door de geluidsmotor

De eigenaar hoorde sommige zinnen niet. De opnamen waren er wel; ze werden geweigerd. Een iPhone laat
een `<audio>`-element alleen starten vlak na een tik. De volgende zin van een verhaal begint als de
vorige klaar is en een hint na een stille poos, dus niet vlak na een tik: die werden geweigerd, en de
stem van het toestel waar ze dan op terugvielen, wordt om dezelfde reden geweigerd. Stil dus.

Ruths opnamen spelen nu door dezelfde geluidsmotor als de effecten (Web Audio). Die wordt door de
eerste tik ontgrendeld en mag daarna op elk moment spelen. Elke opname wordt opgehaald en gedecodeerd,
het volgende stuk van een zin alvast terwijl het eerste speelt, en een klein geheugen houdt de laatste
zestig vast. Het `<audio>`-element blijft alleen voor een pagina zonder geluidsmotor. Bijvangst: Ruth
komt zo ook nooit meer in het mediapaneel van het vergrendelscherm, en `hush()` legt haar stil met de
rest.

Nagekeken: tsc, 1511 tests, audit zonder fouten voor de reuzentand, het Letterbos en het Klankhuis,
en in een browser: in het lichtje speelt elke zin via de geluidsmotor, er wordt geen enkel
audio-element en geen toestelstem gebruikt, en de volgende zin wacht precies tot de vorige klaar is.
Niet nagekeken: een echte iPhone.

## 2026-09-30 — Ruth nagelopen met oren: korte woorden opnieuw, in een zin

De eigenaar hoorde Ruth dingen zeggen die niet klopten: een roos die klonk als "bloesem", en klanken
en klinkers in het Letterbos die andere klanken waren. De opnamen bestonden wel (`voicecrawl` vond
nul missers), maar niemand had gecontroleerd wát erin gezegd wordt. Een spraakmotor die één los
woord krijgt, heeft geen context en raadt.

`scripts/voicehear.mjs` laat nu elke opname uitschrijven door spraakherkenning (ElevenLabs, op de
bouwmachine) en legt dat naast de bedoelde tekst. Met `--context` gaat er een korte zin in dezelfde
stem voor ("Het woord is:"), omdat de herkenning bij één los woord ook de taal gokt ("sok" werd
Russisch). Van de 4739 korte opnamen weken er zo 436 sterk af. `scripts/voicefix.mjs` spreekt zo'n
regel opnieuw in binnen een zin, knipt met de tijdstempels per letter precies het woord eruit, maakt
de randen zacht en schrijft het over de oude opname onder dezelfde naam. Eenheden worden voluit
gezegd ("km/u" is "kilometer per uur"). Na twee rondes wijken er nog 28 woorden af, en dat zijn
nagenoeg allemaal gevallen waar de herkenning het mis heeft en niet Ruth: "sein" en "zijn", "Lynx"
en "links" klinken hetzelfde, en Latijnse namen zijn voor de herkenning gokwerk.

De losse klanken van het Letterbos ("mmm", "ah", "buh") zijn niet zo te repareren: ook in een zin
blijft een losse klank een gok. `scripts/voicesounds.mjs` knipt elke klank uit zijn eigen voorbeeld-
woord (de aa uit maan, de ui uit huis) en rekt de klanken die je kunt aanhouden op tot een halve
seconde zonder dat ze lager worden. Die staan nog niet in de app: de eigenaar luistert eerst.

Nagekeken: 1511 tests, de nieuwe opnamen decoderen en spelen in een browser, en de controle na het
herstel is hierboven. Niet nagekeken: met eigen oren, want die heb ik niet.

## 2026-09-30 — Getallen voluit voor Ruth

Dezelfde luistercontrole over de lange zinnen vond een tweede soort fout: getallen. "228 miljoen"
kwam eruit als tweeëntwintig miljoen, "375 miljoen jaar" als drieënvijftig, en een decimaalkomma nu
en dan als pauze. De spraakmotor gokt bij cijfers met Nederlandse scheidingstekens. `voice.mjs` schrijft
nu elk getal voluit in het Nederlands voordat Ruth het leest (`scripts/nlnumbers.mjs`): eenheden en
tientallen met "en" en een trema na twee en drie, 1100 tot 9999 in honderdtallen zoals je een jaartal
zegt, een komma als "komma", een prijs in euro's, een tijd als "dertien uur dertig", en eenheden als
km en m/s voluit. Alle 116 Nederlandse zinnen met een getal zijn opnieuw ingesproken en daarna
beluisterd: ze kloppen allemaal. Op de koop toe stond in Moonshot "1 rijen hoog", nu "1 rij hoog".

## 2026-09-30 — Het Letterbos zegt alleen hele woorden

De eigenaar beluisterde de uitgeknipte klanken en besliste: haal de losse klanken eruit en gebruik
alleen het complete woord, dat is het enige juiste. Het Letterbos zegt nu bij elke vraag, elke tegel
die niet past, elk vakje en elke hulp het hele woord, en een zinnetje als geheel. De knop "Klank voor
klank" is weg; "Hoor het woord" staat alleen. De hints die hardop worden gezegd noemen geen losse
klanken meer ("de aa van maan" werd "zoals in maan"), en de ladder zegt "verander één letter".
Losse klanken worden ook niet meer opgenomen (`voice.mjs`). Wat op het scherm als tekst staat bij een
fout ("ei en ij klinken hetzelfde") blijft: dat wordt gelezen, niet gezegd.

Dit laat een deel van de oorspronkelijke methode los (eerst het woord, dan klank voor klank). Dat is
een keuze van de eigenaar, en een betere dan klanken die niet kloppen. De tekst van het Letterbos in
de catalogus beloofde "hoor het woord, hoor de klanken"; die is mee aangepast.

Nagekeken: tsc, 1511 tests, audit van het Letterbos zonder fouten, en in een browser vijf niveaus
gespeeld terwijl alles wat werd gezegd werd opgeschreven: alleen hele woorden en de hints.

## 2026-09-30 — De grote controle: het fundament, met agents

De eigenaar was de draad kwijt en vroeg om drie dingen: herinneren waarvoor Suri is, het fundament
als een huis, en een volledige controle voor Android. De drie poorten waren groen (tsc, 1511 tests,
audit 0 fouten over 32 schermen), en toch vonden vijf agents die parallel keken - code-review van het
fundament, een speelronde over alle 29 pagina's, de Android-build, een tekst- en feitencontrole, en
een productblik - dit:

**De tijdslimiet werkte niet.** De klok schreef elke vijftien seconden een kwart minuut, maar de
schoonmaker las de minuten als heel getal terug: 0,25 werd 0, en de dag raakte nooit op. Een kind met
dertig minuten speelde onbeperkt en de ouder zag "0 van 30". Geen test dekte klok en opslag samen;
nu twee wel. Dit was de belangrijkste belofte aan de ouder en hij was een leugen op het scherm.

Wat verder is hersteld, met de regel erbij: Cloudhopper telde als enige niet mee en had geen
`debugState` (regel 7, en de audit); de schakelaar "Waarschuwen voor het einde" schreef een waarde
die niemand las (regel 7), en zegt nu één keer hardop "nog twee minuten"; "Code wijzigen" wiste de
oude code voordat er een nieuwe was, zodat het volgende kind er zelf een kon kiezen; tijd ging
verloren bij elke paginawissel (nu geboekt bij het verlaten); het einde van de dag onderbrak een
verhaal zonder het stil te zetten en werd niet gezegd (regel 6); een corrupt save-bestand kon de app
laten crashen (nu valt elk veld apart terug, met tests); de stem kon een verhaal eeuwig laten wachten
als het eerste stukje van een regel niet laadde; een kind verwijderen zette de klok voor de anderen
stil; de taalkeuze zat alleen in Cloudhoppers instellingen en staat nu op het ouderscherm.

Op Android stond `allowBackup` aan: dan gaat de voortgang van een kind mee naar het Google-account
van de ouder, en `privacy.html` zegt dat dat bestand het toestel nooit verlaat. Regel 1 beslist: uit.

Teksten: de FAQ vroeg letterlijk "Is het pedagogisch goedgekeurd?" (regel 4, ook als vraag);
"leer het hardop zeggen" bij Klokkijken (regel 3); "overgeven" waar "stoppen" bedoeld was; zeven
uitroeptekens; verouderde beloften over de stem, het aantal onderdelen en offline; en een reeks
feiten in de reizen die te stellig of onjuist waren (Napoleon bij de Mosasaurus, "het luidste dier",
"niets groeit onder 200 meter", tanden die "terugkomen", sneeuw waar de Noordzee toendra was, een
T. rex die "ons niet ziet"). Alles is hardop opnieuw ingesproken.

Nagekeken: tsc, 1523 tests, audit 0 fouten, en de tijdslimiet in een browser: 4 → 4,25 → 4,5 → 4,75
→ 5 minuten en dan het slaapscherm. Niet nagekeken: een echte telefoon. Open voor de eigenaar:
Cloudhoppers modus "Eindeloos" na een missie staat op gespannen voet met "elk spel heeft een laatste
ronde"; de munten daar zijn verdiend, niet gekocht, en dat mag van regel 2.

## 2026-09-30 — Tot acht jaar, de week van een kind, en de namen op de voorpagina

De eigenaar besloot: Suri is voor twee tot acht, niet tot tien. Niets in de app was echt voor een
tienjarige gemaakt, en een band die je niet waarmaakt is een claim op de winkelpagina. De catalogus
stopt nu bij 8, de leeftijdskeuze op het ouderscherm ook, en het manifest, de privacyverklaring en de
winkeltekst zeggen hetzelfde. Een kind dat al op 9 of 10 stond valt terug op 8.

Het ouderscherm liet alleen "vandaag" zien: minuten en afgemaakte dingen. Een ouder die op zaterdag
kijkt wil weten wat er deze week gebeurd is. Daarom houdt de klok nu per kind en per dag bij hoeveel
minuten in welk onderdeel zijn gegaan (`family.log`, 28 dagen, daarna weggegooid; regel 1: dit
verlaat het toestel niet). Het paneel "Deze week" telt de laatste zeven dagen op, per onderdeel, met
de regel "oefent" uit de catalogus eronder, en zegt er zelf bij dat niemand heeft gemeten wat een kind
ervan meeneemt (regel 3). Geen grafiek, geen vergelijking, geen ranglijst.

Met twee kinderen moest een ouder voor elke wissel door de code. Dat is een reden om het niet te
doen, en dan telt alle tijd op het verkeerde kind. Daarom staan de namen nu als knoppen bovenaan de
voorpagina zodra er meer dan één kind is; een tik wisselt het kind en herlaadt de pagina. Een kind kan
zo natuurlijk de tijd van een broer of zus opmaken. Dat is een afweging: de tijdslimiet is een
afspraak, geen slot, en de ouder kan de knoppen uitzetten ("Namen op de voorpagina" op het
ouderscherm, regel 7: die schakelaar doet echt iets).

Nagekeken: tsc, 1529 tests, audit 0 fouten, en in een browser: twee kinderen met een gezaaide week,
tik op de tweede naam wisselt het kind, en het ouderscherm toont de week met de juiste minuten. De
eerste poging leek te falen omdat het testscript de opslag bij elke herlaadbeurt opnieuw zaaide; de
app deed het goed. Niet nagekeken: een echte telefoon.

## 2026-09-30 — Getijdenpoel en Dierenboek voor twee en drie

De derde en vierde eenvoudige vorm, naar het patroon van 2026-09-22: hetzelfde spel met de regels
eruit, gekozen op de leeftijd die de ouder invult, met de grens op één plek (`src/platform/who.ts`).

**Getijdenpoel.** Het hele spel draait om de wissel van regel, en een tweejarige houdt geen regel
vast, laat staan twee. Voor drie en jonger is er dus één regel, kleur, die nooit wisselt; twee
poelen; één dier tegelijk, dat langzaam aankomt en aan de kust blijft wachten in plaats van weg te
drijven. Een verkeerde poel is niet fout: het dier gaat terug het water op en Suri zegt de kleur
nog eens ("Deze is rood."). Geen schelpen, geen reeks, geen sterren, geen munten, geen lijst van
getijden en niets dat wordt opgeslagen. Tien dieren, dan "Nog een keer". Het niveau staat als
`SIMPLE_LEVEL` in het model, zodat de tests het zonder browser kunnen lezen.

**Dierenboek.** Bladeren, foto's, een pagina die wordt voorgelezen en "Verras me" zijn al één
gebaar per stuk. Het enige dat letters vraagt is zoeken met het toetsenbord, en dat is voor drie en
jonger weg. De rest blijft: een tweejarige die op een olifant tikt hoort "olifant", en dat is het
boek.

Beide staan nu op `from: 2` in de catalogus, en de audit kijkt naar allebei ook als tweejarige (34
schermen). Vier van de zesentwintig dingen passen nu bij twee; wat daarna helpt is geen vijfde
vereenvoudiging maar een ding dat voor twee gemaakt is.

Nagekeken: tsc, 1537 tests, audit van Getijdenpoel, Dierenboek en de voorpagina 0 fouten, en in een
browser als tweejarige: tien dieren gesleept, waarvan drie eerst naar de verkeerde poel, einde
"Het tij is gesorteerd" zonder fout of gemist. Niet nagekeken: een echte telefoon.

## 2026-09-30 — Twee verhalen die niet over de wereld gaan maar over de dag: verkeer en het donker

De vijf verhaalreizen tot nu toe beantwoorden een vraag over de wereld: hoe diep is diep, wat zit er
in je buik. De eigenaar vroeg om twee die dichter bij de dag van een kind liggen: verkeer, en een
gevoel. Allebei op de gedeelde `Stage` (`src/story/stage.ts`), als data plus een scène, zoals de
andere; allebei gebouwd door een agent en daarna hier nagekeken, aangesloten en gedreven.

**Suri en de fietstocht** (`verkeer`). Naar oma, in de volgorde van een echte rit: helm en bel
thuis, met de fiets aan de hand naar de stoeprand en links, rechts, links kijken (het kind draait
echt de camera, en de auto komt pas als er gekeken is), het rode fietspad met het blauwe bord,
het zebrapad waar Suri afstapt omdat je dan pas voetganger bent, het stoplicht, en de deur van oma.
Elke stap zegt hardop waarom. De regels zijn nagezocht in het RVV en staan in `docs/claims.md`;
de helm is "een goed idee" en nooit verplicht, want dat is hij in Nederland niet. Er gebeurt niets
engs en niets kan fout: op rood op "ga" tikken levert één zin op ("Nog even wachten. Het is rood.")
en geen fout. Hoe ver je moet draaien om gekeken te hebben en hoe lang het rood minstens duurt zijn
productkeuzes, en de code zegt dat.

**Suri en het donker** (`donker`). Het eerste onderdeel over een gevoel, en daarom het onderdeel
dat het minst beweert. Suri is bang als het licht uitgaat; het kind zit bij hem, zoekt wat de
schaduw maakt (een jas op een stoel) en wat het geluid maakt (de wind bij het raam), ademt drie
keer langzaam mee met een cirkel, en kiest een nachtlampje. Drie besluiten die de toon bepalen:

1. **"Bang zijn mag", nooit "je hoeft niet bang te zijn".** De tweede zin zegt een kind dat het
   gevoel fout is. Een test bewaakt dat hij nergens staat.
2. **Het gevoel eindigt kleiner, niet weg.** Een verhaal dat belooft dat de angst over is, liegt
   tegen een kind dat morgen weer bang is. En er is altijd een volwassene om te roepen: dat is een
   belofte namens de ouder, en de reden dat een ouder dit verhaal eerst zelf een keer speelt.
3. **Ademen is "veel mensen voelen zich daar wat rustiger van", niet meer.** Niets wordt behandeld
   of genezen; de tijden van de cirkel zijn productkeuzes. Regel 3 en 4 in één: dit onderdeel
   verdient als eerste de blik van een pedagoog, en `docs/claims.md` zegt dat.

De schaduw was in de eerste versie te groot en te veel een figuur met opgeheven armen; hij is
kleiner gemaakt. Er is geen monster dat echt blijkt en niets dat tevoorschijn springt.

Nagekeken: tsc, 1573 tests, audit van beide pagina's 0 fouten (36 schermen nu), stem en geluiden
opnieuw gerenderd, en beide verhalen in een browser van begin tot eind gedreven met echte tikken
en vegen. Niet nagekeken: een echte telefoon, en een pedagoog heeft dit niet gezien.
