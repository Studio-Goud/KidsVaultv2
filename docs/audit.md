# Fase 1 — Audit van de bestaande app

Datum: september 2026. Gemeten aan commit `bedacfc`. Niets gebouwd; dit is een oordeel.

**Hoe gemeten.** Regels code en bundelgroottes uit de build; leeftijdslabels en leerdoelen uit
`src/hub/main.ts`; testdekking uit `tests/run.mjs`; schermweergave uit `npm run audit` (17 pagina's
× 5 schermformaten) en `npm run contact`. Waar ik iets niet kon meten staat dat erbij.

**Wat ik niet heb kunnen toetsen:** gedrag op echte toestellen (alleen Chromium in een sandbox),
prestaties op oude hardware, en de pedagogische juistheid van welk leerdoel dan ook. Dat laatste
hoort bij de (ortho)pedagoog uit fase 0 §9.

---

## 1. De kern: dit is niet dezelfde app

Het brief vraagt een hub voor **2 tot 6 jaar**. Wat er staat is een verzameling voor **oudere
kinderen**. Dat is geen detail, het is de hele opgave.

| Leeftijdslabel | Aantal games |
|---|---|
| 6+ | 4 (Cloudhopper, Moonshot, Stroomkring, Klokkijken) |
| 5+ | 8 |
| 4+ | 4 (Getijdenpoel, Marktdag, Dierenboek, Klankhuis) |
| **2-3 jaar** | **0** |
| **3-4 jaar** | **0** |

De onderste band van de doelgroep — de helft ervan in jaren — wordt door geen enkel spel bediend.
En het gaat dieper dan een label: de bediening van bijna alles is slepen-en-plaatsen met
meerstaps­regels, en de uitleg staat in geschreven zinnen.

**Eén uitzondering, en die is waardevol:** Opgraving. Het kind veegt met een vinger zand weg tot
er een skelet verschijnt. Eén gebaar, geen regels, geen faalmogelijkheid, direct gevolg. Dat is
precies wat een tweejarige kan (fase 0 §2.4). Het is het enige spel waarvan de kern nu al in de
onderste band past.

---

## 2. Audio-first: de grootste breuk met de ontwerpprincipes

Ontwerpprincipe 3 uit fase 0: *elke instructie gesproken, geen tekst nodig om te spelen.*

**Gemeten: 1 van de 15 games heeft spraak.** Alleen Letterbos praat (`src/games/letters/speech.ts`).
De andere veertien leunen volledig op geschreven tekst — tussen de 7 en 50 `fillText`-aanroepen per
spel, waaronder alle niveaunamen, hints, foutmeldingen en uitleg.

| Voorbeeld | Wat er nu staat | Leesbaar voor een 4-jarige? |
|---|---|---|
| Stroomkring | "De batterij zit nog nergens aan vast." | nee |
| Moonshot | "Tik op een raket, of sleep zelf onderdelen omhoog." | nee |
| Rekenrijk | "Splitsen tot 10", "Over het tiental" | nee |
| Wereldatlas | provincienamen als opdracht | nee |

Dit is geen laagje dat er later overheen kan. Het raakt de schermindeling (een gesproken zin heeft
geen balk nodig), de interactie (principe 4: tijdens spraak niet kunnen tikken) en de opbouw van
elke les. **Audio-first is een herbouw, geen toevoeging.**

Letterbos is wel het bewijs dat het kan, en is het model: het spreekt het woord, spreekt de losse
klanken, en laat het kind de afbeelding aantikken om het opnieuw te horen.

---

## 3. Techniek

### 3.1 Stack (het brief liet dit open)
Geen React Native, geen Flutter. Het is **TypeScript + Vite + Canvas 2D**, met **Capacitor 7** voor
iOS en Android. Eén afhankelijkheid in productie (`@fontsource/nunito`); alle beeld en geluid wordt
in code getekend en gesynthetiseerd.

**Oordeel: dit is een sterke basis en ik zou hem houden.** Geen framework betekent geen
framework-schuld, geen tracking-SDK's die per ongeluk meeliften (belangrijk voor fase 0 §5), en
volledige controle over elke pixel. Het is ook de reden dat de hele app op een oud toestel vloeiend
kan draaien. De prijs is dat er geen kant-en-klare componenten zijn: elk scherm is met de hand
gelegd, en dat is precies waar de fouten in zitten (zie §3.4).

