"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Cloud, Clouds, calcPosFromAngles } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

const SUN_INCLINATION = 0.515;
const SUN_AZIMUTH = 0.2;

const terrainNoise = createNoise2D();
function terrainHeight(x: number, z: number) {
  return terrainNoise(x * 0.012, z * 0.012) * 3.4 + terrainNoise(x * 0.05, z * 0.05) * 0.7;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function CameraRig() {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(0, 0.6, -60);
  }, [camera]);
  return null;
}

function Terrain() {
  const geometry = useMemo(() => {
    const size = 240;
    const seg = 110;
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
    for (let i = 0; i < 16; i++) {
      const x = (rand() - 0.5) * 320;
      const z = -95 - rand() * 55;
      const radius = 18 + rand() * 20;
      const height = 22 + rand() * 30;
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

const CLOUD_CONFIG = [
  { start: -40, speed: 1.1, y: 27, z: -130, scale: 1.4 },
  { start: 10, speed: 0.7, y: 34, z: -155, scale: 1.8 },
  { start: -5, speed: 1.6, y: 23, z: -115, scale: 1.0 },
  { start: 35, speed: 0.9, y: 31, z: -165, scale: 1.5 },
  { start: 55, speed: 1.3, y: 29, z: -140, scale: 1.2 },
  { start: -70, speed: 0.8, y: 20, z: -120, scale: 0.9 },
  { start: 80, speed: 1.0, y: 37, z: -175, scale: 1.6 },
  { start: -20, speed: 1.4, y: 32, z: -150, scale: 1.1 },
  { start: 100, speed: 0.6, y: 25, z: -135, scale: 1.3 },
];

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
    <Clouds limit={150} range={100}>
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

const BIRD_CONFIG = [
  { startX: -50, y: 9, z: -25, speed: 2.2 },
  { startX: -70, y: 10.5, z: -32, speed: 1.6 },
  { startX: -40, y: 8.2, z: -20, speed: 2.8 },
  { startX: -95, y: 12, z: -40, speed: 1.9 },
  { startX: -20, y: 7.3, z: -16, speed: 3.1 },
  { startX: -115, y: 13.2, z: -46, speed: 1.3 },
  { startX: -35, y: 10.8, z: -30, speed: 2.4 },
  { startX: -80, y: 8.8, z: -22, speed: 2.0 },
];

function Birds({ reduced }: { reduced: boolean }) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const wingsL = useRef<(THREE.Mesh | null)[]>([]);
  const wingsR = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    BIRD_CONFIG.forEach((c, i) => {
      const g = groups.current[i];
      if (!g) return;
      if (!reduced) {
        const x = c.startX + t * c.speed;
        g.position.x = ((x + 70) % 140) - 70;
        g.position.y = c.y + Math.sin(t * 0.6 + i) * 0.4;
      } else {
        g.position.set(c.startX, c.y, c.z);
      }
    });
    if (!reduced) {
      const flap = Math.sin(t * 10) * 0.5;
      wingsL.current.forEach((w) => {
        if (w) w.rotation.z = 0.5 + flap;
      });
      wingsR.current.forEach((w) => {
        if (w) w.rotation.z = -0.5 - flap;
      });
    }
  });

  return (
    <>
      {BIRD_CONFIG.map((c, i) => (
        <group
          key={i}
          ref={(el) => {
            groups.current[i] = el;
          }}
          position={[c.startX, c.y, c.z]}
        >
          <mesh
            ref={(el) => {
              wingsL.current[i] = el;
            }}
            position={[-0.15, 0, 0]}
          >
            <boxGeometry args={[0.5, 0.03, 0.08]} />
            <meshBasicMaterial color="#232a33" />
          </mesh>
          <mesh
            ref={(el) => {
              wingsR.current[i] = el;
            }}
            position={[0.15, 0, 0]}
          >
            <boxGeometry args={[0.5, 0.03, 0.08]} />
            <meshBasicMaterial color="#232a33" />
          </mesh>
        </group>
      ))}
    </>
  );
}

function SunGlow({ position }: { position: [number, number, number] }) {
  const glowColor = useMemo(() => new THREE.Color(4.5, 3.4, 1.3), []);
  return (
    <mesh position={position}>
      <sphereGeometry args={[7, 24, 24]} />
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
      dpr={[1, 1.6]}
      gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
      camera={{ position: [0, 2.3, 11], fov: 55, near: 0.5, far: 500 }}
      style={{ position: "fixed", inset: 0, zIndex: 0 }}
    >
      <CameraRig />
      <fog attach="fog" args={["#4fb0f5", 35, 250]} />
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
      <EffectComposer>
        <Bloom intensity={0.7} luminanceThreshold={0.3} luminanceSmoothing={0.3} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
