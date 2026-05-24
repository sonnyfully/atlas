import { Html, Line } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { AtlasMapSceneV1, AtlasSceneGraphEdgeV1 } from "@atlas/shared";
import { getSurfaceHeight } from "./Surface";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashUnit(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

interface SceneRegionsProps {
  scenes: AtlasMapSceneV1[];
  worldSize: number;
  selectedSceneId: string | null;
  hoveredSceneId: string | null;
  onHoverScene: (id: string | null) => void;
  onSelectScene: (id: string | null) => void;
}

interface SceneConnectionsProps {
  scenes: AtlasMapSceneV1[];
  edges: AtlasSceneGraphEdgeV1[];
  worldSize: number;
  selectedSceneId: string | null;
  hoveredSceneId: string | null;
}

interface SceneMeta {
  scene: AtlasMapSceneV1;
  label: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  innerRadius: number;
  hazeHeight: number;
  color: ReturnType<typeof makeSceneColor>;
  rimColor: ReturnType<typeof makeSceneColor>;
  phase: number;
}

function makeSceneColor(hue: number, saturation: number, lightness: number) {
  return new THREE.Color(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
}

function buildSceneMeta(scenes: AtlasMapSceneV1[], worldSize: number): SceneMeta[] {
  const centerOffset = worldSize * 0.5;

  return scenes.map((scene, index) => {
    const x = scene.centroid_pos.x - centerOffset;
    const z = scene.centroid_pos.y - centerOffset;
    const warmth = 24 + hashUnit(scene.id) * 12;
    const saturation = 78 - hashUnit(`${scene.id}:sat`) * 10;
    const lightness = 56 + hashUnit(`${scene.id}:light`) * 8;
    const color = makeSceneColor(warmth, saturation, lightness);
    const rimColor = color.clone().lerp(new THREE.Color("#eff7ff"), 0.28);
    const radius = clamp(54 + Math.sqrt(Math.max(scene.size, 1)) * 19, 68, 196);

    return {
      scene,
      label: scene.name?.trim() || `Scene ${index + 1}`,
      x,
      y: getSurfaceHeight(x, z) + 0.9,
      z,
      radius,
      innerRadius: radius * 0.44,
      hazeHeight: clamp(radius * 0.18, 10, 24),
      color,
      rimColor,
      phase: hashUnit(scene.id) * Math.PI * 2,
    };
  });
}

export function SceneRegions({
  scenes,
  worldSize,
  selectedSceneId,
  hoveredSceneId,
  onHoverScene,
  onSelectScene,
}: SceneRegionsProps) {
  const sceneMeta = useMemo(() => buildSceneMeta(scenes, worldSize), [scenes, worldSize]);
  const glowRefs = useRef<any[]>([]);
  const hazeRefs = useRef<any[]>([]);
  const ringRefs = useRef<any[]>([]);
  const crownRefs = useRef<any[]>([]);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    for (let i = 0; i < sceneMeta.length; i += 1) {
      const meta = sceneMeta[i];
      const isSelected = meta.scene.id === selectedSceneId;
      const isHovered = meta.scene.id === hoveredSceneId;
      const pulse = 1 + Math.sin(elapsed * 0.42 + meta.phase) * (isSelected ? 0.06 : 0.03);

      const glow = glowRefs.current[i];
      if (glow) {
        glow.scale.set(pulse, 1, pulse);
        const material = glow.material as any;
        material.opacity = isSelected ? 0.2 : isHovered ? 0.14 : 0.09;
      }

      const haze = hazeRefs.current[i];
      if (haze) {
        const hazePulse = 1 + Math.sin(elapsed * 0.55 + meta.phase) * (isSelected ? 0.08 : 0.04);
        haze.scale.set(hazePulse, 1, hazePulse);
        const material = haze.material as any;
        material.opacity = isSelected ? 0.13 : isHovered ? 0.09 : 0.05;
      }

      const ring = ringRefs.current[i];
      if (ring) {
        const ringPulse = 1 + Math.sin(elapsed * 0.88 + meta.phase) * (isSelected ? 0.07 : 0.035);
        ring.scale.set(ringPulse, 1, ringPulse);
        const material = ring.material as any;
        material.opacity = isSelected ? 0.62 : isHovered ? 0.3 : 0.14;
      }

      const crown = crownRefs.current[i];
      if (crown) {
        crown.position.y = meta.y + meta.hazeHeight * 0.3 + Math.sin(elapsed * 0.7 + meta.phase) * 0.8;
        crown.scale.setScalar(isSelected ? 1.08 : isHovered ? 1.02 : 1);
      }
    }
  });

  const activeSceneId = selectedSceneId ?? hoveredSceneId;
  const activeScene = activeSceneId ? sceneMeta.find((meta) => meta.scene.id === activeSceneId) ?? null : null;

  return (
    <>
      {sceneMeta.map((meta, index) => {
        const isSelected = meta.scene.id === selectedSceneId;
        const isHovered = meta.scene.id === hoveredSceneId;

        return (
          <group key={meta.scene.id}>
            <mesh
              ref={(node: any) => {
                glowRefs.current[index] = node;
              }}
              position={[meta.x, meta.y, meta.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              renderOrder={1}
            >
              <circleGeometry args={[meta.radius, 84]} />
              <meshBasicMaterial
                color={meta.color}
                transparent
                opacity={isSelected ? 0.2 : isHovered ? 0.14 : 0.09}
                depthWrite={false}
                toneMapped={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>

            <mesh
              ref={(node: any) => {
                hazeRefs.current[index] = node;
              }}
              position={[meta.x, meta.y + meta.hazeHeight * 0.4, meta.z]}
              scale={[1, 0.24, 1]}
              renderOrder={2}
            >
              <sphereGeometry args={[meta.radius * 0.54, 28, 18]} />
              <meshBasicMaterial
                color={meta.color.clone().lerp(new THREE.Color("#d6e8ff"), 0.12)}
                transparent
                opacity={isSelected ? 0.13 : isHovered ? 0.09 : 0.05}
                depthWrite={false}
                toneMapped={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>

            <mesh position={[meta.x, meta.y + 0.08, meta.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
              <circleGeometry args={[meta.innerRadius, 60]} />
              <meshBasicMaterial
                color={meta.color.clone().lerp(new THREE.Color("#ecf6ff"), 0.16)}
                transparent
                opacity={isSelected ? 0.22 : 0.1}
                depthWrite={false}
                toneMapped={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>

            <mesh
              ref={(node: any) => {
                ringRefs.current[index] = node;
              }}
              position={[meta.x, meta.y + 0.12, meta.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              renderOrder={4}
            >
              <ringGeometry args={[meta.radius * 0.88, meta.radius * 0.98, 96]} />
              <meshBasicMaterial
                color={meta.rimColor}
                transparent
                opacity={isSelected ? 0.62 : isHovered ? 0.3 : 0.14}
                depthWrite={false}
                toneMapped={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>

            <group
              ref={(node: any) => {
                crownRefs.current[index] = node;
              }}
              position={[meta.x, meta.y + meta.hazeHeight * 0.3, meta.z]}
            >
              <mesh renderOrder={5}>
                <cylinderGeometry args={[0.8, 2.1, meta.hazeHeight * 0.7, 18]} />
                <meshBasicMaterial
                  color={meta.rimColor}
                  transparent
                  opacity={isSelected ? 0.26 : isHovered ? 0.16 : 0.08}
                  toneMapped={false}
                />
              </mesh>
              <mesh position={[0, meta.hazeHeight * 0.4, 0]} renderOrder={6}>
                <sphereGeometry args={[2.8, 18, 18]} />
                <meshBasicMaterial
                  color="#f3fbff"
                  transparent
                  opacity={isSelected ? 0.9 : isHovered ? 0.56 : 0.22}
                  toneMapped={false}
                />
              </mesh>
            </group>

            <mesh
              position={[meta.x, meta.y + 0.2, meta.z]}
              rotation={[-Math.PI / 2, 0, 0]}
              renderOrder={7}
              onPointerMove={(event: ThreeEvent<PointerEvent>) => {
                event.stopPropagation();
                onHoverScene(meta.scene.id);
              }}
              onPointerOut={(event: ThreeEvent<PointerEvent>) => {
                event.stopPropagation();
                onHoverScene(null);
              }}
              onClick={(event: ThreeEvent<MouseEvent>) => {
                event.stopPropagation();
                onSelectScene(meta.scene.id);
              }}
            >
              <circleGeometry args={[meta.radius * 1.08, 48]} />
              <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
            </mesh>
          </group>
        );
      })}

      {activeScene ? (
        <Html position={[activeScene.x, activeScene.y + activeScene.hazeHeight + 12, activeScene.z]} center distanceFactor={10}>
          <div className="pointer-events-none rounded-full border border-[#ebcfa8] bg-[rgba(255,248,239,0.88)] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-[#8b5a22] backdrop-blur-md shadow-[0_18px_40px_rgba(109,67,23,0.18)]">
            {activeScene.label}
          </div>
        </Html>
      ) : null}
    </>
  );
}

export function SceneConnections({
  scenes,
  edges,
  worldSize,
  selectedSceneId,
  hoveredSceneId,
}: SceneConnectionsProps) {
  const sceneMeta = useMemo(() => buildSceneMeta(scenes, worldSize), [scenes, worldSize]);
  const sceneById = useMemo(
    () => new Map(sceneMeta.map((meta) => [meta.scene.id, meta])),
    [sceneMeta]
  );

  const dedupedEdges = useMemo(() => {
    const map = new Map<string, AtlasSceneGraphEdgeV1>();
    for (const edge of edges) {
      const a = edge.from_scene_id < edge.to_scene_id ? edge.from_scene_id : edge.to_scene_id;
      const b = edge.from_scene_id < edge.to_scene_id ? edge.to_scene_id : edge.from_scene_id;
      const key = `${a}:${b}`;
      const previous = map.get(key);
      if (!previous || edge.weight > previous.weight) {
        map.set(key, edge);
      }
    }
    return Array.from(map.values());
  }, [edges]);

  const activeSceneId = selectedSceneId ?? hoveredSceneId;

  return (
    <>
      {dedupedEdges.map((edge) => {
        const from = sceneById.get(edge.from_scene_id);
        const to = sceneById.get(edge.to_scene_id);
        if (!from || !to) return null;

        const weight = clamp(edge.weight, 0, 1);
        const isActive =
          !!activeSceneId &&
          (edge.from_scene_id === activeSceneId || edge.to_scene_id === activeSceneId);
        const elevation = 14 + weight * 28;
        const midX = (from.x + to.x) * 0.5;
        const midZ = (from.z + to.z) * 0.5;
        const spread = hashUnit(`${edge.from_scene_id}:${edge.to_scene_id}`) - 0.5;
        const curve = new THREE.CubicBezierCurve3(
          new THREE.Vector3(from.x, from.y + 1.8, from.z),
          new THREE.Vector3(midX + spread * 36, from.y + elevation, midZ - spread * 20),
          new THREE.Vector3(midX - spread * 36, to.y + elevation, midZ + spread * 20),
          new THREE.Vector3(to.x, to.y + 1.8, to.z)
        );
        const points = curve.getPoints(40);
        const fromColor = from.color.clone().lerp(new THREE.Color("#e6f3ff"), isActive ? 0.34 : 0.12);
        const toColor = to.color.clone().lerp(new THREE.Color("#e6f3ff"), isActive ? 0.34 : 0.12);
        const glowOpacity = isActive ? 0.34 : 0.1 + weight * 0.08;
        const coreOpacity = isActive ? 0.82 : 0.28 + weight * 0.14;

        return (
          <group key={`${edge.from_scene_id}:${edge.to_scene_id}`}>
            <Line
              points={points}
              color="#b6d6ff"
              lineWidth={isActive ? 2.1 : 1.3}
              transparent
              opacity={glowOpacity}
              depthWrite={false}
              toneMapped={false}
              blending={THREE.AdditiveBlending}
            />
            <Line
              points={points}
              vertexColors={points.map((_point: any, index: number) => {
                const t = index / Math.max(points.length - 1, 1);
                return fromColor.clone().lerp(toColor, t);
              })}
              lineWidth={isActive ? 1.05 : 0.62}
              transparent
              opacity={coreOpacity}
              depthWrite={false}
              toneMapped={false}
            />
          </group>
        );
      })}
    </>
  );
}
