# Suri in de App Store, zonder Mac

Status: de bouwstraat staat klaar en is nog nooit gedraaid. Er is in dit project geen Mac, en een
iOS-app moet op een Mac gebouwd en ondertekend worden. Dat lost `.github/workflows/ios.yml` op: GitHub
huurt per minuut een Mac, bouwt daar het pakket, ondertekent het met een sleutel van Apple en stuurt
het naar App Store Connect. Wat jij nodig hebt is een Apple Developer-account, een API-sleutel en
een iPhone of iPad om het resultaat op te installeren. Dit bestand is het Apple-zusje van
`docs/store.md`, dat hetzelfde voor Google Play beschrijft.

## Hoe het werkt, en waarom zo

**Een Mac huren per bouw, niet per dag.** Het Android-pakket bouwt al op GitHub Actions
(`android.yml`). Dezelfde dienst verhuurt Macs: `runs-on: macos-26` is een Mac met macOS 26 en
Xcode 26, en dat is precies wat Apple sinds april 2026 eist (alles wat je uploadt moet met Xcode 26
en de iOS 26-SDK gebouwd zijn; `developer.apple.com/news/upcoming-requirements`). Een Mac in de cloud
huren en er zelf op inloggen kan ook, maar dan sta je op een Mac die je niet kent met Xcode-schermen
die je nooit eerder zag, en elke bouw is weer handwerk. Een script dat elke keer hetzelfde doet is
goedkoper en betrouwbaarder.

**Ondertekenen zonder certificaat te exporteren.** Normaal maak je op een Mac een certificaat en een
provisioning profile en zet je die als geheimen in de bouwstraat. Sinds Xcode 13 kan Xcode dat zelf,
met alleen een App Store Connect API-sleutel ("cloud signing", WWDC21 sessie 10204). De bouwstraat
geeft `xcodebuild` die sleutel mee (`-allowProvisioningUpdates -authenticationKeyPath …`) en Xcode
maakt het certificaat en het profiel op de Mac van GitHub, elke keer opnieuw. Er is dus één geheim,
en het is er een dat je in App Store Connect zelf kunt intrekken.

**Wat het kost.** GitHub telt een Mac-minuut als tien gewone minuten. Een gratis account heeft 2000
minuten per maand, dus ongeveer 200 Mac-minuten; één bouw van Suri kost naar schatting een kwartier
tot twintig minuten (de stem is 114 MB en moet mee). Reken op acht tot tien bouwen per maand gratis;
daarboven kost een Mac-minuut ongeveer $0,08, dus een bouw ongeveer anderhalve dollar. Het staat
onder *Settings → Billing* in de organisatie op GitHub. Codemagic (500 gratis Mac-minuten per maand)
is het alternatief als dat te krap is; het script is dan over te zetten, de stappen zijn dezelfde.

## Wat er klaarligt

| Wat | Waar |
|---|---|
| App-ID `com.studiogoud.suri`, naam Suri, iOS 14 of hoger | `ios/App/App.xcodeproj`, `capacitor.config.ts` |
| Versie: naam uit `package.json` (1.0.0), nummer per bouw (`100 + runnummer`) | `ios.yml` geeft ze aan `xcodebuild` mee |
| Icoon 1024 × 1024 en opstartscherm met Suri | `scripts/icons.mjs` → `Assets.xcassets` |
| Geen advertentie-SDK en geen trackingvraag meer in `Info.plist` | zie hieronder |
| Liggend en staand op telefoon en tablet | `Info.plist`, `UISupportedInterfaceOrientations` |
| Automatische bouw, ondertekening en upload | `.github/workflows/ios.yml` |
| Privacyverklaring, NL en EN | `privacy.html`, live op `https://kids-vaultv2.vercel.app/privacy.html` |
| Winkelteksten | `docs/store.md`, de Engelse als eerste taal (zie onder) |

**`Info.plist` was niet schoon.** Hij bevatte een `GADApplicationIdentifier` (de proef-app-ID van
Google AdMob) en een `NSUserTrackingUsageDescription` met de tekst "Hiermee kunnen we relevantere
advertenties tonen", allebei uit een sjabloon. Niets in de code gebruikte ze, maar Apple leest de
plist en zet een kinderapp met een advertentie-ID en een trackingtekst niet in de Kinderen-categorie
(richtlijn 1.3). Ze zijn op 2026-11-04 verwijderd, net als een dubbele sleutel en de eis `armv7`,
een processor die sinds iOS 11 niet meer bestaat (nu `arm64`).

## Wat nog van jou is

### 1. Het Apple Developer Program

Op <https://developer.apple.com/programs/enroll/>: $99 per jaar, met een Apple ID met tweestapsverificatie. Een
persoon schrijft zich in via de app *Apple Developer* op een iPhone of iPad (identiteitsbewijs,
een foto); een bedrijf via de website, met een D-U-N-S-nummer, en dat duurt langer. Toelating duurt
tot 48 uur. Met het account komen App Store Connect (de winkel) en *Certificates, Identifiers &
Profiles* (de sleutels) mee.

