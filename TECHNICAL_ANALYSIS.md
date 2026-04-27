# Technische Analyse: StockEx V2

**Erstellt:** 2024  
**Analysiert von:** System-Analyse  
**Zweck:** Vollständiges technisches Verständnis der aktuellen Lösung

---

## 1️⃣ Projekt- & Architekturüberblick

### Tech-Stack

**Frontend:**
- **Framework:** Next.js 14 (App Router)
- **UI-Library:** React 18.2.0
- **Sprache:** TypeScript 5.2.2
- **Styling:** Tailwind CSS 3.3.5
- **Charts:** Recharts 2.10.0
- **HTTP-Client:** Axios 1.13.2 (installiert, aber nicht aktiv genutzt - stattdessen native `fetch`)

**Backend:**
- **Runtime:** Node.js (Next.js Server-Side)
- **API:** Next.js API Routes (App Router)
- **Keine separate Backend-Infrastruktur**

**Datenquellen:**
- **Yahoo Finance API** (v8 Chart API, v7 Quote API, v1 Search API)
- **Alpha Vantage API** (nur für fundamentale Unternehmensdaten)

**Deployment:**
- **Nicht erkennbar:** Keine CI/CD-Konfigurationen (`.github/workflows`, `.gitlab-ci.yml`, etc.)
- **Keine Docker-Konfiguration**
- **Keine Deployment-Skripte**
- **Annahme:** Lokale Entwicklung oder manuelles Deployment

### Architektur-Diagramm (Textuell)

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Startseite │  │   Aktien     │  │  Indikator   │      │
│  │   (page.tsx) │  │   (aktien/)  │  │ (indikator/) │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │               │
│  ┌──────▼─────────────────▼──────────────────▼───────┐     │
│  │         Shared Components (Navigation, etc.)        │     │
│  └─────────────────────────────────────────────────────┘     │
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTP Requests
                            │
┌───────────────────────────▼──────────────────────────────────┐
│              NEXT.JS SERVER (API Routes)                       │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  /api/stocks          → Yahoo Finance (Kurse)        │    │
│  │  /api/stocks/[symbol] → Yahoo Finance (Historie)    │    │
│  │  /api/stocks/[symbol]/details → Multi-Source        │    │
│  │    ├─ Yahoo Chart API                               │    │
│  │    ├─ Yahoo Quote API                                │    │
│  │    └─ Alpha Vantage (Fundamentale Daten)            │    │
│  │  /api/stocks/[symbol]/news → Yahoo Search API       │    │
│  │  /api/indices         → Yahoo Finance (Indizes)     │    │
│  └──────────────────────────────────────────────────────┘    │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            │ HTTP Requests
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                    EXTERNE APIs                                │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │  Yahoo Finance   │  │ Alpha Vantage   │                   │
│  │  - Chart API v8  │  │ - OVERVIEW      │                   │
│  │  - Quote API v7  │  │   (nur Fund.)   │                   │
│  │  - Search API v1 │  │                 │                   │
│  └──────────────────┘  └──────────────────┘                   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│              CLIENT-SIDE STATE & LOGIC                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  CustomIndicator.tsx (Indikator-Logik)                   │  │
│  │  - Technische Analyse (RSI, MA, Support)                  │  │
│  │  - Fundamentale Analyse (KGV, PEG, etc.)                  │  │
│  │  - Backtesting                                           │  │
│  │  - Optimierung                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Portfolio (localStorage)                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### Kommunikationswege

1. **Client → Server:** HTTP GET-Requests zu Next.js API Routes
2. **Server → Externe APIs:** HTTP GET-Requests (kein WebSocket, kein Streaming)
3. **Client → Client:** Keine Peer-to-Peer-Kommunikation
4. **Batch/Jobs:** Keine Hintergrund-Jobs, keine Scheduled Tasks
5. **Caching:** 
   - Next.js Cache-Control Headers (s-maxage, stale-while-revalidate)
   - Keine Redis/Database-Cache-Schicht
   - Client-seitig: localStorage für Portfolio

### Trennung Website/Indikator

