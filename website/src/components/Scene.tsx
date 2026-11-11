"use client";

import { Suspense, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Cloud, Clouds, calcPosFromAngles } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

const SUN_INCLINATION = 0.515;
const SUN_AZIMUTH = 0.2;

const terrainNoise = createNoise2D();
function terrainHeight(x: number, z: number) {
  return (
    terrainNoise(x * 0.012, z * 0.012) * 4.2 +
    terrainNoise(x * 0.05, z * 0.05) * 1.1 +
    terrainNoise(x * 0.16, z * 0.16) * 0.28 +
    terrainNoise(x * 0.45, z * 0.45) * 0.07
  );
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const subscribeReducedMotion = (onChange: () => void) => {
  const mq = window.matchMedia(reducedMotionQuery);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const getReducedMotion = () => window.matchMedia(reducedMotionQuery).matches;

function useReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
}

function CameraRig({ reduced }: { reduced: boolean }) {
  const camera = useThree((state) => state.camera);
  const look = useRef(new THREE.Vector3(0, 0.6, -60));
  useEffect(() => {
    camera.lookAt(look.current);
  }, [camera]);
  useFrame((state, delta) => {
    if (reduced) return;
    const cam = state.camera;
    const target = look.current;
    const t = state.clock.elapsedTime;
    const k = 1 - Math.exp(-delta * 2.2);
    const tx = Math.sin(t * 0.12) * 2.4 + state.pointer.x * 2.6;
    const ty = 2.3 + Math.sin(t * 0.21) * 0.35 + state.pointer.y * 0.9;
    const tz = 11 + Math.sin(t * 0.09) * 1.6;
    cam.position.x += (tx - cam.position.x) * k;
    cam.position.y += (ty - cam.position.y) * k;
    cam.position.z += (tz - cam.position.z) * k;
    target.x += (state.pointer.x * 5 - target.x) * k;
    target.y += (0.6 + state.pointer.y * 2 - target.y) * k;
    cam.lookAt(target);
    cam.rotation.z = Math.sin(t * 0.17) * 0.018;
  });
  return null;
}

function Terrain() {
  const geometry = useMemo(() => {
    const size = 340;
    const seg = 320;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const dark = new THREE.Color("#0e5e24");
    const mid = new THREE.Color("#1fa33a");
    const light = new THREE.Color("#b9e848");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      const t = THREE.MathUtils.clamp((h + 4) / 7, 0, 1);
      const c = t < 0.5 ? dark.clone().lerp(mid, t * 2) : mid.clone().lerp(light, (t - 0.5) * 2);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} position={[0, -3, -60]}>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  );
}

function Mountains() {
  const peaks = useMemo(() => {
    const arr: { position: [number, number, number]; radius: number; height: number; rot: number; idx: number }[] = [];
    let seed = 7;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 64; i++) {
      const layer = i % 4;
      const x = (rand() - 0.5) * (360 + layer * 80);
      const z = -90 - layer * 32 - rand() * 50;
      const radius = 16 + rand() * 24 + layer * 3;
      const height = 24 + rand() * 38 + layer * 10;
      arr.push({ position: [x, -3, z], radius, height, rot: rand() * Math.PI, idx: i });
    }
    return arr;
  }, []);

  const geometries = useMemo(() => {
    const noise2D = createNoise2D();
    const rock = new THREE.Color("#3f5a85");
    const mid = new THREE.Color("#6f89c2");
    const ridge = new THREE.Color("#e8f1fb");
    return peaks.map((m) => {
      const geo = new THREE.ConeGeometry(m.radius, m.height, 9, 5);
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const n = noise2D(x * 0.09 + m.idx * 13.1, z * 0.09 + m.idx * 7.7);
        const jitter = 1 + n * 0.16;
        pos.setX(i, x * jitter);
        pos.setZ(i, z * jitter);
        const t = THREE.MathUtils.clamp((y + m.height / 2) / m.height, 0, 1);
        const ridged = Math.pow(t, 2.4) + Math.max(0, n) * 0.12;
        const c =
          ridged < 0.55
            ? rock.clone().lerp(mid, ridged / 0.55)
            : mid.clone().lerp(ridge, (ridged - 0.55) / 0.45);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      return geo;
    });
  }, [peaks]);

  return (
    <group>
      {peaks.map((m, i) => (
        <mesh key={i} geometry={geometries[i]} position={m.position} rotation={[0, m.rot, 0]}>
          <meshStandardMaterial vertexColors flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

const CLOUD_CONFIG = Array.from({ length: 34 }, (_, i) => {
  const r = (n: number) => {
    const s = Math.sin((i + 1) * 127.1 + n * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  return {
    start: (r(1) - 0.5) * 180,
    speed: 0.5 + r(2) * 1.4,
    y: 16 + r(3) * 30,
    z: -90 - r(4) * 110,
    scale: 0.8 + r(5) * 1.4,
  };
});

function CloudBank({ reduced }: { reduced: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([]);

  useFrame((state) => {
    if (reduced) return;
    CLOUD_CONFIG.forEach((c, i) => {
      const r = refs.current[i];
      if (!r) return;
      const x = c.start + state.clock.elapsedTime * c.speed;
      r.position.x = ((x + 90) % 180) - 90;
    });
  });

  return (
    <Clouds limit={500} range={100}>
      {CLOUD_CONFIG.map((c, i) => (
        <Cloud
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          seed={i + 1}
          segments={30}
          bounds={[14, 2.6, 4]}
          volume={12}
          color="#ffffff"
          fade={100}
          opacity={0.9}
          position={[c.start, c.y, c.z]}
          scale={c.scale}
        />
      ))}
    </Clouds>
  );
}

const BIRD_COUNT = 260;
const BIRDS = Array.from({ length: BIRD_COUNT }, (_, i) => {
  const r = (n: number) => {
    const s = Math.sin((i + 1) * 91.7 + n * 173.3) * 43758.5453;
    return s - Math.floor(s);
  };
  const flock = i % 6;
  return {
    startX: (r(1) - 0.5) * 220,
    y: 5 + flock * 2.2 + r(2) * 4,
    z: -12 - flock * 9 - r(3) * 18,
    speed: 1.2 + r(4) * 2.4 + flock * 0.15,
    phase: r(5) * Math.PI * 2,
    size: 0.7 + r(6) * 0.9,
  };
});

function Birds({ reduced }: { reduced: boolean }) {
  const left = useRef<THREE.InstancedMesh>(null);
  const right = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    const l = left.current;
    const rt = right.current;
    if (!l || !rt) return;
    const t = reduced ? 0 : state.clock.elapsedTime;
    for (let i = 0; i < BIRD_COUNT; i++) {
      const b = BIRDS[i];
      const x = ((b.startX + t * b.speed + 110) % 220) - 110;
      const y = b.y + Math.sin(t * 0.6 + b.phase) * 0.6;
      const flap = reduced ? 0 : Math.sin(t * (8 + b.speed * 1.5) + b.phase) * 0.55;
      const bank = reduced ? 0 : Math.sin(t * 0.4 + b.phase) * 0.15;
      dummy.scale.setScalar(b.size);
      dummy.position.set(x - 0.15 * b.size, y, b.z);
      dummy.rotation.set(0, 0, 0.5 + flap + bank);
      dummy.updateMatrix();
      l.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x + 0.15 * b.size, y, b.z);
      dummy.rotation.set(0, 0, -0.5 - flap + bank);
      dummy.updateMatrix();
      rt.setMatrixAt(i, dummy.matrix);
    }
    l.instanceMatrix.needsUpdate = true;
    rt.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={left} args={[undefined, undefined, BIRD_COUNT]} frustumCulled={false}>
        <boxGeometry args={[0.5, 0.03, 0.08]} />
        <meshBasicMaterial color="#232a33" />
      </instancedMesh>
      <instancedMesh ref={right} args={[undefined, undefined, BIRD_COUNT]} frustumCulled={false}>
        <boxGeometry args={[0.5, 0.03, 0.08]} />
        <meshBasicMaterial color="#232a33" />
      </instancedMesh>
    </>
  );
}

const PARTICLE_COUNT = 2600;

function Particles({ reduced }: { reduced: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const col = new Float32Array(PARTICLE_COUNT * 3);
    const warm = new THREE.Color("#ffe9a8");
    const cool = new THREE.Color("#bfe6ff");
    const c = new THREE.Color();
    let seed = 42;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3] = (rand() - 0.5) * 120;
      pos[i * 3 + 1] = rand() * 30 - 2;
      pos[i * 3 + 2] = 14 - rand() * 110;
      c.copy(warm).lerp(cool, rand());
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return geo;
  }, []);

  useFrame((state) => {
    const p = ref.current;
    if (!p || reduced) return;
    const t = state.clock.elapsedTime;
    p.position.y = Math.sin(t * 0.25) * 0.8;
    p.position.x = Math.sin(t * 0.07) * 3;
    p.rotation.y = Math.sin(t * 0.05) * 0.12;
  });

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.22}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

function SunGlow({ position }: { position: [number, number, number] }) {
  const glowColor = useMemo(() => new THREE.Color(4.5, 3.4, 1.3), []);
  return (
    <mesh position={position}>
      <sphereGeometry args={[11, 32, 32]} />
      <meshBasicMaterial color={glowColor} toneMapped={false} />
    </mesh>
  );
}

export default function Scene() {
  const reduced = useReducedMotion();
  const sunPosition = useMemo(() => calcPosFromAngles(SUN_INCLINATION, SUN_AZIMUTH), []);
  const lightPosition = useMemo(
    () => sunPosition.clone().multiplyScalar(80).toArray() as [number, number, number],
    [sunPosition]
  );
  const sunGlowPosition = useMemo(
    () => sunPosition.clone().multiplyScalar(160).toArray() as [number, number, number],
    [sunPosition]
  );
  return (
    <Canvas
      eventSource={typeof document === "undefined" ? undefined : document.body}
      eventPrefix="client"
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
      camera={{ position: [0, 2.3, 11], fov: 55, near: 0.5, far: 700 }}
      style={{ position: "fixed", inset: 0, zIndex: 0 }}
    >
      <CameraRig reduced={reduced} />
      <fog attach="fog" args={["#4fb0f5", 40, 330]} />
      <ambientLight intensity={0.9} />
      <hemisphereLight args={["#5fc0ff", "#3fb050", 1.0]} />
      <directionalLight position={lightPosition} intensity={2.0} color="#ffe2a0" />
      <SunGlow position={sunGlowPosition} />
      <Suspense fallback={null}>
        <CloudBank reduced={reduced} />
      </Suspense>
      <Mountains />
      <Terrain />
      <Birds reduced={reduced} />
      <Particles reduced={reduced} />
      <EffectComposer>
        <Bloom intensity={1.4} luminanceThreshold={0.22} luminanceSmoothing={0.4} mipmapBlur />
        <Vignette eskil={false} offset={0.2} darkness={0.55} />
      </EffectComposer>
    </Canvas>
  );
}
