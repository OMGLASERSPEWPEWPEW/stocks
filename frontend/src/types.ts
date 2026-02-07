export type MetricType = "correlation" | "institutional" | "news";

export interface StockPoint {
  ticker: string;
  x: number;
  y: number; // height
  z: number; // depth
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
