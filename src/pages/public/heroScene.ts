/**
 * The public pages' hero scene: one keycap field, five formations.
 *
 * The landing page has a full 3D keyboard that morphs into terrain. Repeating
 * that on twelve content pages would be both slow and boring, so this is the
 * same visual language at a fraction of the cost: the same rounded keycap
 * geometry, the same palette and lighting as landing3d.ts, arranged as a field
 * that behaves differently per page. A reader moving from the home page to
 * /curriculum should feel they are in the same world, not on a different site.
 *
 * Everything is one InstancedMesh, so the whole field is a single draw call
 * whatever the formation. It is imported dynamically by PublicHero, never at
 * module scope, because these pages are also rendered to static HTML in Node.
 */

import * as THREE from 'three';

export type Formation = 'wave' | 'terrace' | 'scatter' | 'stream' | 'calm';

export interface HeroOpts {
  formation: Formation;
  /** Primary hue the field tints toward. */
  hue: string;
  /** Second light, for the colour separation the landing uses. */
  hue2: string;
}

/** The five world colours, matching the curriculum and the landing's regions. */
const WORLDS = ['#14d8c4', '#6fe3b6', '#8b7cff', '#ffb454', '#f2789f'];

const COLS = 18;
const ROWS = 6;
const GAP_X = 1.16;
const GAP_Z = 1.12;

function hashN(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** The landing's keycap: a rounded square, extruded and bevelled, laid flat. */
function keycapGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const r = 0.16;
  const s = 0.44;
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s); shape.absarc(s - r, -s + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(s, s - r); shape.absarc(s - r, s - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-s + r, s); shape.absarc(-s + r, s - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-s, -s + r); shape.absarc(-s + r, -s + r, r, Math.PI, Math.PI * 1.5, false);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.4, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 5,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

interface Cell {
  x: number; z: number; col: number; row: number;
  dist: number; phase: number; rnd: number;
  band: number;
}

export interface HeroHandle {
  start(): void;
  stop(): void;
  /** 0 at the top of the hero, 1 once it has scrolled away. */
  setScroll(p: number): void;
  dispose(): void;
}

export function createHeroScene(canvas: HTMLCanvasElement, opts: HeroOpts, staticMode: boolean): HeroHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(new THREE.Color('#0b1020'), 11, 26);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);

  const geo = keycapGeometry();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.44, metalness: 0.22 });
  const count = COLS * ROWS;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const hue = new THREE.Color(opts.hue);
  const surface = new THREE.Color('#1a2244');
  const cells: Cell[] = [];
  const colour = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = (col - (COLS - 1) / 2) * GAP_X;
    const z = (row - (ROWS - 1) / 2) * GAP_Z;
    // Five bands across the field, which is what the terrace formation climbs.
    const band = Math.min(WORLDS.length - 1, Math.floor((col / COLS) * WORLDS.length));
    cells.push({
      x, z, col, row,
      dist: Math.hypot(x, z),
      phase: hashN(i + 7) * Math.PI * 2,
      rnd: hashN(i),
      band,
    });

    colour.copy(surface).lerp(new THREE.Color('#242e59'), hashN(i) * 0.8);
    if (opts.formation === 'terrace') {
      colour.lerp(new THREE.Color(WORLDS[band]), 0.26);
    } else {
      colour.lerp(hue, 0.06 + hashN(i + 31) * 0.14);
    }
    mesh.setColorAt(i, colour);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);

  scene.add(new THREE.AmbientLight(0xbfd0ff, 0.5));
  const dir = new THREE.DirectionalLight(0xffffff, 1.05);
  dir.position.set(4, 9, 6);
  scene.add(dir);
  const lightA = new THREE.PointLight(new THREE.Color(opts.hue), 22, 20, 1.9);
  lightA.position.set(-5, 3.2, 2);
  scene.add(lightA);
  const lightB = new THREE.PointLight(new THREE.Color(opts.hue2), 18, 20, 1.9);
  lightB.position.set(5, 3.2, -2);
  scene.add(lightB);

  const dummy = new THREE.Object3D();
  let raf = 0;
  let running = false;
  let disposed = false;
  let last = 0;
  let t = 0;
  let scroll = 0;

  /** Per-formation height and tilt for one cell at time `t`. */
  function pose(c: Cell): { y: number; rx: number; rz: number; x: number } {
    switch (opts.formation) {
      case 'wave':
        // A ripple leaving the middle of the field, which is where the two
        // anchor keys sit on a real keyboard.
        return { y: Math.sin(t * 1.5 - c.dist * 0.62) * 0.42, rx: 0, rz: 0, x: c.x };
      case 'terrace':
        // Five plateaus climbing away: the five worlds of the curriculum.
        return { y: c.band * 0.46 + Math.sin(t * 0.6 + c.phase) * 0.06, rx: 0, rz: 0, x: c.x };
      case 'scatter':
        return {
          y: c.rnd * 1.1 + Math.sin(t * 0.9 + c.phase) * 0.3,
          rx: Math.sin(t * 0.5 + c.phase) * 0.34,
          rz: Math.cos(t * 0.42 + c.phase) * 0.28,
          x: c.x,
        };
      case 'stream': {
        // The field drifts sideways and wraps, so the page reads as motion
        // along a track rather than a static grid.
        const span = COLS * GAP_X;
        const x = ((c.x + t * 1.5 + span / 2) % span + span) % span - span / 2;
        return { y: Math.sin(t * 1.1 + c.phase) * 0.14, rx: 0, rz: 0, x };
      }
      default:
        return { y: Math.sin(t * 0.66 + c.phase) * 0.17, rx: 0, rz: 0, x: c.x };
    }
  }

  function layout(): void {
    for (let i = 0; i < count; i++) {
      const c = cells[i];
      const p = pose(c);
      dummy.position.set(p.x, p.y, c.z);
      dummy.rotation.set(p.rx, 0, p.rz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  function applyCamera(): void {
    // The field sinks and tips away as the hero scrolls off, so the canvas
    // hands the page over rather than simply vanishing.
    camera.position.set(0, 3.4 + scroll * 2.2, 7.6 + scroll * 1.6);
    camera.lookAt(0, -0.4 - scroll * 0.8, 0);
  }

  const resize = (): void => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    if (!running && !disposed) renderer.render(scene, camera);
  };

  function frame(now: number): void {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    t += dt;
    layout();
    renderer.render(scene, camera);
  }

  resize();
  window.addEventListener('resize', resize);

  // Draw one frame immediately, always. `start()` only schedules a rAF, and a
  // tab that loads in the background, or a device that defers the first frame,
  // would otherwise show a transparent canvas until it happens to get one.
  // Reduced motion keeps this frame and never asks for another.
  t = staticMode ? 1.2 : 0;
  layout();
  applyCamera();
  renderer.render(scene, camera);

  return {
    start(): void {
      if (running || disposed || staticMode) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    stop(): void {
      running = false;
      cancelAnimationFrame(raf);
    },
    setScroll(p: number): void {
      scroll = p;
      applyCamera();
      if (!running && !disposed) renderer.render(scene, camera);
    },
    dispose(): void {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    },
  };
}
