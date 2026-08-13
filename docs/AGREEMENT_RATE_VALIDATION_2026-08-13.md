# Validering af overenskomster og satser — 13. august 2026

## Resultat

Alle 30 katalogposter er gennemgået mod deres konkrete aftaleidentitet. 22 har
en hentbar, officiel hovedkilde med SHA-256 i
[`legal-sources/agreement-source-audit.json`](../legal-sources/agreement-source-audit.json).
Tre kræver manuel dokumentkontrol, to har en konkret kildekonflikt og tre er
ledsage-/betingede poster, som aldrig må vælges direkte.

Dette er **ikke** en aktivering af lønberegning. Der findes fortsat ingen
`agreement_rules` eller `agreement_rate_periods`, og en aktuel timeseddel
forbliver fail-closed. En kilde eller en offentlig sats må først bruges i en
beregning, når regel, paragraf, side, betingelser, satsperiode og test er
registreret for den konkrete aftale.

Status betyder:

| Status | Betydning |
| --- | --- |
| `verified_not_implemented` | Officiel hovedkilde og eventuelle satsblade er hentet og SHA-256-låst; den konkrete beregningsregel er ikke implementeret. |
| `manual_review_required` | Aftalen kan identificeres, men officiel PDF/satsliste kan ikke fuldt byte-verificeres eller har et uafklaret anvendelsesområde. |
| `source_conflict` | To aktuelle eller påstået aktuelle kilder kan ikke forenes. Ingen sats må bruges. |
| `out_of_scope` | Protokol/ledsagedokument eller betinget aftale; må ikke tildeles som selvstændig overenskomst. |

## Kataloggennemgang

`Satsgrundlag` angiver de kontrollerede 2026-satser eller den konkrete
begrænsning. Det er ikke en komplet tarif-tabel: alle kombinationer af
medarbejdergruppe, geografisk prisliste, lokal aftale, varsel, skift og
helligdag skal fortsat registreres separat, før de kan beregnes.

