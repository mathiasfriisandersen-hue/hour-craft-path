# Timesheet API worker

Serverless API-lag til timesheet-data. Worker gemmer timesedler i Cloudflare D1 og bruger et simpelt API-token i `Authorization` headeren.

Frontend og `mail-worker` er ikke koblet på i denne opgave.

## Endpoints

Alle endpoints kræver:

```http
Authorization: Bearer <TIMESHEET_API_TOKEN>
```

| Method | Path | Beskrivelse |
| --- | --- | --- |
| `POST` | `/api/timesheets` | Opretter eller opdaterer en timeseddel i D1. Body kan være en timeseddel direkte eller `{ "timesheet": { ... } }`. |
| `GET` | `/api/timesheets` | Henter alle timesedler fra D1. |
| `GET` | `/api/timesheets/pending` | Henter indsendte timesedler, hvor perioden er afsluttet og godkendelse afventer. |
| `GET` | `/api/timesheets/invoice-ready` | Henter godkendte timesedler med timer, hvor faktura ikke er markeret sendt. |
| `GET` | `/api/timesheets/payroll-ready` | Henter timesedler klar til løn/bogholderi efter eksisterende status- og periodeprincipper. |
| `GET` | `/api/timesheets/sick-leave` | Henter timesedler med registreret sygdom. |
| `GET` | `/api/analytics` | Returnerer aggregerede tal uden navne, mail, telefon, CPR eller adgangskoder. |

## Lokal opsætning

Installer ikke noget globalt. Brug Wrangler via `npx`:

Cloudflares lokale Workers runtime kræver macOS 13.5+ eller en Linux/DevContainer runtime. På ældre macOS kan `wrangler deploy --dry-run` stadig bruges til bundle-check, men lokal D1/runtime kan fejle før Worker starter.

```sh
npx --yes wrangler@latest d1 create hour-craft-timesheets
```

Kopier `database_id` fra outputtet ind i `timesheet-worker/wrangler.toml`.

Opret lokal D1 database og kør migration:

```sh
npx --yes wrangler@latest d1 migrations apply hour-craft-timesheets --local --config timesheet-worker/wrangler.toml
```

Opret en lokal secret-fil:

```sh
cat > timesheet-worker/.dev.vars <<'EOF'
TIMESHEET_API_TOKEN=skift-denne-lokalt
EOF
```

Start Worker lokalt:

```sh
npx --yes wrangler@latest dev --config timesheet-worker/wrangler.toml
```

Test lokalt:

```sh
curl -sS http://127.0.0.1:8787/api/timesheets \
  -H "Authorization: Bearer skift-denne-lokalt"
```

## Deploy

Sæt API-token som Cloudflare Worker secret:

```sh
npx --yes wrangler@latest secret put TIMESHEET_API_TOKEN --config timesheet-worker/wrangler.toml
```

Kør migration mod remote D1:

```sh
npx --yes wrangler@latest d1 migrations apply hour-craft-timesheets --remote --config timesheet-worker/wrangler.toml
```

Deploy Worker:

```sh
npx --yes wrangler@latest deploy --config timesheet-worker/wrangler.toml
```

## Data og persondata

Timesedlen gemmes som JSON i kolonnen `data`, og D1-tabellen har separate indeksfelter til status, uge, virksomhed, sygdom, faktura og løn. Det gør API'et kompatibelt med den eksisterende Timesheet-form uden at ændre appens felter.

`/api/analytics` returnerer kun aggregerede nøgletal. Brug `/api/timesheets/*` endpoints, hvis en autoriseret intern klient skal bruge fulde timeseddeldata.