### 3.2 Architectuur
Elk spel is een eigen pagina met een eigen bundel (`moonshot.html` → `moonshot-*.js`). Dat is
toevallig al modulair: een spel laadt alleen zichzelf.

Wat **ontbreekt** voor de schaal uit fase 2:
- **Geen metadata-register.** Leeftijd, domein, leerdoel en duur staan als losse tekst in
  `src/hub/main.ts`, niet als data waar code iets mee kan. Een ouder die "alleen ruimtevaart, 3-4
  jaar" wil kiezen, kan nergens uit gefilterd worden.
- **Geen gedeelde spel-schil.** Elk spel herhaalt zijn eigen `resize`, `draw`, `at`, veilige zone en
  lus. Dat werd pijnlijk zichtbaar bij de veilige-zone-bug: één fout moest op vijftien plekken
  gerepareerd worden.
- **Geen gids.** Er is geen personage, in geen enkel spel. Ontwerpprincipe 14 (één gids over alle
  domeinen) en pijler 4 (sociaal interactief) — de zwakste pijler in de markt — zijn nog helemaal
  open.

Wat er **wel** al staat en goed is: `src/platform/skill.ts` (adaptieve moeilijkheid per onderwerp),
`src/platform/progress.ts` (één vorm voor voortgang), `src/render/look.ts` (huisstijl-primitieven).
Dat is het begin van de architectuur uit fase 2.

### 3.3 Internationalisatie — kapot
Het brief vraagt i18n vanaf dag 1. Wat er is, is twee systemen naast elkaar:

- `src/i18n.ts`: een echte sleutel-woordenboek met 542 sleutels, gebruikt door Cloudhopper en de
  gedeelde schermen.
- **362 losse `T('english', 'dutch')`-paren** verspreid door de spelbestanden, elk spel met zijn
  eigen hulpfunctie.

En een echte fout: **12 van de 15 games lezen `navigator.language` in plaats van de taalinstelling.**
Zet een ouder de taal op Nederlands op een Engels toestel, dan blijven twaalf spellen Engels.
Alleen Letterbos en Dierenboek volgen de instelling. Een derde taal toevoegen zou nu betekenen:
362 plekken met de hand langs.

### 3.4 Wat er recent is rechtgezet (en wat dat zegt)
Vier fouten op één foto van een echte iPhone bleken twee oorzaken te hebben, en de eerste raakte
**alle zestien spellen**: canvas en stylesheet waren het oneens over waar het scherm begint, omdat
`env(safe-area-inset-top)` via een CSS-variabele in WebKit anders uitleest dan in Chromium. Dat is
nooit opgevallen omdat er op Chromium getest werd.

Daaruit is `npm run audit` ontstaan: 17 pagina's × 5 schermformaten, waarvan twee met een notch,
die faalt op alles wat je kunt indrukken dat onder de chrome ligt, onder de notch, voorbij de
home-indicator, buiten beeld valt of iets in de console gooit. Stand nu: **0 fouten**.

De les voor fase 7: unit tests bewijzen wat de regels zeggen, niet wat er op het scherm staat.
Beide zijn nodig.

### 3.5 Testdekking — scheef
1200 tests, maar ongelijk verdeeld:

| Goed gedekt | Vrijwel ongedekt |
|---|---|
| Letterbos (20 groepen), Wereldatlas (19), Stroomkring (13), Moonshot (12), Klankhuis (10) | **Planetarium, Watermolen, Getijdenpoel, Marktdag, Opgraving: 0 testgroepen** |

Vijf spellen hebben geen enkele test. Dat zijn niet toevallig de spellen die het dichtst bij de
onderste leeftijdsband liggen.

### 3.6 Offline — voldoet niet
Het brief vraagt offline-first.

- **Geen service worker.** De webversie werkt niet zonder netwerk, ook niet voor spellen die verder
  niets nodig hebben.
