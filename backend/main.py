import os

# Disable numba parallel threading — not needed for our small dataset
# and causes crashes when uvicorn serves concurrent requests
os.environ["NUMBA_NUM_THREADS"] = "1"
os.environ["NUMBA_THREADING_LAYER"] = "workqueue"

import logging
import threading
import traceback
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from data import (
    fetch_stock_data,
    compute_log_returns,
    compute_correlation_matrix,
    correlation_to_distance,
    compute_institutional_distance,
    compute_news_distance,
    compute_rolling_distances,
)
from terrain import project_to_2d, build_terrain, align_embeddings

# --- Logging setup: writes to backend/logs/app.log ---
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "app.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("stock-terrain")

app = FastAPI(title="Stock Terrain API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MetricType = Literal["correlation", "institutional", "news"]

_cache: dict[str, dict | None] = {
    "correlation": None,
    "institutional": None,
    "news": None,
}
_lock = threading.Lock()

_timelapse_cache: dict[str, dict | None] = {}
_timelapse_lock = threading.Lock()


def _compute_terrain(metric: MetricType) -> dict:
    logger.info(f"Starting terrain computation for metric={metric}...")

    logger.info("Fetching stock data from yfinance...")
    closes, metadata = fetch_stock_data()
    logger.info(f"Fetched {closes.shape[1]} stocks, {closes.shape[0]} days")

    if metric == "correlation":
        returns = compute_log_returns(closes)
        logger.info(f"Computed log returns: {returns.shape}")
        corr = compute_correlation_matrix(returns)
        logger.info(f"Computed correlation matrix: {corr.shape}")
        dist = correlation_to_distance(corr)
        logger.info("Computed Mantegna distance matrix")
    elif metric == "institutional":
        logger.info("Computing institutional ownership distance...")
        tickers = list(closes.columns)
        dist = compute_institutional_distance(tickers)
        logger.info("Computed institutional distance matrix")
    elif metric == "news":
        logger.info("Computing news co-occurrence distance...")
        tickers = list(closes.columns)
        dist = compute_news_distance(tickers)
        logger.info("Computed news distance matrix")

    positions = project_to_2d(dist)
    logger.info(f"UMAP projected {len(positions)} stocks to 2D")

    terrain = build_terrain(positions, metadata)
    logger.info(
        f"Terrain built: {len(terrain['vertices'])} vertices, "
        f"{len(terrain['faces'])} faces, {len(terrain['stocks'])} stocks"
    )
    return terrain


@app.get("/api/terrain")
def get_terrain(metric: MetricType = Query("correlation")):
    try:
        with _lock:
            if _cache[metric] is None:
                _cache[metric] = _compute_terrain(metric)
        return _cache[metric]
    except Exception:
        logger.error(f"Terrain computation failed (metric={metric}):\n{traceback.format_exc()}")
        raise


@app.post("/api/terrain/refresh")
def refresh_terrain(metric: MetricType = Query("correlation")):
    try:
        with _lock:
            _cache[metric] = _compute_terrain(metric)
        return _cache[metric]
    except Exception:
        logger.error(f"Terrain refresh failed (metric={metric}):\n{traceback.format_exc()}")
        raise


def _compute_timelapse(windows: int, window_size: int) -> dict:
    logger.info(f"Starting timelapse computation: windows={windows}, window_size={window_size}")

    closes, metadata = fetch_stock_data()
    logger.info(f"Fetched {closes.shape[1]} stocks, {closes.shape[0]} days")

    rolling = compute_rolling_distances(closes, window_size=window_size, num_windows=windows)
    logger.info(f"Computed {len(rolling)} rolling distance matrices")

    # Run UMAP for each window
    tickers = list(rolling[0][2].columns)
    from umap import UMAP
    raw_embeddings = []
    for start_date, end_date, dist in rolling:
        reducer = UMAP(
            n_components=2,
            metric="precomputed",
            n_neighbors=min(5, len(tickers) - 1),
            min_dist=0.3,
            random_state=42,
        )
        emb = reducer.fit_transform(dist.values)
        raw_embeddings.append(emb)

    # Align embeddings with Procrustes
    aligned = align_embeddings(raw_embeddings)
    logger.info("Aligned embeddings with Procrustes")

    # Build terrain for each snapshot
    snapshots = []
    shared_faces = None
    shared_grid_res = None
    shared_z_range = None

    for i, (start_date, end_date, _dist) in enumerate(rolling):
        emb = aligned[i]
        positions = {ticker: (float(emb[j, 0]), float(emb[j, 1])) for j, ticker in enumerate(tickers)}
        terrain = build_terrain(positions, metadata)

        if shared_faces is None:
            shared_faces = terrain["faces"]
            shared_grid_res = terrain["gridResolution"]
            shared_z_range = terrain["zRange"]

        snapshots.append({
            "vertices": terrain["vertices"],
            "stocks": terrain["stocks"],
            "startDate": start_date,
            "endDate": end_date,
        })

    logger.info(f"Built {len(snapshots)} timelapse snapshots")

    return {
        "faces": shared_faces,
        "gridResolution": shared_grid_res,
        "zRange": shared_z_range,
        "snapshots": snapshots,
    }


@app.get("/api/terrain/timelapse")
def get_timelapse(
    windows: int = Query(12, ge=2, le=24),
    window_size: int = Query(90, ge=30, le=180),
):
    cache_key = f"{windows}_{window_size}"
    try:
        with _timelapse_lock:
            if cache_key not in _timelapse_cache:
                _timelapse_cache[cache_key] = _compute_timelapse(windows, window_size)
        return _timelapse_cache[cache_key]
    except Exception:
        logger.error(f"Timelapse computation failed:\n{traceback.format_exc()}")
        raise


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "cached": {k: v is not None for k, v in _cache.items()},
    }