### 2. De API-sleutel

In App Store Connect: *Users and Access → Integrations → App Store Connect API → Team Keys →
Generate API Key*. Naam bijvoorbeeld "GitHub", rol **Admin** (cloud signing maakt certificaten aan,
en daar is App Manager niet genoeg voor). Download het `.p8`-bestand: dat kan **één keer**, bewaar
het op een plek die je niet kwijtraakt. Noteer de *Key ID* (bij de sleutel) en de *Issuer ID*
(bovenaan de pagina). Het *Team ID* staat op <https://developer.apple.com/account> onder
*Membership details*.

Dan in GitHub, bij de repository onder *Settings → Secrets and variables → Actions*, vier geheimen:

| Naam | Inhoud |
|---|---|
| `APPLE_API_KEY_BASE64` | de uitvoer van `base64 -w0 AuthKey_XXXXXXXXXX.p8` (macOS: `base64 -i …`) |
| `APPLE_API_KEY_ID` | de Key ID, tien tekens |
| `APPLE_API_ISSUER_ID` | de Issuer ID, een UUID |
| `APPLE_TEAM_ID` | het Team ID, tien tekens |

### 3. De app aanmelden

In App Store Connect: *Apps → + → New App*. Platform iOS, naam **Suri: play and discover**, eerste
taal **English (U.S.)**, Bundle ID `com.studiogoud.suri`, SKU `suri`. Staat de Bundle ID niet in de
lijst, maak hem dan eerst aan op <https://developer.apple.com/account/resources/identifiers> (App
IDs → +, Explicit, geen capabilities). De bouwstraat kan dat ook zelf, maar het app-record in de
winkel maak je altijd met de hand.

### 4. Bouwen en naar TestFlight

GitHub → *Actions → iOS build → Run workflow*, met *upload* aangevinkt. Na een minuut of twintig
staat de bouw in App Store Connect onder *TestFlight*, en een kwartier later (Apple verwerkt hem) kun
je hem op je eigen iPhone of iPad installeren met de app *TestFlight*, door jezelf als interne
tester toe te voegen. Een tag als `v1.0.1` pushen bouwt en uploadt hetzelfde.

**De eerste bouw gaat waarschijnlijk niet in één keer goed.** Er is hier geen Mac om hem vooraf te
proberen; het script is geschreven uit de documentatie van Apple en GitHub en niet gedraaid. Wat je
dan kunt verwachten, van waarschijnlijk naar onwaarschijnlijk:

- *"No profiles for 'com.studiogoud.suri' were found"* of iets met *"cloud signing permission"*:
  de rol van de API-sleutel is geen Admin, of de Bundle ID bestaat nog niet. Zie 2 en 3.
- *"Your development team … does not support the Automatically Manage Signing"* of een fout bij
  het exporteren: de eerste cloud-ondertekening maakt een certificaat aan, en soms moet dat één
  keer bevestigd worden op <https://developer.apple.com/account/resources/certificates>.
- *`pod install`* dat faalt: `npx cap sync ios` haalt de Capacitor-pods op, en dat vraagt internet
  en een CocoaPods die bij de Mac van GitHub past. De foutmelding zegt dan welke.
- Een e-mail van Apple na de upload over een ontbrekend *privacy manifest* (ITMS-91053): de app
  zelf roept geen van de API's aan waarvoor zo'n manifest nodig is, en de Capacitor-pod heeft het
  zijne. Komt de mail toch, dan hoort er een `PrivacyInfo.xcprivacy` in `ios/App/App/` en in het
  Xcode-project, en dat is het enige stuk waarvoor je een Mac of een zorgvuldige hand in
  `project.pbxproj` nodig hebt.

Zet de foutmelding in een nieuwe sessie; het script is klein en de stappen zijn los van elkaar te
herstellen.

### 5. De winkelpagina

De teksten staan in `docs/store.md` en passen ook hier: naam tot 30 tekens, ondertitel tot 30
(gebruik de korte beschrijving, ingekort: *Games and stories, ages 2–8*), beschrijving tot 4000.
Engels (U.S.) is de eerste taal; Nederlands komt erbij als vertaling. Geen "leert", geen
"pedagogisch goedgekeurd" (CLAUDE.md, regels 3 en 4).

**Schermafbeeldingen.** De App Store wil ze staand of liggend per toestelklasse, en de maten zijn
anders dan die van Play: voor de iPhone 1320 × 2868 (of 2868 × 1320 liggend), voor de iPad 13 inch
2064 × 2752 (of liggend). De acht van Play (1920 × 1080) passen niet; ze moeten opnieuw, uit de app
in een browser op die maten, net als in `docs/store.md` beschreven staat. Minstens één per klasse,
hoogstens tien.

