# Architektur-Analyse: StockEx V2
**Senior Software Architect + Quant Engineer Analyse**

**Datum:** 2024  
**Analysiert von:** System-Analyse  
**Zweck:** Vollständiges technisches Verständnis für sichere Weiterentwicklung

---

## 1️⃣ Repository-Inventur

### 1.1 Verzeichnisstruktur

**Top-Level:**
```
/Users/olegreiten/stockex-v2/
├── app/                    # Next.js App Router
├── components/             # React-Komponenten
├── .env.example           # Environment-Variablen Template
├── .gitignore             # Git-Ignore-Regeln
├── next.config.js         # Next.js Konfiguration
├── package.json           # Dependencies & Scripts
├── postcss.config.js      # PostCSS Config (UNBEKANNT - nicht gelesen)
├── README.md              # Projekt-Dokumentation
├── tailwind.config.ts     # Tailwind CSS Konfiguration
├── tsconfig.json          # TypeScript Konfiguration
└── TECHNICAL_ANALYSIS.md  # Vorherige Analyse
```

**app/ Verzeichnis:**
```
app/
├── about/page.tsx                    # Statische Seite
├── aktien/
│   ├── page.tsx                     # Aktien-Übersicht
│   └── [symbol]/
│       └── page.tsx                 # Aktien-Detail (dynamisch)
├── api/                              # API Routes
│   ├── indices/route.ts             # GET /api/indices
│   └── stocks/
│       ├── route.ts                 # GET /api/stocks?symbols=...
│       └── [symbol]/
│           ├── route.ts             # GET /api/stocks/[symbol]?range=...
│           ├── details/route.ts     # GET /api/stocks/[symbol]/details
│           └── news/route.ts        # GET /api/stocks/[symbol]/news
├── globals.css                       # Globale Styles
├── indikator/
│   └── page.tsx                     # Indikator-Seite (Wrapper)
├── indikator-dev/
│   └── page.tsx                     # Entwicklungsseite
├── kontakt/page.tsx                 # Statische Seite
├── layout.tsx                       # Root Layout
├── news/page.tsx                    # News-Seite
├── page.tsx                         # Startseite (/)
└── portfolio/page.tsx               # Portfolio-Management
```

**components/ Verzeichnis:**
```
components/
├── CustomIndicator.tsx    # 1732 Zeilen - Haupt-Indikator-Logik
├── Navigation.tsx         # Navigation-Komponente
├── NewsFeed.tsx           # News-Feed (verwendet Mock-Daten)
└── StockPrices.tsx        # Aktien-Liste
```

**lib/ oder types/ Verzeichnisse:**
- **NICHT vorhanden:** Keine separaten `lib/`, `utils/`, `types/` Verzeichnisse
- **Konsequenz:** Alle Types sind inline in den Komponenten definiert

### 1.2 Zentrale Datentypen

**Location:** `components/CustomIndicator.tsx` (Zeilen 6-55)

```typescript
// Zeile 6-13
interface IndicatorData {
  time: string
  value: number          // Moving Average
  signal: number         // Technisches Signal (normalisiert auf Preis)
  price: number
  fundamentalScore: number
  combinedScore: number
}

// Zeile 15-19
interface Stock {
  symbol: string
  name: string
  price: number
}

// Zeile 21-30
interface CompanyDetails {
  peRatio: number
  forwardPE: number
  pegRatio: number
  profitMargins: number      // Als Dezimal (0.25 = 25%)
  revenueGrowth: number      // Als Dezimal (0.15 = 15%)
  earningsGrowth: number     // Als Dezimal (0.20 = 20%)
  dividendYield: number      // Als Dezimal (0.03 = 3%)
  marketCap: number
}

// Zeile 36-55
interface BacktestResult {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  totalReturn: number
  totalReturnPercent: number
  bestTrade: number
  worstTrade: number
  averageReturn: number
  trades: Array<{
    entryDate: string
    exitDate: string
    entryPrice: number
    exitPrice: number
    return: number
    returnPercent: number
    type: 'BUY' | 'SELL'
  }>
}
```

**Weitere Interfaces (in anderen Dateien):**

**Location:** `app/aktien/[symbol]/page.tsx` (Zeilen 9-64)
```typescript
interface StockData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  currency: string
  historical: Array<{
    date: string
    open: number
    high: number
    low: number
    close: number
    volume: number
    timestamp?: number  // Optional, für Intraday-Daten
  }>
}

interface CompanyDetails {  // Erweitert gegenüber CustomIndicator
  // ... (siehe Zeilen 26-54)
  sector: string
  industry: string
  website: string
  description: string
  employees: number
  // ... weitere Felder
}
```

**Location:** `app/portfolio/page.tsx` (Zeilen 7-35)
```typescript
interface PortfolioItem {
  id: string
  symbol: string
  name: string
  shares: number
  purchasePrice: number
  currentPrice: number
  change: number
  changePercent: number
  totalValue: number
  totalGain: number
  totalGainPercent: number
  historical: Array<{ date: string; close: number }>
}
```

**Location:** `app/api/indices/route.ts` (Zeilen 3-13)
```typescript
interface IndexData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  historical: Array<{ date: string; close: number }>
}
```

### 1.3 Zentrale Utils

**Währungskonvertierung:**

**Location:** `app/api/stocks/route.ts` (Zeilen 4-30)
```typescript
async function getUSDToEURRate(): Promise<number> {
  // Fetch: https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1d&range=1d
  // Fallback: return 0.92 (hart codiert)
}
```

**Location:** `app/api/stocks/[symbol]/route.ts` (Zeilen 4-30)
- **Gleiche Funktion:** `getUSDToEURRate()` - **Code-Duplikation**

**Datum/Zeit:**
- **Keine zentrale Utility:** Datum-Formatierung erfolgt inline
- **Beispiel:** `date.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })`
- **Location:** `components/CustomIndicator.tsx:1022`, `app/aktien/[symbol]/page.tsx:202-230`

**Caching:**
- **Keine zentrale Cache-Utility**
- **Nur Next.js Cache-Control Headers** in API Routes

**Fetch:**
- **Native `fetch` API** wird verwendet
- **Keine Wrapper-Funktion** für Retry/Error-Handling
- **Axios installiert** (`package.json:12`) aber **NICHT verwendet**

### 1.4 Zentrale UI- und Page-Komponenten

**Pages (app/):**
1. **`app/page.tsx`** - Startseite
   - Lädt: `/api/indices`
   - Rendert: Index-Charts (DAX, DOWJ, S&P500, Nasdaq)

2. **`app/aktien/page.tsx`** - Aktien-Übersicht
   - Rendert: `<StockPrices />` Component

3. **`app/aktien/[symbol]/page.tsx`** - Aktien-Detail
   - Lädt: `/api/stocks/[symbol]?range=...`, `/api/stocks/[symbol]/details`, `/api/stocks/[symbol]/news`
   - Rendert: Chart, Unternehmensdaten, News

4. **`app/indikator/page.tsx`** - Indikator-Seite
   - Lädt: `/api/stocks?symbols=...`
   - Rendert: `<CustomIndicator />` Component

5. **`app/indikator-dev/page.tsx`** - Entwicklungsseite
   - Lädt: `/api/stocks?symbols=...`, `/api/stocks/[symbol]?range=...`, `/api/stocks/[symbol]/details`
   - Eigene Optimierungs-Logik (separat von CustomIndicator)

6. **`app/portfolio/page.tsx`** - Portfolio
   - Lädt: `localStorage.getItem('stockex-portfolio')`
   - API: `/api/stocks/[symbol]?range=1mo` (für Updates)

**Components:**
1. **`components/CustomIndicator.tsx`** - 1732 Zeilen
   - **Kritisch:** Enthält gesamte Indikator-Logik
   - **Client-seitig:** Alle Berechnungen im Browser

2. **`components/Navigation.tsx`** - Navigation
   - Statische Links zu allen Seiten

3. **`components/StockPrices.tsx`** - Aktien-Liste
   - Lädt: `/api/stocks?symbols=...`
   - Auto-Refresh: 60 Sekunden

4. **`components/NewsFeed.tsx`** - News
   - **Verwendet Mock-Daten** (Zeilen 19-55)
   - **NICHT verbunden** mit API

