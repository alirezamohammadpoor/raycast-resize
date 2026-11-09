/**
 * Regression simulation for Cycle + DevTools handoff fixes.
 * Run: npx tsx scripts/simulate-cycle-devtools.ts
 */

import { DEVTOOLS_DOCK, expandForDeviceMode } from "../src/devtools-geometry";

const AVAIL = { w: 1728, h: 1055, left: 0, top: 25 };
const CHROME_UI = { w: 0, h: 87 };

type Bounds = { x1: number; y1: number; x2: number; y2: number };
type Preset = { id: string; name: string; class: string; viewport: { w: number; h: number } };

const PRESETS: Record<string, Preset> = {
  mbp14: { id: "mbp14", name: "MacBook Pro 14\"", class: "laptop", viewport: { w: 1512, h: 982 } },
  "ipad-air11-portrait": {
    id: "ipad-air11-portrait",
    name: "iPad Air 11\"",
    class: "tablet",
    viewport: { w: 820, h: 1180 },
  },
  "iphone-standard": {
    id: "iphone-standard",
    name: "iPhone standard",
    class: "phone",
    viewport: { w: 393, h: 852 },
  },
};
const CYCLE = ["mbp14", "ipad-air11-portrait", "iphone-standard"] as const;

interface ChromeState {
  bounds: Bounds;
  inner: { w: number; h: number };
  devtoolsOpen: boolean;
  deviceMode: boolean;
  dockWidth: number;
  handoffActive: boolean;
}

function sizeOf(b: Bounds) {
  return { w: b.x2 - b.x1, h: b.y2 - b.y1 };
}
function fmt(b: Bounds) {
  const o = sizeOf(b);
  return `${o.w}×${o.h} @(${b.x1},${b.y1})`;
}
function syncInner(s: ChromeState) {
  const o = sizeOf(s.bounds);
  if (s.devtoolsOpen) {
    s.inner = {
      w: Math.max(0, o.w - CHROME_UI.w - s.dockWidth),
      h: Math.max(0, o.h - CHROME_UI.h),
    };
  } else {
    s.inner = { w: o.w - CHROME_UI.w, h: o.h - CHROME_UI.h };
  }
}
function measure(s: ChromeState) {
  syncInner(s);
  const o = sizeOf(s.bounds);
  return {
    bounds: { ...s.bounds },
    inner: { ...s.inner },
    avail: { ...AVAIL },
    outer: o,
    chromeW: o.w - s.inner.w,
    chromeH: o.h - s.inner.h,
  };
}
function setBounds(s: ChromeState, b: Bounds) {
  s.bounds = { ...b };
  syncInner(s);
}

function openDeviceMode(s: ChromeState, viewport: { w: number; h: number }, log: string[]) {
  if (!s.handoffActive) {
    s.devtoolsOpen = true;
    s.deviceMode = true;
    s.dockWidth = DEVTOOLS_DOCK;
    s.handoffActive = true;
    log.push(`  keystrokes → DevTools OPENED + deviceMode (first handoff)`);
  } else {
    log.push(`  skip keystrokes — handoff already active (no toggle-close)`);
  }

  const m = measure(s);
  const next = expandForDeviceMode(m.bounds, m.avail, viewport);
  if (next.changed) {
    setBounds(s, { x1: next.x1, y1: next.y1, x2: next.x2, y2: next.y2 });
    log.push(`  expand-only resize → ${fmt(s.bounds)}`);
  } else {
    log.push(`  window already large enough — no resize (${fmt(s.bounds)})`);
  }
  log.push(`  after: DT=${s.devtoolsOpen} handoff=${s.handoffActive} inner=${s.inner.w}×${s.inner.h}`);
}

function closeDeviceModeIfNeeded(s: ChromeState, log: string[]) {
  if (!s.handoffActive) return;
  s.devtoolsOpen = false;
  s.deviceMode = false;
  s.dockWidth = 0;
  s.handoffActive = false;
  log.push(`  closed DevTools (leaving phone handoff)`);
  syncInner(s);
}

function applyPreset(s: ChromeState, p: Preset, log: string[]) {
  const m1 = measure(s);
  log.push(
    `  measure: outer=${m1.outer.w}×${m1.outer.h} inner=${m1.inner.w}×${m1.inner.h} chromeΔ=${m1.chromeW}×${m1.chromeH}`,
  );
  const ow = Math.min(m1.avail.w, p.viewport.w + m1.chromeW);
  const oh = Math.min(m1.avail.h, p.viewport.h + m1.chromeH);
  const x1 = Math.min(Math.max(m1.bounds.x1, m1.avail.left), m1.avail.left + m1.avail.w - ow);
  const y1 = Math.min(Math.max(m1.bounds.y1, m1.avail.top), m1.avail.top + m1.avail.h - oh);
  setBounds(s, { x1, y1, x2: x1 + ow, y2: y1 + oh });
  const m2 = measure(s);
  const ok = m2.inner.w === p.viewport.w && m2.inner.h === p.viewport.h;
  log.push(
    `  resized for ${p.id} → ${fmt(s.bounds)} inner=${m2.inner.w}×${m2.inner.h}` +
      (ok ? " ✓" : ` (want ${p.viewport.w}×${p.viewport.h})`),
  );
}

