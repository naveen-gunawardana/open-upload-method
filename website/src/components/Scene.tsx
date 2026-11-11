"use client";

import { Suspense, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Cloud, Clouds } from "@react-three/drei";
import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { useTheme } from "@/components/ThemeProvider";

const terrainNoise = createNoise2D();
const mountainNoise = createNoise2D();
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

const subscribeVisibility = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};
const getVisible = () => document.visibilityState !== "hidden";

function RenderCadence({ active }: { active: boolean }) {
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    invalidate();
    if (!active) return;
    const timer = window.setInterval(() => invalidate(), 1000 / 30);
    return () => window.clearInterval(timer);
  }, [active, invalidate]);
  return null;
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
    const k = 1 - Math.exp(-Math.min(delta, 0.05) * 2.2);
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

function Terrain({ dark }: { dark: boolean }) {
  const geometry = useMemo(() => {
    const size = 340;
    const seg = 96;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const low = new THREE.Color(dark ? "#05231c" : "#12632b");
    const mid = new THREE.Color(dark ? "#0b4030" : "#299f43");
    const light = new THREE.Color(dark ? "#2e7053" : "#9cdb56");
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      const t = THREE.MathUtils.clamp((h + 4) / 7, 0, 1);
      if (t < 0.5) c.copy(low).lerp(mid, t * 2); else c.copy(mid).lerp(light, (t - 0.5) * 2);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [dark]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} position={[0, -3, -60]}>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  );
}

function Mountains({ dark }: { dark: boolean }) {
  const peaks = useMemo(() => {
    const arr: { position: [number, number, number]; radius: number; height: number; rot: number; idx: number }[] = [];
    let seed = 7;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 24; i++) {
      const layer = i % 3;
      const x = (rand() - 0.5) * (360 + layer * 80);
      const z = -90 - layer * 32 - rand() * 50;
      const radius = 16 + rand() * 24 + layer * 3;
      const height = 24 + rand() * 38 + layer * 10;
      arr.push({ position: [x, -3, z], radius, height, rot: rand() * Math.PI, idx: i });
    }
    return arr;
  }, []);

  const geometries = useMemo(() => {
    const noise2D = mountainNoise;
    const rock = new THREE.Color(dark ? "#111d35" : "#667fa0");
    const mid = new THREE.Color(dark ? "#253c60" : "#94b4d1");
    const ridge = new THREE.Color(dark ? "#879cc0" : "#eff6ff");
    const c = new THREE.Color();
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
        if (ridged < 0.55) c.copy(rock).lerp(mid, ridged / 0.55);
        else c.copy(mid).lerp(ridge, (ridged - 0.55) / 0.45);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      return geo;
    });
  }, [peaks, dark]);
  useEffect(() => () => geometries.forEach(geometry => geometry.dispose()), [geometries]);

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

