# API Reference

Base URL: `http://localhost:8001`

All endpoints return JSON. The backend uses FastAPI; interactive docs are available at `/docs` (Swagger) and `/redoc`.

---

## GET /api/terrain

Fetch the terrain mesh for a given distance metric. Results are cached after the first computation.

**Query parameters**

| Parameter | Type | Default | Values |
|-----------|------|---------|--------|
| `metric` | string | `correlation` | `correlation`, `institutional`, `news` |

**Response: `TerrainData`**

```json
{
  "vertices": [[x, y, z], ...],
  "faces": [[i, j, k], ...],
  "stocks": [
    {
      "ticker": "ASTS",
      "x": 0.42,
      "y": 0.31,
      "z": -0.15,
      "marketCap": 8500000000,
      "logMarketCap": 9.929,
      "sector": "Space Tech"
    }
  ],
  "gridResolution": 100,
  "zRange": { "min": -0.5, "max": 1.0 }
}
```

- `vertices` — array of `[x, y, z]` triples. In Three.js convention: Y = height (market cap), X/Z = UMAP projection.
- `faces` — triangle indices into `vertices` (counter-clockwise winding).
- `stocks` — one entry per ticker with 3D position matching its interpolated surface position.
- `zRange` — raw height range before normalization, useful for colormap scaling.

**Example**

```bash
curl http://localhost:8001/api/terrain?metric=correlation
curl http://localhost:8001/api/terrain?metric=institutional
curl http://localhost:8001/api/terrain?metric=news
```

---

## POST /api/terrain/refresh

Invalidate the cached terrain for a metric and trigger recomputation.

**Query parameters**

| Parameter | Type | Default | Values |
|-----------|------|---------|--------|
| `metric` | string | `correlation` | `correlation`, `institutional`, `news` |

**Response**

```json
{ "status": "ok", "metric": "correlation" }
```

**Example**

```bash
curl -X POST http://localhost:8001/api/terrain/refresh?metric=correlation
```

---

## GET /api/terrain/timelapse

Fetch animated timelapse data: a fixed mesh topology plus per-snapshot vertex positions and stock markers covering rolling time windows over the past year.

**Query parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `windows` | int | `12` | Number of time windows |
| `window_size` | int | `90` | Days per window |

**Response: `TimelapseData`**

```json
{
  "faces": [[i, j, k], ...],
  "gridResolution": 100,
  "zRange": { "min": -0.5, "max": 1.0 },
  "snapshots": [
    {
      "vertices": [[x, y, z], ...],
      "stocks": [...],
      "startDate": "2025-02-26",
      "endDate": "2025-05-26"
    }
  ]
}
```

- `faces` and `gridResolution` are shared across all snapshots.
- Each snapshot has its own `vertices` and `stocks` — the frontend lerps between adjacent snapshots.
- Snapshots are Procrustes-aligned (rotation-only) to minimize frame-to-frame position jumps.

**Example**

```bash
curl "http://localhost:8001/api/terrain/timelapse?windows=12&window_size=90"
```

---

## GET /api/health

Liveness check.

**Response**

```json
{ "status": "ok" }
```

---

## TypeScript types

These interfaces (from `frontend/src/types.ts`) mirror the API response shapes:

```typescript
export type MetricType = "correlation" | "institutional" | "news";

export interface StockPoint {
  ticker: string;
  x: number;
  y: number;        // height (market cap dimension)
  z: number;
  marketCap: number;
  logMarketCap: number;
  sector: string;
}

export interface TerrainData {
  vertices: [number, number, number][];
  faces: [number, number, number][];
  stocks: StockPoint[];
  gridResolution: number;
  zRange: { min: number; max: number };
}

export interface TimelapseSnapshot {
  vertices: [number, number, number][];
  stocks: StockPoint[];
  startDate: string;
  endDate: string;
}

export interface TimelapseData {
  faces: [number, number, number][];
  gridResolution: number;
  zRange: { min: number; max: number };
  snapshots: TimelapseSnapshot[];
}
```