| Nr. | Aftale | Kilde- og satsstatus | Regler og sidehenvisning | Satsgrundlag / begrænsning |
| ---: | --- | --- | --- | --- |
| 1 | Bygge- og Anlægsoverenskomsten 2025-2028 | `verified_not_implemented` | § 8 (37 timer), §§ 18-22 (overarbejde, forskudt tid, skift), § 107, trykt s. 23 og 30-37 / 133 | Mindstebetaling 149,90 kr./t. Skift 48,10 kr. (18-06) og 113,50 kr. (lør. 14 til søn./SH). Kombinationer er **Kræver manuel validering**. |
| 2 | Bygningsoverenskomsten 2025-2028 | `verified_not_implemented` | § 11-12 (37 timer/arbejdstid), § 84, trykt s. 22-26 / 123 | Mindstebetaling 149,65 kr./t; forskudt tid 27,60 / 55,20 / 66,90 kr. efter tidsrum. Lokale skiftregler og samlet beregning er **Kræver manuel validering**. |
| 3 | Murer- og murerarbejdsmandsarbejde 2025-2028 | `verified_not_implemented` | §§ 8-9, § 14, § 86, trykt s. 118-119 | Mindstebetaling 149,65 kr./t. De første to overtimer +50 %, derefter +100 %; søn-/helligdag/natkald +100 % (min. to timer). Akkord/prisliste og zone er **Kræver manuel validering**. |
| 4 | Gulvoverenskomsten 2025-2028 | `verified_not_implemented` | §§ 11-12 og § 21, trykt s. 102 | Mindstebetaling 149,65 kr./t. BJMF-protokol er ikke en selvstændig aftale; geografisk anvendelse er **Kræver manuel validering**. |
| 5 | Asfaltoverenskomsten 2025-2028 | `verified_not_implemented` | §§ 5-6, 14, 19, 21 og § 90, trykt s. 78-80 | Asfalt 155,00 kr./t; nyansat 149,50 kr./t de første tre måneder; forskudt/skift 48,10 / 113,50 kr. Konkrete kategorier er **Kræver manuel validering**. |
| 6 | Isoleringsoverenskomsten 2025-2028 | `verified_not_implemented` | §§ 2, 6-7 og § 26, trykt s. 7-11 / 51 | Forskudt tid 28,93 / 46,56 / 55,32 kr.; overarbejdstillæg 89,72 kr. SH- og kombinationsregler er **Kræver manuel validering**. |
| 7 | Glasoverenskomsten 2025-2028 | `verified_not_implemented` | §§ 1-3 og 6, trykt s. 6-10 | 37 timer, overarbejde og helligdage er lokaliseret; komplet satsblad/prisliste mangler i den strukturerede regelmodel. **Kræver manuel validering**. |
| 8 | Bygge- og Anlægsoverenskomst 2026-2029 (Dansk Håndværk/3F) | `verified_not_implemented`; lokal fil afviger | §§ 11, 13, 19 og 115, trykt s. 23, 28 og 147 | Officiel 2026-2029-PDF er SHA-låst, men den lokale kopi er ikke identisk. Ingen lokal sats må bruges: **Kræver manuel validering**. |
| 9 | El-overenskomsten 2025-2028 (DI/DEF) | `manual_review_required` | DI bekræfter aftaleidentitet og periode; PDF er loginbeskyttet | 2026 mindsteløn 143,35 kr./t er fundet i offentlig partsinformation, men hovedaftale/satskilde kan ikke byte-verificeres. **Kræver manuel validering**. |
| 10 | Elektrikeroverenskomsten 2025-2028 (TEKNIQ/DEF) | `verified_not_implemented` | § 7, 7b-c, 13 og 15, s. 20-26, 53 og 61 | Mindstebetaling 142,25 kr./t; normal arbejdstid inkl. service 154,95 kr./t; forskudt 59,50 / 101,85 kr. Varsel/lokal aftale og øvrige satser er **Kræver manuel validering**. |
| 11 | Metal- og Blik- og Røroverenskomsten 2025-2028 | `verified_not_implemented` | Officiel 218-siders hovedaftale er SHA-låst | Aftalen er en anden aftale end TEKNIQ Industri- og VVS. Ingen komplet kontrolleret satsudtræk i regelmodellen: **Kræver manuel validering**. |
| 12 | VVS-overenskomsterne 2025-2028 | `verified_not_implemented`; lokal fil afviger | §§ 6, 8-9 og 17, PDF s. 18, 22 og 41-42 | Mindstebetaling 143,35 kr./t; første to overtimer 47,30 kr., derefter/kald/SH 132,50 kr.; SH/fritvalg 16 %. Kildedrift og forbund/dækning gør satsbrug **Kræver manuel validering**. |
| 13 | Maleroverenskomsten 2025-2028 (DI/Malerforbundet) | `source_conflict` | DI identificerer aftalen; svendeprisliste er ikke offentligt hashbar | Den lokale maler-PDF kan ikke entydigt knyttes til aftalen. **Kræver manuel validering**; må ikke dele satser med nr. 14-15. |
| 14 | Danske Malermestre/Malerforbundet | `manual_review_required` | Malerforbundets officielle e-viewer identificerer aftalen | Ingen offentlig hente-/hashbar hoved-PDF eller separat aktuel satskilde. **Kræver manuel validering**. |
| 15 | Kooperationens maleroverenskomst | `manual_review_required` | Malerforbundets officielle e-viewer identificerer aftalen | Ingen offentlig hente-/hashbar hoved-PDF eller separat aktuel satskilde. **Kræver manuel validering**; ingen regelarv. |
| 16 | Jord- og Betonoverenskomsten 2025-2028 | `verified_not_implemented` | §§ 7, 20-21 og § 99, trykt s. 19-21, 28-34 og 124 | Mindstebetaling 149,90 kr./t; skift 48,10 / 113,50 kr. Weekend-/varselkombinationer er **Kræver manuel validering**. |
| 17 | Murerarbejdsmandsoverenskomsten 2025-2028 (Kbh./Frederiksberg) | `source_conflict` | DI angiver 2025-2028; tilgængelig konkret PDF er en ældre landsaftale | Uforenelige kilder. Ingen sats eller regel må bruges: **Kræver manuel validering**. |
| 18 | BJMF-protokol til Gulvoverenskomsten | `out_of_scope` | Ledsageprotokol | Må ikke vælges direkte og har ingen selvstændig satsberegning. |
| 19 | Industriens Overenskomst 2025-2028 | `verified_not_implemented` | §§ 9, 13-15, 18 og 22, trykt s. 27-67 | Mindstebetaling 143,40 kr./t; forskudt 32,60 / 53,20 / 62,70 kr.; skift 50,40 / 108,00 / 108,35 kr. Tids-/lokalaftalegrene er **Kræver manuel validering**. |
| 20 | Industriens Organisationsaftaler | `out_of_scope` | Verificeret ledsagekilde til nr. 19 | Må ikke tildeles direkte; relevante protokoller skal knyttes til den konkrete version. |
| 21 | Industrioverenskomsten 2025-2028 (DI Byggeri/3F) | `verified_not_implemented` | Officiel 3F-hovedaftale er SHA-låst | Aftaleidentitet er verificeret, men fuld sats-/regeludtræk er ikke implementeret. **Kræver manuel validering**. |
| 22 | Træ- og Møbeloverenskomsten 2025-2028 | `verified_not_implemented` | Officiel 3F-hovedaftale er SHA-låst | Må ikke blandes med nr. 23. Satser og protokoller er **Kræver manuel validering**. |
| 23 | Industri-, Træ- og Møbeloverenskomsten 2025-2028 | `verified_not_implemented` | Officiel 3F-hovedaftale er SHA-låst | Selvstændig aftale. Satser og protokoller er **Kræver manuel validering**. |
| 24 | Emballageoverenskomsten 2025-2028 | `verified_not_implemented` | §§ 16, 24 og 30, trykt s. 33-55 | 37-timers-/skiftregel; de første tre overtimer +50 %, derefter/lør./søn./SH +100 %. Brancheregimer og SH er **Kræver manuel validering**. |
| 25 | Den Fødevareindustrielle Overenskomst 2025-2028 | `verified_not_implemented` | §§ 1, 3, 8-10, 14-18 og 40-42, trykt s. 12-30, 47-63 og 84-92 | SHA-låste 2026-lønblade: weekend 120,86 kr./t; skift 45,87 / 117,90 kr.; fritvalg 12,25 %. Forædling/holddrift/medarbejdergruppe er **Kræver manuel validering**. |
| 26 | Slagteoverenskomsten 2025-2028 | `verified_not_implemented` | §§ 1, 3-4, 8, 74 og SH-regler, trykt s. 9-24, 79-83 og 104-106 | Tidbetalingsløn 176,10 kr./t; overarbejde 99,15 kr.; forskudt 22,70 / 26,27 kr. Særlige slagte-/kreaturregler er **Kræver manuel validering**. |
| 27 | Mejeribranchens Fællesoverenskomst 2025-2028 | `verified_not_implemented` | §§ 1, 4-9, 34 og SH, trykt s. 5-30 og 76-78 | SHA-låste satsblade: overarbejde 70,58 / 130,64 kr.; forskudt 78,20 / 89,45 kr.; søndag 124,05 kr.; skift 66,01 / 131,12 kr. Medarbejdergruppe/bilag 4 er **Kræver manuel validering**. |
| 28 | Industri- og VVS-overenskomsten 2025-2028 | `verified_not_implemented`; lokal fil afviger | §§ 9, 17 og 19, PDF s. 19 og 27-31, 40 | Forskudt 32,60 / 53,20 / 62,70 kr.; første to hverdags-overtimer 48,10 kr.; søndag 95,75 / 143,70 kr. Den lokale 206-siders fil afviger den officielle 218-siders fil: **Kræver manuel validering**. |
| 29 | DSM Industrioverenskomst 2025-2028 | `verified_not_implemented` | §§ 1, 4-9 og 67, trykt s. 9-27 og 75 | Normalløn 190,58 kr./t; skift 22,95 / 26,55 kr.; lørdag 57,61 / 76,80 kr. Funktion og tidsrum er **Kræver manuel validering**. |
| 30 | Faglærteoverenskomsten 2025-2028 | `out_of_scope` | Betinget på dokumenteret virksomhedsmedlemskab | Må kun blive katalogkandidat for en konkret dokumenteret virksomhed; ikke aktiv eller satsbærende nu. |

