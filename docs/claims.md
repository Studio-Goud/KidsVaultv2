# Claims die een (ortho)pedagoog moet toetsen

Status: open. Niemand met een pedagogische opleiding heeft Suri gezien.

Dit is de lijst van alles wat de app of zijn documentatie beweert over kinderen, en wat er
onder elke bewering ligt. Hij bestaat om twee redenen. De eerste is dat ik ze zelf niet kan
toetsen, en dat het oneerlijk zou zijn om dat verschil weg te schrijven. De tweede is praktisch:
als er ooit een orthopedagoog naar deze app kijkt, moet die niet eerst de hele broncode door om
te vinden waar de uitspraken staan.

De regel die ik mezelf heb opgelegd en die overal in de app terugkomt: **"oefent" mag, "leert"
niet.** Oefenen is een uitspraak over wat een kind doet terwijl het speelt, en die kan ik
verantwoorden. Leren is een uitspraak over wat er daarna van over is, en die kan alleen wie het
gemeten heeft. Zie `src/parents/faq.ts`, vraag `learn`.

En de tweede: **"pedagogisch goedgekeurd" staat nergens en mag nergens komen te staan** tot dit
document leeg is en er een naam onder staat.

---

## A. Wat elk onderdeel zegt te oefenen

Bron: het veld `practises` per rij in `src/platform/catalog.ts`. Zesentwintig rijen, elk één zin.

Wat een pedagoog zou moeten nakijken, per rij:

1. **Is de vaardigheid juist benoemd?** Letterbos zegt "de klanken in een woord horen, er een
   woord van bouwen". Dat is fonemisch bewustzijn en fonemische synthese. Heten die dingen zo,
   en is dat wat het spel daadwerkelijk vraagt?
2. **Is de leeftijd juist?** Elke rij heeft een `from` en een `to`. Die zijn door mij gekozen op
   grond van wat de taak vraagt, niet op grond van een genormeerde ontwikkelingslijn.
3. **Is er een onderdeel dat iets oefent wat op die leeftijd averechts werkt?** De enige waar ik
   zelf twijfel over heb is Klokkijken: de Nederlandse tijdsaanduiding ("tien voor half vier")
   is een dubbele bewerking, en ik weet niet of die op zeven jaar te vroeg komt.

Concreet te toetsen rijen, met wat erachter zit:

| Onderdeel | Zegt te oefenen | Waar dat op steunt |
|---|---|---|
| Letterbos | een gehoord woord bouwen, letters die samen horen, ei/ij, au/ou | spelt woorden; sinds 2026-09-30 zonder losse klanken, dus de verwijzing naar fonemisch bewustzijn (`docs/research.md` §4.1) geldt nog maar ten dele |
| Rekenrijk | uittellen, vergelijken, hoeveel erbij | tellen als handeling met voorwerpen; §4.2 |
| Marktdag | uittellen, eerlijk delen, hoeveel erbij | idem |
| Klokkijken | wijzerplaat en de Nederlandse manier van zeggen | geen bron; mijn inschatting |
| Het jaar rond | dagen en maanden op volgorde, gisteren en morgen, seizoenen, dagdelen | geen bron; mijn inschatting. De zonnestand per seizoen in de tekening is wel natuurkunde: 52° NB plus de declinatie |
| Getijdenpoel | denkflexibiliteit, van regel wisselen | regelwissel-taken (DCCS-achtig); §4.3 |
| Nachtwacht | visueel werkgeheugen | §4.3 |
| Klankhuis | de tel vasthouden, lang/kort, hoog/laag | §4.4 |
| Watermolen | ruimtelijk inzicht, vooruitdenken, oorzaak/gevolg | geen bron; mijn inschatting |
| Stroomkring | oorzaak en gevolg, systematisch zoeken | geen bron; mijn inschatting |
| Opgraving | geduld, het geheel herkennen aan de delen | geen bron; mijn inschatting |
| Planetarium | ordenen, groottes vergelijken, beweging voorspellen | geen bron; mijn inschatting |
| Wereldatlas | waar plekken ten opzichte van elkaar liggen | geen bron; mijn inschatting |
| Dierenboek | goed kijken, vergelijken, indelen, opzoeken | geen bron; mijn inschatting |
| Moonshot | oorzaak en gevolg, stap voor stap uitproberen | geen bron; mijn inschatting |
| Stuifzwam | vakjes tellen, twee getallen vergelijken, uitweg plannen | geen bron; mijn inschatting |
| Cloudhopper | plannen, volgorde, overzicht houden | geen bron; mijn inschatting |
| De grote reis | luisteren, afstanden, volgorde van de planeten | geen bron; mijn inschatting |
| De diepzee | luisteren, hoe diep diep is, wat waar leeft | geen bron; mijn inschatting |
| Het menselijk lichaam | luisteren, waar alles in je eigen lijf zit en waarvoor | geen bron; mijn inschatting. De centimeters zijn voor een kind van 1,20 m (TNO-groeicurven, zesjarige) |
| Suri en de reuzentand | luisteren naar een verhaal, goed kijken en vergelijken, ouder is dieper | geen bron; mijn inschatting |
| Suri en het lichtje in de diepte | luisteren naar een verhaal, goed kijken, hoe diep diep is | geen bron; mijn inschatting |
| Suri en de verloren satelliet | luisteren naar een verhaal, sturen, de volgorde van de planeten | geen bron; mijn inschatting |
| Suri heeft buikpijn | luisteren naar een verhaal, waar het eten in je eigen lijf naartoe gaat | geen bron; mijn inschatting |
| Suri en de fietstocht | luisteren naar een verhaal, kijken voor je oversteekt, wat borden en lichten zeggen | geen bron; mijn inschatting |
| Suri en het donker | luisteren naar een verhaal, een gevoel een naam geven, wat helpt als je bang bent | geen bron; mijn inschatting. Dit is het enige onderdeel over een gevoel, en het verdient als eerste een blik van een pedagoog |
| Van cel tot mens | luisteren naar een verhaal, goed kijken, hoe kleine veranderingen over heel lange tijd optellen | geen bron; mijn inschatting |
| De tijd van de dino's | luisteren, hoe lang geleden lang geleden is, diepere grond is oudere grond | geen bron; mijn inschatting. De leeftijden zijn de gangbare afgeronde per dier |

