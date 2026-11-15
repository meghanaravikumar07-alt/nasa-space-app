# ORBITAL X

**Understanding Fire Beyond Gravity. Protecting Life Beyond Earth.**

ORBITAL X is an AI-powered microgravity combustion intelligence and spacecraft fire safety research platform built around the NASA Space Hackathon problem statement: *"Flame in Freefall: AI-Powered Fire Safety Insights from Microgravity Combustion Data."*

---

## Architecture Overview

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Framer Motion (`motion`), Three.js (procedural 3D Earth, orbital station, GLSL spherical microgravity & 1g buoyant flame shaders), Recharts, Lucide React, and jsPDF.
- **Backend**: Node.js + Express (`server.ts`) with Vite middleware in development and static asset serving in production.
- **Database**: Persistent SQLite via `sql.js` (`data/orbitalx.sqlite`) storing curated NASA combustion experiment runs, uploaded CSV/JSON datasets, live NASA OSDR study metadata, and repository health logs.
- **Machine Learning & AI**:
  - Standardized L2 Ridge Regression predicting flame spread rate (`mm/s`) with 80/20 train/test evaluation, 5-fold cross-validation, RMSE/MAE, standardized feature importance, and Pearson correlations.
  - Transparent experimental prototype Risk Classifier (`LOW`, `MODERATE`, `ELEVATED`, `HIGH RISK`) with 2D risk matrix and nearest-neighbor NASA record matching.
  - Optional server-side scientific synthesis via `@google/genai` (`gemini-4-hydrogen`) grounded strictly in computed dataset metrics.

---

## Folder Structure

- `server.ts` — Express API server, periodic NASA connectivity monitor, and Vite/static entry point
- `server/db/database.ts` — SQLite schema initialization, seeding, and query helpers
- `server/data/curatedDatasets.ts` — Curated FLEX, FLEX-2, SoFIE, SoFIE-GEL, Saffire, and 1g baseline records
- `server/services/nasaConnector.ts` — Live NASA OSDR API & PSI/Glenn availability checks + CSV/JSON validator
- `server/ml/combustionModel.ts` — Ridge Regression, cross-validation, correlation matrix, and risk classifier
- `server/services/geminiInsights.ts` — Server-side Gemini scientific briefing synthesizer
- `src/components/LandingPage.tsx` — Cinematic 3D space mission introduction
- `src/components/three/` — `OrbitalHeroScene.tsx` & `FlameSimulator3D.tsx`
- `src/components/views/` — Overview, Combustion Explorer, AI Intelligence, Simulation Lab, Risk Assessment, Mission Research, About Project
- `data/sample_combustion_dataset.csv` — Offline sample dataset for CSV import testing

---

## Environment Configuration

Copy `.env.example` to `.env` if running locally outside AI Studio:

```bash
GEMINI_API_KEY="your_gemini_api_key"
PORT=3000
```

---

## Installation & Running

```bash
npm install
npm run dev      # Starts Express + Vite on port 3000
npm run lint     # TypeScript type-checking
npm run build    # Production frontend bundle in dist/
npm run start    # Production server on Node 22+
```

---

## REST API Endpoints

- `GET /api/health` — Backend API, SQLite, ML engine, and NASA connectivity status
- `GET /api/overview` — Calculated KPI metrics, investigation metadata, and source health
- `GET /api/records?dataset=ALL|FLEX|FLEX-2|SoFIE|SoFIE-GEL|Saffire|COMPARATIVE_1G_0G` — Filtered combustion records + dynamic filter facets
- `POST /api/data/sync` — Triggers live NASA OSDR search and PSI/Glenn/SoFIE endpoint checks
- `POST /api/data/upload` — Validates and ingests user-supplied CSV or JSON combustion datasets
- `GET /api/sample-csv` — Serves `data/sample_combustion_dataset.csv`
- `GET /api/ml/analysis` — Returns Ridge Regression evaluation, correlations, feature importance, and insights
- `POST /api/ml/predict` — Runs flame spread prediction and prototype risk classification for input parameters
- `POST /api/ai/synthesize` — Generates grounded scientific summary from active dataset statistics
- `GET /api/research/investigations` — Returns flight investigation profiles and indexed NASA OSDR studies

---

## Scientific Scope & Disclaimer

ORBITAL X is an experimental research and hackathon intelligence prototype. Risk classifications, flame spread estimates, and 3D combustion visualizations are statistical and analytical approximations—not validated CFD simulations or NASA-certified spacecraft fire safety assessments (NASA-STD-6001). Historical flight datasets are clearly distinguished from live repository availability checks and offline sample data.