function applyAndNotify(s: ChromeState, p: Preset, phoneMode: string, log: string[]) {
  if (p.class === "phone" && phoneMode === "devtools") {
    log.push(`→ ${p.name} via DevTools handoff`);
    openDeviceMode(s, p.viewport, log);
    return;
  }
  log.push(`→ ${p.name} via window resize`);
  closeDeviceModeIfNeeded(s, log);
  applyPreset(s, p, log);
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

console.log("\n═══ Fixed behavior: 6 cycle presses, phoneMode=devtools ═══");
{
  const s: ChromeState = {
    bounds: { x1: 100, y1: 50, x2: 1500, y2: 950 },
    inner: { w: 0, h: 0 },
    devtoolsOpen: false,
    deviceMode: false,
    dockWidth: 0,
    handoffActive: false,
  };
  syncInner(s);
  const startW = sizeOf(s.bounds).w;
  console.log(`start: ${fmt(s.bounds)}`);

  let index = 0;
  for (let i = 0; i < 6; i++) {
    const p = PRESETS[CYCLE[index]];
    const log: string[] = [];
    console.log(`\n[press ${i + 1}] ${p.name}`);
    applyAndNotify(s, p, "devtools", log);
    for (const line of log) console.log(line);
    index = (index + 1) % CYCLE.length;
  }

  assert(s.devtoolsOpen === true, "DevTools still open after 2nd phone hit (no toggle-close)");
  assert(s.handoffActive === true, "handoff flag still set");
  // iPad geometry step intentionally shrinks; don't require >= start width
}

console.log("\n═══ MBP → phone must NOT shrink a large window ═══");
{
  const s: ChromeState = {
    bounds: { x1: 100, y1: 50, x2: 100 + 1512, y2: 50 + 1069 },
    inner: { w: 0, h: 0 },
    devtoolsOpen: false,
    deviceMode: false,
    dockWidth: 0,
    handoffActive: false,
  };
  syncInner(s);
  const before = sizeOf(s.bounds).w;
  const log: string[] = [];
  applyAndNotify(s, PRESETS["iphone-standard"], "devtools", log);
  for (const line of log) console.log(line);
  assert(sizeOf(s.bounds).w === before, `phone handoff kept width ${before} (got ${sizeOf(s.bounds).w})`);
  assert(s.devtoolsOpen === true, "DevTools opened");

  // second phone press must not toggle-close
  const log2: string[] = [];
  applyAndNotify(s, PRESETS["iphone-standard"], "devtools", log2);
  for (const line of log2) console.log(line);
  assert(s.devtoolsOpen === true, "second phone press left DevTools open");
  assert(log2.some((l) => l.includes("skip") || l.includes("already")), "second press skipped keystrokes");
}

console.log("\n═══ Leaving phone → MBP closes DT and hits exact viewport ═══");
{
  const s: ChromeState = {
    bounds: { x1: 0, y1: 25, x2: 1512, y2: 25 + 1069 },
    inner: { w: 0, h: 0 },
    devtoolsOpen: true,
    deviceMode: true,
    dockWidth: DEVTOOLS_DOCK,
    handoffActive: true,
  };
  syncInner(s);
  const log: string[] = [];
  applyAndNotify(s, PRESETS.mbp14, "devtools", log);
  for (const line of log) console.log(line);
  assert(s.devtoolsOpen === false, "DevTools closed when leaving phone");
  assert(s.handoffActive === false, "handoff flag cleared");
  assert(s.inner.w === 1512, `MBP inner width exact (got ${s.inner.w})`);
}

console.log("\n═══ expandForDeviceMode never shrinks ═══");
{
  const large = { x1: 50, y1: 40, x2: 50 + 1600, y2: 40 + 1000 };
  const next = expandForDeviceMode(large, AVAIL, { w: 393, h: 852 });
  assert(!next.changed, "large window unchanged for phone viewport");
  assert(next.x2 - next.x1 === 1600, "width preserved");

  const tiny = { x1: 100, y1: 100, x2: 500, y2: 400 };
  const grown = expandForDeviceMode(tiny, AVAIL, { w: 393, h: 852 });
  assert(grown.changed, "tiny window expands");
  assert(grown.x2 - grown.x1 === 393 + DEVTOOLS_DOCK, "expands to viewport+dock");
  assert(grown.x1 === 100, "keeps origin x when it fits");
}

console.log("\nAll assertions passed.\n");
