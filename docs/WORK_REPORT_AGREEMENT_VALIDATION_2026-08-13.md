# Arbejdsrapport — Hour Craft Path

**Opgave:** Validering af alle katalogførte overenskomster og satser
**Dato:** 13. august 2026
**Projekt:** Hour Craft Path
**Status:** Gennemført som kilde- og sikkerhedsvalidering; lønberegning er ikke aktiveret

## Samlet resultat

De 30 overenskomstposter i Hour Craft Paths katalog er gennemgået enkeltvis.
Der er etableret et maskinlæsbart kilderegister med officielle URL'er,
SHA-256-hashes, aftaleidentitet, parter, periode, satskilder og sikker
statusklassifikation.

| Resultat | Antal | Betydning |
| --- | ---: | --- |
| `verified_not_implemented` | 22 | Officiel hovedkilde er identificeret og hash-låst; beregningsregler er ikke aktiveret. |
| `manual_review_required` | 3 | Aftalen kan identificeres, men den fulde officielle dokumentpakke kan ikke offentligt byte-verificeres. |
| `source_conflict` | 2 | De tilgængelige kilder er indbyrdes uforenelige; ingen sats må anvendes. |
| `out_of_scope` | 3 | Ledsagedokument eller betinget aftale, som ikke må vælges selvstændigt. |

Alle 30 poster forbliver blokeret for automatisk løn- og fakturaberegning.

## Hvad der fandtes før arbejdet

- Databasen havde allerede et katalog med 30 poster.
- Kun fem poster havde registrerede, kildeverificerede
  `agreement_versions` og `agreement_sources`.
- Der fandtes ingen aktive `agreement_rules` og ingen
  `agreement_rate_periods`.
- Den eksisterende regelmotor var allerede fail-closed: en uverificeret eller
  ufuldstændig regel måtte ikke give et økonomisk resultat.
- Den gamle dækningsmatrix havde en historisk fordeling på fem verificerede,
  ti manuelle, otte manglende kilder, fire konflikter og tre poster uden for
  scope.
- Flere lokale PDF'er fandtes allerede og blev bevaret. De blev ikke
  overskrevet eller automatisk ophøjet til juridisk dokumentation.

## Udført arbejde

### 1. Kildevalidering

Hver katalogpost blev undersøgt separat, så ingen aftale arver regler eller
satser fra en anden. Officielle hovedaftaler og tilgængelige 2026-satsblade
blev hentet fra aftaleparternes egne kilder og registreret med SHA-256.

Der blev fundet tre væsentlige former for kilderisiko:

- Lokale dokumenter for Dansk Håndværk/3F, VVS og Industri/VVS afviger fra de
  aktuelle officielle filer. Disse lokale filer er derfor udtrykkeligt
  blokeret som satsgrundlag.
- De tre maleraftaler er holdt strengt adskilt. To kræver manuel dokumentpakke,
  og DI-aftalen har en konkret kildekonflikt.
- Murerarbejdsmandsoverenskomsten for København/Frederiksberg har modstrid
  mellem den angivne aktuelle periode og den konkret tilgængelige PDF og er
  derfor markeret som kildekonflikt.

Den fulde aftale-for-aftale dokumentation, inklusive de kontrollerede
paragraffer, sider og udvalgte 2026-satser, står i
[AGREEMENT_RATE_VALIDATION_2026-08-13.md](AGREEMENT_RATE_VALIDATION_2026-08-13.md).

### 2. Reproducerbar kontrol

Der blev oprettet et maskinlæsbart register og et kontrolscript. Scriptet
kontrollerer:

- præcis 30 unikke katalogposter;
- tilladte og udfyldte statusværdier;
- gyldige officielle HTTPS-adresser;
- SHA-256 for hovedaftaler og satsblade;
- lokale filhashes;
- at en registreret lokal kildeafvigelse fortsat er en reel afvigelse;
- at lokal kildedrift altid blokerer satsvalidering;
- ved `--remote`, at de aktuelt hostede officielle filer stadig har de
  registrerede hashes.

Kontrollen kan gentages med:

```bash
npm run verify:agreement-sources
node scripts/verify-agreement-sources.mjs --remote
```

### 3. Katalogmigration

Der blev tilføjet en additiv migration, som opdaterer dokumenterede titler,
parter og katalogstatus. Migrationen opretter bevidst ingen versioner, kilder,
regler eller satsperioder og kan derfor ikke aktivere lønberegning.

