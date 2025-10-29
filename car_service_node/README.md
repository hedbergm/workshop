# Bilservice (Node/Express)

En Node/Express-app med SQLite for å føre service- og reparasjonshistorikk for biler du registrerer. Inneholder pålogging (Admin/Admin), bilregister og historikk med dato, beskrivelse, kostnad og km-stand. Sum kostnader vises per bil. Utsalgspris kan settes når bilen selges.

## Kom i gang (Windows/PowerShell)

1. Installer avhengigheter:
```powershell
cd "c:\Users\mhe\OneDrive - Holship A S\Skrivebord\Server Filer\Workshop\car_service_node"
npm install
```
2. Start serveren:
```powershell
npm start
```
3. Åpne i nettleser: http://127.0.0.1:5000
   - Logg inn med Admin / Admin

## Struktur
- `server.js` – Express-app og ruter
- `db.js` – SQLite-tilkobling, skjema og spørringer (better-sqlite3)
- `views/` – EJS-maler
- `public/style.css` – styling
- SQLite `database.sqlite3` opprettes automatisk ved første kjøring

## Notater
- Demoauth uten ekte brukere; bytt ut session-sekret om dette skal prodsettes.
- `regnr` er unikt. Feil håndteres ved registrering.

## Deploy til Render

Denne repoen har en `render.yaml` i rotmappen. På Render:

1. Opprett en ny Web Service og pek til GitHub-repoet.
2. Render vil lese `render.yaml` og bruke build/start-kommandoer som kjører i `car_service_node`.
3. Ingen miljøvariabler er nødvendige, men `NODE_ENV=production` settes automatisk i `render.yaml`.
4. Health check path er `/`.

Merk: Logoen hentes via en Express static-mount fra `../car_service_app`. Repoen deployes med hele strukturen, så dette fungerer på Render uten ekstra steg.
