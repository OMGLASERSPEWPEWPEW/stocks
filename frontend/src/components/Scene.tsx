import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { TerrainMesh } from "./Terrain";
import { StockLabels } from "./StockLabels";
import { TimelapseAnimator } from "./TimelapseAnimator";
import type { TerrainData } from "../types";

export function Scene({
  data,
  animate,
  timelapseTick,
}: {
  data: TerrainData;
  animate?: boolean;
  timelapseTick?: (delta: number) => void;
}) {
  return (
    <Canvas
      camera={{ position: [1.8, 1.5, 1.8], fov: 50 }}
      style={{ width: "100vw", height: "100vh", background: "#0a0a1a" }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} />
      <directionalLight position={[-3, 4, -2]} intensity={0.3} />

      <TerrainMesh data={data} animate={animate} />
      <StockLabels stocks={data.stocks} />

      {timelapseTick && <TimelapseAnimator tick={timelapseTick} />}

      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        minDistance={0.5}
        maxDistance={5}
      />
    </Canvas>
  );
}