const CLOUD_CONFIG = Array.from({ length: 10 }, (_, i) => {
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

function CloudBank({ reduced, dark }: { reduced: boolean; dark: boolean }) {
  const refs = useRef<(THREE.Group | null)[]>([]);

  useFrame((state) => {
    if (reduced) return;
    CLOUD_CONFIG.forEach((c, i) => {
      const r = refs.current[i];
      if (!r) return;
      const x = c.start + state.clock.elapsedTime * c.speed * 0.3;
      r.position.x = ((x + 90) % 180) - 90;
    });
  });

  return (
    <Clouds limit={128} range={96}>
      {CLOUD_CONFIG.map((c, i) => (
        <Cloud
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          seed={i + 1}
          segments={12}
          bounds={[14, 2.6, 4]}
          volume={8}
          color={dark ? "#6a7ba3" : "#ffffff"}
          fade={160}
          opacity={dark ? 0.16 : 0.65}
          position={[c.start, c.y, c.z]}
          scale={c.scale}
        />
      ))}
    </Clouds>
  );
}

const BIRD_COUNT = 18;
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

function Birds({ reduced, dark }: { reduced: boolean; dark: boolean }) {
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
        <meshBasicMaterial color={dark ? "#101a2e" : "#415775"} />
      </instancedMesh>
      <instancedMesh ref={right} args={[undefined, undefined, BIRD_COUNT]} frustumCulled={false}>
        <boxGeometry args={[0.5, 0.03, 0.08]} />
        <meshBasicMaterial color={dark ? "#101a2e" : "#415775"} />
      </instancedMesh>
    </>
  );
}

const PARTICLE_COUNT = 480;

const STAR_VERTEX = `
  attribute vec3 aStarColor;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uAttenuation;
  uniform float uMaxSize;
  varying vec3 vStarColor;
  varying float vTwinkle;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    float perspective = mix(1.0, 42.0 / max(1.0, -viewPosition.z), uAttenuation);
    float variation = mix(0.45, 1.65, pow(fract(aSeed * 3.17), 4.0));
    gl_PointSize = clamp(uSize * uPixelRatio * perspective * variation, 1.5, uMaxSize);
    vStarColor = aStarColor;
    vTwinkle = 0.74 + 0.26 * sin(uTime * (0.25 + fract(aSeed) * 0.6) + aSeed * 6.28318);
  }
`;

// A luminous core with four tapered rays, rather than square point sprites.
const STAR_FRAGMENT = `
  uniform float uOpacity;
  varying vec3 vStarColor;
  varying float vTwinkle;
  void main() {
    vec2 p = (gl_PointCoord - 0.5) * 2.0;
    float radius = length(p);
    float core = exp(-18.0 * radius * radius);
    float horizontal = exp(-150.0 * p.y * p.y) * pow(max(0.0, 1.0 - abs(p.x)), 2.8);
    float vertical = exp(-150.0 * p.x * p.x) * pow(max(0.0, 1.0 - abs(p.y)), 2.8);
    float halo = exp(-5.0 * radius * radius) * 0.1;
    float alpha = clamp(core * 0.85 + max(horizontal, vertical) * 0.8 + halo, 0.0, 1.0);
    alpha *= uOpacity * vTwinkle;
    if (alpha < 0.012) discard;
    gl_FragColor = vec4(vStarColor * 1.8, alpha);
  }
`;

function StarMaterial({ reduced, size, attenuation, opacity, maxSize }: {
  reduced: boolean; size: number; attenuation: number; opacity: number; maxSize: number;
}) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uPixelRatio: { value: 1 }, uSize: { value: size },
    uAttenuation: { value: attenuation }, uOpacity: { value: opacity }, uMaxSize: { value: maxSize },
  }), [size, attenuation, opacity, maxSize]);
  useFrame(state => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = reduced ? 0 : state.clock.elapsedTime;
    material.current.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
  });
  return <shaderMaterial ref={material} uniforms={uniforms} vertexShader={STAR_VERTEX} fragmentShader={STAR_FRAGMENT}
    transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />;
}

function NightStars({ reduced }: { reduced: boolean }) {
  const geometry = useMemo(() => {
    const count = 720;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const color = new THREE.Color();
    const silver = new THREE.Color("#e6eeff"), lavender = new THREE.Color("#b8b7fa");
    let seed = 197;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (random() - 0.5) * 1100;
      positions[i * 3 + 1] = 20 + random() * 420;
      positions[i * 3 + 2] = -180 - random() * 360;
      color.copy(silver).lerp(lavender, random());
      colors.set([color.r, color.g, color.b], i * 3);
      seeds[i] = random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aStarColor", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return geo;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <points geometry={geometry} frustumCulled={false}>
    <StarMaterial reduced={reduced} size={2.7} attenuation={0} opacity={0.85} maxSize={7} />
  </points>;
}

function Particles({ reduced, dark }: { reduced: boolean; dark: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const col = new Float32Array(PARTICLE_COUNT * 3);
    const seeds = new Float32Array(PARTICLE_COUNT);
    const warm = new THREE.Color(dark ? "#d2c4ff" : "#fff3c2");
    const cool = new THREE.Color(dark ? "#c1eaff" : "#d4eafc");
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
      seeds[i] = rand() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aStarColor", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    return geo;
  }, [dark]);
  useEffect(() => () => geometry.dispose(), [geometry]);

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
      <StarMaterial reduced={reduced} size={3.4} attenuation={1} opacity={dark ? 0.55 : 0.22} maxSize={14} />
    </points>
  );
}

