import { useFrame } from "@react-three/fiber";

export function TimelapseAnimator({ tick }: { tick: (delta: number) => void }) {
  useFrame((_, delta) => tick(delta));
  return null;
}