### 1.5 Konfigurationen

**next.config.js:**
```javascript
// Zeile 1-6
const nextConfig = {
  reactStrictMode: true,
}
module.exports = nextConfig
```
- **Minimal:** Nur `reactStrictMode` aktiviert
- **Keine:** `env`, `rewrites`, `headers`, `experimental`

**tsconfig.json:**
```json
// Zeile 1-27
{
  "compilerOptions": {
    "target": "ES2020",
    "strict": true,
    "paths": { "@/*": ["./*"] }
  }
}
```
- **Strict Mode:** Aktiviert
- **Path Aliases:** `@/*` → Root

**package.json:**
```json
// Zeile 1-28
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "recharts": "^2.10.0",
    "yahoo-finance2": "^3.13.0",  // Installiert, aber NICHT verwendet
    "axios": "^1.13.2"             // Installiert, aber NICHT verwendet
  }
}
```

**tailwind.config.ts:**
- **Custom Colors:** `primary`, `gold`, `luxury` (dark, charcoal, anthracite, orange, gold)
- **Content:** `./app/**/*.{js,ts,jsx,tsx,mdx}`, `./components/**/*.{js,ts,jsx,tsx,mdx}`

**env-Variablen:**
- **`.env.example`:** `ALPHA_VANTAGE_API_KEY=demo`
- **`.env.local`:** UNBEKANNT (in .gitignore)
- **Nutzung:** `app/api/stocks/[symbol]/details/route.ts:115`

---

## 2️⃣ API-Routen: exakte Endpunkte + Response-Schemas

### 2.1 API Route Dateien

**Gefunden:**
1. `app/api/stocks/route.ts` - GET /api/stocks
2. `app/api/stocks/[symbol]/route.ts` - GET /api/stocks/[symbol]
3. `app/api/stocks/[symbol]/details/route.ts` - GET /api/stocks/[symbol]/details
4. `app/api/stocks/[symbol]/news/route.ts` - GET /api/stocks/[symbol]/news
5. `app/api/indices/route.ts` - GET /api/indices

### 2.2 Route-Dokumentation

#### Route 1: GET /api/stocks

**Datei:** `app/api/stocks/route.ts`

**Query-Parameter:**
- `symbols` (optional, default: `'AAPL,MSFT,GOOGL,AMZN,TSLA,META,NVDA,JPM'`)
  - **Zeile 113:** `const symbols = searchParams.get('symbols') || 'AAPL,MSFT,GOOGL,AMZN,TSLA,META,NVDA,JPM'`

**Externe Requests:**
1. **EURUSD Rate:**
   - URL: `https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1d&range=1d`
   - **Zeile 7**
   - Headers: `User-Agent: Mozilla/5.0`
   - **Kein Cache-Control** (kein `next: { revalidate }`)

2. **Stock Quotes (parallel):**
   - URL: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=5d`
   - **Zeile 36** (in `fetchStockFromYahoo`)
   - Headers: `User-Agent: Mozilla/5.0`
   - **Für jedes Symbol einzeln** (Zeile 124-140: `Promise.all`)

**Response Schema:**
```typescript
// Zeile 154-158: Array von Stock-Objekten
Array<{
  symbol: string
  name: string
  price: number        // In EUR
  change: number       // In EUR
  changePercent: number
  currency: 'EUR'
}>
```

**Beispiel-Response:**
```json
[
  {
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "price": 209.55,
    "change": 2.34,
    "changePercent": 1.13,
    "currency": "EUR"
  },
  {
    "symbol": "MSFT",
    "name": "Microsoft Corporation",
    "price": 415.23,
    "change": -1.45,
    "changePercent": -0.35,
    "currency": "EUR"
  }
]
```

**Cache Header:**
- **Zeile 156:** `Cache-Control: public, s-maxage=60, stale-while-revalidate=30`
- **60 Sekunden** Server-Cache, 30 Sekunden stale-while-revalidate

**Error-Handling:**
- **503:** Wenn alle API-Calls fehlschlagen (Zeile 148-151)
- **500:** Bei allgemeinem Fehler (Zeile 159-164)
- **Null-Filterung:** Fehlgeschlagene Symbole werden zu `null` und gefiltert (Zeile 143)

---

#### Route 2: GET /api/stocks/[symbol]

**Datei:** `app/api/stocks/[symbol]/route.ts`

**Route-Parameter:**
- `symbol` (dynamisch, z.B. "AAPL")

**Query-Parameter:**
- `range` (optional, default: `'3mo'`)
  - **Zeile 275:** `const range = searchParams.get('range') || '3mo'`
  - **Mögliche Werte:** `'1d'`, `'5d'`, `'1mo'`, `'3mo'`, `'6mo'`, `'1y'`, `'2y'`, `'5y'`, `'max'`

**Externe Requests:**
1. **EURUSD Rate:**
   - URL: `https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1d&range=1d`
   - **Zeile 7** (in `getUSDToEURRate`)

2. **Current Quote:**
   - URL: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=5d`
   - **Zeile 35** (in `fetchStockData`)

3. **Historical Data:**
   - URL: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval={interval}&range={range}`
   - **Zeile 116**
   - **Interval-Mapping (Zeile 105-112):**
     - `range='1d'` → `interval='5m'`
     - `range='5d'` → `interval='1h'`
     - `range='5y'|'max'` → `interval='1wk'`
     - **Default:** `interval='1d'`

4. **Fallback für 1d (Zeile 179-234):**
   - URL: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=5d`
   - **Nur wenn 5m-Request fehlschlägt**

**Response Schema:**
```typescript
// Zeile 253-261
{
  symbol: string
  name: string
  price: number              // In EUR
  change: number             // In EUR
  changePercent: number
  currency: 'EUR'
  historical: Array<{
    date: string             // ISO-String (1d) oder "YYYY-MM-DD"
    timestamp?: number        // Unix-Timestamp (für Intraday)
    open: number             // In EUR
    high: number             // In EUR
    low: number              // In EUR
    close: number            // In EUR
    volume: number
  }>
}
```

**Beispiel-Response:**
```json
{
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "price": 209.55,
  "change": 2.34,
  "changePercent": 1.13,
  "currency": "EUR",
  "historical": [
    {
      "date": "2024-01-15",
      "timestamp": 1705276800,
      "open": 207.20,
      "high": 210.10,
      "low": 206.80,
      "close": 209.55,
      "volume": 52345678
    }
  ]
}
```

**Cache Header:**
- **Zeile 292:** `Cache-Control: public, s-maxage=60, stale-while-revalidate=30`

**Error-Handling:**
- **500:** Bei Fehler (Zeile 295-300)
- **Fallback:** Erstellt Single-Data-Point wenn keine historischen Daten (Zeile 241-251)

---

#### Route 3: GET /api/stocks/[symbol]/details

**Datei:** `app/api/stocks/[symbol]/details/route.ts`

**Route-Parameter:**
- `symbol` (dynamisch)

**Query-Parameter:**
- **Keine**

**Externe Requests (Multi-Source):**

1. **Yahoo Chart API:**
   - URL: `https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1y`
   - **Zeile 28**
   - Headers: `User-Agent: Mozilla/5.0...`, `Accept: application/json`
   - **Cache:** `next: { revalidate: 300 }` (Zeile 36) - **5 Minuten**

2. **Yahoo Quote API:**
   - URL: `https://query1.finance.yahoo.com/v7/finance/quote?symbols={symbol}`
   - **Zeile 67**
   - Headers: `User-Agent: Mozilla/5.0...`, `Accept: application/json`
   - **Cache:** `next: { revalidate: 300 }` (Zeile 75) - **5 Minuten**

3. **Alpha Vantage API:**
   - URL: `https://www.alphavantage.co/query?function=OVERVIEW&symbol={symbol}&apikey={key}`
   - **Zeile 116**
   - Headers: `User-Agent: Mozilla/5.0`
   - **Cache:** `next: { revalidate: 3600 }` (Zeile 125) - **1 Stunde**
   - **API-Key:** `process.env.ALPHA_VANTAGE_API_KEY || 'demo'` (Zeile 115)