function CelestialBody({ dark }: { dark: boolean }) {
  const x = useThree(state => -Math.min(105, 75 * state.size.width / Math.max(1, state.size.height)));
  const halo = useMemo(() => ({ uTint: { value: new THREE.Color(dark ? "#8198f0" : "#ffdb8f") } }), [dark]);
  return (
    <group position={[dark ? x : -x, 63, -210]}>
    <mesh position={[0, 0, -1]}>
      <planeGeometry args={[64, 64]} />
      <shaderMaterial transparent depthWrite={false} uniforms={halo}
        vertexShader={`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        fragmentShader={`uniform vec3 uTint; varying vec2 vUv; void main() { float r = length((vUv - 0.5) * 2.0); if (r > 1.0) discard; gl_FragColor = vec4(uTint, exp(-5.0 * r * r) * 0.16); }`} />
    </mesh>
    {dark ? <mesh>
      <planeGeometry args={[23, 23]} />
      <shaderMaterial transparent depthWrite toneMapped={false}
        vertexShader={`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        fragmentShader={`
          varying vec2 vUv;
          void main() {
            vec2 p = (vUv - 0.5) * 2.0;
            float radius = length(p);
            if (radius > 1.0) discard;
            vec3 normal = vec3(p, sqrt(max(0.0, 1.0 - radius * radius)));
            float phase = smoothstep(-0.06, 0.12, dot(normal, normalize(vec3(-0.95, 0.15, -0.25))));
            float grain = fract(sin(dot(floor(vUv * 150.0), vec2(12.9898, 78.233))) * 43758.5453);
            float craters = 0.12 * (1.0 - smoothstep(0.12, 0.22, length(p - vec2(-0.3, 0.25))))
              + 0.09 * (1.0 - smoothstep(0.08, 0.16, length(p - vec2(-0.5, -0.3))));
            vec3 earthshine = vec3(0.035, 0.055, 0.105);
            vec3 moonlight = vec3(1.35, 1.5, 1.8) * (0.91 + grain * 0.09 - craters);
            float edge = 1.0 - smoothstep(0.985, 1.0, radius);
            gl_FragColor = vec4(mix(earthshine, moonlight, phase), edge);
          }
        `} />
    </mesh> : <mesh><sphereGeometry args={[9, 24, 16]} /><meshBasicMaterial color="#ffedb7" toneMapped={false} /></mesh>}
    </group>
  );
}

export default function Scene({ paused = false }: { paused?: boolean }) {
  const dark = useTheme() === "dark";
  const reduced = useReducedMotion();
  const visible = useSyncExternalStore(subscribeVisibility, getVisible, () => true);
  return (
    <Canvas
      eventSource={typeof document === "undefined" ? undefined : document.body}
      eventPrefix="client"
      frameloop="demand"
      dpr={[1, 1.25]}
      gl={{ antialias: false, alpha: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
      camera={{ position: [0, 2.3, 11], fov: 55, near: 0.5, far: 700 }}
      style={{ position: "fixed", inset: 0, zIndex: 0 }}
    >
      <RenderCadence active={!paused && visible && !reduced} />
      <CameraRig reduced={reduced} />
      <fog attach="fog" args={[dark ? "#10172e" : "#88cefa", 42, 390]} />
      <ambientLight intensity={dark ? 0.35 : 0.8} />
      <hemisphereLight args={[dark ? "#7c91c9" : "#c7e6ff", dark ? "#07101f" : "#79aa54", dark ? 0.6 : 0.85]} />
      <directionalLight position={[-80, 100, 30]} intensity={dark ? 1.2 : 1.5} color={dark ? "#bbd3ff" : "#fff0d3"} />
      {dark && <NightStars reduced={reduced} />}
      <CelestialBody dark={dark} />
      <Suspense fallback={null}>
        <CloudBank reduced={reduced} dark={dark} />
      </Suspense>
      <Mountains dark={dark} />
      <Terrain dark={dark} />
      <Birds reduced={reduced} dark={dark} />
      <Particles reduced={reduced} dark={dark} />
    </Canvas>
  );
}
