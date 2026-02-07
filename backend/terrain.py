import numpy as np
from scipy.interpolate import griddata
from scipy.linalg import orthogonal_procrustes
from umap import UMAP
from typing import Dict, List, Tuple
import pandas as pd


def project_to_2d(distance_matrix: pd.DataFrame, random_state: int = 42) -> Dict[str, Tuple[float, float]]:
    """Use UMAP to project the distance matrix into 2D coordinates."""
    tickers = list(distance_matrix.columns)
    dist_np = distance_matrix.values

    reducer = UMAP(
        n_components=2,
        metric="precomputed",
        n_neighbors=min(5, len(tickers) - 1),
        min_dist=0.3,
        random_state=random_state,
    )
    embedding = reducer.fit_transform(dist_np)

    # Normalize to [-1, 1]
    for dim in range(2):
        col = embedding[:, dim]
        mn, mx = col.min(), col.max()
        if mx - mn > 0:
            embedding[:, dim] = 2 * (col - mn) / (mx - mn) - 1

    return {ticker: (float(embedding[i, 0]), float(embedding[i, 1])) for i, ticker in enumerate(tickers)}


def _normalize_embedding(emb: np.ndarray) -> np.ndarray:
    """Normalize an embedding to [-1, 1] per dimension."""
    normed = emb.copy()
    for dim in range(emb.shape[1]):
        col = normed[:, dim]
        mn, mx = col.min(), col.max()
        if mx - mn > 0:
            normed[:, dim] = 2 * (col - mn) / (mx - mn) - 1
    return normed


def align_embeddings(embeddings: List[np.ndarray]) -> List[np.ndarray]:
    """Align a sequence of UMAP embeddings using rotation-only alignment.

    Uses orthogonal_procrustes (rotation/reflection only, no scaling) to
    eliminate frame-to-frame flicker while preserving the spatial spread.
    """
    if len(embeddings) <= 1:
        return [_normalize_embedding(e) for e in embeddings]

    # Normalize each embedding to [-1, 1] individually
    normed = [_normalize_embedding(e) for e in embeddings]

    aligned = [normed[0]]
    for i in range(1, len(normed)):
        ref = aligned[i - 1]
        cur = normed[i]

        # Center both
        ref_center = ref.mean(axis=0)
        cur_center = cur.mean(axis=0)
        ref_c = ref - ref_center
        cur_c = cur - cur_center

        # Find optimal rotation (no scaling)
        R, _ = orthogonal_procrustes(cur_c, ref_c)

        # Apply rotation and restore reference center
        rotated = cur_c @ R + ref_center
        aligned.append(rotated)

    # Re-normalize all frames globally to [-1, 1]
    all_pts = np.vstack(aligned)
    for dim in range(2):
        mn, mx = all_pts[:, dim].min(), all_pts[:, dim].max()
        if mx - mn > 0:
            for emb in aligned:
                emb[:, dim] = 2 * (emb[:, dim] - mn) / (mx - mn) - 1

    return aligned


def build_terrain(
    positions: Dict[str, Tuple[float, float]],
    metadata: Dict,
    grid_resolution: int = 100,
) -> dict:
    """Build an interpolated terrain mesh from stock positions and market caps."""
    tickers = list(positions.keys())

    xs = np.array([positions[t][0] for t in tickers])
    ys = np.array([positions[t][1] for t in tickers])

    # Z = log market cap, normalized to [0, 1]
    raw_caps = []
    for t in tickers:
        cap = metadata.get(t, {}).get("market_cap")
        raw_caps.append(cap if cap and cap > 0 else 1e6)
    log_caps = np.log10(np.array(raw_caps, dtype=float))
    z_min, z_max = log_caps.min(), log_caps.max()
    if z_max - z_min > 0:
        zs = (log_caps - z_min) / (z_max - z_min)
    else:
        zs = np.full_like(log_caps, 0.5)

    # Build regular grid
    pad = 0.15
    gx = np.linspace(-1 - pad, 1 + pad, grid_resolution)
    gy = np.linspace(-1 - pad, 1 + pad, grid_resolution)
    grid_x, grid_y = np.meshgrid(gx, gy)

    # Interpolate surface — cubic with nearest fallback for edges
    grid_z_cubic = griddata((xs, ys), zs, (grid_x, grid_y), method="cubic")
    grid_z_nearest = griddata((xs, ys), zs, (grid_x, grid_y), method="nearest")
    grid_z = np.where(np.isnan(grid_z_cubic), grid_z_nearest * 0.3, grid_z_cubic)

    # Fade edges toward a base level
    cx, cy = grid_x.ravel(), grid_y.ravel()
    edge_dist = np.minimum(
        np.minimum(cx - gx[0], gx[-1] - cx),
        np.minimum(cy - gy[0], gy[-1] - cy),
    )
    fade = np.clip(edge_dist / 0.3, 0, 1).reshape(grid_z.shape)
    base_level = 0.0
    grid_z = grid_z * fade + base_level * (1 - fade)

    # Clamp negatives
    grid_z = np.clip(grid_z, 0, None)

    # Build vertex array (x, y, z) flattened
    vertices = []
    for j in range(grid_resolution):
        for i in range(grid_resolution):
            vertices.append([float(grid_x[j, i]), float(grid_z[j, i]), float(grid_y[j, i])])

    # Build face indices (two triangles per grid cell)
    faces = []
    for j in range(grid_resolution - 1):
        for i in range(grid_resolution - 1):
            idx = j * grid_resolution + i
            a, b = idx, idx + 1
            c, d = idx + grid_resolution, idx + grid_resolution + 1
            faces.append([a, c, b])
            faces.append([b, c, d])

    # Stock markers
    stocks = []
    for i, t in enumerate(tickers):
        stocks.append({
            "ticker": t,
            "x": float(xs[i]),
            "y": float(zs[i]),  # height
            "z": float(ys[i]),  # depth (Three.js convention: y=up)
            "marketCap": raw_caps[i],
            "logMarketCap": float(log_caps[i]),
            "sector": metadata.get(t, {}).get("sector", "Unknown"),
        })

    return {
        "vertices": vertices,
        "faces": faces,
        "stocks": stocks,
        "gridResolution": grid_resolution,
        "zRange": {"min": float(z_min), "max": float(z_max)},
    }
