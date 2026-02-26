# Stock Market Terrain

A 3D topological terrain visualization of stock market relationships. Market cap maps to height (peaks = large caps, valleys = small caps) and X-Y positioning is derived from return correlation via UMAP — correlated stocks cluster together naturally.

![terrain visualization](docs/screenshot-placeholder.png)

## What it shows

- **Height** — log(market cap). Larger companies are peaks, smaller ones sit in valleys.
- **X-Y position** — UMAP projection of Mantegna correlation distance. Stocks that move together are close; unrelated stocks drift apart.
- **Color** — topographic gradient (deep green → tan → brown → gray → snow) matching elevation.
- **Sectors** — Space Tech labels in blue, Nuclear/Power in orange.

Three distance metrics are available:

| Metric | Description |
|--------|-------------|
| Correlation | Pearson return correlation (Mantegna distance) — default |
| Institutional | Jaccard distance from shared 13-F institutional holders |
| News | Co-occurrence similarity from recent news articles |

## Stock universe

| Sector | Tickers |
|--------|---------|
| Space Tech | ASTS, RKLB, LUNR, SPCE, BKSY, PL, IRDM, GSAT |
| Nuclear/Power | OKLO, NNE, SMR, VST, CEG, TLN, CCJ, LEU, UEC |

## Quick start

**Backend**

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

**Frontend**

```bash
cd frontend
npm install
npm run dev        # http://localhost:5180
```

Frontend expects backend at `http://localhost:8001`. Override with:

```bash
VITE_API_URL=http://your-host:8001 npm run dev
```

## Features

- **3D terrain mesh** — continuous interpolated surface (scipy griddata cubic, 100×100 grid)
- **Orbit camera** — drag to rotate, scroll to zoom, right-click to pan
- **Hover tooltips** — click/hover stock markers to see ticker, market cap, and sector
- **Metric switching** — live toggle between correlation, institutional, and news distance
- **Time-lapse** — animated 12-frame rolling window showing terrain evolution over the past year. Each frame covers a 90-day window; Procrustes alignment prevents frame-to-frame jitter.
- **Playback controls** — play/pause, frame scrubber, 0.5×/1×/2× speed

## Architecture

```
Backend (FastAPI)
  yfinance (1yr daily closes + market cap)
    → log-returns
    → Pearson correlation matrix
    → Mantegna distance: d = sqrt(2 * (1 - corr))
    → UMAP (n_components=2, precomputed metric)
    → Z = normalized log(market_cap)
    → scipy.griddata cubic interpolation → 100×100 mesh
    → GET /api/terrain  →  { vertices, faces, stocks[], zRange }

Frontend (React Three Fiber)
  Scene
    ├── TerrainMesh    — BufferGeometry, per-vertex topographic colors
    ├── StockLabels    — cylinder pole + sphere + HTML billboard per stock
    ├── OrbitControls  — damped orbit camera
    └── TimelapseAnimator — useFrame lerp between snapshots
```

## Tech stack

- **Backend**: Python · FastAPI · yfinance · NumPy · SciPy · scikit-learn · umap-learn
- **Frontend**: TypeScript · React 19 · Vite · Three.js · React Three Fiber · @react-three/drei

## Docs

- [Architecture Decision Records](docs/adr/)
  - [ADR-001: Core architecture](docs/adr/001-stock-terrain-visualization-architecture.md)
  - [ADR-002: Time-lapse animation](docs/adr/002-timelapse-animation.md)
  - [ADR-003: Multi-metric distance](docs/adr/003-multi-metric-distance.md)
- [API Reference](docs/api.md)

## Roadmap

- **Phase 3** — News integration: NLP pipeline adjusts distance weights based on news co-occurrence
- **Phase 4** — IPO simulation: gravity model shows terrain deformation from a hypothetical listing (e.g., SpaceX)
- **Phase 5** — Expanded universe: hundreds of stocks with frontend LOD for performance
