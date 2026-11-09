import { getPreferenceValues } from "@raycast/api";

export interface Browser {
  /** AppleScript application name, also the System Events process name. */
  app: string;
  /** Short name for HUDs and errors. */
  label: string;
}

const BROWSERS: Record<string, Browser> = {
  chrome: { app: "Google Chrome", label: "Chrome" },
  dia: { app: "Dia", label: "Dia" },
};

/** The browser picked in extension preferences. Both are Chromium and share Chrome's AppleScript suite. */
export function getBrowser(): Browser {
  const { browser } = getPreferenceValues<{ browser?: string }>();
  return BROWSERS[browser ?? "chrome"] ?? BROWSERS.chrome;
}
