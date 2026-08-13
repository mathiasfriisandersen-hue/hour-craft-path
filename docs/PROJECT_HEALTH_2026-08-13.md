# Hour Craft Path — projektstatus 13. august 2026

## Kanonisk lokal version

Denne mappe er den lokale source of truth:

`/Users/mathiasandersen/Documents/Hour Craft Path/hour-craft-path-main-2026-08-13`

Den bygger på den lokale `origin/main`-reference (`84a2066`) med de tre nyere
booking-/fakturaændringer og den komplette, integritetskontrollerede QA- og
sikkerhedspakke fra 26. juli 2026. Integrationens merge-commit er `6bead78`.

De øvrige mapper og ZIP-filer i den overliggende `Hour Craft Path`-mappe er
bevarede backups og er ikke den kanoniske arbejdsmappe. Mappen med suffikset
`incomplete-merge-backup` er en bevaret, ufuldstændig kandidat fra den første
samlingsproces og må ikke bruges som udviklingsgrundlag.

## Bekræftet lokalt

- `npm run test:validation`: 24/24 bestået.
- `npm run test:agreement-engine`: 32/32 bestået.
- `npm run test:worker-auth`: 12/12 bestået.
- `npm run test:worker-security`: 12/12 bestået.
- `npm run test:migrations`: bestået, inklusive kontrolleret backup/restore.
- `npm run lint`: bestået.
- `npx tsc --noEmit`: bestået.
- `git diff --check`: bestået.

`npm run build` blev startet én gang og producerede de forventede `dist/`
artefakter. Terminalforbindelsen mistede afslutningskoden efter Vite begyndte
produktionsbygget, så buildets exit-kode er ikke registreret som bestået.

## Sikkerheds- og beregningsstatus

Økonomiske beløb er fortsat fail-closed: uden et gyldigt serverbaseret
beregningssnapshot må klienten ikke udlede faktura- eller lønbeløb. Booking-
periode og den nyere "Faktura sendt"-visning er bevaret.

Der er 30 overenskomstkatalogposter, men ingen er aktiveret til automatisk
beregning. Fem hoveddokumenter er kildeverificeret, men regler og satser er
ikke implementeret. Alle satser, tillæg, paragraffer og ledsagekilder kræver
fortsat manuel juridisk validering før aktivering.

## Bevidst ikke udført

- Ingen remote migration, deployment, push eller publicering.
- Ingen ændring af den tidligere dirty udviklings-checkout.
- Ingen live D1-, Cloudflare- eller mailintegrationstest.
