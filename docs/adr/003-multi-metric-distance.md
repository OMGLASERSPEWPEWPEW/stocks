# ADR-003: Multi-Metric Distance Support

**Status:** Accepted
**Date:** 2026-02-26
**Author:** Deric Ortiz

## Context

Return correlation (ADR-001) is the primary distance metric, but it only captures one dimension of stock relationships. Two stocks can be fundamentally linked — same institutional owners, same news cycle — without exhibiting high return correlation in a given window. Supporting alternative distance metrics lets the user explore different lenses on the same universe.

## Decision

### Three Distance Implementations

All three metrics produce an `N×N` distance matrix that feeds into the same UMAP → mesh pipeline.

**1. Correlation (default)**
Mantegna distance from Pearson return correlation:
```
d_ij = sqrt(2 * (1 - corr_ij))
```
Implemented in `compute_correlation_matrix()` + `correlation_to_distance()` in `backend/data.py`.

**2. Institutional (13-F filings)**
Jaccard distance from shared institutional holders:
```
d_ij = 1 - |holders_i ∩ holders_j| / |holders_i ∪ holders_j|
```
Implemented in `compute_institutional_distance()`. Uses `yfinance` institutional holder data. Falls back to correlation distance if holder data is unavailable for a ticker.

**3. News co-occurrence**
Similarity derived from shared news article appearances:
```
d_ij = 1 - co_occurrence_score_ij
```
Implemented in `compute_news_distance()`. Falls back to correlation distance when news data is insufficient.

### API: Query Parameter Routing

The metric is selected via query parameter on all terrain endpoints:

```
GET /api/terrain?metric=correlation
GET /api/terrain?metric=institutional
GET /api/terrain?metric=news
```

### Caching: Per-Metric with Separate Locks

Each metric has its own cache entry and computation lock in `backend/main.py`:

```python
_terrain_cache: dict[str, TerrainData] = {}
_lock = threading.Lock()       # static terrain cache
_timelapse_lock = threading.Lock()  # timelapse cache
```

The first request for a given metric triggers computation; subsequent requests return cached data. `POST /api/terrain/refresh?metric=...` invalidates and recomputes a specific metric.

### Frontend: Metric Toggle

`App.tsx` manages `activeMetric: MetricType` state. The `TierToggle` component (top-right) switches between metrics with a loading spinner. Each switch triggers a fresh `GET /api/terrain?metric=<selected>` call.

## Consequences

- **Institutional and news fetches are slower** than correlation — yfinance 13-F lookups add latency, and news co-occurrence requires an additional data pass. First-load for these metrics can take 10–30 seconds.
- **Fallback behavior** (correlation when data is missing) means the institutional/news terrains may partially reflect correlation distance for tickers with poor data coverage.
- **UMAP non-determinism** (fixed by random seed) means each metric produces a stable layout within a session, but layouts may differ across server restarts.
- **Cache invalidation** is manual (POST /refresh) — the cache does not auto-expire. For a production system, a TTL would be appropriate.
