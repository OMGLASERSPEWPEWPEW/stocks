import { Html } from "@react-three/drei";
import { useState } from "react";
import type { StockPoint } from "../types";

const SECTOR_COLORS: Record<string, string> = {
  "Space Tech": "#6ea8fe",
  "Nuclear/Power": "#ff9e6d",
};

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${cap.toFixed(0)}`;
}

function StockMarker({ stock }: { stock: StockPoint }) {
  const [hovered, setHovered] = useState(false);
  const color = SECTOR_COLORS[stock.sector] || "#ffffff";
  const labelOffset = 0.06;

  return (
    <group position={[stock.x, stock.y + 0.01, stock.z]}>
      {/* Vertical pole */}
      <mesh position={[0, labelOffset / 2, 0]}>
        <cylinderGeometry args={[0.003, 0.003, labelOffset, 4]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Sphere at top */}
      <mesh
        position={[0, labelOffset, 0]}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Label */}
      <Html
        position={[0, labelOffset + 0.03, 0]}
        center
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            color: "white",
            background: hovered ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.5)",
            padding: hovered ? "6px 10px" : "2px 6px",
            borderRadius: "4px",
            fontSize: hovered ? "13px" : "11px",
            fontFamily: "monospace",
            whiteSpace: "nowrap",
            borderLeft: `3px solid ${color}`,
            transition: "all 0.15s ease",
          }}
        >
          <strong>{stock.ticker}</strong>
          {hovered && (
            <div style={{ fontSize: "11px", opacity: 0.85, marginTop: "2px" }}>
              {formatMarketCap(stock.marketCap)}
              <br />
              {stock.sector}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

export function StockLabels({ stocks }: { stocks: StockPoint[] }) {
  return (
    <group>
      {stocks.map((s) => (
        <StockMarker key={s.ticker} stock={s} />
      ))}
    </group>
  );
}
