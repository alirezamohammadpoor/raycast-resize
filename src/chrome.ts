import { runAppleScript } from "@raycast/utils";
import { getBrowser } from "./browser";

export interface Measurement {
  bounds: { x1: number; y1: number; x2: number; y2: number };
  inner: { w: number; h: number };
  dpr: number;
  // Browser zoom factor: outer window in points (AppleScript) ÷ outer window in
  // CSS px (window.outerWidth). 1.0 at 100% zoom on any display, independent of
  // Retina backing scale — unlike devicePixelRatio, which is an integer at 150%,
  // 200%, 50% zoom and cannot distinguish those from 100%.
  zoom: number;
  avail: { w: number; h: number; left: number; top: number };
}

export function setupHint(label = getBrowser().label): string {
  return `Enable ${label} → View → Developer → "Allow JavaScript from Apple Events" (restart ${label} if just toggled), then retry`;
}

const INTERNAL_PAGE = /^(chrome|chrome-extension|dia|about|devtools):/;

// No string literals inside the JS payload — it is embedded in an AppleScript string.
const MEASURE_JS =
  "JSON.stringify({iw:window.innerWidth,ih:window.innerHeight,ow:window.outerWidth," +
  "dpr:window.devicePixelRatio,aw:screen.availWidth,ah:screen.availHeight," +
  "al:screen.availLeft||0,at:screen.availTop||0})";

const measureScript = (app: string) => `
tell application "${app}"
	if (count of windows) is 0 then return "ERR:NO_WINDOW"
	set theURL to ""
	try
		set theURL to URL of active tab of front window
	end try
	set b to bounds of front window
	set bs to ((item 1 of b) as text) & "," & ((item 2 of b) as text) & "," & ((item 3 of b) as text) & "," & ((item 4 of b) as text)
	set js to missing value
	try
		set js to execute active tab of front window javascript "${MEASURE_JS}"
	on error errMsg
		return "ERR:JS:" & theURL & " ::: " & errMsg
	end try
	if js is missing value then return "ERR:JSNULL:" & theURL
	return bs & "|" & (js as text)
end tell`;

export async function measure(): Promise<Measurement> {
  const { app, label } = getBrowser();
  const out = (await runAppleScript(measureScript(app))).trim();

  if (out === "ERR:NO_WINDOW") throw new Error(`No ${label} window open`);
  if (out.startsWith("ERR:JS")) {
    const detail = out.replace(/^ERR:JS(NULL)?:/, "");
    const url = detail.split(" ::: ")[0].trim();
    if (INTERNAL_PAGE.test(url) || url === "") {
      throw new Error(
        `Active tab is an internal ${label} page (${url || "new tab"}) — JS can't run there. Focus a regular website tab and retry.`,
      );
    }
    const browserMsg = detail.split(" ::: ")[1]?.trim() ?? "";
    if (browserMsg.includes("turned off") || out.startsWith("ERR:JSNULL")) throw new Error(setupHint(label));
    throw new Error(browserMsg || setupHint(label));
  }

  const [boundsStr, json] = out.split("|");
  const [x1, y1, x2, y2] = boundsStr.split(",").map(Number);
  const d = JSON.parse(json);
  if ([x1, y1, x2, y2, d.iw, d.ih, d.ow].some((n) => !Number.isFinite(n)) || d.ow <= 0) {
    throw new Error(`Could not parse ${label} measurement: ${out}`);
  }
  return {
    bounds: { x1, y1, x2, y2 },
    inner: { w: d.iw, h: d.ih },
    dpr: d.dpr,
    zoom: (x2 - x1) / d.ow,
    avail: { w: d.aw, h: d.ah, left: d.al, top: d.at },
  };
}

export async function setBounds(x1: number, y1: number, x2: number, y2: number): Promise<void> {
  const coords = [x1, y1, x2, y2].map(Math.round).join(", ");
  await runAppleScript(`tell application "${getBrowser().app}" to set bounds of front window to {${coords}}`);
}