**Response Schema:**
```typescript
// Zeile 280-312
{
  symbol: string
  name: string
  sector: string | 'N/A'
  industry: string | 'N/A'
  website: string
  description: string
  employees: number
  city: string
  state: string
  country: string
  marketCap: number
  enterpriseValue: number
  peRatio: number
  forwardPE: number
  pegRatio: number
  priceToBook: number
  dividendYield: number        // Als Dezimal (0.025 = 2.5%)
  profitMargins: number        // Als Dezimal (0.25 = 25%)
  operatingMargins: number     // Als Dezimal
  revenueGrowth: number        // Als Dezimal (0.15 = 15%)
  earningsGrowth: number       // Als Dezimal (0.20 = 20%)
  currentPrice: number
  targetHighPrice: number
  targetLowPrice: number
  targetMeanPrice: number
  recommendationMean: number
  recommendationKey: string | 'N/A'
  exDividendDate: string | null
  dividendDate: string | null
}
```

**Beispiel-Response:**
```json
{
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "sector": "Technology",
  "industry": "Consumer Electronics",
  "website": "https://www.apple.com",
  "description": "Apple Inc. designs, manufactures...",
  "employees": 164000,
  "city": "Cupertino",
  "state": "CA",
  "country": "United States",
  "marketCap": 3200000000000,
  "enterpriseValue": 3200000000000,
  "peRatio": 32.5,
  "forwardPE": 28.3,
  "pegRatio": 2.1,
  "priceToBook": 45.2,
  "dividendYield": 0.005,
  "profitMargins": 0.25,
  "operatingMargins": 0.30,
  "revenueGrowth": 0.08,
  "earningsGrowth": 0.12,
  "currentPrice": 209.55,
  "targetHighPrice": 220.00,
  "targetLowPrice": 180.00,
  "targetMeanPrice": 200.00,
  "recommendationMean": 2.1,
  "recommendationKey": "buy",
  "exDividendDate": null,
  "dividendDate": null
}
```

**Cache Header:**
- **Zeile 333:** `Cache-Control: public, s-maxage=300, stale-while-revalidate=60`
- **5 Minuten** Server-Cache

**Error-Handling:**
- **404:** Wenn keine Daten von allen Quellen (Zeile 169-174)
- **500:** Bei allgemeinem Fehler (Zeile 336-341)
- **Alpha Vantage:** Prüft auf `'Note'`, `'Error Message'`, `'Information'` (Zeile 132-138)
- **Fallback:** Verwendet beste verfügbare Quelle (Priorität: Alpha Vantage > Quote > Chart)

**Daten-Transformation:**
- **`getNumericValue()` (Zeile 189-216):** Parsed Strings mit Multiplikatoren (T, B, M, K)
- **Alpha Vantage Prozentwerte:** DividendYield, ProfitMargin werden durch 100 geteilt (Zeile 240-254)

---

#### Route 4: GET /api/stocks/[symbol]/news

**Datei:** `app/api/stocks/[symbol]/news/route.ts`

**Route-Parameter:**
- `symbol` (dynamisch)

**Query-Parameter:**
- **Keine**

**Externe Requests:**
1. **Yahoo Search API:**
   - URL: `https://query1.finance.yahoo.com/v1/finance/search?q={symbol}&quotesCount=1&newsCount=10`
   - **Zeile 14-15**
   - Headers: `User-Agent: Mozilla/5.0`

**Response Schema:**
```typescript
// Zeile 46-55
Array<{
  id: string
  title: string
  summary: string
  source: string
  time: string              // Format: "vor X Stunden/Tagen"
  url: string
  imageUrl: string | null
  publishTime: string       // ISO-String
}>
```

**Beispiel-Response:**
```json
[
  {
    "id": "abc123",
    "title": "Apple Reports Strong Q4 Earnings",
    "summary": "Apple Inc. reported...",
    "source": "Reuters",
    "time": "vor 2 Stunden",
    "url": "https://...",
    "imageUrl": "https://...",
    "publishTime": "2024-01-15T14:30:00.000Z"
  }
]
```

**Cache Header:**
- **Zeile 62:** `Cache-Control: public, s-maxage=300, stale-while-revalidate=60`
- **5 Minuten** Server-Cache

**Error-Handling:**
- **500:** Bei Fehler (Zeile 65-70)
- **Datum-Formatierung:** Berechnet "vor X Stunden/Tagen" (Zeile 30-44)

---

#### Route 5: GET /api/indices

**Datei:** `app/api/indices/route.ts`

**Query-Parameter:**
- **Keine**

**Externe Requests (parallel):**
1. **Yahoo Chart API (für jeden Index):**
   - URLs: 
     - `https://query1.finance.yahoo.com/v8/finance/chart/^GDAXI?interval=1d&range=1mo`
     - `https://query1.finance.yahoo.com/v8/finance/chart/^DJI?interval=1d&range=1mo`
     - `https://query1.finance.yahoo.com/v8/finance/chart/^GSPC?interval=1d&range=1mo`
     - `https://query1.finance.yahoo.com/v8/finance/chart/^IXIC?interval=1d&range=1mo`
   - **Zeile 18-19** (in `fetchIndexData`)
   - **Zeile 118-120:** `Promise.all` für alle 4 Indizes

**Response Schema:**
```typescript
// Zeile 3-13
Array<IndexData>  // Array, da mehrere Indizes
// IndexData:
{
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  historical: Array<{ date: string; close: number }>
}
```

**Beispiel-Response:**
```json
[
  {
    "symbol": "^GDAXI",
    "name": "DAX",
    "price": 18432.50,
    "change": 125.30,
    "changePercent": 0.68,
    "historical": [
      { "date": "2024-01-15", "close": 18432.50 },
      { "date": "2024-01-14", "close": 18307.20 }
    ]
  }
]
```

**Cache Header:**
- **Zeile 134:** `Cache-Control: public, s-maxage=300, stale-while-revalidate=60`
- **5 Minuten** Server-Cache

**Error-Handling:**
- **503:** Wenn alle Indizes fehlschlagen (Zeile 126-129)
- **Null-Filterung:** Fehlgeschlagene Indizes werden gefiltert (Zeile 123)

---

## 3️⃣ Datenfluss Ende-zu-Ende (pro Kernseite)

### 3.1 Seite: / (Startseite)

**Datei:** `app/page.tsx`

**API-Aufrufe:**
- **Zeile 27:** `fetch('/api/indices')` (CSR, `useEffect`)

**Datenformat:**
- **Erwartet:** `Array<IndexData>` (siehe Route 5)
- **Zeile 29:** `const data = await response.json()`
- **Zeile 30:** `setIndices(data)`

**Transformation:**
- **Zeile 42-46:** `formatPrice()` - `Intl.NumberFormat('de-DE')`
- **Zeile 49-52:** `formatChange()` - Formatierung mit Vorzeichen

**States:**
- `indices: IndexData[]` (Zeile 21)
- `isLoading: boolean` (Zeile 22)

**Datenfluss:**
```
Client (useEffect)
  → GET /api/indices
    → Yahoo Finance (4x parallel)
      → Array<IndexData>
        → setIndices()
          → Render Charts
```

---

### 3.2 Seite: /aktien

**Datei:** `app/aktien/page.tsx`

**API-Aufrufe:**
- **Keine direkten Aufrufe** - Delegiert an `<StockPrices />`

**Datenformat:**
- **N/A** (Wrapper-Seite)

**States:**
- **Keine** (Server Component)

---

**Component: StockPrices**

**Datei:** `components/StockPrices.tsx`

**API-Aufrufe:**
- **Zeile 21:** `fetch('/api/stocks?symbols=AAPL,MSFT,GOOGL,AMZN,TSLA,META,NVDA,JPM')` (CSR)
- **Zeile 52:** Auto-Refresh alle 60 Sekunden

**Datenformat:**
- **Erwartet:** `Array<Stock>` (siehe Route 1)
- **Zeile 28:** `const data = await response.json()`
- **Zeile 31:** `setStocks(data)`

**Transformation:**
- **Keine** - Daten werden direkt verwendet

**States:**
- `stocks: Stock[]` (Zeile 15)
- `isLoading: boolean` (Zeile 16)

**Datenfluss:**
```
Client (useEffect + Interval)
  → GET /api/stocks?symbols=...
    → Yahoo Finance (8x parallel)
      → Array<Stock>
        → setStocks()
          → Render Liste
```

---

