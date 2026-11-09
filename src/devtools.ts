import { closeMainWindow, LocalStorage, showHUD } from "@raycast/api";
import { runAppleScript, showFailureToast } from "@raycast/utils";
import { getBrowser } from "./browser";
import { measure, setBounds } from "./chrome";
import { expandForDeviceMode } from "./devtools-geometry";

export { DEVTOOLS_DOCK, expandForDeviceMode } from "./devtools-geometry";

/** Set only after we opened DevTools ourselves and then verified it is open. */
export const DT_HANDOFF_KEY = "devtools-handoff-active";

type DevToolsState = "open" | "closed" | "unknown";

// The browser blocks opening DevTools programmatically except via keystrokes, so
// this needs Raycast's Accessibility permission (System Events). ⌥⌘I is a toggle,
// so we never send it on a remembered flag alone: we read the checkmark on the
// View → Developer → Developer Tools menu item first and act on that.
const stateScript = (app: string) => `
tell application "${app}" to activate
delay 0.2
tell application "System Events"
	if not (exists process "${app}") then return "unknown"
	tell process "${app}"
		repeat with top in menu bar items of menu bar 1
			try
				repeat with sub in menu items of menu 1 of top
					try
						set mi to menu item "Developer Tools" of menu 1 of sub
						set mark to value of attribute "AXMenuItemMarkChar" of mi
						if mark is missing value or mark is "" then return "closed"
						return "open"
					end try
				end repeat
			end try
		end repeat
	end tell
end tell
return "unknown"`;

const OPEN_KEYS = `
tell application "System Events"
	keystroke "i" using {command down, option down}
	delay 0.5
	keystroke "m" using {command down, shift down}
end tell`;

const TOGGLE_DEVTOOLS_KEYS = `
tell application "System Events"
	keystroke "i" using {command down, option down}
end tell`;

async function devToolsState(): Promise<DevToolsState> {
  try {
    const out = (await runAppleScript(stateScript(getBrowser().app))).trim();
    return out === "open" || out === "closed" ? out : "unknown";
  } catch {
    return "unknown";
  }
}

export async function openDeviceMode(deviceName: string, viewport?: { w: number; h: number }): Promise<void> {
  const { label } = getBrowser();
  let previousBounds: { x1: number; y1: number; x2: number; y2: number } | undefined;

  try {
    await closeMainWindow();

    // A remembered flag can be stale (DevTools closed by hand), so drop it and
    // re-derive everything from the real menu state.
    await LocalStorage.removeItem(DT_HANDOFF_KEY);
    const before = await devToolsState();
    if (before === "unknown") {
      throw new Error(`Couldn't read ${label}'s Developer Tools state — check Raycast's Accessibility permission`);
    }

    let openedByUs = false;
    if (before === "closed") {
      await runAppleScript(OPEN_KEYS);
      if ((await devToolsState()) !== "open") {
        throw new Error(`${label} DevTools didn't open`);
      }
      openedByUs = true;
    }

    if (viewport) {
      // Measurement must succeed for a complete handoff — never report success
      // after a swallowed measure failure (store review feedback).
      const m = await measure();
      previousBounds = m.bounds;
      const next = expandForDeviceMode(m.bounds, m.avail, viewport);
      if (next.changed) {
        await setBounds(next.x1, next.y1, next.x2, next.y2);
      }
    }

    if (openedByUs) await LocalStorage.setItem(DT_HANDOFF_KEY, "1");

    // ⌘⇧M (device toolbar) has no readable menu state, so when DevTools was
    // already open we leave it alone rather than risk toggling it off.
    await showHUD(
      openedByUs
        ? `DevTools device mode — pick “${deviceName}”`
        : `DevTools already open — pick “${deviceName}” (⌘⇧M if the device toolbar is off)`,
    );
  } catch (e) {
    if (previousBounds) {
      try {
        await setBounds(previousBounds.x1, previousBounds.y1, previousBounds.x2, previousBounds.y2);
      } catch {
        // best-effort restore
      }
    }
    await showFailureToast(e, {
      title: "Couldn't open DevTools — Raycast may need Accessibility permission",
    });
  }
}

/**
 * Close DevTools if our handoff opened them, so window resizes measure clean
 * chrome. Only toggles when DevTools is verifiably open; the flag is cleared
 * either way so a stale entry can't drive a later toggle.
 */
export async function closeDeviceModeIfNeeded(): Promise<void> {
  const active = (await LocalStorage.getItem<string>(DT_HANDOFF_KEY)) === "1";
  if (!active) return;
  await LocalStorage.removeItem(DT_HANDOFF_KEY);
  if ((await devToolsState()) !== "open") return;
  try {
    await runAppleScript(TOGGLE_DEVTOOLS_KEYS);
  } catch {
    // best-effort; the next measure() surfaces any leftover dock
  }
}