- **Dierenboek en Letterbos halen hun foto's live op bij `upload.wikimedia.org`.** 3744 diersoorten
  en 67 woordfoto's komen van een server van derden, tijdens het spelen. Zonder netwerk valt
  Letterbos terug op tekeningen (netjes opgelost) maar staat het Dierenboek stil.
- Planeetfoto's staan wél lokaal (4,3 MB in `public/img`).

Voor de Kids Category is dit **onzeker en moet het nagekeken worden**: verzoeken naar Wikimedia
sturen het IP-adres en de User-Agent van het toestel van het kind naar een derde partij. Dat is geen
tracking en geen reclame, maar het is wel een verbinding met een derde. Ik weet niet of Apple dit
onder 1.3 schaart. **Voorleggen aan de privacyjurist uit fase 0 §5.3.**

### 3.7 Toegankelijkheid
Niet systematisch getoetst; drie dingen vielen op:

- **Kleur als enige drager.** Getijdenpoel niveau 1 heet "Op kleur" en sorteert op kleur alleen.
  Voor een kleurenblind kind is dat niveau niet te doen. Klankhuis gebruikt kleur per klankstaaf.
  Redundantie (kleur **en** vorm) moet een ontwerpregel worden.
- **Geen ondertiteling of visuele weergave van geluid.** Klankhuis is puur auditief.
- **Raakvlakken**: de audit rekent met een vinger van 30 px. Dat haalt alles. Of dat genoeg is voor
  een tweejarige weet ik niet — fase 0 zegt "grote doelen", maar geeft geen maat. **Open vraag.**

### 3.8 Prestaties
Niet gemeten op echt oude hardware. Wat wel telt:
- Bundelgroottes lopen van 27 kB (Nachtwacht) tot **218 kB (Cloudhopper)**, ongecomprimeerd.
- Elk spel draait een onafgebroken `requestAnimationFrame`-lus, ook als er niets beweegt. Op een
  stilstaand niveauscherm is dat verspilde batterij. **Aan te raden: de lus stilzetten als er een
  frame lang niets verandert.**

---

## 4. Oordeel per game

Getoetst op: past de **kern-interactie** bij 2-6, is het **zonder lezen** te spelen, en is het
leerdoel echt (fase 0 §8, principes 1-6).