### 3.3 Seite: /aktien/[symbol]

**Datei:** `app/aktien/[symbol]/page.tsx`

**API-Aufrufe:**
1. **Zeile 96:** `fetch(\`/api/stocks/${symbol}?range=${timeRange}\`)` (CSR)
2. **Zeile 107:** `fetch(\`/api/stocks/${symbol}/details\`)` (parallel)
3. **Zeile 108:** `fetch(\`/api/stocks/${symbol}/news\`)` (parallel)
   - **Zeile 106:** `Promise.allSettled()` - Fehler-tolerant

**Datenformat:**
- **StockData:** Siehe Route 2
- **CompanyDetails:** Siehe Route 3
- **NewsItem[]:** Siehe Route 4

**Transformation:**
1. **Zeile 202-230:** `formatDate()` - Datum-Formatierung basierend auf `timeRange`
2. **Zeile 232-306:** Filterung für "1d" (nur Börsentag-Daten)
3. **Zeile 308-329:** Sortierung und Mapping zu Chart-Format
4. **Zeile 331-337:** `formatNumber()` - Formatierung großer Zahlen (T, B, M, K)

**States:**
- `stockData: StockData | null` (Zeile 70)
- `companyDetails: CompanyDetails | null` (Zeile 71)
- `news: NewsItem[]` (Zeile 72)
- `isLoading: boolean` (Zeile 73)
- `error: string | null` (Zeile 74)
- `timeRange: string` (Zeile 75, default: `'3mo'`)

**Datenfluss:**
```
Client (useEffect, abhängig von symbol + timeRange)
  → Promise.allSettled([
      GET /api/stocks/[symbol]?range=...
      GET /api/stocks/[symbol]/details
      GET /api/stocks/[symbol]/news
    ])
    → [StockData, CompanyDetails, NewsItem[]]
      → Transformation (formatDate, Filterung)
        → setStockData/setCompanyDetails/setNews()
          → Render Chart + Details + News
```

---

### 3.4 Seite: /indikator

**Datei:** `app/indikator/page.tsx`

**API-Aufrufe:**
- **Zeile 24:** `fetch(\`/api/stocks?symbols=${stockSymbols.join(',')}\`)` (CSR)

**Datenformat:**
- **Erwartet:** `Array<Stock>` (siehe Route 1)

**Transformation:**
- **Keine** - Daten werden an `<CustomIndicator />` weitergegeben

**States:**
- `availableStocks: Stock[]` (Zeile 16)
- `selectedStock: Stock | null` (Zeile 17)
- `isLoadingStocks: boolean` (Zeile 18)

**Datenfluss:**
```
Client (useEffect)
  → GET /api/stocks?symbols=...
    → Array<Stock>
      → setAvailableStocks()
        → Render Dropdown
          → selectedStock → CustomIndicator
```

---

**Component: CustomIndicator**

**Datei:** `components/CustomIndicator.tsx`

**API-Aufrufe (in useEffect, Zeile 875-1047):**
1. **Zeile 881:** `fetch(\`/api/stocks/${selectedStock.symbol}?range=${timeRange}\`)`
2. **Zeile 882:** `fetch(\`/api/stocks/${selectedStock.symbol}/details\`)`
   - **Parallel:** `Promise.all()`

**Datenformat:**
- **StockData:** Siehe Route 2 (mit `historical` Array)
- **CompanyDetails:** Siehe Route 3

**Transformation (Client-seitig, Zeile 920-1028):**
1. **Zeile 920:** `calculateFundamentalScore(details)` - Berechnet fundamentalen Score
2. **Zeile 928:** `calculateSupportResistanceLevels(historical)` - Berechnet Support/Resistance
3. **Zeile 965-1028:** Loop über `historical`:
   - Moving Average (Zeile 970-977)
   - RSI (Zeile 979-991)
   - Support-Score (Zeile 1001)
   - Technical Score (Zeile 1004)
   - Combined Score (Zeile 1016)
   - **Erstellt:** `IndicatorData[]` Array

**States:**
- `data: IndicatorData[]` (Zeile 58)
- `companyDetails: CompanyDetails | null` (Zeile 105)
- `supportLevels: number[]` (Zeile 108)
- `resistanceLevels: number[]` (Zeile 109)
- `period: number` (Zeile 106, default: 14)
- `timeRange: string` (Zeile 107, default: '3mo')
- `optimizationResult: {...} | null` (Zeile 67)

**Datenfluss:**
```
Client (useEffect, abhängig von selectedStock, period, timeRange, optimizationResult)
  → Promise.all([
      GET /api/stocks/[symbol]?range=...
      GET /api/stocks/[symbol]/details
    ])
    → [StockData, CompanyDetails]
      → calculateFundamentalScore()
      → calculateSupportResistanceLevels()
      → Loop: historical.forEach()
        → Berechne MA, RSI, Support-Score
        → Berechne technicalScore, combinedScore
        → Erstelle IndicatorData[]
          → setData()
            → Render Chart + Scores
```

---

### 3.5 Seite: /indikator-dev

**Datei:** `app/indikator-dev/page.tsx`

**API-Aufrufe:**
1. **Zeile 53:** `fetch('/api/stocks?symbols=...')` (beim Laden)
2. **Zeile 111:** `fetch(\`/api/stocks/${selectedStock.symbol}?range=${timeRange}\`)` (bei Optimierung)
3. **Zeile 300:** `fetch(\`/api/stocks/${selectedStock.symbol}/details\`)` (in `simulateTrades`)

**Datenformat:**
- **StockData:** Siehe Route 2
- **CompanyDetails:** Siehe Route 3

**Transformation:**
- **Zeile 289-440:** `simulateTrades()` - Eigene Berechnungslogik (ähnlich CustomIndicator, aber vereinfacht)

**States:**
- `selectedStock: Stock` (Zeile 40)
- `data: any[]` (Zeile 41) - Chart-Daten
- `results: DevelopmentResult[]` (Zeile 44)
- `bestResult: DevelopmentResult | null` (Zeile 45)
- `timeRange: string` (Zeile 46, default: '1y')

**Datenfluss:**
```
Client (Optimierung starten)
  → GET /api/stocks/[symbol]?range=...
    → StockData (historical)
      → simulateTrades() (für jede Konfiguration)
        → GET /api/stocks/[symbol]/details (innerhalb simulateTrades)
          → CompanyDetails
            → Berechne Scores
              → Simuliere Trades
                → Performance-Metriken
                  → setResults()
                    → Render Top 10
```

---

### 3.6 Seite: /portfolio

**Datei:** `app/portfolio/page.tsx`

**API-Aufrufe:**
1. **Zeile 49:** `localStorage.getItem('stockex-portfolio')` (beim Laden)
2. **Zeile 65:** `fetch(\`/api/stocks/${item.symbol}?range=1mo\`)` (für jedes Portfolio-Item, parallel)
3. **Zeile 117:** `fetch(\`/api/stocks/${symbol}?range=1mo\`)` (beim Hinzufügen)

**Datenformat:**
- **PortfolioItem:** Siehe Zeile 7-23
- **StockData:** Siehe Route 2

**Transformation:**
- **Zeile 68-85:** Mapping von `StockData` zu `PortfolioItem` (Berechnung von totalValue, totalGain, etc.)

**States:**
- `portfolio: PortfolioItem[]` (Zeile 38)
- `isLoading: boolean` (Zeile 39)
- `showAddForm: boolean` (Zeile 40)
- `formData: {symbol, shares, purchasePrice}` (Zeile 41-45)

**Persistenz:**
- **localStorage Key:** `'stockex-portfolio'` (Zeile 49, 94, 145, 162)
- **Format:** JSON-String von `PortfolioItem[]`

**Datenfluss:**
```
Client (useEffect beim Mount)
  → localStorage.getItem('stockex-portfolio')
    → PortfolioItem[]
      → updatePortfolioPrices()
        → Promise.all([
            GET /api/stocks/[symbol]?range=1mo (für jedes Item)
          ])
          → Array<StockData>
            → Mapping zu PortfolioItem
              → setPortfolio()
                → localStorage.setItem()
                  → Render Portfolio-Liste
```

---