**Website (Frontend):**
- Statische Seiten: `/about`, `/kontakt`
- Dynamische Seiten: `/`, `/aktien`, `/news`, `/portfolio`
- Navigation: Shared Component (`components/Navigation.tsx`)

**Indikator (Analyse-Logik):**
- **Hauptkomponente:** `components/CustomIndicator.tsx` (1732 Zeilen)
- **Seite:** `/indikator` (Wrapper für CustomIndicator)
- **Entwicklung:** `/indikator-dev` (separate Optimierungsseite)
- **Kopplung:** Indikator ist React-Component, wird in Frontend eingebettet

**Kritische Beobachtung:** Indikator-Logik ist **vollständig client-seitig**. Alle Berechnungen laufen im Browser.

---

## 2️⃣ Website / Frontend

### Seiten-Übersicht

| Route | Datei | Zweck | Dynamische Daten |
|-------|-------|-------|------------------|
| `/` | `app/page.tsx` | Startseite | Indizes (DAX, DOWJ, S&P500, Nasdaq) |
| `/aktien` | `app/aktien/page.tsx` | Aktien-Übersicht | Aktienkurse (AAPL, MSFT, etc.) |
| `/aktien/[symbol]` | `app/aktien/[symbol]/page.tsx` | Aktien-Detail | Kurs, Chart, Unternehmensdaten, News |
| `/news` | `app/news/page.tsx` | News-Übersicht | Finanznachrichten |
| `/indikator` | `app/indikator/page.tsx` | Indikator-Seite | Wrapper für CustomIndicator |
| `/indikator-dev` | `app/indikator-dev/page.tsx` | Entwicklungsseite | Optimierungs-Ergebnisse |
| `/portfolio` | `app/portfolio/page.tsx` | Portfolio-Management | Portfolio-Daten (localStorage) |
| `/about` | `app/about/page.tsx` | Statisch | Keine |
| `/kontakt` | `app/kontakt/page.tsx` | Statisch | Keine |

### Datenflüsse

**Startseite (`/`):**
```
Client → /api/indices → Yahoo Finance → Indizes-Daten → Chart-Rendering
```

**Aktien-Übersicht (`/aktien`):**
```
Client → /api/stocks?symbols=... → Yahoo Finance → Aktienliste → Tabelle
```

**Aktien-Detail (`/aktien/[symbol]`):**
```
Client → /api/stocks/[symbol]?range=... → Yahoo Finance → Kursdaten
Client → /api/stocks/[symbol]/details → Multi-Source → Unternehmensdaten
Client → /api/stocks/[symbol]/news → Yahoo Search → News
```

**Indikator (`/indikator`):**
```
Client → /api/stocks/[symbol]?range=... → Yahoo Finance → Historische Daten
Client → /api/stocks/[symbol]/details → Alpha Vantage → Fundamentale Daten
Client → CustomIndicator.tsx → Berechnung (client-seitig) → Chart/Ergebnisse
```

**Portfolio (`/portfolio`):**
```
Client → localStorage → Portfolio-Daten
Client → /api/stocks/[symbol] → Yahoo Finance → Aktuelle Kurse (für Update)
```

### Nutzerinteraktionen

**Watchlist/Filter:**
- **NICHT vorhanden:** Keine Watchlist-Funktion
- **NICHT vorhanden:** Keine Filter-Funktion
- **Portfolio:** Manuelle Eingabe von Positionen (Symbol, Anzahl, Kaufpreis)

**Aktienauswahl:**
- **Indikator:** Dropdown mit vordefinierten Symbolen (AAPL, MSFT, GOOGL, AMZN, TSLA, META, NVDA, JPM)
- **Aktien-Übersicht:** Gleiche vordefinierte Liste
- **Keine Suche:** Keine Suchfunktion für beliebige Aktien

### Abhängigkeiten zum Indikator

**Harte Kopplungen:**
1. **Indikator-Seite:** Direkter Import von `CustomIndicator` Component
2. **Datenformat:** Indikator erwartet spezifisches `Stock`-Interface
3. **API-Aufrufe:** Indikator ruft direkt `/api/stocks/[symbol]` und `/api/stocks/[symbol]/details` auf