| Game | Nu | Kern-interactie | Oordeel | Waarom |
|---|---|---|---|---|
| **Opgraving** | 5+ | vegen | **Behouden, verlagen naar 2+** | Het enige spel waarvan het gebaar nu al bij een peuter past. Eén vinger, geen regels, direct gevolg, niet kapot te spelen. Dit wordt het instapspel. |
| **Klankhuis** | 4+ | tikken op staven | **Behouden, verlagen naar 2+** | Woordeloos, tastbaar, herhaalbaar. Een tweejarige kan hier meteen mee spelen; de niveaus zijn voor later. |
| **Getijdenpoel** | 4+ | slepen, sorteren | **Behouden, verlagen naar 3+** | Sorteren is kernstof voor 3-4. Wel: kleur mag nooit het enige verschil zijn. |
| **Marktdag** | 4+ | tellen, slepen | **Behouden, verlagen naar 3+** | Uittellen tot tien is precies de rekenstof van 3-4. Dichtst bij "betekenisvol" (fase 0 pijler 3): een mandje vullen is iets uit het echte leven. |
| **Nachtwacht** | 5+ | vegen van ster naar ster | **Behouden, band verbreden** | De moeilijkheid komt al uit `skill.ts` en schaalt oneindig door. Met 3 sterren is het een spel voor een driejarige. |
| **Watermolen** | 5+ | geulen graven | **Behouden** | Ruimtelijk, gevolg is zichtbaar, geen tekst nodig om te begrijpen wat water doet. Onderkant blijft ~4. |
| **Stuifzwam** | 5+ | plaatsen en wegwezen | **Behouden** | Vakjes tellen en vooruitdenken. Blijft 5+. |
| **Letterbos** | 5+ | slepen van letters | **Behouden — en als model** | Het enige spel dat al praat, met echte foto's en een fonetisch onderbouwde opbouw. Nederlandse klanken zijn 4-6 stof; onderkant niet verlagen. |
| **Rekenrijk** | 5+ | slepen op rekenmateriaal | **Behouden bovenband** | Splitsen tot tien is groep-3-stof. Voor 2-4 is een apart telspel nodig; dit spel verlagen zou het kapotmaken. |
| **Klokkijken** | 6+ | wijzers zetten | **Behouden, blijft 5-6** | Fase 0 §2.4 zegt klokkijken rond 5-6. Klopt met het label. Wel: "half vier" is Nederlandse stof en een sterk verkoopargument. |
| **Stroomkring** | 6+ | lijn trekken | **Behouden, blijft 6** | Echte natuurkunde, echt leerdoel. Te abstract onder de 5. Hoort bij de bovenkant van de doelgroep, of bij een vervolgproduct. |
| **Moonshot** | 6+ | bouwen | **Behouden bovenband + hergebruiken** | Te complex voor 2-4, uitstekend voor 6. Maar de raket-bouwen-en-lanceren-kern is letterlijk het voorbeeld uit fase 5. De bouwlaag wordt de opstap naar de ontdekreis. |
| **Planetarium** | 5+ | ordenen, verkennen | **Herbouwen als ontdekreis** | Heeft al NASA-opnamen, een zonnestelsel op schaal en missies. Dat is 80% van de ontdekreis-engine uit fase 5, maar nu verpakt als puzzel met tabbladen. |
| **Dierenboek** | 4+ | bladeren, zoeken | **Herbouwen** | 3744 soorten met foto's is een schat. Maar zoeken gaat via een toetsenbord en de teksten zijn leesstof. Als visuele encyclopedie (fase 5) moet het door beeld en spraak werken. |
| **Wereldatlas** | 5+ | provincies slepen | **Herbouwen of uit scope** | De opdracht is een naam die je moet lezen. Zonder lezen valt het spel om. Aardrijkskunde is bovendien geen domein uit het brief. |
| **Cloudhopper** | 6+ | routes tekenen, luchtverkeer | **Schrappen uit deze app** | 218 kB, de grootste en oudste codebase, vraagt verdeelde aandacht, lezen en planning ver boven de doelgroep. Het is een goed spel voor 8+. Het hoort niet in een app voor 2-6 en houdt de bundel en de huisstijl gegijzeld. Advies: apart product of uitfaseren. |

**Samengevat: 11 behouden (4 met verlaagde onderband), 3 herbouwen, 1 schrappen, 1 buiten scope.**

---

## 5. Wat er helemaal niet is

Gemeten tegen de fases 2 t/m 7:

| Uit het brief | Status |
|---|---|
| Ouderpoort (parental gate) | **bestaat niet** |
| Kindprofielen, meerdere kinderen | **bestaat niet** |
| Tijdslimiet per dag/sessie | **bestaat niet** |
| Afloopflow ("laatste spelletje", afsluitritueel, vergrendelen) | **bestaat niet** |
| Ouder kan domeinen aan/uitzetten | **bestaat niet** |
| Voortgangsoverzicht voor ouders | **bestaat niet** (wel per spel zichtbaar voor het kind) |
| Abonnement / betaling | **bestaat niet** — geen enkele regel code |
| Gids-personage | **bestaat niet** |
| Gesproken instructie | 1 van 15 spellen |
| Ontdekreis-engine (fase 5) | **bestaat niet**; Planetarium en Moonshot zijn de grondstof |
| Visuele encyclopedie | half — Dierenboek is er, maar leesafhankelijk |
| Domein vormen en kleuren | **ontbreekt** |
| Domein dinosaurussen | half — Opgraving heeft dino's, geen kennislaag |
| Domein natuur | half — Dierenboek |
| Doe-opdracht zonder scherm, praat-erover-kaart | **bestaat niet** |
| Service worker / offline | **bestaat niet** |

De ouderhoek die er wél is (`src/ui/screens.ts` en de belofte-kaart op de hub) belooft nu al vier
dingen aan ouders: geen advertenties, geen volgsoftware, sessies eindigen, en "we zeggen wat we
niet weten". Die belofte is waar voor de eerste twee en de vierde. **"Sessies eindigen" is waar per
spel (elk spel heeft een laatste ronde) maar niet per dag** — er is geen dagelijkse begrenzing.
Dat verschil moet eerlijk blijven tot fase 3 gebouwd is.