Twintig van de zesentwintig staan op "mijn inschatting" (dat waren er twaalf van de achttien; hier stond eerder "elf", wat een telfout was). Dat is de grootste open post in dit document.

## B. Schermtijd

- **Twee tot zes.** Vijf tot tien minuten per keer en maximaal een half uur per dag (2-4); tien
  tot vijftien minuten en maximaal een uur (4-6). Bron: Nederlands Jeugdinstituut, via
  `docs/research.md` §3.1. Geïmplementeerd in `limitsForAge()` in `src/platform/session.ts`.
  **Te toetsen:** of ik de richtlijn juist lees, en of "de bovenkant nemen omdat het een plafond
  is dat een ouder kan verlagen" een verdedigbare keuze is.
- **Zeven en acht.** `{75, 20}` minuten. **Bron: geen.** Dit zijn mijn getallen.
  De code zegt dat erbij en het ouderscherm zegt het ook. **Te toetsen:** wat hier hoort te staan,
  of dat een limiet op deze leeftijd überhaupt het juiste instrument is.

## C. Het einde van een sessie

- **Geen waarschuwing vooraf, wel een aangekondigde laatste beurt.** Bron: Hiniker e.a., CHI
  2016, via `docs/research.md` §3.2: een waarschuwing van "nog twee minuten" maakte de overgang
  zwaarder bij kinderen van één tot vijf, een natuurlijk eindpunt maakte hem lichter.
  Geïmplementeerd in `isLastGo()` en het afsluitscherm in `src/platform/clock.ts`.
  **Te toetsen:** of ik die bevinding correct vertaal naar wat de app doet, en of de uitkomst
  voor kinderen van zes tot tien nog geldt - het onderzoek ging over één tot vijf.

## D. De eenvoudige vorm voor twee- en driejarigen

- **Claim:** onder de vier jaar is één gebaar, geen regel, geen vraag en geen manier om te
  verliezen de juiste vorm van een spel. Zie `src/platform/who.ts` en de eenvoudige vorm van
  Opgraving.
- **Waar het op steunt:** `docs/research.md` §2.1 over wat een tweejarige met een scherm kan.
- **Te toetsen:** of de grens bij drie jaar goed ligt, en of "niet kunnen verliezen" op deze
  leeftijd inderdaad beter is dan "mogen verliezen zonder gevolgen".

## E. Audio-first

- **Claim:** alles wat ertoe doet wordt hardop gezegd, omdat een kind van vier niet leest.
- **Te toetsen:** of de zinnen kort en concreet genoeg zijn voor de leeftijd waarvoor ze bedoeld
  zijn. Ze zijn door mij geschreven en door niemand met verstand van taalaanbod nagekeken. De
  volledige lijst staat in de broncode; het is per spel één tot tien zinnen.

## F. De feiten

Alle inhoudelijke feiten - dinosauriërs, planeten, dieren, de diepzee - zijn door mij nagezocht
en zijn geen pedagogische claim. Die horen hier niet thuis, maar wel de vorm ervan:

