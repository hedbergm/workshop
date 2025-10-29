# Bilservice – enkel webapp

En liten Flask-applikasjon for å føre service- og reparasjonshistorikk for biler du registrerer. Inneholder pålogging (Admin/Admin), bilregister og historikk med dato, beskrivelse, kostnad og km-stand. Sum kostnader vises per bil. Utsalgspris kan settes når bilen selges.

## Krav dekket
- Innlogging: Brukernavn `Admin`, Passord `Admin` (enkelt demo-oppsett)
- Bilregister: Regnr, Merke, Type, Modell, Innkjøpspris
- Historikk: hva som er gjort, når, kostnad (NOK) og km-stand
- Sum kostnad per bil (summeres av historikkoppføringer)
- Utsalgspris ved utregistrering

## Kom i gang (Windows/PowerShell)

1. Opprett og aktiver et virtuelt miljø (valgfritt):
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```
2. Installer avhengigheter:
```powershell
pip install -r requirements.txt
```
3. Start serveren:
```powershell
python .\app.py
```
4. Åpne i nettleser: http://127.0.0.1:5000
   - Logg inn med Admin / Admin

## Struktur
- `app.py` – Flask-app, ruter og visninger
- `models.py` – SQLAlchemy-modeller (Vehicle, ServiceEntry)
- `templates/` – Jinja2 HTML-maler
- `static/style.css` – enkel styling
- SQLite-fil `database.sqlite3` opprettes automatisk ved første kjøring

## Notater
- Dette er en enkel demo uten ekte brukeradministrasjon. Bytt ut SECRET_KEY og legg på ordentlig auth hvis appen skal ut i produksjon.
- Regnr er unikt i databasen. Du får en feilmelding hvis du forsøker å registrere samme regnr flere ganger.
