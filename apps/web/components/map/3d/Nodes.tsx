import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { analysisToColor } from "@/lib/atlas-color";
import type { AtlasMapTrackV1 } from "@atlas/shared";
import { getSurfaceHeight } from "./Surface";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashUnit(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

interface NodesProps {
  tracks: AtlasMapTrackV1[];
  worldSize: number;
  usePoints: boolean;
  selectedId: string | null;
  selectedSceneId: string | null;
  hoveredId: string | null;
  nowPlayingId: string | null;
  highlightedIds: Set<string>;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}

interface TrackPoint {
  x: number;
  y: number;
  z: number;
}

export function Nodes({
  tracks,
  worldSize,
  usePoints,
  selectedId,
  selectedSceneId,
  hoveredId,
  nowPlayingId,
  highlightedIds,
  onHover,
  onSelect,
}: NodesProps) {
  const centerOffset = worldSize * 0.5;

  const points = useMemo<TrackPoint[]>(
    () =>
      tracks.map((track) => {
        const x = track.pos.x - centerOffset;
        const z = track.pos.y - centerOffset;
        return { x, y: getSurfaceHeight(x, z) + 1.25, z };
      }),
    [centerOffset, tracks]
  );

  const colors = useMemo(() => tracks.map((track) => analysisToColor(track.analysis, track.id)), [tracks]);
  const selectedIndex = useMemo(() => tracks.findIndex((track) => track.id === selectedId), [selectedId, tracks]);

  if (usePoints) {
    return (
      <PointsNodes
        tracks={tracks}
        points={points}
        colors={colors}
        selectedIndex={selectedIndex}
        selectedSceneId={selectedSceneId}
        highlightedIds={highlightedIds}
        onHover={onHover}
        onSelect={onSelect}
      />
    );
  }

  return (
    <InstancedNodes
      tracks={tracks}
      points={points}
      colors={colors}
      selectedId={selectedId}
      selectedSceneId={selectedSceneId}
      hoveredId={hoveredId}
      nowPlayingId={nowPlayingId}
      highlightedIds={highlightedIds}
      onHover={onHover}
      onSelect={onSelect}
    />
  );
}

function PointsNodes({
  tracks,
  points,
  colors,
  selectedIndex,
  selectedSceneId,
  highlightedIds,
  onHover,
  onSelect,
}: {
  tracks: AtlasMapTrackV1[];
  points: TrackPoint[];
  colors: any[];
  selectedIndex: number;
  selectedSceneId: string | null;
  highlightedIds: Set<string>;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}) {
  const { raycaster } = useThree();

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    const pointColors = new Float32Array(points.length * 3);

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;

      const color = colors[i].clone();
      if (highlightedIds.size > 0 && !highlightedIds.has(tracks[i].id)) {
        color.lerp(new THREE.Color("#08111a"), 0.72);
      } else if (selectedSceneId && tracks[i].scene_id !== selectedSceneId) {
        color.lerp(new THREE.Color("#08111a"), 0.58);
      }

      pointColors[i * 3] = color.r;
      pointColors[i * 3 + 1] = color.g;
      pointColors[i * 3 + 2] = color.b;
    }

    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(pointColors, 3));
    return g;
  }, [colors, highlightedIds, points, selectedSceneId, tracks]);

  useEffect(() => {
    raycaster.params.Points = { threshold: 10 };
  }, [raycaster]);

  const selected = selectedIndex >= 0 ? points[selectedIndex] : null;

  return (
    <>
      <points
        geometry={geometry}
        frustumCulled={false}
        onPointerMove={(event: any) => {
          event.stopPropagation();
          const idx = event.index ?? -1;
          onHover(idx >= 0 ? tracks[idx].id : null);
        }}
        onPointerOut={() => onHover(null)}
        onClick={(event: any) => {
          event.stopPropagation();
          const idx = event.index ?? -1;
          onSelect(idx >= 0 ? tracks[idx].id : null);
        }}
      >
        <pointsMaterial
          size={5.1}
          sizeAttenuation
          transparent
          opacity={0.92}
          depthWrite={false}
          vertexColors
          blending={THREE.AdditiveBlending}
        />
      </points>

      {selected ? (
        <mesh position={[selected.x, selected.y + 0.2, selected.z]}>
          <torusGeometry args={[10, 0.45, 10, 42]} />
          <meshBasicMaterial color="#d8edff" transparent opacity={0.85} toneMapped={false} />
        </mesh>
      ) : null}
    </>
  );
}