### 3.2 Datenfluss-Diagramm (Textform)

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP GET
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS API ROUTES                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  /api/stocks?symbols=...                                │   │
│  │    → getUSDToEURRate()                                   │   │
│  │    → fetchStockFromYahoo() × N (parallel)                │   │
│  │    → Return: Array<{symbol, name, price, change, ...}>  │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  /api/stocks/[symbol]?range=...                          │   │
│  │    → getUSDToEURRate()                                   │   │
│  │    → fetchStockData()                                    │   │
│  │      → Yahoo Chart API (current + historical)           │   │
│  │    → Return: {symbol, name, price, historical: [...]}    │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  /api/stocks/[symbol]/details                           │   │
│  │    → Yahoo Chart API                                     │   │
│  │    → Yahoo Quote API                                     │   │
│  │    → Alpha Vantage API (OVERVIEW)                        │   │
│  │    → Combine & Return: CompanyDetails                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  /api/stocks/[symbol]/news                              │   │
│  │    → Yahoo Search API                                    │   │
│  │    → Return: Array<NewsItem>                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  /api/indices                                            │   │
│  │    → fetchIndexData() × 4 (parallel)                    │   │
│  │    → Return: Array<IndexData>                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP GET
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNE APIs                                  │
│  ┌──────────────────┐  ┌──────────────────┐                  │
│  │  Yahoo Finance   │  │ Alpha Vantage    │                  │
│  │  - Chart API v8  │  │ - OVERVIEW       │                  │
│  │  - Quote API v7  │  │   (nur Fund.)    │                  │
│  │  - Search API v1 │  │                  │                  │
│  └──────────────────┘  └──────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              CLIENT-SEITIGE BERECHNUNGEN                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  CustomIndicator.tsx (useEffect)                         │   │
│  │    Input: StockData.historical[]                         │   │
│  │    Input: CompanyDetails                                 │   │
│  │    → calculateSupportResistanceLevels()                  │   │
│  │    → Loop: historical.forEach()                          │   │
│  │      → MA, RSI, Support-Score                            │   │
│  │      → technicalScore, combinedScore                      │   │
│  │    → Output: IndicatorData[]                             │   │
│  │    → setData() → Render Chart                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Portfolio (localStorage)                                 │   │
│  │    → localStorage.getItem('stockex-portfolio')           │   │
│  │    → Update via API                                       │   │
│  │    → localStorage.setItem()                               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4️⃣ CustomIndicator.tsx: Funktionslandkarte + Abhängigkeiten

### 4.1 Funktionsgruppen

**Datei:** `components/CustomIndicator.tsx` (1732 Zeilen)

#### Gruppe 1: Datenerhebung

**Funktionen:**
- **`useEffect` (Zeile 875-1047):** `fetchStockData()`
  - **Input:** `selectedStock`, `period`, `timeRange`, `optimizationResult` (dependencies)
  - **API-Calls:**
    - `fetch(\`/api/stocks/${selectedStock.symbol}?range=${timeRange}\`)`
    - `fetch(\`/api/stocks/${selectedStock.symbol}/details\`)`
  - **Output:** Setzt `data`, `companyDetails`, `supportLevels`, `resistanceLevels`
  - **States verwendet:** `selectedStock`, `period`, `timeRange`, `optimizationResult`

---

#### Gruppe 2: Feature-Berechnung

**Funktionen:**

1. **`calculateFundamentalScore(details: CompanyDetails | null): number`**
   - **Location:** Zeile 112-218
   - **Input:** `CompanyDetails` oder `null`
   - **Output:** Score 0-100
   - **Berechnet:** 6 Sub-Scores (KGV, PEG, Gewinnmarge, Umsatzwachstum, Gewinnwachstum, Dividende)
   - **Gewichtungen (hart codiert, Zeile 207-213):**
     - KGV: 10%
     - PEG: 15%
     - Gewinnmarge: 15%
     - Umsatzwachstum: 30%
     - Gewinnwachstum: 25%
     - Dividende: 5%
   - **Schwellenwerte (hart codiert):**
     - KGV: 10, 15, 25, 30 (Zeile 120-128)
     - PEG: 0.5, 1.5, 2.0 (Zeile 134-140)
     - Gewinnmarge: 5%, 15%, 25% (Zeile 147-155)
     - Wachstum: 5%, 10%, 20% (Zeile 162-190)
     - Dividende: 1.5%, 3% (Zeile 196-202)
   - **Abhängigkeiten:** `CompanyDetails` Interface

2. **`calculateSupportScore(currentPrice: number, supportLevels: number[]): number`**
   - **Location:** Zeile 221-270
   - **Input:** Aktueller Preis, Array von Support-Levels
   - **Output:** Score 0-100
   - **Logik:**
     - Findet nächstgelegene Support-Linie (Zeile 227-235)
     - Berechnet `priceDiffPercent` (Zeile 239-240)
     - **Schwellenwerte (hart codiert, Zeile 249-268):**
       - ±0.5% → 90-100
       - 0.5-2% → 70-90
       - 2-5% → 50-70
       - >5% → 30-50
       - <0% (unter Support) → 0-30
   - **Abhängigkeiten:** `calculateSupportResistanceLevels()` muss vorher aufgerufen werden

3. **`calculateSupportResistanceLevels(historical: Array<{date: string, close: number}>): {support: number[], resistance: number[]}`**
   - **Location:** Zeile 273-364
   - **Input:** Historische Preisdaten
   - **Output:** Arrays von Support- und Resistance-Levels
   - **Logik:**
     - Filtert letzte 12 Monate (Zeile 278-285)
     - Findet lokale Minima/Maxima mit dynamischem Fenster (Zeile 293-319)
     - **Fenster-Größe:** `Math.max(3, Math.floor(recentData.length / 20))` (Zeile 293)
     - Clustert ähnliche Preise (±1%, hart codiert, Zeile 322)
     - **Minimum-Berührungen:** 2 (hart codiert, Zeile 352)
     - **Maximale Levels:** 5 (hart codiert, Zeile 357)
   - **Abhängigkeiten:** Mindestens 20 Datenpunkte (Zeile 274)

4. **RSI-Berechnung (inline, Zeile 979-991)**
   - **Location:** Innerhalb `useEffect` Loop (Zeile 966)
   - **Input:** `historical` Array, aktueller Index `i`
   - **Output:** RSI-Wert 0-100
   - **Lookback:** 14 Tage (hart codiert, Zeile 982)
   - **Formel:** `RSI = 100 - (100 / (1 + RS))` mit `RS = avgGain / avgLoss`
   - **Problem:** Verwendet `historical[j + 1]` - **könnte Lookahead sein** (siehe 5.1)

5. **Moving Average (inline, Zeile 970-977)**
   - **Location:** Innerhalb `useEffect` Loop (Zeile 966)
   - **Input:** `historical` Array, aktueller Index `i`, `period` (State)
   - **Output:** Moving Average-Wert
   - **Berechnung:** `sum / count` für `[i - period + 1, i]`
   - **Problem:** Verwendet Daten bis zum aktuellen Index - **korrekt, kein Lookahead**

---

#### Gruppe 3: Scoring

**Funktionen:**

1. **Technical Score Berechnung (inline, Zeile 993-1004)**
   - **Location:** Innerhalb `useEffect` Loop
   - **Input:** `rsiValue`, `maValue`, `supportScore`
   - **Output:** `technicalScore` (0-100)
   - **Gewichtungen (hart codiert, Zeile 1004):**
     - RSI: 30%
     - MA: 60%
     - Support: 10%
   - **MA-Score-Berechnung (Zeile 997-998):**
     - `maDistance = ((price - movingAverage) / movingAverage) * 100`
     - `maValue = 50 + Math.min(Math.max(maDistance * 5, -50), 50)`
     - **Begrenzung:** ±50 Punkte Abweichung (hart codiert)

2. **Combined Score Berechnung (inline, Zeile 1006-1016)**
   - **Location:** Innerhalb `useEffect` Loop
   - **Input:** `technicalScore`, `fundamentalScore`
   - **Output:** `combinedScore` (0-100)
   - **Gewichtungen:**
     - **Standard:** Technisch 60%, Fundamental 40% (hart codiert, Zeile 1007-1008)
     - **Mit Optimierung:** Verwendet `optimizationResult.bestWeights` (Zeile 1010-1014)

---

#### Gruppe 4: Empfehlung/Signal

