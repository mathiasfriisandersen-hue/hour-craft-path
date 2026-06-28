# Timesheet mail worker

Cloudflare Worker der sender timesedler via Resend uden at gemme timeseddeldata.

## Hemmelige værdier

Sæt Resend API-nøglen som Worker secret:

```sh
npx --yes wrangler@latest secret put RESEND_API_KEY --config mail-worker/wrangler.toml
```

## Deploy

```sh
npm run mail:deploy
```

Efter deploy skal Worker-URL'en sættes i `public/mail-config.json`:

```json
{
  "timesheetMailApiUrl": "https://<worker-url>/send-timesheet"
}
```

GitHub Pages læser denne fil i browseren og bruger mailsystemet. Hvis URL'en er tom, falder appen
tilbage til den gamle mailkladde.

## Resend domæne

Workerens afsender er sat til:

```text
Sub-Z Timesheet <timesheet@send.mathiasfriisandersen.dk>
```

Det kræver, at `send.mathiasfriisandersen.dk` er verificeret i Resend med de DNS-records, Resend
viser.
