/* Tank Flow Simulator: the 3D view and the controls.
 * The water itself is simulated in worker.js (sim.js); this file draws the tank, the equipment and thousands of
 * small streaks carried by the flow, colours the slow water red, and lets you edit and save setups. */
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { FlowSim } from './sim.js';

const IN = 2.54, GAL = 3.785;            // cm per inch, litres per US gallon
// slower than this (cm/s) counts as a dead zone: reefs want brisk flow, planted and goldfish tanks much gentler
const SLOW = { marine: 5, fresh: 2, cold: 3 };
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- starting setups for each kind of tank ---------- */
const TEMPLATES = {
  marine: () => ({
    name: 'Reef tank', kind: 'marine', tank: { length: 90, depth: 50, height: 50, sand: 3 },
    items: [
      { type: 'pump', name: 'Left powerhead', x: 4, y: 36, z: 12, yaw: 25, pitch: -5, flow: 3000, nozzle: 4 },
      { type: 'pump', name: 'Right powerhead', x: 86, y: 30, z: 38, yaw: 200, pitch: 0, flow: 3000, nozzle: 4 },
      { type: 'outlet', name: 'Return pump', x: 60, y: 44, z: 3, yaw: 120, pitch: -15, flow: 1200, nozzle: 2 },
      { type: 'rock', name: 'Left rock', x: 28, y: 12, z: 22, sx: 34, sy: 20, sz: 26 },
      { type: 'rock', name: 'Right rock', x: 64, y: 10, z: 24, sx: 26, sy: 16, sz: 22 },
    ] }),
  fresh: () => ({
    name: 'Planted tank', kind: 'fresh', tank: { length: 80, depth: 35, height: 45, sand: 5 },
    items: [
      { type: 'outlet', name: 'Filter outlet', x: 4, y: 38, z: 6, yaw: 5, pitch: 0, flow: 700, nozzle: 1.6 },
      { type: 'rock', name: 'Hardscape', x: 46, y: 13, z: 16, sx: 30, sy: 18, sz: 18 },
      { type: 'airstone', name: 'Airstone', x: 74, z: 28, strength: 2 },
    ] }),
  cold: () => ({
    name: 'Goldfish tank', kind: 'cold', tank: { length: 100, depth: 40, height: 45, sand: 3 },
    items: [
      { type: 'outlet', name: 'Filter outlet', x: 5, y: 38, z: 6, yaw: 10, pitch: -5, flow: 1000, nozzle: 2 },
      { type: 'airstone', name: 'Airstone', x: 80, z: 25, strength: 3 },
      { type: 'block', name: 'Ornament', x: 55, y: 9, z: 18, sx: 16, sy: 12, sz: 12 },
    ] }),
};
const ADDABLE = {
  pump: { label: 'Powerhead', make: t => ({ type: 'pump', name: 'Powerhead', x: t.length / 2, y: t.height * 0.7, z: 4, yaw: 90, pitch: 0, flow: 2000, nozzle: 4 }) },
  outlet: { label: 'Filter / return outlet', make: t => ({ type: 'outlet', name: 'Outlet', x: 4, y: t.height * 0.85, z: 4, yaw: 30, pitch: 0, flow: 800, nozzle: 2 }) },
  airstone: { label: 'Airstone', make: t => ({ type: 'airstone', name: 'Airstone', x: t.length * 0.8, z: t.depth / 2, strength: 2 }) },
  rock: { label: 'Rock', make: t => ({ type: 'rock', name: 'Rock', x: t.length / 2, y: (t.sand || 0) + 8, z: t.depth / 2, sx: 20, sy: 14, sz: 16 }) },
  block: { label: 'Box (ornament, overflow, heater)', make: t => ({ type: 'block', name: 'Box', x: t.length / 2, y: t.height / 2, z: 3, sx: 10, sy: 20, sz: 6 }) },
};

/* ---------- saving: your WordPress account when signed in, otherwise this browser ---------- */
class Store {
  constructor(el) { this.rest = el.dataset.rest; this.nonce = el.dataset.nonce; this.key = 'tank-flow-setups'; }
  local() { try { return JSON.parse(localStorage.getItem(this.key)) || []; } catch (e) { return []; } }
  async load() {
    if (this.rest) {
      try {
        const r = await fetch(this.rest, { headers: { 'X-WP-Nonce': this.nonce }, credentials: 'same-origin' });
        if (r.ok) { const list = await r.json(); if (Array.isArray(list)) return list; }
      } catch (e) { /* fall back to this browser */ }
    }
    return this.local();
  }
  async save(list) {
    try { localStorage.setItem(this.key, JSON.stringify(list)); } catch (e) { /* private mode */ }
    if (!this.rest) return true;
    try {
      const r = await fetch(this.rest, { method: 'POST', credentials: 'same-origin',
        headers: { 'X-WP-Nonce': this.nonce, 'Content-Type': 'application/json' }, body: JSON.stringify(list) });
      return r.ok;
    } catch (e) { return false; }
  }
}

