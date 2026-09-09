/**
 * Simulates Cycle Breakpoints + DevTools handoff against a fake Chrome window.
 * Answers the "global hotkey + DevTools makes window small" failure mode.
 *
 * Run: npx tsx scripts/simulate-cycle-devtools.ts
 */

const DEVTOOLS_DOCK = 620;
const CHROME_UI = { w: 0, h: 87 }; // toolbar+tab strip approx when DT closed
const AVAIL = { w: 1728, h: 1055, left: 0, top: 25 }; // external monitor-ish

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

const CYCLE = ["mbp14", "ipad-air11-portrait", "iphone-standard"];

interface ChromeState {
  bounds: Bounds;
  /** Content viewport CSS px (what innerWidth reports) */
  inner: { w: number; h: number };
  devtoolsOpen: boolean;
  deviceMode: boolean;
  /** When device mode on, emulated device width consumes part of content area */
  dockWidth: number;
}

function outer(b: Bounds) {
  return { w: b.x2 - b.x1, h: b.y2 - b.y1 };
}

function fmt(b: Bounds) {
  const o = outer(b);
  return `${o.w}×${o.h} @(${b.x1},${b.y1})`;
}

function syncInner(s: ChromeState) {
  const o = outer(s.bounds);
  if (s.devtoolsOpen) {
    // Docked DT steals width from the page viewport
    const contentW = Math.max(0, o.w - CHROME_UI.w - s.dockWidth);
    const contentH = Math.max(0, o.h - CHROME_UI.h);
    if (s.deviceMode) {
      // Device mode: innerWidth is the emulated device size (user-picked);
      // we don't know which device — approximate as min(content, last phone) not tracked.
      // Before user picks, Chrome often keeps previous page size or a default.
      // Model: inner reflects remaining content pane (not yet locked to a device).
      s.inner = { w: contentW, h: contentH };
    } else {
      s.inner = { w: contentW, h: contentH };
    }
  } else {
    s.inner = { w: o.w - CHROME_UI.w, h: o.h - CHROME_UI.h };
  }
}

function measure(s: ChromeState) {
  syncInner(s);
  const o = outer(s.bounds);
  return {
    bounds: { ...s.bounds },
    inner: { ...s.inner },
    zoom: 1,
    avail: { ...AVAIL },
    outer: o,
    chromeW: o.w - s.inner.w,
    chromeH: o.h - s.inner.h,
  };
}

function setBounds(s: ChromeState, x1: number, y1: number, x2: number, y2: number) {
  s.bounds = { x1, y1, x2, y2 };
  syncInner(s);
}

/** Mirrors src/devtools.ts openDeviceMode */
function openDeviceMode(s: ChromeState, viewport: { w: number; h: number }, log: string[]) {
  // ⌥⌘I is a TOGGLE
  s.devtoolsOpen = !s.devtoolsOpen;
  if (!s.devtoolsOpen) {
    s.deviceMode = false;
    s.dockWidth = 0;
    log.push(`  keystroke ⌥⌘I → DevTools CLOSED (toggle)`);
  } else {
    log.push(`  keystroke ⌥⌘I → DevTools OPENED`);
    // ⌘⇧M toggles device mode
    s.deviceMode = !s.deviceMode;
    s.dockWidth = s.devtoolsOpen ? DEVTOOLS_DOCK : 0;
    log.push(`  keystroke ⌘⇧M → deviceMode=${s.deviceMode}`);
  }

  // Then forced resize (current code always does this)
  const m = measure(s);
  const outerW = Math.min(m.avail.w, viewport.w + DEVTOOLS_DOCK);
  setBounds(s, m.avail.left, m.avail.top, m.avail.left + outerW, m.avail.top + m.avail.h);
  log.push(`  forced resize → ${fmt(s.bounds)} (viewport+dock=${viewport.w}+${DEVTOOLS_DOCK})`);
  log.push(`  after: DT=${s.devtoolsOpen} deviceMode=${s.deviceMode} inner=${s.inner.w}×${s.inner.h}`);
}

/** Mirrors src/resize.ts applyPreset */
function applyPreset(s: ChromeState, p: Preset, log: string[]) {
  const m1 = measure(s);
  log.push(`  measure: outer=${m1.outer.w}×${m1.outer.h} inner=${m1.inner.w}×${m1.inner.h} chromeΔ=${m1.chromeW}×${m1.chromeH}`);

  let outerW = p.viewport.w + m1.chromeW;
  let outerH = p.viewport.h + m1.chromeH;
  const clamped = outerW > m1.avail.w || outerH > m1.avail.h;
  outerW = Math.min(outerW, m1.avail.w);
  outerH = Math.min(outerH, m1.avail.h);

  const x1 = Math.min(Math.max(m1.bounds.x1, m1.avail.left), m1.avail.left + m1.avail.w - outerW);
  const y1 = Math.min(Math.max(m1.bounds.y1, m1.avail.top), m1.avail.top + m1.avail.h - outerH);
  setBounds(s, x1, y1, x1 + outerW, y1 + outerH);

  const m2 = measure(s);
  log.push(
    `  resized for ${p.id} → ${fmt(s.bounds)} inner=${m2.inner.w}×${m2.inner.h}` +
      (clamped ? " CLAMPED" : "") +
      (m2.inner.w === p.viewport.w && m2.inner.h === p.viewport.h ? " ✓" : ` (want ${p.viewport.w}×${p.viewport.h})`),
  );
}

