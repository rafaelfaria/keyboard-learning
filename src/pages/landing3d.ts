import * as THREE from 'three';
import { buildLayout } from '../lib/keyboard';

interface KeyState {
  x: number; z: number; w: number;
  y: number; vy: number; press: number;      // press anim 0..1
  phase: number;                              // idle bob phase
  baseColor: THREE.Color;
  worldColor: THREE.Color;
  worldH: number;                             // terrain height multiplier for world view
  flash: number;
}

const REGION_COLORS = {
  numbers: new THREE.Color('#ffb454'),
  top: new THREE.Color('#8b7cff'),
  home: new THREE.Color('#14d8c4'),
  bottom: new THREE.Color('#4caf7d'),
  space: new THREE.Color('#3d4a7d'),
  ctrl: new THREE.Color('#273055'),
};

function hashN(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export class KeyboardScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private mesh: THREE.InstancedMesh;
  private keys: KeyState[] = [];
  private charToIdx = new Map<string, number>();
  private dummy = new THREE.Object3D();
  private lightA: THREE.PointLight;
  private lightB: THREE.PointLight;
  private sprites: { s: THREE.Sprite; life: number }[] = [];
  private glyphCache = new Map<string, THREE.Texture>();
  private raf = 0;
  private last = 0;
  private progress = 0;    // 0 hero → 1 world map
  private pointer = { x: 0, y: 0 };
  private running = false;
  private staticMode: boolean;
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement, staticMode: boolean) {
    this.staticMode = staticMode;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    this.scene.fog = new THREE.Fog(new THREE.Color('#0b1020'), 14, 34);

    const layout = buildLayout('qwerty');
    // Build rounded-key geometry (unit key)
    const shape = new THREE.Shape();
    const r = 0.16, s = 0.44;
    shape.moveTo(-s + r, -s);
    shape.lineTo(s - r, -s); shape.absarc(s - r, -s + r, r, -Math.PI / 2, 0, false);
    shape.lineTo(s, s - r); shape.absarc(s - r, s - r, r, 0, Math.PI / 2, false);
    shape.lineTo(-s + r, s); shape.absarc(-s + r, s - r, r, Math.PI / 2, Math.PI, false);
    shape.lineTo(-s, -s + r); shape.absarc(-s + r, -s + r, r, Math.PI, Math.PI * 1.5, false);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2, curveSegments: 5 });
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.2 });
    this.mesh = new THREE.InstancedMesh(geo, mat, layout.length);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // layout rows → world positions
    const rowZ = [-2.1, -1.05, 0, 1.05, 2.1];
    const rowWidths: number[] = [0, 0, 0, 0, 0];
    for (const k of layout) rowWidths[k.row] += k.w + 0.08;
    const cursors = rowZ.map((_, i) => -rowWidths[i] / 2);

    layout.forEach((k, i) => {
      const w = k.w;
      const x = cursors[k.row] + w / 2;
      cursors[k.row] += w + 0.08;
      const z = rowZ[k.row];
      const region = k.code === 'space' ? 'space' : k.control ? 'ctrl' : k.row === 0 ? 'numbers' : k.row === 1 ? 'top' : k.row === 2 ? 'home' : 'bottom';
      const base = new THREE.Color('#1c2547').lerp(new THREE.Color('#2a3560'), hashN(i) * 0.7);
      if (region === 'home' && !k.control) base.lerp(REGION_COLORS.home, 0.16);
      const worldH = region === 'numbers' ? 1.9 + hashN(i) * 1.6
        : region === 'top' ? 1.3 + hashN(i + 60) * 1.1
        : region === 'home' ? 0.8 + hashN(i + 120) * 0.5
        : region === 'bottom' ? 1.1 + hashN(i + 180) * 0.9
        : region === 'space' ? 0.35 : 0.7 + hashN(i + 240) * 0.6;
      this.keys.push({
        x, z, w,
        y: 0, vy: 0, press: 0,
        phase: hashN(i + 7) * Math.PI * 2,
        baseColor: base,
        worldColor: REGION_COLORS[region].clone().lerp(base, 0.25),
        worldH,
        flash: 0,
      });
      if (k.base && !this.charToIdx.has(k.base)) this.charToIdx.set(k.base, i);
      if (k.shifted && !this.charToIdx.has(k.shifted.toLowerCase())) this.charToIdx.set(k.shifted.toLowerCase(), i);
      this.mesh.setColorAt(i, base);
    });
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.scene.add(this.mesh);

    // ground glow plane
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#0b1020'), transparent: true, opacity: 0.0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.4;
    this.scene.add(ground);

    this.scene.add(new THREE.AmbientLight(0xbfd0ff, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 1.15);
    dir.position.set(4, 9, 6);
    this.scene.add(dir);
    this.lightA = new THREE.PointLight(0x14d8c4, 26, 18, 1.9);
    this.lightA.position.set(-5, 3, 2);
    this.scene.add(this.lightA);
    this.lightB = new THREE.PointLight(0x8b7cff, 22, 18, 1.9);
    this.lightB.position.set(5, 3, -2);
    this.scene.add(this.lightB);

    this.resize();
    this.applyCamera();
    window.addEventListener('resize', this.resize);
    window.addEventListener('pointermove', this.onPointer, { passive: true });

    if (staticMode) {
      this.layoutKeys(0);
      this.renderer.render(this.scene, this.camera);
    } else {
      this.start();
    }
  }

  private onPointer = (e: PointerEvent) => {
    this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };

  resize = (): void => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.staticMode && !this.disposed) this.renderer.render(this.scene, this.camera);
  };

  setProgress(p: number): void {
    this.progress = Math.max(0, Math.min(1, p));
    if (this.staticMode) {
      this.applyCamera();
      this.layoutKeys(0);
      this.renderer.render(this.scene, this.camera);
    }
  }

  start(): void {
    if (this.running || this.staticMode) return;
    this.running = true;
    this.last = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.tick(t / 1000, dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  typeKey(ch: string): void {
    const idx = this.charToIdx.get(ch.toLowerCase()) ?? (ch === ' ' ? this.charToIdx.get(' ') : undefined);
    if (idx === undefined) return;
    const k = this.keys[idx];
    k.press = 1;
    k.flash = 1;
    if (!this.staticMode && /[a-z0-9]/i.test(ch)) this.spawnGlyph(ch.toUpperCase(), k.x, k.z);
  }

  private glyphTexture(ch: string): THREE.Texture {
    let t = this.glyphCache.get(ch);
    if (!t) {
      const c = document.createElement('canvas');
      c.width = c.height = 96;
      const ctx = c.getContext('2d')!;
      ctx.font = '800 64px "Manrope Variable", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(20,216,196,0.9)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#dffcf8';
      ctx.fillText(ch, 48, 52);
      t = new THREE.CanvasTexture(c);
      this.glyphCache.set(ch, t);
    }
    return t;
  }

  private spawnGlyph(ch: string, x: number, z: number): void {
    if (this.sprites.length > 22) {
      const old = this.sprites.shift();
      if (old) this.scene.remove(old.s);
    }
    const mat = new THREE.SpriteMaterial({ map: this.glyphTexture(ch), transparent: true, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.position.set(x, 1.1, z);
    s.scale.setScalar(0.9);
    this.scene.add(s);
    this.sprites.push({ s, life: 1 });
  }

  private applyCamera(): void {
    const p = this.progress;
    const ease = p * p * (3 - 2 * p);
    // hero: low dramatic front view → world: high map view
    const px = 0 + this.pointer.x * 0.7 * (1 - ease);
    const py = 5.6 + ease * 7.2 + this.pointer.y * -0.35 * (1 - ease);
    const pz = 9.6 - ease * 7.4;
    this.camera.position.set(px, py, pz);
    this.camera.lookAt(0, ease * -0.6, 0.4 - ease * 0.4);
  }

  private layoutKeys(time: number): void {
    const p = this.progress;
    const ease = p * p * (3 - 2 * p);
    const col = new THREE.Color();
    this.keys.forEach((k, i) => {
      k.press = Math.max(0, k.press - 0.065);
      k.flash = Math.max(0, k.flash - 0.03);
      const bob = this.staticMode ? 0 : Math.sin(time * 1.4 + k.phase) * 0.05 * (1 - ease);
      const pressY = -k.press * 0.22;
      const h = 1 + (k.worldH - 1) * ease;
      this.dummy.position.set(k.x, bob + pressY + (h - 1) * 0.21, k.z);
      this.dummy.scale.set(k.w, h, 1);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      col.copy(k.baseColor).lerp(k.worldColor, ease);
      if (k.flash > 0) col.lerp(new THREE.Color('#7ffcf0'), k.flash * 0.85);
      this.mesh.setColorAt(i, col);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  private tick(time: number, dt: number): void {
    this.applyCamera();
    this.layoutKeys(time);
    this.lightA.position.x = Math.sin(time * 0.5) * 6;
    this.lightA.position.z = Math.cos(time * 0.4) * 3.5;
    this.lightB.position.x = Math.cos(time * 0.35) * -6;
    this.lightB.position.z = Math.sin(time * 0.45) * -3;
    // occasional ambient shimmer
    if (Math.random() < dt * 3.2 && this.progress < 0.5) {
      const i = Math.floor(Math.random() * this.keys.length);
      this.keys[i].flash = Math.max(this.keys[i].flash, 0.5);
    }
    for (const g of this.sprites) {
      g.life -= dt * 0.7;
      g.s.position.y += dt * 1.5;
      (g.s.material as THREE.SpriteMaterial).opacity = Math.max(0, g.life);
      g.s.scale.setScalar(0.9 + (1 - g.life) * 0.5);
    }
    this.sprites = this.sprites.filter((g) => {
      if (g.life <= 0) { this.scene.remove(g.s); return false; }
      return true;
    });
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.onPointer);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.glyphCache.forEach((t) => t.dispose());
    this.renderer.dispose();
  }
}