**Implizite Annahmen:**
1. **Datenformat:** `historical` Array muss `{date: string, close: number}` enthalten
2. **CompanyDetails:** Muss bestimmte Felder enthalten (peRatio, pegRatio, etc.)
3. **Zeitstempel:** Datum-Strings werden als ISO-Strings oder "YYYY-MM-DD" erwartet
4. **Preise:** Alle Preise werden in EUR erwartet (automatische USD→EUR Konvertierung)

---

## 3️⃣ Indikator / Analyse-Logik

### Features & Berechnungen

**Technische Analyse:**

1. **RSI (Relative Strength Index) - ähnlich:**
   - **Berechnung:** 14-Tage Lookback
   - **Formel:** `RSI = 100 - (100 / (1 + RS))` mit `RS = avgGain / avgLoss`
   - **Output:** Wert 0-100
   - **Gewichtung:** 30% im technischen Score

2. **Moving Average (MA):**
   - **Berechnung:** Einfacher gleitender Durchschnitt
   - **Standard-Periode:** 14 Tage (konfigurierbar)
   - **Score-Berechnung:** `50 + (maDistance * 5)` mit `maDistance = ((price - MA) / MA) * 100`
   - **Gewichtung:** 60% im technischen Score

3. **Support-Levels:**
   - **Erkennung:** Lokale Minima in den letzten 12 Monaten
   - **Fenster:** Dynamisch (`Math.floor(recentData.length / 20)`)
   - **Clustering:** ±1% Toleranz für Gruppierung
   - **Filter:** Nur Levels mit ≥2 Berührungen
   - **Score-Berechnung:** 
     - Kurs an Support (±0.5%): 90-100
     - Kurs leicht über Support (0.5-2%): 70-90
     - Kurs über Support (2-5%): 50-70
     - Kurs deutlich über Support (>5%): 30-50
     - Kurs unter Support: 0-30
   - **Gewichtung:** 10% im technischen Score

**Fundamentale Analyse:**

1. **KGV (P/E Ratio):**
   - **Optimal:** 15-25 → Score 80
   - **Akzeptabel:** 10-30 → Score 60
   - **Überbewertet:** >30 → Score 20
   - **Gewichtung:** 10%

2. **PEG Ratio:**
   - **Optimal:** 0.5-1.5 → Score 80
   - **Sehr günstig:** <0.5 → Score 90
   - **Überbewertet:** >2 → Score 20
   - **Gewichtung:** 15%

3. **Gewinnmarge:**
   - **Exzellent:** >25% → Score 100
   - **Gut:** >15% → Score 80
   - **Akzeptabel:** >5% → Score 60
   - **Niedrig:** ≤5% → Score 30
   - **Gewichtung:** 15%

4. **Umsatzwachstum:**
   - **Sehr stark:** >20% → Score 100
   - **Gut:** >10% → Score 80
   - **Moderat:** >5% → Score 60
   - **Negativ:** Linear abgestuft
   - **Gewichtung:** 30%

5. **Gewinnwachstum:**
   - **Sehr stark:** >20% → Score 100
   - **Gut:** >10% → Score 80
   - **Moderat:** >5% → Score 60
   - **Negativ:** Linear abgestuft
   - **Gewichtung:** 25%

6. **Dividendenrendite:**
   - **Gut:** >3% → Score 90
   - **Moderat:** >1.5% → Score 70
   - **Niedrig:** ≤1.5% → Score 60
   - **Gewichtung:** 5%

**Kombinierter Score:**
- **Technischer Score:** RSI (30%) + MA (60%) + Support (10%)
- **Fundamentaler Score:** Gewichtete Summe aller 6 Metriken
- **Kombinierter Score:** Technisch (60%) + Fundamental (40%)

### Zeitauflösung

**Historische Daten:**
- **Standard:** Tagesdaten (`interval=1d`)
- **Intraday (1d):** 5-Minuten-Intervalle (`interval=5m`)
- **1 Woche:** Stunden-Intervalle (`interval=1h`)
- **5 Jahre/Max:** Wochen-Intervalle (`interval=1wk`)

