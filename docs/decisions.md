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
