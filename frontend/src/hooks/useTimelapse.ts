import { useState, useCallback, useRef } from "react";
import type { TimelapseData, TerrainData, StockPoint } from "../types";

export interface TimelapseState {
  isPlaying: boolean;
  currentFrame: number;
  interpolation: number;
  speed: number;
  totalFrames: number;
  currentData: TerrainData | null;
  startDate: string;
  endDate: string;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seekTo: (frame: number) => void;
  setSpeed: (s: number) => void;
  tick: (delta: number) => void;
}

function lerpVertex(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function lerpStock(a: StockPoint, b: StockPoint, t: number): StockPoint {
  return {
    ...a,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function interpolateFrame(
  data: TimelapseData,
  frame: number,
  t: number,
): TerrainData {
  const snapA = data.snapshots[frame];
  const nextFrame = (frame + 1) % data.snapshots.length;
  const snapB = data.snapshots[nextFrame];

  const vertices = snapA.vertices.map((v, i) =>
    lerpVertex(v, snapB.vertices[i], t),
  );
  const stocks = snapA.stocks.map((s, i) =>
    lerpStock(s, snapB.stocks[i], t),
  );

  return {
    vertices,
    faces: data.faces,
    stocks,
    gridResolution: data.gridResolution,
    zRange: data.zRange,
  };
}

export function useTimelapse(data: TimelapseData | null): TimelapseState {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const frameRef = useRef(0);
  const interpRef = useRef(0);
  const [, forceUpdate] = useState(0);

  const totalFrames = data ? data.snapshots.length : 0;

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const togglePlayPause = useCallback(() => setIsPlaying((p) => !p), []);

  const seekTo = useCallback(
    (frame: number) => {
      frameRef.current = Math.max(0, Math.min(frame, totalFrames - 1));
      interpRef.current = 0;
      forceUpdate((n) => n + 1);
    },
    [totalFrames],
  );

  const tick = useCallback(
    (delta: number) => {
      if (!isPlaying || !data || totalFrames < 2) return;

      // Each frame transition takes ~2 seconds at 1x speed
      const transitionDuration = 2.0;
      interpRef.current += (delta * speed) / transitionDuration;

      if (interpRef.current >= 1) {
        interpRef.current -= 1;
        frameRef.current = (frameRef.current + 1) % totalFrames;
      }

      forceUpdate((n) => n + 1);
    },
    [isPlaying, data, totalFrames, speed],
  );

  const currentFrame = frameRef.current;
  const interpolation = interpRef.current;

  let currentData: TerrainData | null = null;
  let startDate = "";
  let endDate = "";

  if (data && totalFrames > 0) {
    currentData = interpolateFrame(data, currentFrame, interpolation);
    const snap = data.snapshots[currentFrame];
    startDate = snap.startDate;
    endDate = snap.endDate;
  }

  return {
    isPlaying,
    currentFrame,
    interpolation,
    speed,
    totalFrames,
    currentData,
    startDate,
    endDate,
    play,
    pause,
    togglePlayPause,
    seekTo,
    setSpeed,
    tick,
  };
}