**Funktionen:**

1. **`getRecommendation(dataPoint?: IndicatorData): 'KAUFEN' | 'VERKAUFEN' | 'HALTEN'`**
   - **Location:** Zeile 1067-1088
   - **Input:** Optionaler Datenpunkt (sonst `currentData` aus State)
   - **Output:** Empfehlung
   - **Logik (hart codierte Schwellenwerte, Zeile 1076-1087):**
     - **KAUFEN:** `technicalSignal && (fundamentalScore > 50 || combinedScore > 52)`
     - **VERKAUFEN:** `!technicalSignal && (fundamentalScore < 45 || combinedScore < 48)`
     - **HALTEN:** Alles andere
   - **`technicalSignal`:** `data.signal > data.value` (Zeile 1071)
   - **Abhängigkeiten:** `data`, `currentData` (State)

---

#### Gruppe 5: Backtest

**Funktionen:**

1. **`runBacktest(): void`**
   - **Location:** Zeile 367-466
   - **Input:** `data` (State), `getRecommendation()` (Funktion)
   - **Output:** Setzt `backtestResult` (State)
   - **Logik:**
     - Loop über `data` Array (Zeile 382)
     - **Entry:** Bei `recommendation === 'KAUFEN'` (Zeile 412)
     - **Exit:** Bei `recommendation === 'VERKAUFEN'` ODER Stop-Loss (Zeile 393-394)
     - **Stop-Loss:** `current.price < current.value * 0.95` (hart codiert, Zeile 394)
     - **Position Sizing:** Fix (1 Position, keine Größenanpassung)
     - **Fees/Slippage:** **NICHT berücksichtigt**
   - **Metriken berechnet (Zeile 440-462):**
     - `totalTrades`, `winningTrades`, `losingTrades`
     - `winRate`, `totalReturn`, `totalReturnPercent`
     - `bestTrade`, `worstTrade`, `averageReturn`
   - **Fehlende Metriken:** Max Drawdown, Profit Factor, Sharpe Ratio, Trade-Dauer
   - **KRITISCH:** Verwendet `getRecommendation(current)` - **Lookahead-Bias** (siehe 5.1)

---

#### Gruppe 6: Optimierung

**Funktionen:**

1. **`optimizeWeights(): void`**
   - **Location:** Zeile 469-873
   - **Input:** `data` (State), `companyDetails` (State)
   - **Output:** Setzt `optimizationResult` (State)
   - **Logik:**
     - **Schritt 1 (Zeile 512-663):** Findet "optimale Trades" mit **5-Tage Lookahead**
       - **Zeile 515:** `const lookAhead = 5`
       - **Zeile 516:** `const futureIndex = Math.min(i + lookAhead, data.length - 1)`
       - **Zeile 522:** `if (priceChangePercent > 3)` - **KRITISCH: Lookahead-Bias**
     - **Schritt 2 (Zeile 667-836):** Grid Search über Gewichtungen
       - Tech/Fund: 50-90% (Schritt 10%, Zeile 669)
       - Tech-Indikatoren: 4 Konfigurationen (Zeile 695-700)
       - Fund-Metriken: 3 Konfigurationen (Zeile 706-710)
     - **Schritt 3 (Zeile 838-841):** Findet beste Konfiguration
   - **Performance-Metrik (Zeile 803):** `(accuracy * 0.4) + (winRate * 0.3) + (normalizedReturn * 0.3)`
   - **KRITISCH:** Lookahead-Bias in Schritt 1 (siehe 5.1)

---

#### Gruppe 7: UI Rendering

**Funktionen:**
- **Return-Statement (Zeile 1092-1732):** JSX-Rendering
- **Modals:** Parameter-Anpassung, Zeitraum-Änderung
- **Charts:** Recharts LineChart mit `data` State
- **Tabellen:** Backtest-Ergebnisse, Optimierungs-Ergebnisse

---

### 4.2 Call Graph (wichtigste Ketten)

```
useEffect (875)
  ├─→ fetch('/api/stocks/[symbol]')
  ├─→ fetch('/api/stocks/[symbol]/details')
  │
  ├─→ calculateFundamentalScore(details) (920)
  │     └─→ (inline: peScore, pegScore, profitScore, etc.)
  │
  ├─→ calculateSupportResistanceLevels(historical) (928)
  │     └─→ clusterLevels() (inline, 322)
  │
  ├─→ Loop: historical.forEach() (966)
  │     ├─→ MA-Berechnung (inline, 970-977)
  │     ├─→ RSI-Berechnung (inline, 979-991)
  │     ├─→ calculateSupportScore(price, filteredSupport) (1001)
  │     ├─→ technicalScore = RSI*0.3 + MA*0.6 + Support*0.1 (1004)
  │     └─→ combinedScore = technical*techWeight + fundamental*fundWeight (1016)
  │
  └─→ setData(newData)

runBacktest() (367)
  └─→ getRecommendation(current) (387)
        └─→ (verwendet current.combinedScore, current.signal, etc.)

optimizeWeights() (469)
  ├─→ calculateSupportResistanceLevels(historicalData) (480)
  ├─→ Loop: data.forEach() (513)
  │     ├─→ calculateSupportScore() (553, 624)
  │     └─→ (berechnet RSI/MA inline, 527-548)
  └─→ Grid Search (667-836)
        └─→ (verwendet optimalTrades mit Lookahead)
```

---

## 5️⃣ Lookahead-Bias: Beweisstellen & genaue Ursachen

### 5.1 RSI/MA Berechnung im Backtest

**Problem-Stelle 1: RSI-Berechnung in Haupt-Loop**

**Location:** `components/CustomIndicator.tsx:979-991`

```typescript
// Zeile 983: Loop über j von (i - lookback + 1) bis i
for (let j = Math.max(0, i - lookback + 1); j < i; j++) {
  // Zeile 984: PROBLEM: historical[j + 1] - historical[j]
  const change = historical[j + 1].close - historical[j].close
  if (change > 0) gains += change
  else losses += Math.abs(change)
}
```

**Warum korrekt:**
- `j` geht nur bis `i` (nicht darüber)
- `historical[j + 1]` ist immer `≤ historical[i]`
- **KEIN Lookahead** in der Haupt-Berechnung

**ABER:** Diese Berechnung wird **einmal für alle Datenpunkte** durchgeführt, bevor der Backtest läuft. Im Backtest wird dann `getRecommendation(current)` aufgerufen, das bereits berechnete Scores verwendet.

**Problem-Stelle 2: Backtest verwendet vorberechnete Scores**

**Location:** `components/CustomIndicator.tsx:382-387`

```typescript
// Zeile 382: Loop über data Array
for (let i = 1; i < data.length; i++) {
  const current = data[i]  // data[i] enthält bereits berechnete Scores
  
  // Zeile 387: PROBLEM: getRecommendation verwendet current.combinedScore
  const recommendation = getRecommendation(current)
}
```

**Warum Lookahead-Bias:**
- `data[i].combinedScore` wurde in Zeile 1016 berechnet
- Diese Berechnung verwendete `historical` Array **vollständig** (Zeile 966: `for (let i = 0; i < historical.length; i++)`)
- **RSI für Index i** verwendet Daten bis Index i, aber **MA für Index i** verwendet auch Daten **nach** Index i (wenn `period > 1`)
- **Support-Levels** wurden aus **gesamten** historischen Daten berechnet (Zeile 928), inklusive zukünftiger Daten relativ zum Backtest-Zeitpunkt

**Minimaler Informationsschnitt:**
- Für Backtest-Zeitpunkt `t`:
  - RSI: Nur Daten `[t-14, t]`
  - MA: Nur Daten `[t-period+1, t]`
  - Support-Levels: Nur Daten `[t-365, t]` (12 Monate rückwärts)
  - **NICHT:** Daten `[t+1, t+n]`

---

### 5.2 Support/Resistance: Levels aus vollem Datensatz

**Problem-Stelle:**

**Location:** `components/CustomIndicator.tsx:927-928`

```typescript
// Zeile 927: Berechnet Support-Levels aus GESAMTEM historical Array
const levels = calculateSupportResistanceLevels(historical)
```

**Location:** `components/CustomIndicator.tsx:273-285`

