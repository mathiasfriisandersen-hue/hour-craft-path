# Timesheet mail worker

Organisation-afgrænset Cloudflare Worker til faste timeseddel- og invitationsskabeloner.

## Sikkerhedsmodel

Browser-Origin bruges kun til CORS og giver aldrig adgang. Beskyttede handlinger kræver en
serververificeret Supabase JWT, et aktivt D1-medlemskab og en tilladt rolle. Workeren udleder
organisation, modtager og projektrelation fra D1 og accepterer ikke vilkårlig modtager, emne,
tekst, HTML eller reply-to fra klienten.

Invitationer er tidsbegrænsede opaque tokens. Kun SHA-256-hashen gemmes i D1, og indløsning er
atomisk og kan kun ske én gang. Rate limits, idempotency og audit-events gemmes også i D1. Det
tidligere KV-`/app-state`- og samtykkeflow er fjernet.

Demo-sessioner må ikke sende mail eller oprette invitationer.

## Konfiguration

Bindingen skal hedde `TIMESHEET_DB`. `mail-worker/wrangler.toml` peger på samme autoritative D1
som timesheet-workeren.

Følgende værdier skal konfigureres til det konkrete auth-miljø uden at gætte projekt-ID'er:

- `AUTH_ISSUER`
- `AUTH_AUDIENCE`
- `SUPABASE_JWKS_URL`
- `ALLOWED_ORIGIN`
- `APP_BASE_URL`
- `RESEND_FROM_EMAIL`

Sæt provider-nøglen som Worker secret:

```sh
npx --yes wrangler@latest secret put RESEND_API_KEY --config mail-worker/wrangler.toml
```

Hvis demo-JWT'er skal kunne identificeres og afvises med den fælles signaturkontrol, skal
`DEMO_SESSION_SECRET` være den samme Worker secret som i timesheet-workeren.

Den nuværende D1-model gemmer mailadresser krypteret. Da krypteringsformat og nøglekontrakt ikke
er leveret, fejler rigtig levering bevidst lukket med
`recipient_decryption_not_configured`. Der bruges ingen klartekst- eller legacy-fallback.

## API

Klientkonfigurationen skal pege på Workerens base-URL. Klienten sender kun faste kommandoer:

```json
{
  "template": "timesheet_submission_contact",
  "timesheetId": "server-timesheet-id",
  "idempotencyKey": "unik-nøgle"
}
```

Tilladte mailtemplates er defineret server-side. Invitationer oprettes med `timesheetId`,
`purpose` og `idempotencyKey`; modtageren kan ikke angives af klienten.

## Lokal kontrol og senere deployment

Kør først migrationerne lokalt via timesheet-workerens migrationer. Start derefter Workeren:

```sh
npm run mail:dev
```

Deploy, remote migration, Worker secrets og auth-konfiguration er eksterne handlinger og udføres
kun efter særskilt godkendelse.
