# Timesheet API worker

Organisation-afgrænset API til timesedler, overenskomstkatalog og beregningssnapshots i
Cloudflare D1.

## Autorisation

Produktion kræver en serverudstedt JWT i `Authorization: Bearer <jwt>`. Workeren verificerer
signaturen mod Supabase JWKS og kontrollerer issuer, audience, udløb, tilbagekaldelse samt aktivt
organisationsmedlemskab og rolle i D1. Browser-CORS giver ikke adgang i sig selv.

Følgende værdier skal konfigureres til det konkrete auth-miljø; README'en angiver bevidst ingen
projekt-ID'er eller URL'er:

- `AUTH_ISSUER`
- `AUTH_AUDIENCE`
- `SUPABASE_JWKS_URL`
- `ALLOWED_ORIGIN`

Demo kræver desuden `DEMO_SESSION_SECRET` som Worker secret. En demosession er højst gyldig i én
time, er bundet til demoorganisationen og giver kun syntetiske/tomme svar. Demo kan ikke skrive
timesedler, sende mail eller læse produktionsdata.

## D1 og migrationer

Bindingen skal hedde `TIMESHEET_DB`. Brug databasekonfigurationen i
`timesheet-worker/wrangler.toml`; opfind eller kopier ikke database-ID'er fra dokumentation.

Kør alle versionerede migrationer lokalt:

```sh
npx --yes wrangler@latest d1 migrations apply <database-name> \
  --local \
  --config timesheet-worker/wrangler.toml
```

Kør mod remote D1 først efter særskilt godkendelse:

```sh
npx --yes wrangler@latest d1 migrations apply <database-name> \
  --remote \
  --config timesheet-worker/wrangler.toml
```

Migrationerne omfatter det oprindelige timesheet-skema, det normaliserede multi-tenant- og
overenskomstskema samt agreement-kataloget. Eksisterende rækker uden sikker
organisationstilknytning forbliver blokeret til manuel tenant-migrering.

## Centrale endpoints

Alle endpoints undtagen oprettelse af en konfigureret demosession kræver en verificeret session.
Svar og mutationer afgrænses til sessionens organisation og rolle.

| Method | Path                               | Formål                                                             |
| ------ | ---------------------------------- | ------------------------------------------------------------------ |
| `POST` | `/api/demo/session`                | Udsteder en kort, read-only demosession, når demo er konfigureret. |
| `GET`  | `/api/session`                     | Returnerer den serververificerede session.                         |
| `GET`  | `/api/agreements`                  | Returnerer overenskomstkatalog og versionsstatus.                  |
| `GET`  | `/api/timesheets`                  | Returnerer rollefiltrerede timesedler i organisationen.            |
| `POST` | `/api/timesheets`                  | Opretter/opdaterer med relationskontrol og optimistic concurrency. |
| `POST` | `/api/timesheets/:id/calculations` | Opretter et versionslåst beregningssnapshot med eksplicit `asOf`.  |
| `GET`  | `/api/timesheets/pending`          | Returnerer timesedler, der afventer godkendelse.                   |
| `GET`  | `/api/timesheets/invoice-ready`    | Returnerer timesedler, der kan vurderes til faktura.               |
| `GET`  | `/api/timesheets/payroll-ready`    | Returnerer timesedler, der kan vurderes til løn.                   |
| `GET`  | `/api/timesheets/sick-leave`       | Returnerer autoriserede sygefraværsregistreringer.                 |
| `GET`  | `/api/analytics`                   | Returnerer rolle- og organisationstilpassede aggregater.           |

Godkendte timesedler er låst. Mutationer bruger ETag/`If-Match`, og sikkerhedsrelevante handlinger
skriver audit-events. Manglende eller ikke-validerede overenskomstregler skal blokere automatisk
beløbsberegning og markeres til manuel validering.

## Lokal kontrol

Start kun efter at bindings, migrationer og auth-værdier er konfigureret:

```sh
npx --yes wrangler@latest dev --config timesheet-worker/wrangler.toml
```

Eksempel på en autoriseret sessionskontrol:

```sh
curl -sS http://127.0.0.1:8787/api/session \
  -H "Authorization: Bearer <server-issued-jwt>"
```

Der findes ikke længere et globalt `TIMESHEET_API_TOKEN`, en browserautoriserende
`/app-state`-rute eller en lokal adgangskode som alternativ til en serversession.

## Deploy

Deploy, remote migrationer og secret-ændringer er eksterne handlinger og udføres ikke som del af
lokale kodeændringer uden udtrykkelig godkendelse.