Efter migrationen er databasefordelingen 22
`verified_not_implemented`, tre `manual_review_required`, to
`source_conflict` og tre `out_of_scope`.

### 4. Dokumentationssikkerhed

Den tidligere dækningsmatrix er bevaret som historik, men har fået en tydelig
advarsel og henvisning til det nye kilderegister. Det reducerer risikoen for,
at de gamle statusoptællinger eller arbejdstitler bruges som nyt
beregningsgrundlag.

## Ændrede og oprettede filer

| Fil | Ændring |
| --- | --- |
| `legal-sources/agreement-source-audit.json` | Nyt auditregister for alle 30 poster med kilder, hashes og status. |
| `scripts/verify-agreement-sources.mjs` | Ny lokal og ekstern kildekontrol. |
| `package.json` | Nyt script: `verify:agreement-sources`. |
| `timesheet-worker/migrations/0004_refresh_agreement_source_audit.sql` | Additiv opdatering af katalogmetadata og status. |
| `scripts/run-migration-tests.mjs` | Migration 0004 og den nye statusfordeling indgår i test. |
| `docs/AGREEMENT_RATE_VALIDATION_2026-08-13.md` | Detaljeret faglig valideringsrapport for alle 30 poster. |
| `docs/agreement-coverage-matrix.md` | Markerede den gamle matrix som historisk og erstattet. |
| `docs/WORK_REPORT_AGREEMENT_VALIDATION_2026-08-13.md` | Denne arbejdsrapport. |

## Verifikation udført

| Kontrol | Resultat |
| --- | --- |
| Lokal kilde- og hashkontrol | Bestået, 30/30 poster |
| Frisk fjernkontrol af officielle PDF'er og satsblade | Bestået |
| `npm run test:migrations` | Bestået; clean, dry-run, repræsentativ migration, backup/restore, integritet, FK og triggers |
| `npm run test:validation` | Bestået; 24 kontroller |
| `npm run test:agreement-engine` | Bestået; 32/32 kontroller |
| `git diff --check` | Bestået |

Regelmotortesten viste en ikke-blokerende advarsel om, at WebSocket-port 24678
allerede var i brug. Selve testsuiten afsluttede korrekt med 32/32 bestået.

Der blev ikke kørt fuldt produktionsbuild, fordi ændringerne er begrænset til
kilderegister, dokumentation, kontrolscript og additiv katalogmigration. De
relevante målrettede checks blev kørt i stedet.

## Bevidst ikke ændret

- Ingen UI eller timeseddelfelter er ændret.
- Ingen satser er lagt ind som aktive beregningssatser.
- Ingen overenskomstregler er maskinkodet eller aktiveret.
- Ingen helligdags-, weekend-, skifteholds- eller overarbejdslogik er ændret.
- Ingen overenskomst arver regler fra en anden overenskomst.
- Ingen eksisterende lokal PDF er slettet eller overskrevet.
- Der er ikke foretaget commit, push eller deployment.

## Kræver fortsat manuel validering

Følgende fem poster kan ikke godkendes yderligere uden partsautoriseret
dokumentation:

1. El-overenskomsten mellem DI og Dansk El-Forbund — officiel hoved-PDF er
   adgangsbeskyttet.
2. Danske Malermestre/Malerforbundet — officiel e-viewer findes, men der
   mangler en hente- og hashbar hovedaftale og satskilde.
3. Kooperationens maleroverenskomst — samme dokumentproblem; regler må ikke
   arves fra de øvrige maleraftaler.
4. DI/Malerforbundets maleroverenskomst — lokal fil kan ikke entydigt knyttes
   til den aktuelle aftale/prisliste.
5. Murerarbejdsmandsoverenskomsten København/Frederiksberg — periode og
   tilgængelig PDF er i konflikt.

For de 22 kildeverificerede aftaler kræver produktionsaktivering stadig en ny,
afgrænset implementeringsopgave. Hver beregningsgren skal registreres med
konkret paragraf, side, medarbejderkategori, arbejdsart, geografi, tidsrum,
varsel, lokal aftale, satsperiode og tests for blandt andet midnat, weekend,
helligdag, DST, overlap og afrunding.

## Konklusion

Arbejdet har gjort overenskomstkataloget dokumenteret og kontrollerbart uden
at fremstille kildevalidering som færdig lønberegningsimplementering. Demoen er
dermed sikrere: kendte kilder er låst, konflikter er synlige, gamle lokale
dokumenter kan ikke ubemærket drive satser, og alle ufuldstændige regler
forbliver markeret **Kræver manuel validering**.
