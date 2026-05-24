"use client";

import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  AdaptiveDpr,
  CameraControls,
  ContactShadows,
  Environment,
  Html,
  Lightformer,
  Sparkles,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, DepthOfField, EffectComposer, Noise, SSAO, Vignette } from "@react-three/postprocessing";
import type { AtlasMapV1Response } from "@atlas/shared";
import { Nodes } from "./Nodes";
import { SceneConnections, SceneRegions } from "./SceneLayers";
import { Surface } from "./Surface";
import { type QualityPreference, useQuality } from "./use-quality";

interface SoundMapSceneProps {
  payload: AtlasMapV1Response;
  selectedId: string | null;
  selectedSceneId: string | null;
  hoveredId: string | null;
  hoveredSceneId: string | null;
  highlightedIds: Set<string>;
  nowPlayingId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  onHoverScene: (id: string | null) => void;
  onSelectScene: (id: string | null) => void;
  onClearSelection: () => void;
}

function QualityPanel({
  quality,
  nodeCount,
}: {
  quality: ReturnType<typeof useQuality>;
  nodeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const options: QualityPreference[] = ["auto", "high", "med", "low"];

  return (
    <div className="absolute right-4 top-4 z-20 flex items-start gap-2">
      {open ? (
        <div className="rounded-2xl border border-white/10 bg-[rgba(10,16,28,0.76)] px-3 py-3 text-[11px] text-slate-100/82 backdrop-blur-xl shadow-[0_24px_60px_rgba(2,8,20,0.42)]">
          <div className="flex items-center gap-2">
            <span className="font-medium uppercase tracking-[0.22em] text-slate-200/62">Display</span>
            <div className="flex gap-1">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`rounded-full px-2 py-1 uppercase transition ${
                    quality.preference === option
                      ? "bg-white/18 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.14)]"
                      : "bg-white/8 text-slate-200/72 hover:bg-white/12"
                  }`}
                  onClick={() => quality.setPreference(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-slate-200/45">
            {quality.mode} fidelity · {quality.usePoints ? "points" : "instanced"} renderer · {nodeCount} nodes
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className="rounded-full border border-white/12 bg-[rgba(10,16,28,0.56)] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.24em] text-slate-100/68 backdrop-blur-md transition hover:border-white/18 hover:bg-[rgba(10,16,28,0.74)] hover:text-white/90"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "Hide Display" : "Display"}
      </button>
    </div>
  );
}

function PerfHud({ nodeCount, mode, renderMode }: { nodeCount: number; mode: string; renderMode: string }) {
  const { gl } = useThree();
  const [stats, setStats] = useState({ calls: 0, triangles: 0, points: 0 });

  useFrame((_, delta) => {
    if (delta <= 0) return;
    setStats((current) => {
      const next = {
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        points: gl.info.render.points,
      };
      if (
        current.calls === next.calls &&
        current.triangles === next.triangles &&
        current.points === next.points
      ) {
        return current;
      }
      return next;
    });
  });

  if (process.env.NEXT_PUBLIC_ATLAS_DEBUG !== "1") return null;

  return (
    <Html position={[0, 0, 0]} fullscreen>
      <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-white/20 bg-black/55 px-2.5 py-1.5 font-mono text-[10px] text-white/70 backdrop-blur">
        <div>nodes={nodeCount}</div>
        <div>mode={mode}</div>
        <div>renderer={renderMode}</div>
        <div>calls={stats.calls}</div>
        <div>tris={stats.triangles}</div>
        <div>points={stats.points}</div>
      </div>
    </Html>
  );
}

function DirectedEnvironment() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={["#17110d"]} />
      <Lightformer
        intensity={2.2}
        color="#fff2de"
        position={[0, 14, -24]}
        rotation={[0.35, 0, 0]}
        scale={[24, 10, 1]}
        form="rect"
      />
      <Lightformer
        intensity={1.3}
        color="#ffb66e"
        position={[-18, 9, 16]}
        rotation={[0, Math.PI / 4, 0]}
        scale={[18, 12, 1]}
        form="rect"
      />
      <Lightformer
        intensity={0.9}
        color="#ffe5c1"
        position={[22, 6, 18]}
        rotation={[0, -Math.PI / 3, 0]}
        scale={[14, 8, 1]}
        form="ring"
      />
      <Lightformer intensity={1.2} color="#ff8a2a" position={[0, 24, 0]} scale={[6, 18, 1]} form="ring" />
    </Environment>
  );
}

function AuthoredCamera() {
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    controlsRef.current?.setLookAt(0, 168, 264, 0, -8, 8, true);
  }, []);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      smoothTime={0.9}
      draggingSmoothTime={0.16}
      minDistance={132}
      maxDistance={620}
      minPolarAngle={0.48}
      maxPolarAngle={1.34}
      dollySpeed={0.55}
      truckSpeed={0.85}
    />
  );
}