/* ---------- the app ---------- */
class TankFlow {
  constructor(el) {
    this.el = el;
    this.store = new Store(el);
    this.units = 'metric';
    this.threshold = 5;
    this.showParticles = true; this.showDead = false; this.paused = false;
    this.selected = null;
    this.saved = [];
    this.buildDom();
    this.buildScene();
    this.setup = this.fromTemplate(el.dataset.kind || 'marine');
    this.restart();
    this.renderPanel();
    this.store.load().then(list => {
      this.saved = list;
      try { this.units = localStorage.getItem('tank-flow-units') || 'metric'; } catch (e) { /* ignore */ }
      // came from a "Marine / Freshwater / Coldwater" card: open your latest setup of that kind, or a fresh template
      const want = new URLSearchParams(location.search).get('kind');
      const pick = want ? list.find(x => x.kind === want) : list[0];
      if (pick) { this.setup = structuredClone(pick); this.viewSet = false; this.restart(); }
      this.renderPanel();
    });
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  fromTemplate(kind) {
    const s = (TEMPLATES[kind] || TEMPLATES.marine)();
    s.id = uid(); s.items.forEach(it => { it.id = uid(); });
    return s;
  }

  /* ---------- page structure ---------- */
  buildDom() {
    this.el.innerHTML = `
      <div class="tfs-stage">
        <div class="tfs-canvas"></div>
        <div class="tfs-hud" aria-live="polite"></div>
        <div class="tfs-legend"><span class="tfs-sw slow"></span><span class="tfs-legend-slow"></span>
          <span class="tfs-sw mid"></span>moving <span class="tfs-sw fast"></span>fast</div>
        <div class="tfs-views">
          <button type="button" data-view="front">Front</button><button type="button" data-view="top">Top</button>
          <button type="button" data-view="side">Side</button><button type="button" data-view="angle">3D</button>
        </div>
      </div>
      <aside class="tfs-panel"></aside>`;
    this.canvasBox = this.el.querySelector('.tfs-canvas');
    this.hud = this.el.querySelector('.tfs-hud');
    this.panel = this.el.querySelector('.tfs-panel');
    this.el.querySelector('.tfs-views').addEventListener('click', e => {
      const b = e.target.closest('[data-view]'); if (b) this.setView(b.dataset.view);
    });
    this.panel.addEventListener('input', e => this.onInput(e));
    this.panel.addEventListener('change', e => this.onInput(e, true));
    this.panel.addEventListener('click', e => this.onClick(e));
  }

  /* ---------- 3D scene ---------- */
  buildScene() {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.canvasBox.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x082238);
    this.camera = new THREE.PerspectiveCamera(40, 1, 1, 5000);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.scene.add(new THREE.HemisphereLight(0xdff2ff, 0x3a3020, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(0.3, 1, 0.6); this.scene.add(sun);
    this.tankGroup = new THREE.Group(); this.scene.add(this.tankGroup);
    new ResizeObserver(() => this.resize()).observe(this.canvasBox);
    // click an item in the 3D view to edit it
    r.domElement.addEventListener('pointerdown', e => { this.downAt = [e.clientX, e.clientY]; });
    r.domElement.addEventListener('pointerup', e => {
      if (!this.downAt || Math.hypot(e.clientX - this.downAt[0], e.clientY - this.downAt[1]) > 5) return;
      const rect = r.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), this.camera);
      const hit = ray.intersectObjects(this.itemMeshes || [], true)[0];
      let o = hit && hit.object; while (o && !o.userData.itemId) o = o.parent;
      this.select(o ? o.userData.itemId : null, true);
    });
  }

  resize() {
    const w = this.canvasBox.clientWidth, h = this.canvasBox.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (!this.viewSet && this.setup) { this.setView('angle'); this.viewSet = true; }
  }

  // tank coordinates (cm from the back-left-bottom corner) → scene coordinates (centred)
  toWorld(x, y, z) { const t = this.setup.tank; return new THREE.Vector3(x - t.length / 2, y, z - t.depth / 2); }

