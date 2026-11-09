/* Runs the water simulation off the main thread so the 3D view stays smooth.
   Messages in:  {cmd:'init', tank, items, cells} · {cmd:'sources', items} · {cmd:'pause', paused}
   Messages out: {u, v, w, avg, time, nx, ny, nz} snapshots a few times a second. */
import { FlowSim } from './sim.js';

let sim = null, paused = false, timer = null, lastPost = 0;

function loop() {
  if (!sim || paused) return;
  const until = performance.now() + 25;           // simulate in 25 ms slices
  while (performance.now() < until) sim.step();
  const now = performance.now();
  if (now - lastPost > 120) {
    lastPost = now;
    const u = sim.u.slice(), v = sim.v.slice(), w = sim.w.slice(), avg = sim.avgSpeed.slice();
    postMessage({ u, v, w, avg, time: sim.time, nx: sim.nx, ny: sim.ny, nz: sim.nz }, [u.buffer, v.buffer, w.buffer, avg.buffer]);
  }
  timer = setTimeout(loop, 4);
}

onmessage = (e) => {
  const m = e.data;
  if (m.cmd === 'init') {
    sim = new FlowSim(m.tank, m.items, m.cells);
    clearTimeout(timer); loop();
  } else if (m.cmd === 'sources' && sim) {
    sim.setSources(m.items);
  } else if (m.cmd === 'pause') {
    paused = m.paused; clearTimeout(timer); if (!paused) loop();
  }
};
