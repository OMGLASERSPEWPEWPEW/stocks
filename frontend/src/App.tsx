import { useEffect, useState, useCallback } from "react";
import { Scene } from "./components/Scene";
import { TimelapseControls } from "./components/TimelapseControls";
import { useTimelapse } from "./hooks/useTimelapse";
import type { TerrainData, MetricType, TimelapseData } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";

const TIERS: { metric: MetricType; label: string; description: string }[] = [
  { metric: "correlation", label: "Return Correlation", description: "Price movement similarity" },
  { metric: "institutional", label: "Institutional Ownership", description: "Shared fund holders" },
  { metric: "news", label: "News Co-occurrence", description: "Mentioned together in news" },
];

const PROXIMITY_TEXT: Record<MetricType, string> = {
  correlation: "return correlation",
  institutional: "institutional ownership overlap",
  news: "news co-occurrence",
};

function App() {
  const [data, setData] = useState<TerrainData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [activeMetric, setActiveMetric] = useState<MetricType>("correlation");

  // Timelapse state
  const [timelapseMode, setTimelapseMode] = useState(false);
  const [timelapseData, setTimelapseData] = useState<TimelapseData | null>(null);
  const [timelapseLoading, setTimelapseLoading] = useState(false);

  const timelapse = useTimelapse(timelapseData);

  const fetchTerrain = useCallback((metric: MetricType) => {
    const isInitial = data === null;
    if (isInitial) {
      setLoading(true);
    } else {
      setSwitching(true);
    }
    setError(null);

    fetch(`${API_URL}/api/terrain?metric=${metric}`)
      .then((r) => {
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
        setSwitching(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
        setSwitching(false);
      });
  }, [data]);

  useEffect(() => {
    fetchTerrain(activeMetric);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMetricChange = (metric: MetricType) => {
    if (metric === activeMetric) return;
    // Exit timelapse if active, then switch metric
    if (timelapseMode) {
      timelapse.pause();
      setTimelapseMode(false);
    }
    setActiveMetric(metric);
    fetchTerrain(metric);
  };

  const handleTimelapseStart = () => {
    if (timelapseLoading) return;
    setTimelapseLoading(true);

    // Timelapse is always correlation-based — switch metric to match
    if (activeMetric !== "correlation") {
      setActiveMetric("correlation");
    }

    // Fetch timelapse and static correlation terrain in parallel
    const timelapseReq = fetch(`${API_URL}/api/terrain/timelapse`).then((r) => {
      if (!r.ok) throw new Error(`API error: ${r.status}`);
      return r.json();
    });
    const correlationReq = fetch(`${API_URL}/api/terrain?metric=correlation`).then((r) => {
      if (!r.ok) throw new Error(`API error: ${r.status}`);
      return r.json();
    });

    Promise.all([timelapseReq, correlationReq])
      .then(([tlData, corrData]: [TimelapseData, TerrainData]) => {
        setData(corrData);
        setTimelapseData(tlData);
        setTimelapseMode(true);
        setTimelapseLoading(false);
        timelapse.play();
      })
      .catch((e) => {
        setError(e.message);
        setTimelapseLoading(false);
      });
  };

  const handleTimelapseClose = () => {
    timelapse.pause();
    setTimelapseMode(false);
  };

  if (loading) {
    return (
      <div style={overlay}>
        <div style={card}>
          <div style={spinner} />
          <p style={{ margin: "16px 0 0", color: "#aaa" }}>
            Fetching stock data & computing terrain...
          </p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={overlay}>
        <div style={card}>
          <p style={{ color: "#ff6b6b" }}>Error: {error}</p>
          <p style={{ color: "#888", fontSize: "13px" }}>
            Make sure the backend is running: <code>uvicorn main:app --reload</code>
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const displayData = timelapseMode && timelapse.currentData ? timelapse.currentData : data;

  return (
    <>
      <div style={{ opacity: switching ? 0.5 : 1, transition: "opacity 0.3s" }}>
        <Scene
          data={displayData}
          animate={timelapseMode}
          timelapseTick={timelapseMode ? timelapse.tick : undefined}
        />
      </div>
      <TierToggle
        activeMetric={activeMetric}
        onSelect={handleMetricChange}
        switching={switching}
        disabled={false}
      />
      <TimelapseButton
        onClick={handleTimelapseStart}
        loading={timelapseLoading}
        active={timelapseMode}
      />
      {timelapseMode && (
        <TimelapseControls state={timelapse} onClose={handleTimelapseClose} />
      )}
      {switching && (
        <div style={switchingOverlay}>
          <div style={spinner} />
          <p style={{ margin: "12px 0 0", color: "#aaa", fontSize: "13px" }}>
            Computing {TIERS.find((t) => t.metric === activeMetric)?.label} terrain...
          </p>
        </div>
      )}
      {timelapseLoading && (
        <div style={switchingOverlay}>
          <div style={spinner} />
          <p style={{ margin: "12px 0 0", color: "#aaa", fontSize: "13px" }}>
            Computing time-lapse snapshots...
          </p>
        </div>
      )}
      {error && (
        <div style={errorBanner}>
          Failed to load metric: {error}
        </div>
      )}
      {!timelapseMode && <Legend activeMetric={activeMetric} />}
    </>
  );
}

function TimelapseButton({
  onClick,
  loading,
  active,
}: {
  onClick: () => void;
  loading: boolean;
  active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || active}
      style={{
        position: "fixed",
        top: 20,
        left: 20,
        background: active ? "rgba(110,168,254,0.25)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${active ? "#6ea8fe" : "rgba(255,255,255,0.1)"}`,
        borderRadius: "6px",
        padding: "8px 14px",
        color: "white",
        fontFamily: "monospace",
        fontSize: "12px",
        cursor: loading || active ? "wait" : "pointer",
        opacity: loading ? 0.6 : 1,
        zIndex: 10,
        transition: "all 0.2s",
      }}
    >
      {loading ? "Loading..." : "Time-Lapse"}
    </button>
  );
}

function TierToggle({
  activeMetric,
  onSelect,
  switching,
  disabled,
}: {
  activeMetric: MetricType;
  onSelect: (metric: MetricType) => void;
  switching: boolean;
  disabled: boolean;
}) {
  return (
    <div style={toggleContainer}>
      {TIERS.map(({ metric, label, description }) => (
        <button
          key={metric}
          onClick={() => onSelect(metric)}
          disabled={switching || disabled}
          style={{
            ...toggleButton,
            background: activeMetric === metric ? "rgba(110,168,254,0.25)" : "rgba(255,255,255,0.05)",
            borderColor: activeMetric === metric ? "#6ea8fe" : "rgba(255,255,255,0.1)",
            opacity: switching || disabled ? 0.6 : 1,
            cursor: switching || disabled ? "not-allowed" : "pointer",
          }}
        >
          <div style={{ fontWeight: activeMetric === metric ? "bold" : "normal", fontSize: "12px" }}>
            {label}
          </div>
          <div style={{ fontSize: "10px", color: "#888", marginTop: "2px" }}>
            {description}
          </div>
        </button>
      ))}
    </div>
  );
}

function Legend({ activeMetric }: { activeMetric: MetricType }) {
  return (
    <div style={legendStyle}>
      <div style={{ fontWeight: "bold", marginBottom: "8px", fontSize: "14px" }}>
        Stock Terrain
      </div>
      <div style={{ display: "flex", gap: "12px", marginBottom: "6px" }}>
        <span>
          <span style={{ color: "#6ea8fe" }}>&#9679;</span> Space Tech
        </span>
        <span>
          <span style={{ color: "#ff9e6d" }}>&#9679;</span> Nuclear/Power
        </span>
      </div>
      <div style={{ color: "#888" }}>
        Height = market cap &middot; Proximity = {PROXIMITY_TEXT[activeMetric]}
      </div>
      <div style={{ color: "#666", marginTop: "4px" }}>
        Drag to orbit &middot; Scroll to zoom
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  width: "100vw",
  height: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#0a0a1a",
  color: "white",
  fontFamily: "monospace",
};

const card: React.CSSProperties = {
  textAlign: "center",
  padding: "32px",
};

const spinner: React.CSSProperties = {
  width: "32px",
  height: "32px",
  border: "3px solid #333",
  borderTop: "3px solid #6ea8fe",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
  margin: "0 auto",
};

const toggleContainer: React.CSSProperties = {
  position: "fixed",
  top: 20,
  right: 20,
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  zIndex: 10,
};

const toggleButton: React.CSSProperties = {
  border: "1px solid",
  borderRadius: "6px",
  padding: "8px 12px",
  color: "white",
  fontFamily: "monospace",
  textAlign: "left",
  transition: "all 0.2s",
};

const switchingOverlay: React.CSSProperties = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  textAlign: "center",
  zIndex: 20,
  background: "rgba(0,0,0,0.7)",
  padding: "24px 32px",
  borderRadius: "12px",
};

const errorBanner: React.CSSProperties = {
  position: "fixed",
  top: 20,
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(255,50,50,0.9)",
  color: "white",
  padding: "8px 16px",
  borderRadius: "6px",
  fontFamily: "monospace",
  fontSize: "13px",
  zIndex: 30,
};

const legendStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 20,
  left: 20,
  background: "rgba(0,0,0,0.7)",
  padding: "12px 16px",
  borderRadius: "8px",
  color: "white",
  fontFamily: "monospace",
  fontSize: "12px",
  zIndex: 10,
};

export default App;