  setView(v) {
    const t = this.setup.tank;
    const tgt = new THREE.Vector3(0, t.height * 0.45, 0);
    // far enough back that the whole tank fits, whatever the window's shape
    const fov = this.camera.fov * Math.PI / 180, aspect = Math.max(0.4, this.camera.aspect || 1.4);
    const radius = 0.5 * Math.hypot(t.length, t.height, t.depth);
    const d = 0.9 * radius / Math.sin(Math.min(fov / 2, Math.atan(Math.tan(fov / 2) * aspect)));
    const a = [d * 0.45, d * 0.42, d * 0.79];
    const pos = { front: [0, t.height * 0.5, d], top: [0, d, 0.01], side: [d, t.height * 0.5, 0], angle: a }[v] || a;
    this.camera.position.set(pos[0], pos[1], pos[2]);
    this.controls.target.copy(tgt); this.controls.update();
  }

  buildTank() {
    const g = this.tankGroup; g.clear();
    const t = this.setup.tank;
    const box = new THREE.BoxGeometry(t.length, t.height, t.depth); box.translate(0, t.height / 2, 0);
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0x9cc3e0, transparent: true, opacity: 0.7 })));
    g.add(new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0x5fb3ff, transparent: true, opacity: 0.05, side: THREE.BackSide, depthWrite: false })));
    if (t.sand > 0) {
      const sand = new THREE.Mesh(new THREE.BoxGeometry(t.length, t.sand, t.depth), new THREE.MeshStandardMaterial({ color: 0xe2cfa0, roughness: 1 }));
      sand.position.y = t.sand / 2; g.add(sand);
    }
    // a "FRONT" label on the floor in front of the tank
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const cx = c.getContext('2d'); cx.fillStyle = 'rgba(200,225,245,.75)'; cx.font = '600 34px system-ui, sans-serif'; cx.textAlign = 'center'; cx.fillText('FRONT', 128, 44);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(24, 6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    label.rotation.x = -Math.PI / 2; label.position.set(0, 0.1, t.depth / 2 + 6); g.add(label);

    this.itemMeshes = [];
    for (const it of this.setup.items) {
      const m = this.itemMesh(it); if (!m) continue;
      m.userData.itemId = it.id; g.add(m); this.itemMeshes.push(m);
    }
    this.highlight();
  }

  itemMesh(it) {
    const t = this.setup.tank;
    const grp = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.6, metalness: 0.2 });
    if (it.type === 'pump' || it.type === 'outlet') {
      const yaw = it.yaw * Math.PI / 180, pitch = it.pitch * Math.PI / 180;
      const dir = new THREE.Vector3(Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw));
      const rN = (it.nozzle || 2) / 2;
      const body = it.type === 'pump'
        ? new THREE.CylinderGeometry(rN + 1.2, rN + 2.2, 7, 20)
        : new THREE.CylinderGeometry(rN + 0.4, rN + 0.6, 4, 14);
      body.rotateZ(-Math.PI / 2); body.translate(it.type === 'pump' ? -3 : -1.5, 0, 0);
      const mesh = new THREE.Mesh(body, dark);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      grp.add(mesh);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rN + 0.3, 0.35, 8, 24), new THREE.MeshStandardMaterial({ color: 0x3d9bff, emissive: 0x0a3a6a }));
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); grp.add(ring);
      if (it.type === 'outlet') {          // the pipe coming down from the rim
        const len = Math.max(0.5, t.height - it.y + 2);
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(rN + 0.4, rN + 0.4, len, 12), dark);
        pipe.position.y = len / 2; grp.add(pipe);
      }
      grp.position.copy(this.toWorld(it.x, it.y, it.z));
    } else if (it.type === 'airstone') {
      const y = (t.sand || 0);
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 2.4, 16), new THREE.MeshStandardMaterial({ color: 0x8c96a0, roughness: 1 }));
      stone.position.y = 1.2; grp.add(stone);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, t.height - y + 2, 8), new THREE.MeshStandardMaterial({ color: 0x9ad0b0, transparent: true, opacity: 0.6 }));
      tube.position.set(1.5, (t.height - y) / 2 + 1, 0); grp.add(tube);
      grp.position.copy(this.toWorld(it.x, y, it.z));
    } else if (it.type === 'rock') {
      const geo = new THREE.IcosahedronGeometry(0.5, 3);
      // knobbly rock: push each corner in or out a little, the same way every time for this rock
      let seed = 0; for (const ch of String(it.id)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
      const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      const pos = geo.attributes.position, map = new Map();
      for (let i = 0; i < pos.count; i++) {
        const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
        if (!map.has(key)) map.set(key, 0.85 + rnd() * 0.28);
        const f = map.get(key); pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xb8a088, roughness: 1, flatShading: true }));
      m.scale.set(it.sx, it.sy, it.sz); grp.add(m);
      grp.position.copy(this.toWorld(it.x, it.y, it.z));
    } else if (it.type === 'block') {
      const m = new THREE.Mesh(new THREE.BoxGeometry(it.sx, it.sy, it.sz), new THREE.MeshStandardMaterial({ color: 0x6f7f8f, roughness: 0.8 }));
      grp.add(m); grp.position.copy(this.toWorld(it.x, it.y, it.z));
    } else return null;
    return grp;
  }

  highlight() {
    for (const m of this.itemMeshes || []) {
      const on = m.userData.itemId === this.selected;
      m.traverse(o => { if (o.material && o.material.emissive && !o.geometry.type.startsWith('Torus')) o.material.emissive.setHex(on ? 0x664400 : 0x000000); });
    }
  }

  /* ---------- particles: short streaks that follow the water ---------- */
  buildParticles() {
    if (this.lines) { this.scene.remove(this.lines); this.lines.geometry.dispose(); }
    const t = this.setup.tank;
    const vol = t.length * t.depth * t.height;
    this.N = clamp(Math.round(vol / 45), 1500, 6000);
    this.pos = new Float32Array(this.N * 3);
    this.age = new Float32Array(this.N); this.life = new Float32Array(this.N);
    const geo = new THREE.BufferGeometry();
    this.linePos = new Float32Array(this.N * 6); this.lineCol = new Float32Array(this.N * 6);
    geo.setAttribute('position', new THREE.BufferAttribute(this.linePos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.lineCol, 3));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);
    for (let i = 0; i < this.N; i++) this.spawn(i, true);
  }

  spawn(i, anyAge) {
    const t = this.setup.tank, f = this.field;
    for (let tries = 0; tries < 20; tries++) {
      const x = Math.random() * t.length, y = (t.sand || 0) + Math.random() * (t.height - (t.sand || 0)), z = Math.random() * t.depth;
      if (f && f.isSolidAt(x, y, z)) continue;
      this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; break;
    }
    this.life[i] = 3 + Math.random() * 6;
    this.age[i] = anyAge ? Math.random() * this.life[i] : 0;
  }

  updateParticles(dt) {
    const f = this.field; if (!f) return;
    const t = this.setup.tank, T = this.threshold, v = [0, 0, 0];
    const slow = [1.0, 0.3, 0.28], c1 = [0.18, 0.6, 1.0], c2 = [0.75, 0.95, 1.0];
    for (let i = 0; i < this.N; i++) {
      const o = i * 3;
      let x = this.pos[o], y = this.pos[o + 1], z = this.pos[o + 2];
      f.velocityAt(x, y, z, v);
      // midpoint step for smoother paths
      const mx = x + v[0] * dt * 0.5, my = y + v[1] * dt * 0.5, mz = z + v[2] * dt * 0.5;
      f.velocityAt(mx, my, mz, v);
      x += v[0] * dt; y += v[1] * dt; z += v[2] * dt;
      this.age[i] += dt;
      if (this.age[i] > this.life[i] || x < 0 || x > t.length || y < 0 || y > t.height || z < 0 || z > t.depth || f.isSolidAt(x, y, z)) {
        this.spawn(i, false); x = this.pos[o]; y = this.pos[o + 1]; z = this.pos[o + 2]; f.velocityAt(x, y, z, v);
      }
      this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z;
      const s = Math.hypot(v[0], v[1], v[2]);
      // tail length grows with speed, with a minimum so still water shows as dots
      const k = s > 0.01 ? Math.max(0.12, 0.6 / Math.max(s, 1)) * Math.min(1, 0.15 + s / 20) : 0;
      const L = o * 2;
      const hx = x - t.length / 2, hz = z - t.depth / 2;
      this.linePos[L] = hx; this.linePos[L + 1] = y; this.linePos[L + 2] = hz;
      const tail = s < 0.4 ? 0.5 / Math.max(s, 0.05) : 1;
      this.linePos[L + 3] = hx - v[0] * k * tail * 2; this.linePos[L + 4] = y - v[1] * k * tail * 2; this.linePos[L + 5] = hz - v[2] * k * tail * 2;
      if (s < 0.4) { this.linePos[L + 3] = hx + 0.35; this.linePos[L + 4] = y; this.linePos[L + 5] = hz; }
      let col;
      if (s < T) col = slow;
      else { const a = clamp((s - T) / 30, 0, 1); col = [c1[0] + (c2[0] - c1[0]) * a, c1[1] + (c2[1] - c1[1]) * a, c1[2] + (c2[2] - c1[2]) * a]; }
      // fade in and out over a particle's life
      const fade = Math.min(1, this.age[i] / 0.6, (this.life[i] - this.age[i]) / 0.6);
      this.lineCol[L] = col[0] * fade; this.lineCol[L + 1] = col[1] * fade; this.lineCol[L + 2] = col[2] * fade;
      this.lineCol[L + 3] = col[0] * fade * 0.15; this.lineCol[L + 4] = col[1] * fade * 0.15; this.lineCol[L + 5] = col[2] * fade * 0.15;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.attributes.color.needsUpdate = true;
  }

  /* ---------- dead zone blocks ---------- */
  updateDead() {
    if (this.deadMesh) { this.scene.remove(this.deadMesh); this.deadMesh.geometry.dispose(); this.deadMesh = null; }
    const f = this.field; if (!f || !this.showDead) return;
    const list = [];
    for (let k = 0; k < f.nz; k++) for (let j = 0; j < f.ny; j++) for (let i = 0; i < f.nx; i++) {
      const c = f.ic(i, j, k); if (!f.solid[c] && f.avgSpeed[c] < this.threshold) list.push([i, j, k]);
    }
    const geo = new THREE.BoxGeometry(f.hx * 0.92, f.hy * 0.92, f.hz * 0.92);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.16, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    const m = new THREE.Matrix4(), t = this.setup.tank;
    list.forEach(([i, j, k], n) => { m.makeTranslation((i + 0.5) * f.hx - t.length / 2, (j + 0.5) * f.hy, (k + 0.5) * f.hz - t.depth / 2); mesh.setMatrixAt(n, m); });
    mesh.count = list.length;
    this.deadMesh = mesh; this.scene.add(mesh);
  }

  /* ---------- simulation (in a worker) ---------- */
  restart() {
    const s = this.setup;
    this.threshold = s.threshold || SLOW[s.kind] || 5;
    const items = s.items.map(it => it.type === 'airstone' ? { ...it, y: (s.tank.sand || 0) + 1 } : it);
    this.field = new FlowSim(s.tank, items, 12000);  // a copy of the grid here, for sampling the flow
    this.simTime = 0;
    if (this.worker) this.worker.terminate();
    this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = e => {
      const d = e.data, f = this.field;
      if (!f || d.nx !== f.nx || d.ny !== f.ny || d.nz !== f.nz) return;
      f.u.set(d.u); f.v.set(d.v); f.w.set(d.w); f.avgSpeed.set(d.avg); this.simTime = d.time;
      const now = performance.now();
      if (now - (this.lastStats || 0) > 500) { this.lastStats = now; this.updateHud(); if (this.showDead) this.updateDead(); }
    };
    this.worker.postMessage({ cmd: 'init', tank: s.tank, items, cells: 12000 });
    if (this.paused) this.worker.postMessage({ cmd: 'pause', paused: true });
    this.buildTank();
    this.buildParticles();
    this.updateDead();
    if (!this.viewSet) this.resize();
    this.updateHud();
  }

  // pumps moved or changed strength, but nothing solid moved: keep the water as it is
  updateSources() {
    const s = this.setup;
    const items = s.items.map(it => it.type === 'airstone' ? { ...it, y: (s.tank.sand || 0) + 1 } : it);
    this.worker.postMessage({ cmd: 'sources', items });
    this.field.setSources(items);
    this.buildTank();
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.showParticles && !this.paused) this.updateParticles(dt);
    this.lines.visible = this.showParticles;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /* ---------- numbers ---------- */
  len(cm) { return this.units === 'imperial' ? +(cm / IN).toFixed(1) : Math.round(cm * 10) / 10; }
  lenU() { return this.units === 'imperial' ? 'in' : 'cm'; }
  flow(lph) { return this.units === 'imperial' ? Math.round(lph / GAL) : Math.round(lph); }
  flowU() { return this.units === 'imperial' ? 'gal/h' : 'L/h'; }
  spd(cms) { return this.units === 'imperial' ? (cms / IN).toFixed(1) : cms.toFixed(1); }
  spdU() { return this.units === 'imperial' ? 'in/s' : 'cm/s'; }
  vol(l) { return this.units === 'imperial' ? `${Math.round(l / GAL)} gal` : `${Math.round(l)} L`; }

  updateHud() {
    const f = this.field; if (!f) return;
    const s = this.setup, st = f.stats(this.threshold);
    const q = s.items.filter(i => i.type === 'pump' || i.type === 'outlet').reduce((a, i) => a + (+i.flow || 0), 0);
    const turnover = st.waterLitres ? q / st.waterLitres : 0;
    const settling = this.simTime < 25;
    this.hud.innerHTML = `
      <div><b>${Math.round(st.slowShare * 100)}%</b> of the water is slower than ${this.spd(this.threshold)} ${this.spdU()}</div>
      <div>Average speed <b>${this.spd(st.mean)}</b> ${this.spdU()} · fast areas ${this.spd(st.p90)} ${this.spdU()}</div>
      <div>${this.vol(st.waterLitres)} of water · pumps turn it over <b>${turnover.toFixed(0)}×</b> an hour</div>
      ${settling ? `<div class="tfs-settle">Water still settling… ${Math.round(this.simTime)}s / 25s</div>` : ''}`;
    this.el.querySelector('.tfs-legend-slow').textContent = `under ${this.spd(this.threshold)} ${this.spdU()}`;
  }

  /* ---------- the side panel ---------- */
  field1(label, key, value, min, max, step, unit, extra = '') {
    return `<label class="tfs-f"><span>${label}</span>
      <input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${value}" ${extra}>
      <input type="number" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${value}" ${extra}><em>${unit}</em></label>`;
  }

  itemFields(it) {
    const t = this.setup.tank, u = this.lenU(), L = v => this.len(v), st = this.units === 'imperial' ? 0.5 : 1;
    const pos = (withY = true) => this.field1('Left ↔ right', 'x', L(it.x), 0, L(t.length), st, u)
      + (withY ? this.field1('Height', 'y', L(it.y), 0, L(t.height), st, u) : '')
      + this.field1('Back ↔ front', 'z', L(it.z), 0, L(t.depth), st, u);
    if (it.type === 'pump' || it.type === 'outlet') {
      const maxF = it.type === 'pump' ? 20000 : 6000;
      return pos()
        + this.field1('Points', 'yaw', it.yaw, 0, 359, 1, '°', 'data-hint="0 right · 90 front · 180 left · 270 back"')
        + `<p class="tfs-hint">0° right · 90° front · 180° left · 270° back</p>`
        + this.field1('Tilt', 'pitch', it.pitch, -80, 80, 1, '°')
        + this.field1('Flow', 'flow', this.flow(it.flow), 0, this.flow(maxF), this.units === 'imperial' ? 10 : 50, this.flowU())
        + this.field1('Nozzle', 'nozzle', L(it.nozzle), L(0.5), L(12), this.units === 'imperial' ? 0.1 : 0.1, u);
    }
    if (it.type === 'airstone') return pos(false) + this.field1('Bubbles', 'strength', it.strength, 1, 5, 1, '');
    return pos() + this.field1('Width', 'sx', L(it.sx), 1, L(t.length), st, u)
      + this.field1('Tall', 'sy', L(it.sy), 1, L(t.height), st, u) + this.field1('Deep', 'sz', L(it.sz), 1, L(t.depth), st, u);
  }

  renderPanel() {
    const s = this.setup, t = s.tank, u = this.lenU(), L = v => this.len(v), st = this.units === 'imperial' ? 0.5 : 1;
    const icons = { pump: '⟴', outlet: '⤵', airstone: '∘', rock: '◆', block: '▭' };
    this.panel.innerHTML = `
      <section class="tfs-sec">
        <div class="tfs-row">
          <select data-a="open" aria-label="Saved setups">
            ${this.saved.length ? '' : '<option>No saved setups yet</option>'}
            ${this.saved.map(x => `<option value="${esc(x.id)}" ${x.id === s.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
          </select>
          <button type="button" data-a="save" class="tfs-pri">Save</button>
        </div>
        <label class="tfs-f tfs-name"><span>Name</span><input type="text" data-k="name" value="${esc(s.name)}"></label>
        <div class="tfs-row tfs-small">
          <select data-a="new" aria-label="New setup"><option value="">New setup…</option>
            <option value="marine">Reef tank</option><option value="fresh">Freshwater / planted</option><option value="cold">Coldwater / goldfish</option></select>
          <button type="button" data-a="copy">Duplicate</button>
          <button type="button" data-a="delete" class="tfs-danger">Delete</button>
        </div>
        <p class="tfs-saved" aria-live="polite"></p>
      </section>

      <details class="tfs-sec" open><summary>Tank</summary>
        ${this.field1('Length', 't.length', L(t.length), L(20), L(300), st, u)}
        ${this.field1('Depth', 't.depth', L(t.depth), L(15), L(120), st, u)}
        ${this.field1('Height', 't.height', L(t.height), L(15), L(120), st, u)}
        ${this.field1('Sand', 't.sand', L(t.sand), 0, L(15), this.units === 'imperial' ? 0.25 : 0.5, u)}
        <div class="tfs-row tfs-small"><span>Units</span>
          <button type="button" data-a="units" data-v="metric" class="${this.units === 'metric' ? 'on' : ''}">cm · L/h</button>
          <button type="button" data-a="units" data-v="imperial" class="${this.units === 'imperial' ? 'on' : ''}">in · gal/h</button></div>
      </details>

      <details class="tfs-sec" open><summary>Equipment and rock</summary>
        <div class="tfs-items">
        ${s.items.map(it => `
          <div class="tfs-item ${it.id === this.selected ? 'open' : ''}" data-id="${esc(it.id)}">
            <button type="button" class="tfs-ihead" data-a="select"><span class="tfs-ic">${icons[it.type] || ''}</span>
              <span class="tfs-iname">${esc(it.name || ADDABLE[it.type].label)}</span>
              <span class="tfs-isub">${it.type === 'pump' || it.type === 'outlet' ? `${this.flow(it.flow)} ${this.flowU()}` : ADDABLE[it.type].label.split(' (')[0]}</span></button>
            ${it.id === this.selected ? `<div class="tfs-ibody">
              <label class="tfs-f tfs-name"><span>Name</span><input type="text" data-k="name" value="${esc(it.name || '')}"></label>
              ${this.itemFields(it)}
              <button type="button" data-a="remove" class="tfs-danger tfs-small">Remove</button></div>` : ''}
          </div>`).join('')}
        </div>
        <div class="tfs-row tfs-small"><select data-a="add" aria-label="Add equipment"><option value="">+ Add…</option>
          ${Object.entries(ADDABLE).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></div>
      </details>

      <details class="tfs-sec" open><summary>What to show</summary>
        <label class="tfs-check"><input type="checkbox" data-v="particles" ${this.showParticles ? 'checked' : ''}> Moving water (streaks)</label>
        <label class="tfs-check"><input type="checkbox" data-v="dead" ${this.showDead ? 'checked' : ''}> Dead zones as red blocks</label>
        ${this.field1('Slow below', 'threshold', this.spd(this.threshold), this.units === 'imperial' ? 0.4 : 1, this.units === 'imperial' ? 6 : 15, this.units === 'imperial' ? 0.1 : 0.5, this.spdU())}
        <div class="tfs-row tfs-small">
          <button type="button" data-a="pause">${this.paused ? 'Run' : 'Pause'}</button>
          <button type="button" data-a="restart">Restart the water</button></div>
      </details>`;
  }

  select(id, fromScene) {
    this.selected = this.selected === id && !fromScene ? null : id;
    this.highlight(); this.renderPanel();
    if (fromScene && id) { const el = this.panel.querySelector(`.tfs-item[data-id="${id}"]`); if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }

  onInput(e, committed) {
    const el = e.target, s = this.setup;
    if (el.dataset.v === 'particles') { this.showParticles = el.checked; return; }
    if (el.dataset.v === 'dead') { this.showDead = el.checked; this.updateDead(); return; }
    if (el.dataset.a === 'open' && committed) { const f = this.saved.find(x => x.id === el.value); if (f) { this.setup = structuredClone(f); this.selected = null; this.viewSet = false; this.restart(); this.renderPanel(); } return; }
    if (el.dataset.a === 'new' && committed && el.value) { this.setup = this.fromTemplate(el.value); this.selected = null; this.viewSet = false; this.restart(); this.renderPanel(); return; }
    if (el.dataset.a === 'add' && committed && el.value) {
      const it = ADDABLE[el.value].make(s.tank); it.id = uid(); s.items.push(it); this.selected = it.id;
      if (it.type === 'rock' || it.type === 'block') this.restart(); else this.updateSources();
      this.renderPanel(); return;
    }
    const k = el.dataset.k; if (!k) return;
    // keep the slider and the number box beside it in step
    const wrap = el.closest('.tfs-f');
    if (wrap) wrap.querySelectorAll(`[data-k="${k}"]`).forEach(o => { if (o !== el) o.value = el.value; });
    const itemEl = el.closest('.tfs-item');
    const raw = el.type === 'text' ? el.value : parseFloat(el.value);
    if (el.type !== 'text' && !Number.isFinite(raw)) return;
    const imp = this.units === 'imperial';
    if (k === 'threshold') { this.threshold = s.threshold = imp ? raw * IN : raw; this.updateHud(); if (this.showDead) this.updateDead(); return; }
    if (k === 'name') {
      if (itemEl) { const it = s.items.find(i => i.id === itemEl.dataset.id); if (it) it.name = raw; const n = itemEl.querySelector('.tfs-iname'); if (n) n.textContent = raw; }
      else s.name = raw;
      return;
    }
    if (k.startsWith('t.')) {
      s.tank[k.slice(2)] = imp ? raw * IN : raw;
      clearTimeout(this.tankTimer); this.tankTimer = setTimeout(() => { this.viewSet = false; this.restart(); }, committed ? 0 : 350);
      return;
    }
    if (!itemEl) return;
    const it = s.items.find(i => i.id === itemEl.dataset.id); if (!it) return;
    const lengthKeys = ['x', 'y', 'z', 'sx', 'sy', 'sz', 'nozzle'];
    it[k] = lengthKeys.includes(k) && imp ? raw * IN : k === 'flow' && imp ? raw * GAL : raw;
    const sub = itemEl.querySelector('.tfs-isub'); if (sub && k === 'flow') sub.textContent = `${this.flow(it.flow)} ${this.flowU()}`;
    if (it.type === 'rock' || it.type === 'block') {
      // moving rock changes the solid shape of the tank: rebuild once you stop dragging
      this.buildTank(); clearTimeout(this.rockTimer); this.rockTimer = setTimeout(() => this.restart(), committed ? 0 : 400);
    } else this.updateSources();
  }

  async onClick(e) {
    const b = e.target.closest('[data-a]'); if (!b || b.tagName === 'SELECT') return;
    const a = b.dataset.a, s = this.setup;
    if (a === 'select') { this.select(b.closest('.tfs-item').dataset.id); return; }
    if (a === 'remove') {
      const id = b.closest('.tfs-item').dataset.id, it = s.items.find(i => i.id === id);
      s.items = s.items.filter(i => i.id !== id); this.selected = null;
      if (it && (it.type === 'rock' || it.type === 'block')) this.restart(); else this.updateSources();
      this.renderPanel(); return;
    }
    if (a === 'units') { this.units = b.dataset.v; try { localStorage.setItem('tank-flow-units', this.units); } catch (er) { /* ignore */ } this.renderPanel(); this.updateHud(); return; }
    if (a === 'pause') { this.paused = !this.paused; this.worker.postMessage({ cmd: 'pause', paused: this.paused }); this.renderPanel(); return; }
    if (a === 'restart') { this.restart(); return; }
    if (a === 'copy') { this.setup = structuredClone(s); this.setup.id = uid(); this.setup.name = s.name + ' (copy)'; this.renderPanel(); this.flash('Copied. Press Save to keep it.'); return; }
    if (a === 'save' || a === 'delete') {
      if (a === 'delete') {
        if (!this.saved.some(x => x.id === s.id) || !confirm(`Delete “${s.name}”?`)) return;
        this.saved = this.saved.filter(x => x.id !== s.id);
      } else {
        const i = this.saved.findIndex(x => x.id === s.id);
        const copy = structuredClone(s);
        if (i >= 0) this.saved[i] = copy; else this.saved.unshift(copy);
      }
      const ok = await this.store.save(this.saved);
      if (a === 'delete') { this.setup = this.saved[0] ? structuredClone(this.saved[0]) : this.fromTemplate('marine'); this.restart(); }
      this.renderPanel();
      this.flash(ok ? (a === 'save' ? 'Saved.' : 'Deleted.') : 'Saved in this browser only (couldn’t reach WordPress).');
    }
  }

  flash(msg) { const p = this.panel.querySelector('.tfs-saved'); if (p) { p.textContent = msg; clearTimeout(this.flashT); this.flashT = setTimeout(() => { p.textContent = ''; }, 3000); } }
}

document.querySelectorAll('.tank-flow-sim').forEach(el => {
  try { new TankFlow(el); } catch (err) {
    el.innerHTML = '<p class="tfs-error">The flow simulator needs a browser with WebGL and module workers (any current Chrome, Edge, Firefox or Safari).</p>';
    console.error(err);
  }
});
