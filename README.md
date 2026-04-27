# StockEx V2

Eine moderne Website zur Anzeige von Aktienkursen, Nachrichten und einem eigenen Indikator.

## Features

- 📈 Aktienkurse in Echtzeit
- 📰 Finanznachrichten
- 📊 Eigener Indikator (Hauptfokus)

## Entwicklung

```bash
npm install
npm run dev
```

Die Anwendung läuft dann auf [http://localhost:3000](http://localhost:3000)

### API-Keys

Die Anwendung nutzt mehrere kostenlose APIs:
- **Yahoo Finance**: Kein API-Key erforderlich (für Kurse und Basis-Daten)
- **Alpha Vantage**: **Erforderlich** für detaillierte Unternehmensdaten (kostenlos)

**WICHTIG:** Alpha Vantage wird **nur für Unternehmensdaten** verwendet, nicht für Kurse. Dies reduziert die API-Requests erheblich.

Um einen kostenlosen Alpha Vantage API-Key zu erhalten:
1. Gehe zu https://www.alphavantage.co/support/#api-key
2. Fülle das Formular aus (dauert weniger als 20 Sekunden)
3. Erstelle eine `.env.local` Datei im Projekt-Root
4. Füge hinzu: `ALPHA_VANTAGE_API_KEY=dein_api_key_hier`

**Ohne API-Key:** Die Anwendung funktioniert, zeigt aber keine detaillierten Unternehmensdaten an. Kurse und Basis-Informationen werden weiterhin von Yahoo Finance geliefert.

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Recharts (für Diagramme)