**Indikator-Berechnung:**
- **RSI:** 14-Tage Lookback
- **MA:** Konfigurierbar (Standard: 14 Tage)
- **Support/Resistance:** Letzte 12 Monate

### Hart codierte Parameter

**Technische Indikatoren:**
- RSI Lookback: **14 Tage** (hart codiert)
- MA Standard-Periode: **14 Tage** (konfigurierbar via UI)
- Support-Clustering: **±1%** Toleranz
- Support-Minimum-Berührungen: **2**

**Schwellenwerte (Empfehlungslogik):**
- **KAUFEN:** `technicalSignal && (fundamentalScore > 50 || combinedScore > 52)`
- **VERKAUFEN:** `!technicalSignal && (fundamentalScore < 45 || combinedScore < 48)`
- **HALTEN:** Alles andere

**Support-Score-Schwellen:**
- ±0.5%, 0.5-2%, 2-5%, >5% (hart codiert)
- Score-Bereiche: 90-100, 70-90, 50-70, 30-50, 0-30 (hart codiert)

**Fundamentale Schwellen:**
- KGV: 10, 15, 25, 30 (hart codiert)
- PEG: 0.5, 1.5, 2.0 (hart codiert)
- Gewinnmarge: 5%, 15%, 25% (hart codiert)
- Wachstum: 5%, 10%, 20% (hart codiert)
- Dividende: 1.5%, 3% (hart codiert)

### Implizite Heuristiken

1. **Support-Erkennung:** Lokale Minima innerhalb eines dynamischen Fensters (keine statistische Validierung)
2. **Score-Normalisierung:** Lineare Interpolation zwischen Schwellenwerten
3. **Neutrale Scores:** Fehlende Daten → Score 50 (neutral)
4. **MA-Score:** Begrenzt auf ±50 Punkte Abweichung (`Math.min(Math.max(maDistance * 5, -50), 50)`)

### Input/Output pro Komponente

**`calculateFundamentalScore(details: CompanyDetails | null): number`**
- **Input:** CompanyDetails (peRatio, pegRatio, profitMargins, etc.) oder null
- **Output:** Score 0-100
- **Zweck:** Bewertung fundamentaler Unternehmensdaten
- **Abhängigkeiten:** CompanyDetails-Interface, hart codierte Schwellenwerte

**`calculateSupportScore(currentPrice: number, supportLevels: number[]): number`**
- **Input:** Aktueller Preis, Array von Support-Levels
- **Output:** Score 0-100
- **Zweck:** Bewertung der Nähe zu Support-Linien
- **Abhängigkeiten:** `calculateSupportResistanceLevels()` muss vorher aufgerufen werden

**`calculateSupportResistanceLevels(historical: Array<{date: string, close: number}>): {support: number[], resistance: number[]}`**
- **Input:** Historische Preisdaten (letzte 12 Monate)
- **Output:** Arrays von Support- und Resistance-Levels
- **Zweck:** Identifikation wichtiger Preisniveaus
- **Abhängigkeiten:** Mindestens 20 Datenpunkte, Filterung auf 12 Monate

**`getRecommendation(dataPoint?: IndicatorData): 'KAUFEN' | 'VERKAUFEN' | 'HALTEN'`**
- **Input:** Optionaler Datenpunkt (sonst aktueller Datenpunkt)
- **Output:** Empfehlung
- **Zweck:** Generierung von Trading-Signalen
- **Abhängigkeiten:** `technicalSignal`, `fundamentalScore`, `combinedScore` müssen berechnet sein

---

## 4️⃣ Datenquellen & Marktdaten

### Datenanbieter

**Yahoo Finance:**
- **Endpunkte:**
  - `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}` (Chart API)
  - `https://query1.finance.yahoo.com/v7/finance/quote?symbols={symbol}` (Quote API)
  - `https://query1.finance.yahoo.com/v1/finance/search?q={symbol}` (Search API)
- **Datenqualität:** Live (während Handelszeiten), Delayed (außerhalb)
- **Rate Limits:** **NICHT dokumentiert** - implizite Annahme: keine strikten Limits
- **Kosten:** Kostenlos (kein API-Key erforderlich)
- **Zuverlässigkeit:** Unbekannt - keine offizielle API-Dokumentation