function SceneContent({
  payload,
  selectedId,
  selectedSceneId,
  hoveredId,
  hoveredSceneId,
  highlightedIds,
  nowPlayingId,
  onHover,
  onSelect,
  onHoverScene,
  onSelectScene,
  quality,
}: SoundMapSceneProps & { quality: ReturnType<typeof useQuality> }) {
  const worldSize = payload.world.world_size;

  const mapNodes = useMemo(
    () => (
      <Nodes
        tracks={payload.tracks}
        worldSize={worldSize}
        usePoints={quality.usePoints}
        selectedId={selectedId}
        selectedSceneId={selectedSceneId}
        hoveredId={hoveredId}
        nowPlayingId={nowPlayingId}
        highlightedIds={highlightedIds}
        onHover={onHover}
        onSelect={onSelect}
      />
    ),
    [
      highlightedIds,
      hoveredId,
      nowPlayingId,
      onHover,
      onSelect,
      payload.tracks,
      quality.usePoints,
      selectedId,
      selectedSceneId,
      worldSize,
    ]
  );

  const composerEffects = useMemo(() => {
    const effects: ReactElement[] = [];

    if (quality.enableSsao) {
      effects.push(
        <SSAO
          key="ssao"
          samples={10}
          radius={0.14}
          intensity={18}
          luminanceInfluence={0.2}
          color="#05080f"
          worldDistanceThreshold={0.9}
          worldDistanceFalloff={0.2}
          worldProximityThreshold={0.02}
          worldProximityFalloff={0.0025}
        />
      );
    }

    if (quality.enableBloom) {
      effects.push(
        <Bloom
          key="bloom"
          intensity={0.95}
          luminanceThreshold={0.28}
          luminanceSmoothing={0.24}
          mipmapBlur
          radius={0.72}
        />
      );
    }

    if (quality.enableDepthOfField) {
      effects.push(
        <DepthOfField
          key="dof"
          focusDistance={0.018}
          focalLength={0.024}
          bokehScale={2.1}
          height={480}
        />
      );
    }

    if (quality.enableNoise) {
      effects.push(<Noise key="noise" opacity={0.018} />);
    }

    if (quality.enableVignette) {
      effects.push(<Vignette key="vignette" eskil={false} offset={0.2} darkness={0.74} />);
    }

    return effects;
  }, [
    quality.enableBloom,
    quality.enableDepthOfField,
    quality.enableNoise,
    quality.enableSsao,
    quality.enableVignette,
  ]);

  return (
    <>
      <color attach="background" args={["#120d0a"]} />
      <fog attach="fog" args={["#16100c", 170, 2000]} />

      <ambientLight intensity={0.34} color="#f6ebdb" />

      <directionalLight
        castShadow
        position={[220, 290, 160]}
        intensity={1.08}
        color="#fff0df"
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={10}
        shadow-camera-far={900}
        shadow-camera-left={-320}
        shadow-camera-right={320}
        shadow-camera-top={320}
        shadow-camera-bottom={-320}
      />

      <directionalLight position={[-260, 120, 240]} intensity={0.4} color="#ffcf9d" />
      <directionalLight position={[0, 150, -320]} intensity={0.34} color="#e7b982" />
      <pointLight position={[0, 44, -80]} intensity={13} distance={480} color="#ff8b2c" />
      <pointLight position={[0, 26, 130]} intensity={10} distance={320} color="#ffe7c9" />
      <DirectedEnvironment />

      <Sparkles
        count={quality.sparklesCount}
        size={5}
        scale={[worldSize * 0.78, 150, worldSize * 0.78]}
        position={[0, 38, 0]}
        speed={0.12}
        opacity={0.18}
        color="#fff3e2"
      />

      <Surface worldSize={worldSize} scenes={payload.scenes} />

      <SceneConnections
        scenes={payload.scenes}
        edges={payload.scene_graph_edges}
        worldSize={worldSize}
        selectedSceneId={selectedSceneId}
        hoveredSceneId={hoveredSceneId}
      />

      <SceneRegions
        scenes={payload.scenes}
        worldSize={worldSize}
        selectedSceneId={selectedSceneId}
        hoveredSceneId={hoveredSceneId}
        onHoverScene={onHoverScene}
        onSelectScene={onSelectScene}
      />

      {mapNodes}

      <ContactShadows
        position={[0, -8, 0]}
        opacity={0.34}
        scale={Math.max(900, worldSize * 0.95)}
        blur={2.6}
        far={220}
        resolution={512}
        color="#362114"
      />

      {(quality.enableSsao || composerEffects.length > 0) && (
        <EffectComposer
          enableNormalPass={quality.enableSsao}
          multisampling={quality.mode === "high" ? 4 : 0}
          resolutionScale={quality.enableSsao ? quality.ssaoResolutionScale : undefined}
        >
          {composerEffects}
        </EffectComposer>
      )}

      <AuthoredCamera />
      <AdaptiveDpr pixelated />
    </>
  );
}

export function SoundMapScene(props: SoundMapSceneProps) {
  const quality = useQuality(props.payload.tracks.length);
  const renderMode = quality.usePoints ? "points" : "instanced";

  return (
    <div className="relative h-[min(78vh,920px)] min-h-[560px] overflow-hidden rounded-[30px] border border-[#3b2818] bg-[radial-gradient(circle_at_18%_4%,rgba(255,255,255,0.08),transparent_22%),radial-gradient(circle_at_50%_112%,rgba(255,122,26,0.18),transparent_32%),radial-gradient(circle_at_82%_12%,rgba(255,229,193,0.08),transparent_18%),linear-gradient(180deg,#1b140f_0%,#150f0c_46%,#0f0a08_100%)] shadow-[0_36px_110px_rgba(42,22,8,0.34)]">
      <QualityPanel quality={quality} nodeCount={props.payload.tracks.length} />

      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_100%,rgba(255,122,26,0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_16%,transparent_74%,rgba(14,8,4,0.5))]" />
      <div className="pointer-events-none absolute inset-0 z-10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),inset_0_0_180px_rgba(20,12,7,0.6)]" />

      <Canvas
        dpr={quality.dpr}
        camera={{ position: [0, 168, 264], fov: 40, near: 0.1, far: 5000 }}
        shadows
        onPointerMissed={(event) => {
          if ((event as { type?: string }).type === "click") {
            props.onClearSelection();
          }
        }}
      >
        <SceneContent {...props} quality={quality} />
        <PerfHud
          nodeCount={props.payload.tracks.length}
          mode={quality.mode}
          renderMode={renderMode}
        />
      </Canvas>
    </div>
  );
}
