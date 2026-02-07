# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Stock market terrain visualization — renders stocks as a 3D topological surface where market cap = height (peaks = large caps, valleys = small caps) and X-Y positioning is derived from return correlation via UMAP (correlated stocks cluster together). Focused on space tech and nuclear/power sectors.

## Architecture

- **`backend/`** — Python FastAPI server handling data fetching, correlation computation, UMAP projection, and terrain mesh generation
- **`frontend/`** — Vite + React + TypeScript + React Three Fiber (Three.js) for 3D terrain rendering

### Data Pipeline (backend)
`yfinance` → log-returns → Pearson correlation matrix → Mantegna distance `d=sqrt(2*(1-corr))` → UMAP (2D, precomputed metric) → scipy `griddata` cubic interpolation → terrain mesh JSON

### Key Files
- `backend/data.py` — Stock universe definition, yfinance fetching, correlation/distance computation
- `backend/terrain.py` — UMAP projection, terrain mesh generation (vertices, faces, stock markers)
- `backend/main.py` — FastAPI app with single endpoint `GET /api/terrain`
- `frontend/src/components/Terrain.tsx` — Three.js mesh renderer with topographic colormap
- `frontend/src/components/StockLabels.tsx` — Billboard labels with hover tooltips
- `frontend/src/components/Scene.tsx` — Canvas, lighting, OrbitControls
- `frontend/src/App.tsx` — Data fetching, loading/error states, legend

## Commands

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # dev server (default port 5173)
npx tsc --noEmit     # type-check
npx vite build       # production build
```

Frontend expects backend at `http://localhost:8001` (override with `VITE_API_URL` env var).

## Stock Universe

Defined in `backend/data.py`. Two sectors:
- **Space Tech**: ASTS, RKLB, LUNR, SPCE, BKSY, PL, IRDM, GSAT
- **Nuclear/Power**: OKLO, NNE, SMR, VST, CEG, TLN, CCJ, LEU, UEC
