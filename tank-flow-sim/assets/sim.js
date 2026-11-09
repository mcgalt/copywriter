/* Tank Flow Simulator: the water.
 *
 * A small incompressible fluid solver ("stable fluids" on a staggered grid) sized to the tank:
 *   1. pumps, filter outlets and airstones push the water near them towards their output speed,
 *   2. the water carries its own motion along (semi-Lagrangian advection),
 *   3. a pressure solve makes the flow incompressible, so jets create return currents, suck water in
 *      behind the pump, and bend round rock and sand.
 * Walls, the sand bed and the rock are solid; the water surface is treated as a flat lid.
 * Units: centimetres and seconds. x = left→right (length), y = bottom→top (height), z = back→front (depth).
 */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class FlowSim {
  /**
   * @param {object} tank  {length, depth, height, sand}  in cm
   * @param {Array}  items pumps, outlets, airstones, rocks, blocks (see app.js)
   * @param {number} cells roughly how many grid cells to use (detail vs speed)
   */
  constructor(tank, items, cells = 14000) {
    this.tank = tank;
    const L = tank.length, H = tank.height, D = tank.depth;
    const h = Math.cbrt((L * H * D) / cells);
    this.nx = Math.max(6, Math.round(L / h));
    this.ny = Math.max(5, Math.round(H / h));
    this.nz = Math.max(5, Math.round(D / h));
    this.hx = L / this.nx; this.hy = H / this.ny; this.hz = D / this.nz;
    this.hmin = Math.min(this.hx, this.hy, this.hz);
    const { nx, ny, nz } = this;
    this.n = nx * ny * nz;
    this.u = new Float32Array((nx + 1) * ny * nz);
    this.v = new Float32Array(nx * (ny + 1) * nz);
    this.w = new Float32Array(nx * ny * (nz + 1));
    this.u0 = new Float32Array(this.u.length);
    this.v0 = new Float32Array(this.v.length);
    this.w0 = new Float32Array(this.w.length);
    this.p = new Float32Array(this.n);
    this.div = new Float32Array(this.n);
    this.solid = new Uint8Array(this.n);
    this.avgSpeed = new Float32Array(this.n);   // time-averaged speed in each cell (cm/s)
    this.time = 0;
    this.buildSolids(items);
    this.setSources(items);
  }

  // ---------- indexing ----------
  ic(i, j, k) { return i + this.nx * (j + this.ny * k); }
  iu(i, j, k) { return i + (this.nx + 1) * (j + this.ny * k); }
  iv(i, j, k) { return i + this.nx * (j + (this.ny + 1) * k); }
  iw(i, j, k) { return i + this.nx * (j + this.ny * k); }
  cellOf(x, y, z) {
    return [clamp(Math.floor(x / this.hx), 0, this.nx - 1), clamp(Math.floor(y / this.hy), 0, this.ny - 1),
      clamp(Math.floor(z / this.hz), 0, this.nz - 1)];
  }
  isSolidAt(x, y, z) {
    const [i, j, k] = this.cellOf(x, y, z);
    return this.solid[this.ic(i, j, k)] === 1;
  }

  // ---------- sand and rock ----------
  buildSolids(items) {
    const { nx, ny, nz, hx, hy, hz } = this;
    const sand = this.tank.sand || 0;
    const rocks = items.filter(it => it.type === 'rock' || it.type === 'block');
    this.solid.fill(0);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = (i + 0.5) * hx, y = (j + 0.5) * hy, z = (k + 0.5) * hz;
      let s = y < sand;
      for (const r of rocks) {
        if (s) break;
        const dx = x - r.x, dy = y - r.y, dz = z - r.z;
        if (r.type === 'rock') {
          s = (dx / (r.sx / 2)) ** 2 + (dy / (r.sy / 2)) ** 2 + (dz / (r.sz / 2)) ** 2 <= 1;
        } else {
          s = Math.abs(dx) <= r.sx / 2 && Math.abs(dy) <= r.sy / 2 && Math.abs(dz) <= r.sz / 2;
        }
      }
      this.solid[this.ic(i, j, k)] = s ? 1 : 0;
    }
    // never let the whole tank be solid
    let fluid = 0; for (let c = 0; c < this.n; c++) fluid += 1 - this.solid[c];
    this.fluidCells = fluid;
    this.enforceWalls();
  }

  // ---------- what pushes the water ----------
  /* Each pump or filter outlet becomes a forced jet: flow Q through a nozzle of area A leaves at Q/A, keeps that
     speed for a while and then slows and widens (see facesFor). Airstones lift a column of water to the surface. */
  setSources(items) {
    const src = [];
    for (const it of items) {
      if (it.type === 'pump' || it.type === 'outlet') {
        if (!(it.flow > 0)) continue;
        const yaw = (it.yaw || 0) * Math.PI / 180, pitch = (it.pitch || 0) * Math.PI / 180;
        const dir = [Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw)];
        const Q = it.flow * 1000 / 3600;                      // L/h → cm³/s
        const rN = (it.nozzle || (it.type === 'pump' ? 4 : 2)) / 2;
        const vN = Q / (Math.PI * rN * rN);
        // A real jet keeps its nozzle speed for about 6 nozzle-widths, then slows as 1/distance while it
        // widens (about 1 cm per 10 cm travelled). A coarse grid smears that too fast, so the first stretch of
        // the jet is imposed from that rule and the solver takes it from there.
        const d = 2 * rN, core = 6 * d;
        const len = Math.max(1.5 * this.hmin, Math.min(core * 1.6, 0.35 * Math.max(this.tank.length, this.tank.depth)));
        src.push({ kind: 'jet', pos: [it.x, it.y, it.z], dir, speed: vN, r0: rN, core, len });
      } else if (it.type === 'airstone') {
        const speed = 5 + 4 * (it.strength || 2);           // a bubble plume lifts water at roughly 10–25 cm/s
        src.push({ kind: 'plume', pos: [it.x, it.y, it.z], speed, radius: Math.max(0.75 * this.hmin, (it.width || 4) / 2) });
      }
    }
    this.sources = src;
    // collect the faces each source drives, once, so stepping is cheap
    this.forced = [];
    for (const s of src) this.forced.push(this.facesFor(s));
    const vmax = src.reduce((m, s) => Math.max(m, s.speed), 5);
    this.vmax = vmax;
    this.dt = clamp(2 * this.hmin / vmax, 0.03, 0.25);
  }

  facesFor(s) {
    const out = [];                 // [array, index, target, blend]
    const { nx, ny, nz, hx, hy, hz } = this;
    const seen = new Set();
    const add = (arr, name, idx, target, blend) => {
      const key = name + idx; if (seen.has(key)) return; seen.add(key);
      out.push([arr, idx, target, blend]);
    };
    // for a jet: the speed it should have at this point (0 = outside the jet); for a plume: 1 inside, 0 outside
    const strength = (x, y, z) => {
      if (s.kind === 'jet') {
        const rx = x - s.pos[0], ry = y - s.pos[1], rz = z - s.pos[2];
        const t = rx * s.dir[0] + ry * s.dir[1] + rz * s.dir[2];
        if (t < -0.5 * this.hmin || t > s.len) return 0;
        const px = rx - t * s.dir[0], py = ry - t * s.dir[1], pz = rz - t * s.dir[2];
        const r = Math.sqrt(px * px + py * py + pz * pz);
        const tt = Math.max(t, 0);
        const width = Math.max(s.r0 + 0.1 * tt, 0.6 * this.hmin);
        if (r > width) return 0;
        const centre = tt < s.core ? s.speed : s.speed * s.core / tt;
        // spread the same momentum over the wider jet: speed drops with the area it now covers
        const spread = Math.min(1, (s.r0 + 0.1 * tt) ** 2 / (width * width));
        return centre * Math.sqrt(spread);
      }
      const rx = x - s.pos[0], rz = z - s.pos[2];
      return y >= s.pos[1] - this.hy && rx * rx + rz * rz <= s.radius * s.radius ? 1 : 0;
    };
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (this.solid[this.ic(i, j, k)]) continue;
      const x = (i + 0.5) * hx, y = (j + 0.5) * hy, z = (k + 0.5) * hz;
      const g = strength(x, y, z);
      if (!g) continue;
      if (s.kind === 'jet') {
        const [dx, dy, dz] = s.dir, b = 0.6;
        if (i > 0) add(this.u, 'u', this.iu(i, j, k), g * dx, b);
        if (i + 1 < nx) add(this.u, 'u', this.iu(i + 1, j, k), g * dx, b);
        if (j > 0) add(this.v, 'v', this.iv(i, j, k), g * dy, b);
        if (j + 1 < ny) add(this.v, 'v', this.iv(i, j + 1, k), g * dy, b);
        if (k > 0) add(this.w, 'w', this.iw(i, j, k), g * dz, b);
        if (k + 1 < nz) add(this.w, 'w', this.iw(i, j, k + 1), g * dz, b);
      } else {
        if (j > 0) add(this.v, 'v', this.iv(i, j, k), s.speed, 0.35);
        if (j + 1 < ny) add(this.v, 'v', this.iv(i, j + 1, k), s.speed, 0.35);
      }
    }
    return out;
  }

  // ---------- one time step ----------
  step() {
    const dt = this.dt;
    this.applySources();
    this.advect(dt);
    this.applySources();
    this.enforceWalls();
    this.project(30);
    this.average(dt);
    this.time += dt;
  }

  applySources() {
    for (const faces of this.forced) for (const [arr, idx, target, blend] of faces) {
      arr[idx] += (target - arr[idx]) * blend;
    }
  }

  // velocity at any point, by trilinear interpolation of each staggered component.
  sampleComp(arr, ox, oy, oz, sx, sy, sz, x, y, z) {
    const gx = clamp(x / this.hx - ox, 0, sx - 1.0001), gy = clamp(y / this.hy - oy, 0, sy - 1.0001), gz = clamp(z / this.hz - oz, 0, sz - 1.0001);
    const i = gx | 0, j = gy | 0, k = gz | 0, fx = gx - i, fy = gy - j, fz = gz - k;
    const b = i + sx * (j + sy * k), dy = sx, dz = sx * sy;
    const a000 = arr[b], a100 = arr[b + 1], a010 = arr[b + dy], a110 = arr[b + dy + 1];
    const a001 = arr[b + dz], a101 = arr[b + dz + 1], a011 = arr[b + dz + dy], a111 = arr[b + dz + dy + 1];
    const c00 = a000 + (a100 - a000) * fx, c10 = a010 + (a110 - a010) * fx;
    const c01 = a001 + (a101 - a001) * fx, c11 = a011 + (a111 - a011) * fx;
    const c0 = c00 + (c10 - c00) * fy, c1 = c01 + (c11 - c01) * fy;
    return c0 + (c1 - c0) * fz;
  }
  sampleU(x, y, z, arr = this.u) { return this.sampleComp(arr, 0, 0.5, 0.5, this.nx + 1, this.ny, this.nz, x, y, z); }
  sampleV(x, y, z, arr = this.v) { return this.sampleComp(arr, 0.5, 0, 0.5, this.nx, this.ny + 1, this.nz, x, y, z); }
  sampleW(x, y, z, arr = this.w) { return this.sampleComp(arr, 0.5, 0.5, 0, this.nx, this.ny, this.nz + 1, x, y, z); }
  velocityAt(x, y, z, out = [0, 0, 0]) {
    out[0] = this.sampleU(x, y, z); out[1] = this.sampleV(x, y, z); out[2] = this.sampleW(x, y, z);
    return out;
  }

  // the water carries its own motion along: trace each face back through the flow (RK2) and take what was there
  advect(dt) {
    const { nx, ny, nz, hx, hy, hz } = this;
    const L = this.tank.length, H = this.tank.height, D = this.tank.depth;
    this.u0.set(this.u); this.v0.set(this.v); this.w0.set(this.w);
    const u0 = this.u0, v0 = this.v0, w0 = this.w0;
    const P = [0, 0, 0];
    const trace = (x, y, z) => {
      const a0 = this.sampleU(x, y, z, u0), a1 = this.sampleV(x, y, z, v0), a2 = this.sampleW(x, y, z, w0);
      const mx = x - 0.5 * dt * a0, my = y - 0.5 * dt * a1, mz = z - 0.5 * dt * a2;
      P[0] = clamp(x - dt * this.sampleU(mx, my, mz, u0), 0, L);
      P[1] = clamp(y - dt * this.sampleV(mx, my, mz, v0), 0, H);
      P[2] = clamp(z - dt * this.sampleW(mx, my, mz, w0), 0, D);
    };
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) {
      trace(i * hx, (j + 0.5) * hy, (k + 0.5) * hz); this.u[this.iu(i, j, k)] = this.sampleU(P[0], P[1], P[2], u0);
    }
    for (let k = 0; k < nz; k++) for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) {
      trace((i + 0.5) * hx, j * hy, (k + 0.5) * hz); this.v[this.iv(i, j, k)] = this.sampleV(P[0], P[1], P[2], v0);
    }
    for (let k = 1; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      trace((i + 0.5) * hx, (j + 0.5) * hy, k * hz); this.w[this.iw(i, j, k)] = this.sampleW(P[0], P[1], P[2], w0);
    }
  }

  // no water through the glass, the surface, the sand or the rock
  enforceWalls() {
    const { nx, ny, nz, solid } = this;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i <= nx; i++) {
      if (i === 0 || i === nx || solid[this.ic(i - 1, j, k)] || solid[this.ic(i, j, k)]) this.u[this.iu(i, j, k)] = 0;
    }
    for (let k = 0; k < nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i < nx; i++) {
      if (j === 0 || j === ny || solid[this.ic(i, j - 1, k)] || solid[this.ic(i, j, k)]) this.v[this.iv(i, j, k)] = 0;
    }
    for (let k = 0; k <= nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (k === 0 || k === nz || solid[this.ic(i, j, k - 1)] || solid[this.ic(i, j, k)]) this.w[this.iw(i, j, k)] = 0;
    }
  }

  // make the flow incompressible: solve for pressure, then remove its gradient
  project(iters) {
    const { nx, ny, nz, hx, hy, hz, solid, p, div, u, v, w } = this;
    const ax = 1 / (hx * hx), ay = 1 / (hy * hy), az = 1 / (hz * hz);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = this.ic(i, j, k);
      div[c] = solid[c] ? 0 : (u[this.iu(i + 1, j, k)] - u[this.iu(i, j, k)]) / hx
        + (v[this.iv(i, j + 1, k)] - v[this.iv(i, j, k)]) / hy + (w[this.iw(i, j, k + 1)] - w[this.iw(i, j, k)]) / hz;
    }
    const omega = 1.7;
    for (let it = 0; it < iters; it++) {
      for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const c = this.ic(i, j, k);
        if (solid[c]) continue;
        let sum = 0, diag = 0;
        if (i > 0 && !solid[c - 1]) { sum += p[c - 1] * ax; diag += ax; }
        if (i < nx - 1 && !solid[c + 1]) { sum += p[c + 1] * ax; diag += ax; }
        if (j > 0 && !solid[c - nx]) { sum += p[c - nx] * ay; diag += ay; }
        if (j < ny - 1 && !solid[c + nx]) { sum += p[c + nx] * ay; diag += ay; }
        const s = nx * ny;
        if (k > 0 && !solid[c - s]) { sum += p[c - s] * az; diag += az; }
        if (k < nz - 1 && !solid[c + s]) { sum += p[c + s] * az; diag += az; }
        if (diag === 0) continue;
        p[c] += omega * ((sum - div[c]) / diag - p[c]);
      }
    }
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) {
      const a = this.ic(i - 1, j, k), b = a + 1;
      if (!solid[a] && !solid[b]) u[this.iu(i, j, k)] -= (p[b] - p[a]) / hx;
    }
    for (let k = 0; k < nz; k++) for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = this.ic(i, j - 1, k), b = a + nx;
      if (!solid[a] && !solid[b]) v[this.iv(i, j, k)] -= (p[b] - p[a]) / hy;
    }
    for (let k = 1; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = this.ic(i, j, k - 1), b = a + nx * ny;
      if (!solid[a] && !solid[b]) w[this.iw(i, j, k)] -= (p[b] - p[a]) / hz;
    }
  }

  cellSpeed(i, j, k) {
    const uu = 0.5 * (this.u[this.iu(i, j, k)] + this.u[this.iu(i + 1, j, k)]);
    const vv = 0.5 * (this.v[this.iv(i, j, k)] + this.v[this.iv(i, j + 1, k)]);
    const ww = 0.5 * (this.w[this.iw(i, j, k)] + this.w[this.iw(i, j, k + 1)]);
    return Math.sqrt(uu * uu + vv * vv + ww * ww);
  }

  // a running average of the speed in each cell over the last few seconds, so dead zones don't flicker
  average(dt) {
    const a = Math.min(1, dt / 4);
    const { nx, ny, nz } = this;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = this.ic(i, j, k);
      this.avgSpeed[c] = this.solid[c] ? 0 : this.avgSpeed[c] + (this.cellSpeed(i, j, k) - this.avgSpeed[c]) * a;
    }
  }

  /** Share of the water (by volume) moving slower than `threshold` cm/s, plus mean and fast-end speeds. */
  stats(threshold) {
    let slow = 0, fluid = 0, sum = 0;
    const speeds = [];
    for (let c = 0; c < this.n; c++) {
      if (this.solid[c]) continue;
      fluid++; const s = this.avgSpeed[c]; sum += s; speeds.push(s);
      if (s < threshold) slow++;
    }
    speeds.sort((a, b) => a - b);
    return {
      slowShare: fluid ? slow / fluid : 0,
      mean: fluid ? sum / fluid : 0,
      p90: speeds.length ? speeds[Math.floor(speeds.length * 0.9)] : 0,
      waterLitres: fluid * this.hx * this.hy * this.hz / 1000,
    };
  }
}
