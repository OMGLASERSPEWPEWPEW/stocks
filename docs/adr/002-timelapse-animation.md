# ADR-002: Time-Lapse Terrain Animation

**Status:** Accepted
**Date:** 2026-02-26
**Author:** Deric Ortiz

## Context

The static terrain snapshot (ADR-001) shows where stocks stand today, but not how they moved there. Showing the terrain evolve over the past year reveals when correlations shifted — e.g., a sector-wide event pulling stocks together, or a decoupling after earnings divergence.

The key challenge is consistency across frames: UMAP is non-deterministic, so naively running UMAP on each time window produces layouts that jump discontinuously, making animation useless.

## Decision

### Backend: Rolling Windows + Procrustes Alignment

`compute_rolling_distances()` in `backend/data.py` slices 1 year of daily closes into overlapping 90-day windows (default 12 windows, ~30-day step). For each window:

1. Compute log-returns and Pearson correlation
2. Apply Mantegna distance transform
3. Run UMAP independently per window

`align_embeddings()` in `backend/terrain.py` then applies **rotation-only Procrustes** analysis: each frame is rotated to best match the previous frame. Scale and translation are intentionally excluded to avoid distorting the layout — only orientation is stabilized.

The timelapse endpoint (`GET /api/terrain/timelapse`) returns:

```json
{
  "faces": [[i, j, k], ...],
  "gridResolution": 100,
  "zRange": { "min": float, "max": float },
  "snapshots": [
    {
      "vertices": [[x, y, z], ...],
      "stocks": [...],
      "startDate": "2025-05-01",
      "endDate": "2025-07-29"
    }
  ]
}
```

Faces are shared across all snapshots; only vertex positions and stock markers change.

### Frontend: Linear Interpolation Between Snapshots

`useTimelapse.ts` manages animation state. Each frame transition:

- Takes ~2 seconds at 1× speed (0.5×, 1×, 2× multipliers supported)
- Linearly interpolates vertex positions and stock X/Y/Z between adjacent snapshots using `lerp()`
- Updates Three.js `BufferGeometry` attributes in-place each tick (no geometry rebuild) via `useRef`

`TimelapseAnimator.tsx` calls `tick(delta)` via React Three Fiber's `useFrame` each render cycle.

Playback controls (play/pause, scrubber, speed) live in `TimelapseControls.tsx`, overlaid as fixed UI at the bottom of the screen.

## Alternatives Considered

**Pre-baked video export** — Render frames server-side and return an MP4. Rejected: loses interactivity (orbit camera, hover tooltips) and adds ffmpeg dependency.

**WebSocket streaming** — Stream frames in real-time as they compute. Rejected: adds significant backend complexity for no benefit over a single batch fetch.

**t-SNE instead of UMAP per window** — t-SNE has no concept of a global frame of reference, making Procrustes alignment less stable. UMAP's metric parameter also allows reuse of the same distance function.

## Consequences

- Initial timelapse fetch is heavier than a static fetch (~12× the data). Mitigated by a separate cache with its own lock (`_timelapse_lock`).
- Rotation-only Procrustes provides good stability for gradual shifts but may still show jumps if the topology changes drastically between windows.
- The 90-day window size means recent market events are blended with older data. A shorter window would be noisier; a longer one loses temporal resolution.
- Timelapse faces are fixed (shared topology); only vertex positions change, enabling efficient in-place buffer updates.