- **Te toetsen:** of een zin als "De Mount Everest zou er in passen en er zou nog water boven
  staan" op vijf jaar iets betekent, of dat het alleen klinkt alsof het iets betekent.
- **Het lichtje in de diepte** zegt deze feiten hardop, elk nagezocht maar door niemand met
  verstand van zeebiologie nagelezen: de zones (zonlicht tot 200 m, schemer tot 1000 m, daaronder
  geen daglicht; de indeling van NOAA); lantaarnvissen maken zelf licht; een potvis duikt naar
  beneden voor inktvis en kan een uur onder water blijven (gemiddeld zo'n drie kwartier, soms
  langer dan anderhalf uur); water op anderhalve kilometer is een graad of vier; zeesneeuw bestaat
  uit dalende kruimels van boven; veel diepzeedieren maken licht om elkaar te vinden of te jagen;
  alleen vrouwtjes hengelaarsvissen hebben een lichtje, en daar leven bacteriën in; Melanocetus is
  ongeveer achttien centimeter, zo groot als een banaan. Eén ding is een verhaalkeuze en geen feit:
  zo snel als in het verhaal zakt geen duikboot anderhalve kilometer.
- **De verloren satelliet** zegt deze feiten hardop, nagezocht maar door niemand van een
  ruimtevaartorganisatie nagelezen: het ruimtestation vliegt zo'n 400 km hoog en gaat in ongeveer
  anderhalf uur rond de aarde (92 minuten), dus zo'n zestien zonsopkomsten per dag; wolken zitten
  onder de 12 km en boven de 100 km (de Kármánlijn) is de lucht zwart; de maan staat gemiddeld
  384.400 km van de aarde, er is geen lucht en het regent er nooit; Apollo 11 landde in 1969, het
  onderstel van de maanlander bleef staan en de voetstappen zijn er nog; Mars is rood door ijzeroxide
  (roest) in het stof en de lucht is overdag geelbruin; Perseverance heeft tien verzegelde buisjes
  met gesteente neergelegd bij Three Forks in de krater Jezero, en die zijn nog niet opgehaald; Mars
  staat gemiddeld 228 miljoen km van de zon en Saturnus 1,4 miljard; de ringen zijn ijs van
  stofkorrels tot brokken zo groot als een huis (NASA), en van opzij gezien een dunne lijn;
  Saturnus is minder dicht dan water; een radiosignaal doet er van Saturnus naar de aarde 67 tot 92
  minuten over, afhankelijk van waar beide in hun baan staan; een capsule komt terug onder drie parachutes en landt in zee. Twee dingen zijn een
  verhaalkeuze en geen feit, en het verhaal zegt dat aan het eind ook hardop: de reis duurt in het
  echt jaren, en Stip is verzonnen. Hoe de raket stijgt (`altitudeAt`) is een vorm die goed voelt,
  geen baanberekening.
- **Suri heeft buikpijn** zegt deze feiten hardop, nagezocht maar door geen arts nagelezen: een
  kind heeft twintig melktanden; speeksel begint het eten al af te breken (amylase, zetmeel);
  spierringen in de slokdarm knijpen het eten naar beneden (peristaltiek), en slikken lukt daarom
  ook op je hoofd; maagzuur doodt de meeste ziekteverwekkers en een laag slijm beschermt de maagwand;
  de maag kneedt het eten tot pap (chymus); de dunne darm is bij een volwassene zo'n zes meter en
  zit vol darmvlokken die voedingsstoffen aan het bloed doorgeven; in de darm leven ook veel goede
  bacteriën; ziekmakende bacteriën uit eten kunnen de darmwand irriteren en buikpijn geven; rode
  bloedcellen vervoeren zuurstof en het bloed gaat in ongeveer een minuut het lichaam rond; witte
  bloedcellen kunnen de bloedbaan verlaten en bacteriën opeten (fagocytose). Een verhaalkeuze en
  geen feit: dat je piepklein naar binnen kunt, en dat de witte bloedcellen hulp nodig hebben. Het
  verhaal eindigt met het advies van een ouder, niet van een arts: rust, drinken, handen wassen, en
  naar de dokter als buikpijn niet overgaat. Dat laatste staat er met opzet, en een test bewaakt het.