---

## 6. Beslispunten

1. **Cloudhopper: schrappen, of apart product?** Het is 218 kB, het beste afgewerkte spel in de
   repo, en het hoort niet bij 2-6. Mijn advies: uit deze app, bewaren als los product. Dit is een
   besluit van de eigenaar, niet van mij.
2. **Wereldatlas: herbouwen zonder lezen, of laten vallen?** Aardrijkskunde staat niet in de
   domeinlijst van fase 4. 19 testgroepen en 3380 regels gaan verloren als het vervalt.
3. **Bovenband 6+ behouden of loslaten?** Stroomkring, Klokkijken en Moonshot zijn 6+. Het brief
   zegt 2-6. Houden we ze als "kop" van de app (een kind groeit erin), of wordt de app strikt 2-6?
4. **Spraak: opnames of TTS?** Letterbos gebruikt nu de stem van het besturingssysteem
   (`speechSynthesis`). Dat is gratis, werkt offline op de meeste toestellen, en klinkt vlak. Voor
   veertien spellen plus een gids is dit dé kostenpost van het project. *(fase 0 §9.3, nog open)*
5. **Wikimedia-foto's live ophalen: acceptabel voor de Kids Category?** Voorleggen aan een jurist.
   Alternatief: de 3744 foto's meeleveren (schatting: honderden MB's, te groot) of het Dierenboek
   terugbrengen tot een kleinere, lokale set.
6. **Eerst de fundering of eerst de onderband?** Twee volgordes:
   - *Fundering eerst:* fase 2 (gedeelde schil, gids, audio-first, metadata) en fase 3 (ouderomgeving)
     voordat er één spel bij komt. Later goedkoper, duurt langer voor er iets zichtbaars is.
   - *Onderband eerst:* eerst drie spellen voor 2-4 bouwen om te zien of het concept werkt, en de
     fundering daarna. Sneller te toetsen bij echte peuters, maar het herbouwen komt dubbel.

   **Mijn advies: fundering eerst, met één uitzondering.** Bouw meteen één spel voor 2-3 jaar op de
   nieuwe schil (Opgraving omgebouwd), zodat de schil zich aan een echte peuter bewijst voordat er
   veertien spellen op staan.

---

## 7. Open vragen

1. Hoe groot moet een raakvlak zijn voor een 2-jarige? Fase 0 zegt "grote doelen" zonder maat. Is er
   een bron met een getal in millimeters?
2. Mag een kind van 2-3 überhaupt slepen, of alleen tikken? Fase 0 §2.2 zegt dat slepen beter
   werkt voor woordleren, maar zegt niets over of de motoriek het toelaat.
3. Wat is de bovengrens van de app: strikt 6, of groeit een kind door? Dit bepaalt of de 6+-spellen
   blijven.
4. Is er al een (ortho)pedagoog? Zonder die persoon blijven alle leerdoel-claims in §4 van mij, en
   ik ben geen pedagoog.
5. Moet de webversie blijven bestaan naast de app-winkels? Dat bepaalt of de service worker
   (§3.6) nodig is.
6. Eén gids voor alle domeinen: dier, kind, of iets abstracts? Dit raakt de hele huisstijl en is
   het eerste wat in fase 2 vastligt.

---

## 8. Wat ik zou doen als het mijn geld was

De codebase is beter dan de productvraag. Er staat vakwerk: echte natuurkunde in Stroomkring, echte
rekenmethodes in Rekenrijk, echte fonetiek in Letterbos, 3744 diersoorten met bronvermelding. Dat
gooi je niet weg.

Maar het is gebouwd voor een kind dat kan lezen, en dat kind is niet de doelgroep. De drie dingen
die het verschil maken zijn geen van drieën "nog een spel":

1. **Een stem.** Veertien spellen die praten in plaats van schrijven.
2. **Een gids.** Het enige antwoord op de zwakste pijler in de hele markt (fase 0 §2.1).
3. **De ouderomgeving.** Tijdslimiet, afloopritueel en domeinkeuze zijn wat een ouder €3,99 per
   maand waard vindt — niet het aantal spellen.

De onderband (2-4) is daarna een kwestie van bouwen. De fundering is het moeilijke deel.
