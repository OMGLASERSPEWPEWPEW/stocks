import yfinance as yf
import pandas as pd
import numpy as np
import logging
from typing import Dict, List, Tuple
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger("stock-terrain")

SPACE_TECH = ["ASTS", "RKLB", "LUNR", "SPCE", "BKSY", "PL", "IRDM", "GSAT"]
NUCLEAR_POWER = ["OKLO", "NNE", "SMR", "VST", "CEG", "TLN", "CCJ", "LEU", "UEC"]

SECTORS = {
    **{t: "Space Tech" for t in SPACE_TECH},
    **{t: "Nuclear/Power" for t in NUCLEAR_POWER},
}

ALL_TICKERS = SPACE_TECH + NUCLEAR_POWER


def fetch_stock_data(tickers: List[str] = ALL_TICKERS, period: str = "1y") -> Tuple[pd.DataFrame, Dict]:
    """Fetch historical closes and current metadata for tickers."""
    data = yf.download(tickers, period=period, auto_adjust=True, progress=False)

    # yfinance >=1.x returns MultiIndex columns: (Price, Ticker)
    if isinstance(data.columns, pd.MultiIndex):
        closes = data["Close"]
    else:
        closes = data[["Close"]].rename(columns={"Close": tickers[0]}) if len(tickers) == 1 else data["Close"]

    closes = closes.dropna(axis=1, how="all").dropna()

    metadata = {}
    for ticker in closes.columns:
        info = yf.Ticker(ticker).fast_info
        metadata[ticker] = {
            "ticker": ticker,
            "sector": SECTORS.get(ticker, "Unknown"),
            "market_cap": getattr(info, "market_cap", None),
        }

    return closes, metadata


def compute_log_returns(closes: pd.DataFrame) -> pd.DataFrame:
    return np.log(closes / closes.shift(1)).dropna()


def compute_correlation_matrix(returns: pd.DataFrame) -> pd.DataFrame:
    return returns.corr()


def correlation_to_distance(corr: pd.DataFrame) -> pd.DataFrame:
    """Mantegna distance: d_ij = sqrt(2 * (1 - corr_ij))."""
    return np.sqrt(2 * (1 - corr))


def compute_institutional_distance(tickers: List[str] = ALL_TICKERS) -> pd.DataFrame:
    """Compute distance matrix based on Jaccard similarity of institutional holders."""
    holder_sets: Dict[str, set] = {}
    for t in tickers:
        try:
            holders_df = yf.Ticker(t).institutional_holders
            if holders_df is not None and not holders_df.empty:
                # Use the 'Holder' column for institution names
                col = "Holder" if "Holder" in holders_df.columns else holders_df.columns[0]
                holder_sets[t] = set(holders_df[col].dropna().str.strip().str.lower())
            else:
                holder_sets[t] = set()
        except Exception as e:
            logger.warning(f"Failed to fetch institutional holders for {t}: {e}")
            holder_sets[t] = set()

    n = len(tickers)
    dist = np.zeros((n, n))
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            a, b = holder_sets[tickers[i]], holder_sets[tickers[j]]
            union = a | b
            if len(union) == 0:
                dist[i, j] = 1.0
            else:
                jaccard = len(a & b) / len(union)
                dist[i, j] = 1.0 - jaccard

    return pd.DataFrame(dist, index=tickers, columns=tickers)


def compute_rolling_distances(
    closes: pd.DataFrame,
    window_size: int = 90,
    num_windows: int = 12,
) -> List[Tuple[str, str, pd.DataFrame]]:
    """Compute distance matrices over evenly-spaced rolling windows.

    Returns list of (start_date, end_date, distance_matrix) tuples.
    """
    total_days = len(closes)
    if total_days < window_size:
        raise ValueError(f"Not enough data: {total_days} days < window_size {window_size}")

    # Evenly space window start indices across available range
    max_start = total_days - window_size
    if num_windows == 1:
        starts = [max_start]
    else:
        starts = [int(round(i * max_start / (num_windows - 1))) for i in range(num_windows)]

    results = []
    for start in starts:
        end = start + window_size
        window_closes = closes.iloc[start:end]
        start_date = str(window_closes.index[0].date())
        end_date = str(window_closes.index[-1].date())

        returns = compute_log_returns(window_closes)
        corr = compute_correlation_matrix(returns)
        dist = correlation_to_distance(corr)
        results.append((start_date, end_date, dist))

    return results


def compute_news_distance(tickers: List[str] = ALL_TICKERS) -> pd.DataFrame:
    """Compute distance matrix based on news co-occurrence (cosine similarity).

    Falls back to return correlation distance if insufficient news data.
    """
    # Collect news articles per ticker
    ticker_articles: Dict[str, List[dict]] = {}
    for t in tickers:
        try:
            news = yf.Ticker(t).news
            ticker_articles[t] = news if news else []
        except Exception as e:
            logger.warning(f"Failed to fetch news for {t}: {e}")
            ticker_articles[t] = []

    # Build a set of all unique article identifiers (use link or title as key)
    all_articles: Dict[str, set] = {}  # article_key -> set of tickers mentioned
    for t in tickers:
        for article in ticker_articles[t]:
            title = article.get("title", "")
            link = article.get("link", article.get("url", title))
            key = link if link else title
            if not key:
                continue
            # Check which tickers appear in this article's text
            text = (title + " " + article.get("summary", article.get("description", ""))).upper()
            if key not in all_articles:
                # Find all tickers mentioned in this article
                mentioned = set()
                for ticker in tickers:
                    if ticker.upper() in text:
                        mentioned.add(ticker)
                all_articles[key] = mentioned
            else:
                all_articles[key].add(t)

    # Build co-occurrence matrix
    n = len(tickers)
    ticker_idx = {t: i for i, t in enumerate(tickers)}
    cooccurrence = np.zeros((n, n))
    for _key, mentioned in all_articles.items():
        mentioned_list = [t for t in mentioned if t in ticker_idx]
        for i, t1 in enumerate(mentioned_list):
            for t2 in mentioned_list[i + 1:]:
                cooccurrence[ticker_idx[t1], ticker_idx[t2]] += 1
                cooccurrence[ticker_idx[t2], ticker_idx[t1]] += 1

    # Check if we have enough data
    if cooccurrence.sum() == 0:
        logger.warning("No news co-occurrence data found, falling back to return correlation")
        closes, _ = fetch_stock_data(tickers)
        returns = compute_log_returns(closes)
        corr = compute_correlation_matrix(returns)
        return correlation_to_distance(corr)

    # Add self-occurrence counts (diagonal) for cosine similarity
    for i in range(n):
        cooccurrence[i, i] = len(ticker_articles[tickers[i]])

    # Cosine similarity of co-occurrence vectors
    sim = cosine_similarity(cooccurrence)
    sim = np.clip(sim, 0, 1)
    dist = 1.0 - sim
    np.fill_diagonal(dist, 0.0)

    return pd.DataFrame(dist, index=tickers, columns=tickers)
