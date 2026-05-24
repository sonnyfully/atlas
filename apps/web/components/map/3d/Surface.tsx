import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { AtlasMapSceneV1 } from "@atlas/shared";

const CURVE_FACTOR = 0.00012;
const MAX_SCENE_UNIFORMS = 8;

function surfaceHeight(x: number, z: number): number {
  return -(x * x + z * z) * CURVE_FACTOR;
}

interface SurfaceProps {
  worldSize: number;
  scenes?: AtlasMapSceneV1[];
}

export function Surface({ worldSize, scenes = [] }: SurfaceProps) {
  const geometry = useMemo(() => {
    const extent = Math.max(1600, worldSize * 1.28);
    const plane = new THREE.PlaneGeometry(extent, extent, 220, 220);
    plane.rotateX(-Math.PI / 2);
    const pos = plane.attributes.position as any;

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      const radial = Math.sqrt(x * x + z * z);
      const ridgeA = Math.sin(x * 0.014) * Math.cos(z * 0.012) * 7.5;
      const ridgeB = Math.sin((x + z) * 0.022) * 3.2;
      const basin = -Math.pow(Math.min(radial / extent, 1), 2.1) * 12;

      pos.setY(i, surfaceHeight(x, z) + ridgeA + ridgeB + basin);
    }

    pos.needsUpdate = true;
    plane.computeVertexNormals();
    return plane;
  }, [worldSize]);

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#1e1510"),
      roughness: 0.84,
      metalness: 0.16,
      emissive: new THREE.Color("#3a2211"),
      emissiveIntensity: 0.34,
    });

    mat.onBeforeCompile = (shader: any) => {
      shader.uniforms.sceneCenters = { value: Array.from({ length: MAX_SCENE_UNIFORMS }, () => new THREE.Vector3()) };
      shader.uniforms.sceneRadii = { value: new Float32Array(MAX_SCENE_UNIFORMS) };
      shader.uniforms.sceneCount = { value: 0 };

      mat.userData.atlasUniforms = shader.uniforms;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vWorldPos;\nvarying vec3 vViewPositionAtlas;"
      );

      shader.vertexShader = shader.vertexShader.replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvWorldPos = worldPosition.xyz;"
      );

      shader.vertexShader = shader.vertexShader.replace(
        "#include <fog_vertex>",
        "#include <fog_vertex>\nvViewPositionAtlas = - mvPosition.xyz;"
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        [
          "#include <common>",
          "varying vec3 vWorldPos;",
          "varying vec3 vViewPositionAtlas;",
          `uniform vec3 sceneCenters[${MAX_SCENE_UNIFORMS}];`,
          `uniform float sceneRadii[${MAX_SCENE_UNIFORMS}];`,
          "uniform int sceneCount;",
        ].join("\n")
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        [
          "float contourA = 0.5 + 0.5 * sin(vWorldPos.x * 0.026 + vWorldPos.z * 0.019);",
          "float contourB = 0.5 + 0.5 * sin(vWorldPos.x * 0.013 - vWorldPos.z * 0.021);",
          "float contourC = 0.5 + 0.5 * sin((vWorldPos.x + vWorldPos.z) * 0.018);",
          "float contourMask = smoothstep(0.76, 0.995, contourA) * 0.05 + smoothstep(0.8, 0.995, contourB) * 0.032 + smoothstep(0.84, 0.996, contourC) * 0.022;",
          "float grain = sin(vWorldPos.x * 0.06) * sin(vWorldPos.z * 0.051) * 0.018;",
          "float gridX = smoothstep(0.975, 0.998, 0.5 + 0.5 * sin(vWorldPos.x * 0.017));",
          "float gridZ = smoothstep(0.975, 0.998, 0.5 + 0.5 * sin(vWorldPos.z * 0.017));",
          "float flow = 0.5 + 0.5 * sin(vWorldPos.x * 0.01 + vWorldPos.z * 0.006);",
          "float sceneInfluence = 0.0;",
          "for (int i = 0; i < 8; i++) {",
          "  if (i >= sceneCount) {",
          "    break;",
          "  }",
          "  float dist = distance(vWorldPos.xz, sceneCenters[i].xz);",
          "  float radius = max(sceneRadii[i], 1.0);",
          "  sceneInfluence += smoothstep(radius * 1.05, radius * 0.28, dist);",
          "}",
          "sceneInfluence = clamp(sceneInfluence, 0.0, 1.0);",
          "float horizon = clamp(length(vWorldPos.xz) / 1500.0, 0.0, 1.0);",
          "vec3 cartographyTint = vec3(0.052, 0.032, 0.018) + vec3(0.08, 0.048, 0.024) * sceneInfluence;",
          "vec3 routeTint = vec3(0.11, 0.064, 0.028) * (gridX + gridZ) * 0.4;",
          "float viewingDepth = smoothstep(80.0, 480.0, length(vViewPositionAtlas));",
          "gl_FragColor.rgb += cartographyTint * (0.5 + flow * 0.35);",
          "gl_FragColor.rgb += vec3(contourMask + grain);",
          "gl_FragColor.rgb += routeTint;",
          "gl_FragColor.rgb += vec3(sceneInfluence * 0.07 + horizon * 0.016 + viewingDepth * 0.01);",
          "#include <dithering_fragment>",
        ].join("\n")
      );
    };

    return mat;
  }, []);

  useEffect(() => {
    const uniforms = material.userData.atlasUniforms;
    if (!uniforms) return;

    const centers = uniforms.sceneCenters.value as any[];
    const radii = uniforms.sceneRadii.value as Float32Array;
    const centerOffset = worldSize * 0.5;

    centers.forEach((center) => center.set(0, 0, 0));
    radii.fill(0);

    const relevantScenes = scenes.slice(0, MAX_SCENE_UNIFORMS);
    relevantScenes.forEach((scene, index) => {
      const x = scene.centroid_pos.x - centerOffset;
      const z = scene.centroid_pos.y - centerOffset;
      centers[index].set(x, getSurfaceHeight(x, z), z);
      radii[index] = Math.min(200, Math.max(56, 40 + Math.sqrt(Math.max(scene.size, 1)) * 18));
    });

    uniforms.sceneCount.value = relevantScenes.length;
  }, [material, scenes, worldSize]);

  return <mesh geometry={geometry} material={material} receiveShadow />;
}

export function getSurfaceHeight(x: number, z: number): number {
  const radial = Math.sqrt(x * x + z * z);
  const ridgeA = Math.sin(x * 0.014) * Math.cos(z * 0.012) * 7.5;
  const ridgeB = Math.sin((x + z) * 0.022) * 3.2;
  const basin = -Math.pow(Math.min(radial / 1700, 1), 2.1) * 12;
  return surfaceHeight(x, z) + ridgeA + ridgeB + basin;
}