## Kildelåsning og reproducerbar kontrol

Auditregisteret indeholder hver hentbar officiel URL, SHA-256, lokale matches
og de separate 2026-satsblade for fødevare-, slagte-, mejeri- og DSM-området.
Kontrollen kan køres uden netværk og med frisk kontrol af de fjernhostede
kilder:

```bash
node scripts/verify-agreement-sources.mjs
node scripts/verify-agreement-sources.mjs --remote
```

En ændret PDF, et manglende satsblad eller en lokal fil, der ikke matcher den
angivne hash, får kontrollen til at fejle. De tre poster med en ikke-offentlig
hoved-PDF/e-viewer og de to kildekonflikter kan ikke blive grønne af en hash;
de kræver en manuel, partsautoriseret dokumentpakke.

## Bevidst ikke ændret

- Ingen satser, regler, heligdagslogik, lønberegning eller eksport er aktiveret.
- Ingen overenskomst arver regler fra en anden; især ikke Industriens
  Overenskomst til de øvrige industri-, bygge- eller VVS-aftaler.
- Ingen lokal PDF med kildedrift bruges som juridisk beregningsgrundlag.

Før produktionsaktivering skal hver konkret beregningsgren registreres med
paragraf, side, alle betingelser, historisk satsperiode og grænsetest (midnat,
weekend, helligdag, DST, overlap og afrunding).
