# Hour Craft Path — projektstatus 13. august 2026

## Kanonisk lokal version

Den lokale source of truth er:

`/Users/mathiasandersen/Documents/Hour Craft Path/hour-craft-path-main-2026-08-13`

Versionen bygger på GitHub `origin/main` ved `84a2066`. Remote-referencen blev
verificeret med `git ls-remote` den 13. august 2026. De tre booking- og
fakturacommits efter `e994bf2` er bevaret.

Den verificerede endelige QA-patch fra 26. juli 2026 er integreret i commit
`25bd1df`. Kildearkivet er:

`/Volumes/USB 1/Hour-Craft-Path-QA-endelig-2026-07-26-2006.zip`

SHA-256:
`254a6c4e41d15cf6cd1f7a8ed4f6de73d836ccb1052f06acdf152c8c9905ab24`

ZIP-integritet og hash er kontrolleret lokalt. De nyere bookingperiodeændringer
og visningen "Faktura sendt" er bevaret ved trevejs-merge.

Efter integration matcher 47 af patchens 49 filer slutarkivet byte-for-byte.
De to bevidste afvigelser er `src/lib/timesheet-store.ts` og
`src/routes/admin.invoice-payroll.tsx`, hvor de nyere booking- og
fakturafunktioner er bevaret. De seks afsluttende sikkerhedsfiler matcher
slutarkivet byte-for-byte.

De øvrige mapper og ZIP-filer i den overliggende `Hour Craft Path`-mappe er
bevarede backups. Mappen med suffikset `incomplete-merge-backup` er en ufuldstændig
kandidat og må ikke bruges som udviklingsgrundlag.

## Bekræftet lokalt

- `npm run test:validation`: 24/24 bestået.
- `npm run test:agreement-engine`: 32/32 bestået.
- `npm run test:worker-auth`: 12/12 bestået.
- `npm run test:worker-security`: 17/17 bestået.
- `npm run test:migrations`: bestået, inklusive kontrolleret backup/restore.
- `npm run lint`: bestået.
- `npx tsc --noEmit`: bestået med exit-kode 0.
- `npm run build`: bestået med exit-kode 0.
- `git diff --check`: bestået.

Buildet producerede både klient- og serverartefakter og prerenderede `/`.
Vite viste kun ikke-blokerende oplysninger om manglende Lovable-kontekst og
mulig fremtidig erstatning af `vite-tsconfig-paths`.

## Sikkerheds- og beregningsstatus

- Kundens fakturabeløb beregnes ikke længere i browseren uden et verificeret
  serverbaseret beregningssnapshot.
- Faktura-, løn- og eksporthandlinger er fail-closed, når snapshot eller anden
  nødvendig validering mangler.
- Rå fejlmeddelelser, stack traces og følsomme værdier sendes ikke videre til
  browserlog eller fejltelemetri fra de kontrollerede fejlveje.
- Bookingperiode og "Faktura sendt"-visningen er fortsat tilgængelige.
- `.env.example` er gendannet med den nødvendige mail-worker-konfigurationsnøgle
  uden hemmelige værdier.

Der er 30 overenskomstkatalogposter. Ingen er aktiveret til automatisk
økonomisk beregning. Fem hoveddokumenter er kildeverificeret, men regler og
satser er ikke implementeret. Satser, tillæg, paragraffer og ledsagekilder
kræver fortsat manuel juridisk validering før aktivering.

## Bevidst ikke udført

- Ingen remote migration, deployment, push eller publicering.
- Ingen ændring af den tidligere dirty udviklings-checkout.
- Ingen live D1-, Cloudflare- eller mailintegrationstest.
- Ingen juridisk godkendelse af overenskomstregler eller satser.
