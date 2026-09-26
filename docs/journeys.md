# De ontdekreis

Status: gebouwd. Vier reizen live (`reis.html`, `diepzee.html`, `dino.html`, `lichaam.html`), motor in `src/journey/`.

## Wat het is

Een ontdekreis is het enige onderdeel van Suri dat geen spel is. Je stapt ergens in, je drukt
op start, en het ding brengt je. Om de zoveel tijd stopt het, zegt de gids één ding, en jij
beslist of je meer wilt horen of verder wilt. Er wordt niets van je gevraagd en er kan niets
misgaan.

Dat is de bedoeling. Een kind dat iets wil, wil soms iets kunnen en soms iets weten, en voor het
tweede was in deze app niets. Alles was een opgave. Dit is het ding dat je opent als je je wilt
laten meenemen.

## Waarom het een formaat is en geen spel

Omdat dezelfde vorm minstens vijf keer nodig is: het zonnestelsel, een duik in zee, de tijd van de
dino's, een reis door een lichaam, een wandeling door een fabriek. Wat tussen die vijf verschilt
is een lijst haltes, de kleuren ertussen, de schaal langs de zijkant en waar je in zit. Al het
andere - het reizen, het stilstaan, het doorvragen, het naslaan achteraf - is hetzelfde en staat
één keer geschreven.

De motor is daarom vier bestanden en de reizen zijn data:

| Bestand | Wat het doet |
|---|---|
| `src/journey/types.ts` | de vorm van een reis: haltes, kleuren, plaatjes, schaal, voertuig |
| `src/journey/route.ts` | het gedrag, zonder canvas: rijden, stilstaan, doorvragen, verder, springen |
| `src/journey/screen.ts` | het scherm: de wereld, de rail, de regel, de knoppen, het overzicht |
| `src/journey/craft.ts` | vier voertuigen: raket, duikboot, capsule, boor |
| `src/journey/picture.ts` | het plaatje bij een halte, van welke soort dan ook |

`route.ts` bevat geen canvas, geen geluid en geen opslag, en is daarom volledig getest zonder
browser: `npm test`, groep "Ontdekreis". Dat is hier belangrijker dan elders, omdat één regel
die breekt meteen alle reizen breekt.

## De regel

Je rijdt of je staat stil. Rijdend draagt de route je en verandert niets daaraan - er staat
tijdens het rijden geen enkele knop op het scherm. Stilstaand beweegt er niets tot jij dat zegt.
Er zit nergens een klok in: een kind dat twee minuten naar Jupiter wil kijken, kijkt twee minuten
naar Jupiter. Wat een sessie beëindigt hoort het einde van het ding te zijn en niet een teller
erbinnenin (`docs/research.md` §3.2).

Eén been duurt altijd `LEG_SECONDS` seconden, ongeacht de echte afstand. Neptunus ligt dertig keer
zo ver als de aarde; een kind dat daar dertig keer zo lang op wacht leert dat niet, dat legt de
telefoon neer. De meter langs de zijkant vertelt de echte schaal wel, stuksgewijs tussen de
haltes door - dezelfde soort vertekening als elke kaart van het zonnestelsel maakt.

## Het naslagwerk

Elke reis is ook een overzicht: alle haltes tegelijk, en je mag er elke van openen, ook een waar
je nooit geweest bent. Niets zit op slot, want niets is hier verdiend - het is een boek, en een
boek mag je in het midden opendoen. Wat het overzicht wél laat zien is welke je al gehad hebt,
want dat is het enige wat een kind eraan vraagt.

## De plaatjes

Vier soorten, en de motor merkt het verschil niet:

- `planet` / `moon`: een opname die met de app meegeleverd wordt. Die waren er al voor
  Planetarium; de loader is daarvoor uit dat spel gehaald en staat nu in `src/platform/`.
- `remote`: een foto op Wikimedia Commons, opgehaald op het moment dat hij nodig is. Dezelfde
  wachtrij als het dierenboek gebruikt.
- `drawn`: de reis tekent zijn eigen halte. De diepzee doet dat drie keer, omdat er van een wrak
  op vier kilometer en van de diepste plek van de zee geen foto bestaat die een kind leest.
- `none`: een schijf in de kleur van de wereld daar, voor een halte die een plek is en geen ding.

Bij elke foto staat de fotograaf en de licentie, op het scherm waar hij groot te zien is. Dat is
geen nettigheid maar wat die licenties vragen: een deel ervan is CC BY-SA.

## De vier die er zijn

**De grote reis** (`src/journeys/solar.ts`). Elf haltes, van de zon tot Pluto. Kostte geen enkele
nieuwe asset: de foto's lagen er al voor Planetarium.

**De diepzee** (`src/journeys/deep.ts`). Tien haltes, van de golven tot de Challengerdiepte. Zeven
foto's uit Wikimedia Commons - dezelfde die het dierenboek gebruikt, dus licentie en fotograaf
waren al nagekeken - en drie getekende haltes in `deepart.ts`.

Dat die tweede geen regel motor kostte is het punt van het hele formaat.

**De tijd van de dino's** (`src/journeys/dino.ts`). Elf haltes, van de mammoet in de ijstijd tot
Herrerasaurus, 231 miljoen jaar geleden. Je zit in een boor: hoe dieper, hoe ouder de grond en hoe
verder terug in de tijd, want zo werkt de bodem echt. Tien haltes zijn foto's van echte fossielen
in echte musea, omdat niemand ooit een levende dino heeft gezien en een getekende dino naast een
gefotografeerde de tekening tot feit maakt. De ene getekende halte is de inslag
(`dinoart.ts`). Drie haltes zijn dichtbij huis gekozen: Trix in Naturalis, de Mosasaurus uit
Maastricht, de Iguanodons uit de kolenmijn van Bernissart. De motor kreeg alleen een vierde
voertuig, de boor.

**Het menselijk lichaam** (`src/journeys/body.ts`). Elf haltes, van je kruin tot je tenen: de
hersenen, het oog, de tanden, de stembanden, de longen, het hart, het bloed, de maag, de darmen,
de knie, de voet. Van boven naar beneden omdat het je eigen lijf is en een kind elke halte bij
zichzelf kan aanwijzen. De meter telt centimeters vanaf de kruin van een kind van 1,20 m, de
lengte van een zesjarige volgens de groeicurven van TNO; dat is een keuze, geen meting. Vier
haltes zijn foto's (een oog, bloed onder de microscoop, röntgenfoto's van een knie en een voet);
de organen zijn getekend (`bodyart.ts`), omdat een foto van een echt orgaan uit een operatiekamer
komt en een vierjarige bang maakt in plaats van nieuwsgierig. Geen regel motor.

## Wat er nog niet is

- De laatste reis uit de opdracht: een fabriek. Een databestand plus tekenwerk, en die loopt
  horizontaal.
- Een horizontale reis. De as kan `up` of `down`; een fabriek loopt van links naar rechts en dat
  is tekenwerk in `screen.ts`, geen verandering in de data.
