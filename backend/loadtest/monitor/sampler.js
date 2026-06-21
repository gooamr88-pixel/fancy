/**
 * Dependency-free system sampler. Run it on the machine hosting the API while a
 * k6 level executes; it appends CPU%, memory and load average to a CSV you can
 * paste into the results template.
 *
 *   node monitor/sampler.js                         # 2s interval, ./results/system-<ts>.csv
 *   INTERVAL=1000 OUT=results/sys-1000.csv node monitor/sampler.js
 *
 * Notes:
 *  - CPU% and memory are SYSTEM-wide (good enough when the box runs only the API).
 *  - For PER-PROCESS Node metrics use one of: `pm2 monit`, `clinic doctor -- node server.js`,
 *    or `docker stats`. For a quick per-PID number: `npx pidusage <pid>`.
 *  - loadavg is 0 on Windows (OS limitation) — use CPU% there.
 */
const os = require('os');
const fs = require('fs');
const path = require('path');

const INTERVAL = Number(process.env.INTERVAL || 2000);
const OUT = process.env.OUT || path.join('results', `system-${Date.now()}.csv`);
fs.mkdirSync(path.dirname(OUT), { recursive: true });

function cpuSnapshot() {
  let idle = 0, total = 0;
  for (const cpu of os.cpus()) {
    for (const t of Object.values(cpu.times)) total += t;
    idle += cpu.times.idle;
  }
  return { idle, total };
}

let prev = cpuSnapshot();
const header = 'timestamp,cpu_pct,mem_used_mb,mem_total_mb,mem_pct,load1\n';
fs.writeFileSync(OUT, header);
process.stdout.write(`Sampling every ${INTERVAL}ms -> ${OUT}\n${header}`);

setInterval(() => {
  const cur = cpuSnapshot();
  const dIdle = cur.idle - prev.idle;
  const dTotal = cur.total - prev.total;
  const cpuPct = dTotal > 0 ? (1 - dIdle / dTotal) * 100 : 0;
  prev = cur;

  const memTotal = os.totalmem() / 1048576;
  const memUsed = (os.totalmem() - os.freemem()) / 1048576;
  const memPct = (memUsed / memTotal) * 100;
  const load1 = os.loadavg()[0];

  const line = `${new Date().toISOString()},${cpuPct.toFixed(1)},${memUsed.toFixed(0)},${memTotal.toFixed(0)},${memPct.toFixed(1)},${load1.toFixed(2)}\n`;
  fs.appendFileSync(OUT, line);
  process.stdout.write(line);
}, INTERVAL);

// Stop cleanly on Ctrl-C.
process.on('SIGINT', () => { process.stdout.write(`\nSaved ${OUT}\n`); process.exit(0); });