**Alpha Vantage:**
- **Endpoint:** `https://www.alphavantage.co/query?function=OVERVIEW&symbol={symbol}&apikey={key}`
- **Datenqualität:** EOD (End of Day) für fundamentale Daten
- **Rate Limits:** 
  - Free Tier: 5 Requests/Minute, 500 Requests/Tag
  - **Risiko:** Rate-Limit-Überschreitung führt zu Fehlern
- **Kosten:** Kostenlos (mit API-Key)
- **Nutzung:** **NUR für fundamentale Unternehmensdaten**, nicht für Kurse

### Datenfluss & Caching

**Pull-Modell:**
- **Kein Push/Streaming:** Alle Daten werden per HTTP GET abgerufen
- **Client-seitig:** `useEffect` mit Fetch-Calls
- **Server-seitig:** Next.js API Routes mit Cache-Control Headers

**Caching-Strategie:**
- **Yahoo Finance:** `s-maxage=60, stale-while-revalidate=30` (60 Sekunden)
- **Alpha Vantage:** `s-maxage=3600` (1 Stunde) - längeres Caching wegen Rate Limits
- **Indizes:** `s-maxage=300` (5 Minuten)
- **Keine persistente Cache-Schicht:** Kein Redis, keine Datenbank

**Währungskonvertierung:**
- **USD → EUR:** Automatische Konvertierung via EURUSD=X Rate
- **Berechnung:** `priceEUR = priceUSD * (1 / eurUsdRate)`
- **Fallback:** 0.92 (hart codiert) wenn API fehlschlägt

### Risiken

**API-Limits:**
1. **Alpha Vantage:** 5 Requests/Minute → **Kritisch** bei mehreren Nutzern
2. **Yahoo Finance:** Unbekannte Limits → **Mittel** (kann zu Blockierungen führen)
3. **Keine Rate-Limit-Behandlung:** Keine Retry-Logik, keine Queue

**Kostenfallen:**
- **Aktuell:** Keine Kosten (alle APIs kostenlos)
- **Risiko:** Alpha Vantage könnte kostenpflichtig werden
- **Keine Alternative:** Kein Fallback-Provider für fundamentale Daten

**Latenz:**
- **Client-seitige Berechnung:** Indikator-Berechnung im Browser → abhängig von Client-Performance
- **Sequenzielle API-Calls:** Keine parallele Optimierung bei mehreren Requests
- **Keine Prefetching-Strategie:** Daten werden erst bei Bedarf geladen

**Datenlücken:**
- **Fehlerbehandlung:** Try-Catch vorhanden, aber keine Retry-Logik
- **Fallback:** Teilweise Fallbacks (z.B. EURUSD-Rate), aber nicht vollständig
- **Fehlende Daten:** Alpha Vantage kann "None" oder "N/A" zurückgeben → wird zu 0 konvertiert

---

## 5️⃣ Backtesting / Validierung

### Backtesting-Implementierung

**Vorhanden:** ✅ Ja, in `CustomIndicator.tsx` (`runBacktest()`)

**Funktionsweise:**
1. **Datenbasis:** Verwendet bereits berechnete `data` Array (historische Indikator-Werte)
2. **Signal-Generierung:** Verwendet `getRecommendation()` für jeden Datenpunkt
3. **Trade-Simulation:**
   - **KAUFEN:** Eröffnet LONG-Position bei KAUFEN-Signal
   - **VERKAUFEN:** Schließt Position bei VERKAUFEN-Signal oder Stop-Loss (Preis < MA * 0.95)
   - **HALTEN:** Keine Aktion
4. **Metriken:**
   - Total Trades, Winning Trades, Losing Trades
   - Win Rate, Total Return, Best/Worst Trade, Average Return

### Lookahead-Bias-Prävention

**KRITISCHES PROBLEM:** ❌ **Lookahead-Bias vorhanden**

**Beweis:**
```typescript
// In runBacktest():
const recommendation = getRecommendation(current)
```