```typescript
// Zeile 278-285: Filtert auf letzte 12 Monate ABER relativ zu HEUTE
const twelveMonthsAgo = new Date()
twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

const recentData = historical.filter(item => {
  const itemDate = new Date(item.date)
  return itemDate >= twelveMonthsAgo  // PROBLEM: Verwendet HEUTE als Referenz
})
```

**Warum Lookahead-Bias:**
- `twelveMonthsAgo` wird **heute** berechnet (Zeile 279-280)
- Im Backtest für Zeitpunkt `t` (z.B. vor 2 Jahren) würden Support-Levels aus Daten berechnet, die **nach** Zeitpunkt `t` liegen
- **Korrekt wäre:** `twelveMonthsAgo = new Date(historical[i].date)` minus 12 Monate

**Minimaler Informationsschnitt:**
- Für Backtest-Zeitpunkt `t`:
  - Support-Levels nur aus Daten `[t-365, t]`
  - **NICHT:** Daten `[t+1, heute]`

---

### 5.3 Optimierung: 5-Tage Lookahead

**Problem-Stelle:**

**Location:** `components/CustomIndicator.tsx:512-522`

```typescript
// Zeile 512: Loop über data Array
for (let i = 0; i < data.length - 5; i++) {
  const current = data[i]
  const lookAhead = 5  // PROBLEM: 5 Tage in die Zukunft
  const futureIndex = Math.min(i + lookAhead, data.length - 1)
  const futurePrice = data[futureIndex].price
  const priceChange = futurePrice - current.price
  const priceChangePercent = (priceChange / current.price) * 100

  // Zeile 522: Identifiziert "optimale Trades" basierend auf ZUKÜNFTIGEM Preis
  if (priceChangePercent > 3) {
    // ... speichert als "optimaler Trade"
  }
}
```

**Warum Lookahead-Bias:**
- **Zeile 515:** `const lookAhead = 5` - schaut 5 Tage in die Zukunft
- **Zeile 516:** `const futureIndex = Math.min(i + lookAhead, data.length - 1)`
- **Zeile 522:** `if (priceChangePercent > 3)` - identifiziert Trades, die **in Zukunft** profitabel wären
- Diese "optimalen Trades" werden dann verwendet, um Gewichtungen zu optimieren (Zeile 692-835)
- **Problem:** Zum Zeitpunkt `i` war der Preis in 5 Tagen nicht bekannt

**Minimaler Informationsschnitt:**
- **KEIN Lookahead:** Optimierung sollte auf **historisch bekannten** Signalen basieren
- **Alternative:** Walk-Forward-Optimierung mit Train/Test-Split

---

## 6️⃣ Backtest-Engine: Modellannahmen und fehlende Realismen

### 6.1 Entry/Exit Regeln

**Location:** `components/CustomIndicator.tsx:367-466`

**Entry-Regeln:**
- **Zeile 412:** `if (recommendation === 'KAUFEN')`
  - **Preis:** `current.price` (Zeile 414)
  - **Keine:** Limit-Orders, Market-Orders, Slippage

**Exit-Regeln:**
- **Zeile 393:** `if (recommendation === 'VERKAUFEN' || ...)`
- **Zeile 394:** Stop-Loss: `current.price < current.value * 0.95`
  - **Stop-Loss-Prozentsatz:** 5% (hart codiert)
  - **Berechnung:** `current.value` ist Moving Average
  - **Keine:** Trailing Stop, Time-based Exit

**Position Sizing:**
- **Fix:** 1 Position (Zeile 414: `position = 'LONG'`)
- **Keine:** Dynamische Größenanpassung, Risk-Management, Portfolio-Allokation

**Fees/Slippage:**
- **NICHT berücksichtigt**
- **Zeile 395:** `const returnAmount = current.price - entryPrice`
- **Keine Abzüge** für Transaktionskosten

### 6.2 Fehlende Metriken

**Vorhanden:**
- Win Rate (Zeile 455)
- Total Return (Zeile 456)
- Best/Worst Trade (Zeile 458-459)
- Average Return (Zeile 460)

**Fehlt:**
- **Max Drawdown:** Maximale Verlustserie
- **Profit Factor:** Total Gains / Total Losses
- **Sharpe Ratio:** Risk-adjusted Return
- **Sortino Ratio:** Downside Risk-adjusted Return
- **Calmar Ratio:** Return / Max Drawdown
- **Trade-Dauer:** Durchschnittliche Haltedauer
- **Win/Loss Ratio:** Durchschnittlicher Gewinn vs. Verlust
- **Expectancy:** (Win% × AvgWin) - (Loss% × AvgLoss)
- **Slippage/Commissions:** Transaktionskosten

---

## 7️⃣ Rate Limits / Skalierung / Caching

### 7.1 Retry-Logik, Exponential Backoff, Throttling

**Gefunden:**
- **NICHT vorhanden:** Keine Retry-Logik
- **NICHT vorhanden:** Kein Exponential Backoff
- **NICHT vorhanden:** Kein Throttling

**Beispiel (typisch für alle API-Calls):**
```typescript
// app/api/stocks/route.ts:124-140
const quotes = await Promise.all(
  symbolArray.map(async (symbol) => {
    try {
      const quote = await fetchStockFromYahoo(symbol, usdToEurRate)
      return quote
    } catch (error: any) {
      console.error(`Error fetching ${symbol}:`, error?.message || error)
      return null  // Einfach null zurückgeben, kein Retry
    }
  })
)
```

### 7.2 Caching

**Server-seitig (Next.js API Routes):**

**Route 1:** `/api/stocks`
- **Zeile 156:** `Cache-Control: public, s-maxage=60, stale-while-revalidate=30`
- **Kein:** `next: { revalidate }` in fetch

**Route 2:** `/api/stocks/[symbol]`
- **Zeile 292:** `Cache-Control: public, s-maxage=60, stale-while-revalidate=30`
- **Kein:** `next: { revalidate }` in fetch

**Route 3:** `/api/stocks/[symbol]/details`
- **Zeile 333:** `Cache-Control: public, s-maxage=300, stale-while-revalidate=60`
- **Zeile 36, 75:** `next: { revalidate: 300 }` in fetch (Yahoo APIs)
- **Zeile 125:** `next: { revalidate: 3600 }` in fetch (Alpha Vantage)

**Route 4:** `/api/stocks/[symbol]/news`
- **Zeile 62:** `Cache-Control: public, s-maxage=300, stale-while-revalidate=60`
- **Kein:** `next: { revalidate }` in fetch

**Route 5:** `/api/indices`
- **Zeile 134:** `Cache-Control: public, s-maxage=300, stale-while-revalidate=60`
- **Kein:** `next: { revalidate }` in fetch

**Client-seitig:**
- **Keine Memoization:** Keine `useMemo` für teure Berechnungen
- **Keine Debouncing:** API-Calls bei jedem `useEffect`-Trigger

**Globale Caches:**
- **NICHT vorhanden:** Kein Redis, keine Datenbank
- **Nur:** Next.js HTTP-Cache (via Cache-Control Headers)

### 7.3 Parallele vs. sequentielle Requests

**Parallele Requests:**

**Route 1:** `/api/stocks`
- **Zeile 124:** `Promise.all()` - **Parallel** für alle Symbole

**Route 5:** `/api/indices`
- **Zeile 118:** `Promise.all()` - **Parallel** für alle Indizes

**Route 3:** `/api/stocks/[symbol]/details`
- **Zeile 31, 70:** Yahoo Chart + Quote API - **Parallel** (aber nicht explizit `Promise.all`)
- **Zeile 121:** Alpha Vantage - **Sequenziell** nach Yahoo

**Sequentielle Requests:**
- **Route 2:** `/api/stocks/[symbol]`
  - **Zeile 35:** Quote-Request
  - **Zeile 115:** Historical-Request (nach Quote)
  - **Sequenziell**

### 7.4 Request-Schätzung: /indikator für 1 Symbol

**Beim Öffnen von `/indikator` für Symbol "AAPL":**

1. **`app/indikator/page.tsx` (Zeile 24):**
   - 1x GET `/api/stocks?symbols=AAPL,MSFT,...`
     - → 1x EURUSD Rate
     - → 8x Yahoo Chart API (parallel)

