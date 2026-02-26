# ADR-001: Stock Market Terrain Visualization Architecture

**Status:** Accepted
**Date:** 2026-02-06
**Author:** Deric Ortiz

## Context

We want to visualize stocks as a 3D topological terrain where:
- **Height (Z-axis)** represents market capitalization — large caps are peaks, small caps are valleys
- **X-Y positioning** is derived from return correlation so that correlated stocks naturally cluster together
- The terrain is a continuous interpolated surface, not just scattered points

The initial focus is a static snapshot of two sectors: **space tech** (ASTS, RKLB, LUNR, PL, IRDM, GSAT, BKSY, SPCE) and **nuclear/power** (OKLO, NNE, SMR, VST, CEG, TLN, CCJ, LEU, UEC).

This concept draws on established quantitative finance frameworks:
- **Correlation-based network topology** (Mantegna 1999 — minimum spanning trees from correlation matrices)
- **Topological Data Analysis** (Gidea & Katz — persistence landscapes of financial time series)
- **Gravity models in finance** (capital flow attraction proportional to market size, decaying with distance)
- **Manifold learning** (UMAP/t-SNE for projecting high-dimensional correlation data to 2D)

The long-term vision includes time-lapse terrain animation, news-driven proximity adjustments, and IPO impact simulation (e.g., modeling how a hypothetical $1.5T SpaceX IPO would deform the surrounding terrain by displacing capital from neighboring stocks).

## Decision

### Architecture: Python Backend + Web Frontend

**Backend (Python / FastAPI):**
- Handles all data fetching, computation, and mesh generation
- `yfinance` for historical price data and market cap
- Correlation matrix → distance matrix → UMAP 2D projection pipeline
- `scipy.interpolate.griddata` for terrain mesh interpolation
- Serves terrain data via REST API as JSON

**Frontend (Vite + React + React Three Fiber):**
- Three.js via React Three Fiber for 3D terrain rendering
- Height-based color gradient (topographic colormap)
- Billboard labels on stock positions
- OrbitControls for camera manipulation
- Hover tooltips with stock metadata

### Data Pipeline

```
yfinance (1yr daily closes)
  → log-returns
  → Pearson correlation matrix (N×N)
  → distance matrix: d_ij = sqrt(2 * (1 - corr_ij))
  → UMAP (n_components=2) → X, Y positions
  → Z = normalized log(market_cap)
  → scipy griddata (cubic) on 100×100 grid → continuous terrain mesh
  → JSON response: { vertices, faces, stocks[] }
```

### Positioning Rationale: Return Correlation + UMAP

We chose **return correlation** as the primary distance metric because:
1. It is the standard quant baseline for measuring stock relationships
2. It captures market-revealed relationships (not just sector labels)
3. Correlated stocks will naturally cluster — space tech stocks that move together will form a ridge, nuclear stocks another
4. UMAP preserves both local structure (within-sector clusters) and global structure (sector separation) better than t-SNE

Alternative metrics considered for future phases:
- Shared institutional ownership (13-F filings)
- News co-occurrence / sentiment correlation
- Supply chain linkage
- Factor exposure similarity (growth, value, momentum loadings)

These can be layered in as weighted components of a composite distance matrix.

### Stock Universe (Phase 1)

| Sector | Tickers |
|---|---|
| Space Tech | ASTS, RKLB, LUNR, SPCE, BKSY, PL, IRDM, GSAT |
| Nuclear/Power | OKLO, NNE, SMR, VST, CEG, TLN, CCJ, LEU, UEC |

~17 stocks. Small enough to iterate quickly, large enough to produce a meaningful terrain.

## Consequences

### Benefits
- Python backend keeps the heavy math (correlation, UMAP, interpolation) in a mature ecosystem with proven libraries
- Web frontend makes the result shareable and interactive — no desktop app install required
- UMAP positioning means the layout is data-driven, not hand-arranged — relationships emerge from actual market behavior
- The architecture cleanly separates data/computation from rendering, so either side can evolve independently
- Starting with a static snapshot reduces initial complexity while establishing the full pipeline

### Risks and Tradeoffs
- **UMAP is non-deterministic** — different runs produce different layouts. Mitigation: fix random seed, or cache/persist a canonical layout
- **Small universe (17 stocks) may produce sparse terrain** — the interpolated surface between distant stocks could look artificial. Mitigation: tune interpolation parameters, add a base "sea level"
- **yfinance is unofficial and rate-limited** — acceptable for prototyping, but a production system would need a proper data provider (Alpha Vantage, Polygon, etc.)
- **Correlation is backward-looking** — the terrain reflects past relationships, not current capital flows. This is a known limitation addressed in future phases (news integration, real-time data)
- **Two API calls per page load** (terrain data isn't huge, but could cache aggressively)

### Future Phase Dependencies
This architecture supports the planned evolution:
- **Phase 2 (Time-lapse):** Backend computes terrain for each time window; frontend animates between snapshots
- **Phase 3 (News integration):** Add NLP pipeline to backend; adjust distance matrix weights
- **Phase 4 (IPO simulation):** Add gravity model to backend; frontend shows before/after terrain deformation
- **Phase 5 (Expanded universe):** Scale UMAP to hundreds of stocks; frontend LOD (level of detail) for performance