**Problem:** `getRecommendation()` verwendet `current.combinedScore`, `current.fundamentalScore`, etc. Diese Scores werden **vor dem Backtest** für alle Datenpunkte berechnet, wobei:
- **RSI:** Verwendet zukünftige Daten (14-Tage Lookback nach vorne)
- **MA:** Verwendet zukünftige Daten (Moving Average enthält zukünftige Preise)
- **Support-Levels:** Werden aus **gesamten** historischen Daten berechnet (inkl. zukünftiger Daten)

**Korrekte Implementierung würde erfordern:**
- RSI nur mit Daten bis zum aktuellen Zeitpunkt
- MA nur mit vergangenen Daten
- Support-Levels nur mit Daten bis zum aktuellen Zeitpunkt

**Aktueller Status:** Backtest verwendet Informationen, die zum Zeitpunkt der Entscheidung nicht verfügbar waren.

### Walk-Forward-Tests

**NICHT vorhanden:** ❌ Keine Walk-Forward-Validierung

**Was fehlt:**
- Keine Aufteilung in Trainings-/Test-Sets
- Keine Out-of-Sample-Validierung
- Keine Rolling-Window-Tests

### Metriken

**Gemessen:**
- Win Rate (Gewinnwahrscheinlichkeit)
- Total Return (Gesamt-Rendite)
- Best/Worst Trade
- Average Return

**NICHT gemessen:**
- Sharpe Ratio
- Maximum Drawdown
- Profit Factor
- Risk-Adjusted Returns
- Trade-Dauer
- Slippage/Commissions (vereinfacht)

### Trade-Logging

**Vorhanden:** ✅ Trades werden in `BacktestResult.trades[]` gespeichert
- Entry/Exit Date, Price, Return, Return Percent

**NICHT geloggt:**
- Indikator-Werte zum Zeitpunkt des Trades
- Market Conditions
- Volatilität
- Volume

---

## 6️⃣ Erweiterbarkeit & "Selbstlernen"

### Parameter-Optimierung

**Vorhanden:** ✅ `optimizeWeights()` Funktion

**Funktionsweise:**
1. **Optimal Trades finden:** Analysiert zukünftige Preise (5 Tage Lookahead) → **Lookahead-Bias**
2. **Grid Search:** Testet verschiedene Gewichtungskombinationen
3. **Performance-Metrik:** `(accuracy * 0.4) + (winRate * 0.3) + (normalizedReturn * 0.3)`
4. **Ausgabe:** Beste Gewichtungskombination

**Probleme:**
- **Lookahead-Bias:** Verwendet zukünftige Preise zur Identifikation "optimaler" Trades
- **Overfitting-Risiko:** Keine Out-of-Sample-Validierung
- **Begrenzte Suche:** Nur diskrete Werte (z.B. techWeight: 50, 60, 70, 80, 90)

### ML/Optimierung Integration

**Theoretisch integrierbar:** ⚠️ **Mit Einschränkungen**

**Blockierende Faktoren:**

1. **Client-seitige Berechnung:**
   - Alle Berechnungen laufen im Browser
   - ML-Modelle benötigen typischerweise Server-Ressourcen
   - **Lösung:** Indikator-Logik auf Server verschieben

2. **Monolithische Komponente:**
   - `CustomIndicator.tsx` ist 1732 Zeilen, alles in einer Datei
   - Keine Trennung von Berechnung und UI
   - **Lösung:** Refactoring in separate Module

3. **Hart codierte Schwellenwerte:**
   - Alle Schwellenwerte sind fest im Code
   - ML würde dynamische Schwellenwerte benötigen
   - **Lösung:** Konfigurierbare Parameter-Schicht

4. **Fehlende Daten-Pipeline:**
   - Keine strukturierte Datenaufbereitung
   - Keine Feature-Engineering-Pipeline
   - **Lösung:** ETL-Pipeline implementieren

**Erweiterbar:**
- **Datenstruktur:** Bereits strukturiert (IndicatorData Interface)
- **Modularität:** Berechnungen sind in Funktionen gekapselt
- **API-Integration:** Externe APIs können erweitert werden