2. **`components/CustomIndicator.tsx` (Zeile 881-882):**
   - 2x GET (parallel):
     - `/api/stocks/AAPL?range=3mo`
       - → 1x EURUSD Rate
       - → 1x Yahoo Chart API (current quote)
       - → 1x Yahoo Chart API (historical)
     - `/api/stocks/AAPL/details`
       - → 1x Yahoo Chart API (parallel)
       - → 1x Yahoo Quote API (parallel)
       - → 1x Alpha Vantage API (sequenziell)

**Gesamt (externe Requests):**
- **EURUSD:** 2x (könnte gecacht sein)
- **Yahoo Chart:** 1 + 1 + 1 = 3x
- **Yahoo Quote:** 1x
- **Alpha Vantage:** 1x

**Total:** ~6-7 externe HTTP-Requests beim ersten Laden

---

## 8️⃣ Security & Betrieb

### 8.1 ENV-Variablen

**Gefunden:**

**Location:** `app/api/stocks/[symbol]/details/route.ts:115`
```typescript
const alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY || 'demo'
```

**Sicherheit:**
- ✅ **Server-seitig:** `process.env` wird nur in API Routes verwendet (Server-Side)
- ✅ **NICHT im Client:** Kein `process.env` in Client-Components
- ⚠️ **Fallback:** 'demo' Key als Fallback (kann zu Rate-Limit-Problemen führen)

**Weitere ENV-Variablen:**
- **UNBEKANNT:** Gibt es weitere ENV-Variablen?

### 8.2 Secrets im Client

**Geprüft:**
- ✅ **Alpha Vantage Key:** Nur server-seitig (`process.env`)
- ✅ **Keine API-Keys** in Client-Code

### 8.3 CORS

**Geprüft:**
- **NICHT konfiguriert:** Keine explizite CORS-Konfiguration in `next.config.js`
- **Next.js Default:** CORS wird von Next.js gehandhabt (API Routes sind same-origin)

### 8.4 Logging

**Gefunden:**
- **Console.log:** Extensive Verwendung in API Routes
  - Beispiel: `app/api/stocks/route.ts:117, 121, 129, 145`
  - Beispiel: `app/api/stocks/[symbol]/details/route.ts:25, 47, 88, 141, 314`
- **Client-seitig:** `console.log`, `console.error`, `console.warn` in Components
- **Keine:** Strukturiertes Logging (Winston, Pino, etc.)
- **Keine:** Log-Aggregation

### 8.5 Deployment/CI

**Gefunden:**
- **UNBEKANNT:** Keine `.github/workflows/`, `.gitlab-ci.yml`, `Dockerfile`, `vercel.json`
- **UNBEKANNT:** Hosting-Provider, Deployment-Prozess

---

## 9️⃣ Ergebnis: "Was wir jetzt sicher wissen" vs. "Was noch fehlt"

### 9.1 Gesichert (mit Referenzen)

| Aspekt | Status | Referenz |
|--------|--------|----------|
| **Tech-Stack** | ✅ Next.js 14, React 18, TypeScript | `package.json:13-14,26` |
| **API-Routen** | ✅ 5 Routes dokumentiert | `app/api/**/route.ts` |
| **Datentypen** | ✅ Interfaces in Components | `components/CustomIndicator.tsx:6-55` |
| **Indikator-Logik** | ✅ Client-seitig, 1732 Zeilen | `components/CustomIndicator.tsx` |
| **Gewichtungen** | ✅ RSI 30%, MA 60%, Support 10% | `components/CustomIndicator.tsx:1004` |
| **Fundamental-Gewichtungen** | ✅ KGV 10%, PEG 15%, etc. | `components/CustomIndicator.tsx:207-213` |
| **Lookahead-Bias** | ✅ In Backtest + Optimierung | `components/CustomIndicator.tsx:387,515` |
| **Support-Levels** | ✅ ±1% Clustering, min 2 Berührungen | `components/CustomIndicator.tsx:322,352` |
| **Caching** | ✅ Cache-Control Headers vorhanden | `app/api/**/route.ts` (verschiedene Zeilen) |
| **Alpha Vantage** | ✅ Nur für OVERVIEW, Rate Limit 5/min | `app/api/stocks/[symbol]/details/route.ts:115,125` |
| **Portfolio** | ✅ localStorage, Key: 'stockex-portfolio' | `app/portfolio/page.tsx:49,94,145,162` |
| **Währung** | ✅ USD→EUR Konvertierung | `app/api/stocks/route.ts:4-30` |

### 9.2 Unklar/Fehlt (mit konkreten Fragen)

| Aspekt | Status | Frage |
|--------|--------|-------|
| **Deployment** | ❓ UNBEKANNT | Wo wird die App gehostet? Gibt es CI/CD? |
| **Rate-Limit-Strategie** | ❓ UNBEKANNT | Wie werden Rate-Limits bei mehreren Nutzern gehandhabt? |
| **Datenvalidierung** | ❓ UNBEKANNT | Gibt es Runtime-Validierung der API-Responses? |
| **Error-Recovery** | ❓ UNBEKANNT | Gibt es Retry-Logik für fehlgeschlagene API-Calls? |
| **Testing** | ❓ UNBEKANNT | Gibt es Unit-Tests, Integration-Tests? |
| **Monitoring** | ❓ UNBEKANNT | Gibt es Error-Tracking (Sentry, etc.)? |
| **Datenbank** | ❓ UNBEKANNT | Wird eine Datenbank verwendet? |
| **User-Sessions** | ❓ UNBEKANNT | Gibt es User-Authentifizierung? |
| **Skalierung** | ❓ UNBEKANNT | Wie viele gleichzeitige Nutzer werden erwartet? |
| **Backup-Strategie** | ❓ UNBEKANNT | Wie werden Portfolio-Daten gesichert (localStorage kann verloren gehen)? |

---

## 🔟 Rückfragen an den Entwickler

1. **Deployment & Hosting:**
   - Wo wird die Anwendung aktuell gehostet (Vercel, selbst gehostet, etc.)?
   - Gibt es eine CI/CD-Pipeline?
   - Wie werden Updates deployed?

2. **Skalierung & Nutzerbasis:**
   - Wie viele gleichzeitige Nutzer werden erwartet?
   - Ist die Anwendung öffentlich oder intern?
   - Gibt es Performance-Anforderungen (Latenz, Throughput)?

3. **Rate-Limits:**
   - Wie wird mit Alpha Vantage Rate Limits (5 Requests/Minute) bei mehreren Nutzern umgegangen?
   - Gibt es einen Plan für alternative Datenquellen?
   - Wird ein API-Key-Pool verwendet?

4. **Datenqualität & Validierung:**
   - Gibt es Anforderungen an Datenaktualität (Live, EOD, etc.)?
   - Wie werden Datenlücken behandelt?
   - Gibt es Backup-Datenquellen?

5. **Backtesting-Validierung:**
   - Soll der Lookahead-Bias behoben werden?
   - Gibt es Anforderungen an Backtesting-Genauigkeit?
   - Sollen fehlende Metriken (Max Drawdown, etc.) hinzugefügt werden?

6. **Indikator-Parameter:**
   - Wie wurden die Schwellenwerte (KGV 15-25, combinedScore > 52, etc.) bestimmt?
   - Gibt es historische Validierung dieser Werte?
   - Sollen Parameter konfigurierbar sein?

7. **Rechtliches & Compliance:**
   - Gibt es Haftungsausschlüsse für Trading-Empfehlungen?
   - Werden regulatorische Anforderungen erfüllt (z.B. MiFID II)?
   - Gibt es Compliance-Anforderungen?

8. **Zukunft & Roadmap:**
   - Gibt es Pläne für ML-Integration?
   - Soll die Indikator-Logik server-seitig verschoben werden?
   - Gibt es Performance-Optimierungs-Pläne?

9. **Daten-Persistenz:**
   - Soll Portfolio-Daten in einer Datenbank gespeichert werden (statt localStorage)?
   - Gibt es Anforderungen an Daten-Synchronisation zwischen Geräten?

10. **Testing & Qualitätssicherung:**
    - Gibt es Test-Strategien für die Indikator-Logik?
    - Wie wird die Korrektheit der Berechnungen validiert?
    - Gibt es Regression-Tests bei Änderungen?

---

**Ende der Analyse**
