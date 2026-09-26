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

Bron: het veld `practises` per rij in `src/platform/catalog.ts`. Twintig rijen, elk één zin.

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
| Letterbos | klanken horen, woorden bouwen, ei/ij, au/ou | fonemisch bewustzijn als voorloper van lezen; `docs/research.md` §4.1 |
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
| De tijd van de dino's | luisteren, hoe lang geleden lang geleden is, diepere grond is oudere grond | geen bron; mijn inschatting. De leeftijden zijn de gangbare afgeronde per dier |

Veertien van de twintig staan op "mijn inschatting" (dat waren er twaalf van de achttien; hier stond eerder "elf", wat een telfout was). Dat is de grootste open post in dit document.

## B. Schermtijd

- **Twee tot zes.** Vijf tot tien minuten per keer en maximaal een half uur per dag (2-4); tien
  tot vijftien minuten en maximaal een uur (4-6). Bron: Nederlands Jeugdinstituut, via
  `docs/research.md` §3.1. Geïmplementeerd in `limitsForAge()` in `src/platform/session.ts`.
  **Te toetsen:** of ik de richtlijn juist lees, en of "de bovenkant nemen omdat het een plafond
  is dat een ouder kan verlagen" een verdedigbare keuze is.
- **Zeven tot tien.** `{75, 20}` en `{90, 25}` minuten. **Bron: geen.** Dit zijn mijn getallen.
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
