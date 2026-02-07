import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import type { TerrainData } from "../types";

const COLORMAP = [
  new THREE.Color("#1a472a"), // deep green (valley)
  new THREE.Color("#2d6a4f"), // green
  new THREE.Color("#74a57f"), // light green
  new THREE.Color("#c9b458"), // tan/brown
  new THREE.Color("#a0522d"), // sienna
  new THREE.Color("#8b7355"), // brown
  new THREE.Color("#b0b0b0"), // gray
  new THREE.Color("#f0f0f0"), // snow
];

function heightToColor(t: number): THREE.Color {
  const idx = t * (COLORMAP.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, COLORMAP.length - 1);
  const frac = idx - lo;
  return COLORMAP[lo].clone().lerp(COLORMAP[hi], frac);
}

function buildGeometry(data: TerrainData): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const verts = new Float32Array(data.vertices.length * 3);
  const colors = new Float32Array(data.vertices.length * 3);

  let minY = Infinity,
    maxY = -Infinity;
  for (const [, y] of data.vertices) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const yRange = maxY - minY || 1;

  for (let i = 0; i < data.vertices.length; i++) {
    const [x, y, z] = data.vertices[i];
    verts[i * 3] = x;
    verts[i * 3 + 1] = y;
    verts[i * 3 + 2] = z;

    const t = (y - minY) / yRange;
    const color = heightToColor(t);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const indices = new Uint32Array(data.faces.length * 3);
  for (let i = 0; i < data.faces.length; i++) {
    indices[i * 3] = data.faces[i][0];
    indices[i * 3 + 1] = data.faces[i][1];
    indices[i * 3 + 2] = data.faces[i][2];
  }

  geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();

  return geo;
}

export function TerrainMesh({
  data,
  animate,
}: {
  data: TerrainData;
  animate?: boolean;
}) {
  const geoRef = useRef<THREE.BufferGeometry | null>(null);

  // For static mode, rebuild geometry via useMemo
  const staticGeo = useMemo(() => {
    if (animate) return null;
    return buildGeometry(data);
  }, [data, animate]);

  // For animate mode, create geometry once and update buffers in place
  useEffect(() => {
    if (!animate) return;

    if (!geoRef.current) {
      geoRef.current = buildGeometry(data);
      return;
    }

    const geo = geoRef.current;
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    const colorAttr = geo.getAttribute("color") as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const colors = colorAttr.array as Float32Array;

    let minY = Infinity,
      maxY = -Infinity;
    for (const [, y] of data.vertices) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const yRange = maxY - minY || 1;

    for (let i = 0; i < data.vertices.length; i++) {
      const [x, y, z] = data.vertices[i];
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const t = (y - minY) / yRange;
      const color = heightToColor(t);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    geo.computeVertexNormals();
  }, [data, animate]);

  const geometry = animate ? geoRef.current : staticGeo;
  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} flatShading />
    </mesh>
  );
}