- **Suri en de fietstocht** zegt deze dingen hardop, nagezocht in het RVV 1990 en de gangbare
  verkeerslessen, maar door geen verkeersdeskundige nagelezen: in Nederland fiets je rechts; een
  rood fietspad is voor fietsen en een blauw rond bord met een fiets erop (G11) zegt hetzelfde; een
  helm beschermt je hoofd als je valt en is "een goed idee", nooit "verplicht", want er is geen
  helmplicht voor fietsers; op een zebrapad moeten auto's stoppen voor voetgangers die oversteken
  (RVV art. 49), daarom stapt Suri af en loopt hij met de fiets aan de hand, en toch kijk je eerst;
  rood is stoppen, groen is gaan; voor het oversteken kijk je links, rechts, links, omdat op de
  dichtstbijzijnde rijstrook het verkeer van links komt; een bel zegt "hier kom ik". Hoe ver je moet
  draaien om "gekeken" te hebben (`LOOK_YAW`) en hoe lang het rood minstens duurt (`RED_MIN`) zijn
  productkeuzes. Er gebeurt niets engs: geen aanrijding, geen claxon, niemand doet iets fout.
- **Suri en het donker** is het enige onderdeel over een gevoel en beweert daarom zo min mogelijk.
  Het zegt hardop: bang zijn in het donker is heel gewoon bij kleine kinderen (een van de meest
  voorkomende angsten van de peuter- en kleutertijd); een gevoel heeft een naam en als je de naam
  weet kun je er makkelijker over praten (een claim over praten, niet over het weggaan van de
  angst); een schaduw komt altijd ergens vandaan en als je kijkt is het weer een jas; veel mensen
  voelen zich wat rustiger van langzaam ademen ("veel", "voelen", niet meer dan dat: er wordt niets
  behandeld of genezen); een nachtlampje mag; je mag altijd papa of mama roepen (een belofte namens
  de ouder, en de reden dat een ouder dit verhaal eerst zelf een keer speelt). Het verhaal zegt
  nooit "je hoeft niet bang te zijn" en eindigt met een gevoel dat kleiner is, niet weg. De tijden
  van het ademen (`BREATH_IN`, `BREATH_OUT`) zijn productkeuzes, geen voorschrift. Een test bewaakt
  de zinnen die hier genoemd staan.
- **Van cel tot mens** zegt deze feiten hardop, nagezocht maar door geen bioloog nagelezen: de
  oudste sporen van leven zijn ruim 3,5 miljard jaar oud; cellen met een kern zo'n 2 miljard;
  dieren van veel cellen zo'n 600 miljoen; Haikouichthys 518 miljoen, zo lang als een vinger, met
  een staaf (chorda) in de rug; beenvissen met kaken zo'n 420 miljoen; Tiktaalik 375 miljoen, met
  in zijn vin één bot, dan twee, dan kleine botjes; Acanthostega 365 miljoen, acht vingers aan de
  voorpoot, een neef en geen voorouder; de eerste eierleggers met schaal aan onze kant zo'n 310
  miljoen; Thrinaxodon 250 miljoen, poten meer onder het lijf, misschien snorharen; Morganucodon zo'n
  205 miljoen, zo klein als een muis, waarschijnlijk vooral 's nachts actief; de inslag 66 miljoen
  jaar geleden; de eerste primaten zo'n 55 miljoen; Proconsul zo'n 20 miljoen, zonder staart; de
  splitsing met de chimpansees zo'n 7 miljoen (Sahelanthropus), chimpansees als neven; Lucy 3,2
  miljoen, rechtop, iets meer dan een meter; Homo habilis zo'n 2,3 miljoen, stenen werktuigen; Homo
  erectus zo'n 1,9 miljoen, lange benen, Afrika uit, later vuur; Homo sapiens zo'n 300.000 jaar
  (Jebel Irhoud); grotschilderingen meer dan 40.000 jaar. De zeven seconden: 300.000 van 3,7 miljard
  jaar op een dag van 86.400 seconden is 7,0 seconden. De berkenspanner: roet maakte in Engeland in
  de negentiende eeuw de stammen zwart, rond Manchester werden de donkere vlinders bijna de enige,
  en na schonere lucht kwamen de lichte terug. Wat getekend is, is geen feit: de kleuren van de
  dieren en hun precieze vorm zijn een voorstelling, en het lijf tussen twee stops in is een
  tussenvorm om de verandering te laten zien, geen gevonden fossiel.

## G. Wat de app níét beweert, en zo moet blijven

- Niet: dat een kind hier leert lezen, rekenen of klokkijken.
- Niet: dat schermtijd met deze app beter is dan schermtijd met iets anders.
- Niet: dat het pedagogisch verantwoord, goedgekeurd of getoetst is.
- Niet: een leeftijd in maanden, een niveau, een score die met een schoolniveau te maken heeft.

---

## Wat een toets zou kosten

Eén orthopedagoog die een dag met de app en deze lijst doorbrengt, haalt A en G eruit. Voor B, C
en D is dat niet genoeg: daar zou je willen kijken hoe kinderen het daadwerkelijk gebruiken. Dat
is een onderzoek en geen review, en tot dat er is blijft de eerlijke formulering staan: dit oefent
iets, en wat er blijft hangen weten we niet.