function applyAndNotify(s: ChromeState, p: Preset, phoneMode: string, log: string[]) {
  if (p.class === "phone" && phoneMode === "devtools") {
    log.push(`→ ${p.name} via DevTools handoff`);
    openDeviceMode(s, p.viewport, log);
    return;
  }
  log.push(`→ ${p.name} via window resize`);
  applyPreset(s, p, log);
}

function runScenario(title: string, phoneMode: string, presses: number, start?: Partial<ChromeState>) {
  console.log(`\n═══ ${title} ═══`);
  console.log(`phoneMode=${phoneMode}  cycle=${CYCLE.join(" → ")}  presses=${presses}`);

  const s: ChromeState = {
    bounds: { x1: 100, y1: 50, x2: 100 + 1400, y2: 50 + 900 },
    inner: { w: 0, h: 0 },
    devtoolsOpen: false,
    deviceMode: false,
    dockWidth: 0,
    ...start,
  };
  syncInner(s);
  console.log(`start: ${fmt(s.bounds)} inner=${s.inner.w}×${s.inner.h} DT=${s.devtoolsOpen}`);

  let index = 0;
  for (let i = 0; i < presses; i++) {
    const id = CYCLE[index % CYCLE.length];
    const p = PRESETS[id];
    const log: string[] = [];
    console.log(`\n[press ${i + 1}] ${index + 1}/${CYCLE.length} · ${p.name}`);
    applyAndNotify(s, p, phoneMode, log);
    for (const line of log) console.log(line);
    index = (index + 1) % CYCLE.length;
  }

  console.log(`\nend: ${fmt(s.bounds)} inner=${s.inner.w}×${s.inner.h} DT=${s.devtoolsOpen} deviceMode=${s.deviceMode}`);
  return s;
}

// --- Scenarios answering the grill questions ---

runScenario("A: default cycle, DevTools phone mode, 6 presses (2 full rotations)", "devtools", 6);

runScenario("B: same but phoneMode=resize (geometry only)", "resize", 6);

runScenario(
  "C: DevTools already open before first phone hit (user had DT open)",
  "devtools",
  4,
  {
    bounds: { x1: 0, y1: 25, x2: 1600, y2: 1080 },
    devtoolsOpen: true,
    deviceMode: false,
    dockWidth: DEVTOOLS_DOCK,
  },
);

// D: quantify the "small window" on phone handoff from a large MBP-sized window
{
  console.log(`\n═══ D: size delta on phone DevTools handoff ═══`);
  const s: ChromeState = {
    bounds: { x1: 0, y1: 25, x2: 1512 + CHROME_UI.w, y2: 25 + 982 + CHROME_UI.h },
    inner: { w: 0, h: 0 },
    devtoolsOpen: false,
    deviceMode: false,
    dockWidth: 0,
  };
  syncInner(s);
  const before = outer(s.bounds);
  const log: string[] = [];
  openDeviceMode(s, PRESETS["iphone-standard"].viewport, log);
  const after = outer(s.bounds);
  console.log(`before phone handoff: ${before.w}×${before.h}`);
  console.log(`after phone handoff:  ${after.w}×${after.h}`);
  console.log(`Δ width: ${after.w - before.w}  Δ height: ${after.h - before.h}`);
  console.log(`forced width formula: min(avail=${AVAIL.w}, 393+620=${393 + DEVTOOLS_DOCK}) = ${Math.min(AVAIL.w, 393 + DEVTOOLS_DOCK)}`);
  console.log(`forced height: full avail.h = ${AVAIL.h} (ignores previous height)`);
}

// E: after phone DT open, next MBP press — chrome delta poisoning
{
  console.log(`\n═══ E: MBP resize while DevTools still docked ═══`);
  const s: ChromeState = {
    bounds: { x1: 0, y1: 25, x2: 1013, y2: 25 + AVAIL.h },
    inner: { w: 0, h: 0 },
    devtoolsOpen: true,
    deviceMode: true,
    dockWidth: DEVTOOLS_DOCK,
  };
  syncInner(s);
  const log: string[] = [];
  applyPreset(s, PRESETS.mbp14, log);
  for (const line of log) console.log(line);
  console.log(`Note: chromeW includes ${DEVTOOLS_DOCK}px dock → outer grows to fit 1512+dock, or clamps.`);
  console.log(`DevTools still open=${s.devtoolsOpen} — never closed when leaving phone step.`);
}