function InstancedNodes({
  tracks,
  points,
  colors,
  selectedId,
  selectedSceneId,
  hoveredId,
  nowPlayingId,
  highlightedIds,
  onHover,
  onSelect,
}: {
  tracks: AtlasMapTrackV1[];
  points: TrackPoint[];
  colors: any[];
  selectedId: string | null;
  selectedSceneId: string | null;
  hoveredId: string | null;
  nowPlayingId: string | null;
  highlightedIds: Set<string>;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}) {
  const meshRef = useRef<any>(null);
  const ringRef = useRef<any>(null);
  const beaconRef = useRef<any>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const phases = useMemo(() => tracks.map((track) => hashUnit(track.id) * Math.PI * 2), [tracks]);
  const baseScales = useMemo(
    () => tracks.map((track) => clamp(2.3 + (track.bridge_score ?? 0) * 1.2, 2.2, 4.2)),
    [tracks]
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const lowlightColor = new THREE.Color("#1b120d");
    const highlightColor = new THREE.Color("#fff2e1");

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const color = colors[i].clone();
      const hasHighlights = highlightedIds.size > 0;

      if (selectedId === track.id) {
        color.lerp(highlightColor, 0.48);
        color.multiplyScalar(1.55);
      } else if (hoveredId === track.id || nowPlayingId === track.id) {
        color.lerp(highlightColor, 0.28);
        color.multiplyScalar(1.22);
      } else if (hasHighlights) {
        if (highlightedIds.has(track.id)) {
          color.lerp(highlightColor, 0.16);
          color.multiplyScalar(1.08);
        } else {
          color.lerp(lowlightColor, 0.7);
          color.multiplyScalar(0.42);
        }
      } else if (selectedSceneId && track.scene_id !== selectedSceneId) {
        color.lerp(lowlightColor, 0.58);
        color.multiplyScalar(0.46);
      } else if (selectedSceneId && track.scene_id === selectedSceneId) {
        color.lerp(highlightColor, 0.12);
        color.multiplyScalar(1.04);
      }

      mesh.setColorAt(i, color);
    }

    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, [colors, highlightedIds, hoveredId, nowPlayingId, selectedId, selectedSceneId, tracks]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const t = state.clock.elapsedTime;
    let selectedPoint: TrackPoint | null = null;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const p = points[i];

      const pulse = 1 + Math.sin(t * 1.8 + phases[i]) * 0.08;
      const hoverBoost = track.id === hoveredId ? 1.24 : 1;
      const selectedBoost = track.id === selectedId ? 1.32 : 1;
      const playBoost = track.id === nowPlayingId ? 1.2 : 1;
      const similarBoost = highlightedIds.has(track.id) ? 1.12 : 1;
      const sceneBoost = selectedSceneId && track.scene_id === selectedSceneId ? 1.08 : 1;
      const scale = baseScales[i] * pulse * hoverBoost * selectedBoost * playBoost * similarBoost * sceneBoost;

      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      if (track.id === selectedId) {
        selectedPoint = p;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;

    const ring = ringRef.current;
    const beacon = beaconRef.current;
    if (!ring || !selectedPoint) {
      if (ring) ring.visible = false;
      if (beacon) beacon.visible = false;
      return;
    }

    ring.visible = true;
    ring.position.set(selectedPoint.x, selectedPoint.y + 0.25, selectedPoint.z);
    const ringScale = 1.04 + Math.sin(t * 2.2) * 0.04;
    ring.scale.set(ringScale, ringScale, ringScale);

    if (!beacon) return;
    beacon.visible = true;
    beacon.position.set(selectedPoint.x, selectedPoint.y + 0.9, selectedPoint.z);
    const beaconPulse = 1 + Math.sin(t * 2.4) * 0.08;
    beacon.scale.set(beaconPulse, 1 + Math.sin(t * 2) * 0.1, beaconPulse);
  });

  const handlePick = (event: any) => {
    event.stopPropagation();
    const idx = event.instanceId ?? -1;
    onSelect(idx >= 0 ? tracks[idx].id : null);
  };

  return (
    <>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, tracks.length]}
        castShadow
        frustumCulled={false}
        onPointerMove={(event: any) => {
          event.stopPropagation();
          const idx = event.instanceId ?? -1;
          onHover(idx >= 0 ? tracks[idx].id : null);
        }}
        onPointerOut={() => onHover(null)}
        onClick={handlePick}
      >
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial
          roughness={0.22}
          metalness={0.22}
          emissive="#ff9d3f"
          emissiveIntensity={0.5}
          transparent
          opacity={0.94}
        />
      </instancedMesh>

      <mesh ref={ringRef} visible={false} castShadow={false} receiveShadow={false}>
        <torusGeometry args={[10.4, 0.52, 14, 68]} />
        <meshBasicMaterial color="#ffe6c6" transparent opacity={0.88} toneMapped={false} />
      </mesh>

      <group ref={beaconRef} visible={false}>
        <mesh castShadow={false} receiveShadow={false}>
          <cylinderGeometry args={[0.18, 0.92, 12, 18]} />
          <meshBasicMaterial color="#ffd0a1" transparent opacity={0.42} toneMapped={false} />
        </mesh>
        <mesh position={[0, 5.8, 0]} castShadow={false} receiveShadow={false}>
          <sphereGeometry args={[1.45, 18, 18]} />
          <meshBasicMaterial color="#fff8ef" transparent opacity={0.92} toneMapped={false} />
        </mesh>
        <mesh position={[0, 5.8, 0]} castShadow={false} receiveShadow={false}>
          <sphereGeometry args={[3.4, 20, 20]} />
          <meshBasicMaterial color="#ffb061" transparent opacity={0.12} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}
