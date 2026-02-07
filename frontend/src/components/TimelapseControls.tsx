import type { TimelapseState } from "../hooks/useTimelapse";

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function TimelapseControls({
  state,
  onClose,
}: {
  state: TimelapseState;
  onClose: () => void;
}) {
  const {
    isPlaying,
    currentFrame,
    speed,
    totalFrames,
    startDate,
    endDate,
    togglePlayPause,
    seekTo,
    setSpeed,
  } = state;

  return (
    <div style={container}>
      {/* Date label */}
      <div style={dateLabel}>
        {formatDate(startDate)} &mdash; {formatDate(endDate)}
      </div>

      {/* Transport controls */}
      <div style={controls}>
        <button
          style={btn}
          onClick={() => seekTo(Math.max(0, currentFrame - 1))}
          title="Previous frame"
        >
          &#9664;&#9664;
        </button>
        <button style={{ ...btn, fontSize: "16px" }} onClick={togglePlayPause}>
          {isPlaying ? "\u23F8" : "\u25B6"}
        </button>
        <button
          style={btn}
          onClick={() => seekTo((currentFrame + 1) % totalFrames)}
          title="Next frame"
        >
          &#9654;&#9654;
        </button>
      </div>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={totalFrames - 1}
        value={currentFrame}
        onChange={(e) => seekTo(Number(e.target.value))}
        style={scrubber}
      />

      {/* Speed + Close */}
      <div style={bottomRow}>
        <div style={speedGroup}>
          {[0.5, 1, 2].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              style={{
                ...speedBtn,
                background:
                  speed === s ? "rgba(110,168,254,0.3)" : "transparent",
                borderColor:
                  speed === s ? "#6ea8fe" : "rgba(255,255,255,0.2)",
              }}
            >
              {s}x
            </button>
          ))}
        </div>
        <button style={closeBtn} onClick={onClose} title="Exit timelapse">
          &#10005;
        </button>
      </div>
    </div>
  );
}

const container: React.CSSProperties = {
  position: "fixed",
  bottom: 20,
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(0,0,0,0.7)",
  backdropFilter: "blur(8px)",
  padding: "12px 20px",
  borderRadius: "10px",
  color: "white",
  fontFamily: "monospace",
  fontSize: "12px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "8px",
  zIndex: 20,
  minWidth: "280px",
};

const dateLabel: React.CSSProperties = {
  color: "#6ea8fe",
  fontWeight: "bold",
  fontSize: "13px",
};

const controls: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
};

const btn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "4px",
  color: "white",
  padding: "4px 10px",
  cursor: "pointer",
  fontFamily: "monospace",
  fontSize: "12px",
};

const scrubber: React.CSSProperties = {
  width: "100%",
  accentColor: "#6ea8fe",
  cursor: "pointer",
};

const bottomRow: React.CSSProperties = {
  display: "flex",
  width: "100%",
  justifyContent: "space-between",
  alignItems: "center",
};

const speedGroup: React.CSSProperties = {
  display: "flex",
  gap: "4px",
};

const speedBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "4px",
  color: "white",
  padding: "2px 8px",
  cursor: "pointer",
  fontFamily: "monospace",
  fontSize: "11px",
};

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "4px",
  color: "#ff6b6b",
  padding: "2px 8px",
  cursor: "pointer",
  fontFamily: "monospace",
  fontSize: "13px",
};