### Entkopplung erforderlich

**Zu entkoppeln:**
1. **Berechnungslogik ↔ UI:** Indikator-Berechnung sollte Service/API sein
2. **Datenquellen ↔ Berechnung:** Abstrakte Datenquelle-Interface
3. **Parameter ↔ Logik:** Konfigurierbare Parameter-Schicht
4. **Backtesting ↔ Live-Trading:** Separate Module

**Aktueller Zustand:** Alles ist eng gekoppelt in einer React-Component.

---

## 7️⃣ Kritische Schwachstellen

### Technische Schulden

**KRITISCH:**
1. **Lookahead-Bias im Backtesting:** Backtest verwendet zukünftige Informationen
2. **Lookahead-Bias in Optimierung:** Optimierung identifiziert "optimale Trades" mit 5-Tage-Lookahead
3. **Keine Rate-Limit-Behandlung:** Alpha Vantage kann bei mehreren Nutzern fehlschlagen
4. **Client-seitige Berechnung:** Indikator-Logik im Browser → Performance-Probleme bei großen Datenmengen

**MITTEL:**
1. **Monolithische Komponente:** 1732 Zeilen in einer Datei
2. **Fehlende Fehlerbehandlung:** Viele API-Calls ohne Retry-Logik
3. **Hart codierte Schwellenwerte:** Keine Konfigurierbarkeit
4. **Keine Datenvalidierung:** API-Responses werden nicht validiert (TypeScript-Typen helfen, aber Runtime-Validierung fehlt)

**GERING:**
1. **Code-Duplikation:** EURUSD-Rate-Berechnung mehrfach vorhanden
2. **Fehlende Tests:** Keine Unit-Tests erkennbar
3. **Inkonsistente Fehlerbehandlung:** Teilweise try-catch, teilweise nicht

### Implizite Annahmen

**KRITISCH:**
1. **Yahoo Finance API:** Wird als stabil und verfügbar angenommen (keine offizielle Dokumentation)
2. **Datenformat:** API-Responses haben erwartete Struktur (keine Schema-Validierung)
3. **Währung:** Alle Preise werden in EUR erwartet (USD→EUR Konvertierung)
4. **Zeitzone:** Keine explizite Zeitzone-Behandlung (kann zu Problemen führen)

**MITTEL:**
1. **Support-Levels:** Werden als stabil angenommen (keine Validierung der Signifikanz)
2. **Fundamentale Daten:** Alpha Vantage liefert konsistente Daten (kann "None"/"N/A" sein)
3. **Historische Daten:** Vollständige Datenreihen ohne Lücken

### Overfitting-Risiken

**KRITISCH:**
1. **Optimierung ohne Out-of-Sample-Test:** Beste Gewichtung wird auf denselben Daten getestet, auf denen sie optimiert wurde
2. **Viele Parameter:** 3 Tech-Gewichtungen + 6 Fund-Gewichtungen + 2 Haupt-Gewichtungen = 11 Parameter
3. **Keine Cross-Validation:** Keine Aufteilung in Train/Test-Sets

**MITTEL:**
1. **Grid Search:** Begrenzte Suche (nicht exhaustive)
2. **Performance-Metrik:** Kombiniert mehrere Metriken (kann zu Overfitting führen)

### Skalierungsprobleme

**KRITISCH:**
1. **Client-seitige Berechnung:** Bei vielen Datenpunkten kann Browser langsam werden
2. **Alpha Vantage Rate Limits:** 5 Requests/Minute → bei mehreren Nutzern problematisch
3. **Keine Caching-Strategie:** Jeder Nutzer lädt Daten neu

**MITTEL:**
1. **Sequenzielle API-Calls:** Könnte parallelisiert werden
2. **Keine Datenbank:** Portfolio nur in localStorage (nicht synchronisiert zwischen Geräten)

### Regulatorische/Kommunikative Risiken

**KRITISCH:**
1. **Keine Haftungsausschlüsse:** Trading-Empfehlungen ohne Disclaimer
2. **Keine Risikowarnung:** Keine Hinweise auf Verlustrisiken
3. **"Professionelle Indikatoren":** Marketing-Sprache ohne Qualifikation