**Categorie:** *Education*, met *Kids* als tweede. Vink **Made for Kids** aan en kies een
leeftijdsband; Apple kent *5 and under*, *6–8* en *9–11*, en je mag er één kiezen. Suri is voor
twee tot acht; *6–8* is de band waar de meeste dingen in vallen, *5 and under* de band die de
kleinste gebruikers beschermt. Een keuze voor jou; de app verandert er niet van.

**Leeftijdsclassificatie:** de vragenlijst levert *4+* op: geen geweld, niets angstaanjagends,
geen gokken, geen contact tussen gebruikers, geen ongefilterd internet. De meteoriet en de bacteriën
zijn getekend en rustig verteld; vul *geen* in, maar kijk ze zelf na.

**App Privacy:** *Data Not Collected*. Alles staat in `localStorage` op het toestel
(`src/util/storage.ts`); de foto's van Wikimedia Commons sturen niets over de gebruiker mee.

**Kinderen-categorie (richtlijn 1.3 en 5.1.4):** geen advertenties, geen analytics van derden, geen
links naar buiten en geen aankopen behalve achter een *ouderpoort*. Suri's ouderscherm zit achter
een zelfgekozen code, en dat is zo'n poort. De link naar de privacyverklaring staat achter die code.
Bij de review-vragen: *Does your app include third-party analytics? No. Third-party advertising?
No. Does it collect, transmit or share personal information? No.*

**Notities voor de reviewer:** schrijf dat de ouderomgeving achter een code zit die bij het eerste
gebruik wordt gekozen, en geef er een voor de reviewer. Zet erbij dat de app zonder account werkt
en dat niets de telefoon verlaat.

## Het abonnement: €3,99 per jaar, drie dagen gratis

Dit is op 2026-11-04 door de eigenaar besloten; de tekst in het ouderscherm en de vragen zegt het
al, met erbij dat het afrekenen nog niet gebouwd is (`src/parents/main.ts`, `src/parents/faq.ts`).
Zo zet je dat in App Store Connect, en zo bouw je het:

1. **Een auto-renewable subscription**, groep "Suri", product `suri.year`, duur één jaar, prijs
   €3,99 (een prijspunt dat Apple kent). Daarop een **introductory offer: free trial, 3 days**. De
   drie gratis dagen zijn daarmee van Apple: Apple stuurt de herinnering, Apple rekent af, en een
   ouder zegt op waar hij alles opzegt.
2. **Een kleine keuze die altijd gratis is**, niet alleen de eerste drie dagen. Twee redenen. Apple
   vindt een app die na drie dagen helemaal dichtgaat een proefversie en behandelt hem zo bij de
   review; en een app die niets meer doet wordt gewist, terwijl een app die nog drie dingen doet
   blijft staan tot de ouder er klaar voor is. Voorstel: Kiekeboe, Vingerverf, Opgraving, Marktdag,
   Klokkijken en één verhaalreis (Suri en de reuzentand), zodat elke leeftijd één ding heeft. De
   rest staat op de plank met Suri's gezicht ervoor, en een tik brengt de ouder naar het
   ouderscherm, achter de code.
3. **De koopknop achter de code.** Richtlijn 1.3: aankopen in een kinderapp alleen achter een
   ouderpoort. Het ouderscherm is die poort; de knop komt in het paneel *Abonnement*.
4. **Geen RevenueCat of een andere dienst.** Die sturen een toestel-ID naar een server van een
   derde, en dat mag niet van regel 1 en niet van richtlijn 1.3 voor de Kinderen-categorie. StoreKit 2
   praat alleen met Apple en controleert de aankoop op het toestel zelf. Capacitor heeft daar geen
   eigen plug-in voor; het is ongeveer honderd regels Swift (een plug-in met `products()`,
   `purchase()`, `restore()` en `current()`) plus dezelfde vier op Android met Google Play Billing.
   Een klus van een dag of twee, pas zinvol als de bouwstraat draait en de app in TestFlight staat.

Zolang dat er niet is, is de app in de winkel gratis en compleet, en zegt het ouderscherm eerlijk
dat het afrekenen nog komt. Dat is beter dan een slot zonder sleutel.

## Wat nog niet klopt

- De bouwstraat heeft nooit gedraaid; zie 4. De eerste run is de test.
- Het pakket heeft op geen echte iPhone gedraaid. Eerste keer openen: het opstartscherm, of er iets
  onder de notch of de balk onderaan valt (`safeArea()` leest `env(safe-area-inset-*)`, dat de
  WKWebView op iOS wel doorgeeft), of het geluid speelt zonder dat je eerst de stille schakelaar om
  moet zetten, en of het trillen werkt.
- De schermafbeeldingen voor de App Store bestaan nog niet (zie 5).
- Het abonnement is niet gebouwd (zie boven).