**MITTEL:**
1. **Datenqualität:** Keine Garantie für Datenkorrektheit
2. **Keine Dokumentation:** Keine Dokumentation der Indikator-Logik für Nutzer

---

## 8️⃣ Offene Fragen an den Produktentwickler

### Fehlende Informationen

1. **Deployment:**
   - Wo wird die Anwendung gehostet?
   - Gibt es eine Produktions-Umgebung?
   - Wie werden Updates deployed?

2. **Nutzerbasis:**
   - Wie viele gleichzeitige Nutzer werden erwartet?
   - Ist die Anwendung öffentlich oder intern?

3. **Datenqualität:**
   - Welche Anforderungen gibt es an Datenaktualität?
   - Wie werden Datenlücken behandelt?
   - Gibt es Backup-Datenquellen?

4. **Performance:**
   - Welche Latenz-Anforderungen gibt es?
   - Wie viele Aktien sollen gleichzeitig analysiert werden können?

### Unklare Designentscheidungen

5. **Client-seitige Berechnung:**
   - Warum wurde die Indikator-Logik client-seitig implementiert?
   - Gibt es Pläne für Server-seitige Berechnung?

6. **Backtesting:**
   - Soll der Lookahead-Bias behoben werden?
   - Gibt es Anforderungen an Backtesting-Genauigkeit?

7. **Optimierung:**
   - Soll die Optimierung Lookahead-Bias-frei sein?
   - Gibt es Anforderungen an Out-of-Sample-Validierung?

8. **Datenquellen:**
   - Warum wurde Yahoo Finance gewählt (keine offizielle API)?
   - Gibt es Pläne für alternative Datenquellen?
   - Wie wird mit API-Änderungen umgegangen?

### Annahmen, die bestätigt werden müssen

9. **Indikator-Logik:**
   - Sind die Schwellenwerte (KGV 15-25, etc.) wissenschaftlich fundiert?
   - Gibt es Backtests, die die Indikator-Performance validieren?
   - Wie wurde die Gewichtung (60% technisch, 40% fundamental) bestimmt?

10. **Support/Resistance:**
    - Warum ±1% Toleranz für Clustering?
    - Warum Minimum 2 Berührungen?
    - Gibt es Validierung, dass diese Levels signifikant sind?

11. **Empfehlungslogik:**
    - Warum `combinedScore > 52` für KAUFEN?
    - Warum `combinedScore < 48` für VERKAUFEN?
    - Gibt es historische Validierung dieser Schwellenwerte?

12. **Skalierung:**
    - Wie viele gleichzeitige Nutzer werden erwartet?
    - Wie viele API-Requests pro Minute/Tag?
    - Gibt es Budget für kostenpflichtige APIs?

13. **Rechtliches:**
    - Gibt es Haftungsausschlüsse für Trading-Empfehlungen?
    - Werden regulatorische Anforderungen erfüllt?
    - Gibt es Compliance-Anforderungen?

14. **Zukunft:**
    - Gibt es Roadmap für ML-Integration?
    - Soll die Anwendung erweitert werden (mehr Aktien, mehr Indikatoren)?
    - Gibt es Performance-Optimierungs-Pläne?

---

## Zusammenfassung

**Stärken:**
- Moderne Tech-Stack (Next.js, TypeScript, React)
- Strukturierte Code-Basis
- Funktionsfähige Indikator-Implementierung
- Multi-Source-Datenintegration

**Kritische Schwächen:**
- Lookahead-Bias in Backtesting und Optimierung
- Client-seitige Berechnung limitiert Skalierung
- Fehlende Rate-Limit-Behandlung
- Keine Out-of-Sample-Validierung

**Empfehlungen (ohne Implementierung):**
1. Backtesting-Logik refactoren (Lookahead-Bias eliminieren)
2. Indikator-Berechnung auf Server verschieben
3. Rate-Limit-Behandlung implementieren
4. Walk-Forward-Validierung hinzufügen
5. Parameter-Schicht für Konfigurierbarkeit
6. Datenvalidierung implementieren

---

**Ende der Analyse**
