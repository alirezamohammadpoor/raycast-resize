# Resize

Raycast extension: viewport-accurate Chrome window presets for responsive dev. Full design in [SPEC.md](SPEC.md).

- Presets follow the **Chrome DevTools contract**: viewport = device dimensions (iPad Air → 820×1180).
- The local Chrome window's own UI is **measured live** (never guessed), so the *viewport* — not the outer window — hits the preset numbers exactly. Bookmarks bar, scrollbar mode, zoom all handled.
- All presets resize for real — programmatic bounds bypass Chrome's drag minimum, so even 320–440px phone widths work. Phone/iPad HUDs say "geometry only" (touch, DPR 3, dvh, safe areas still need a device or DevTools). A **Phone Presets** preference can route iPhone presets to DevTools device mode instead.

## Setup

1. `npm install && npm run dev` (imports the extension into Raycast).
2. Chrome → **View → Developer → Allow JavaScript from Apple Events** (one-time; needed to measure the viewport).
3. First resize prompts macOS to allow Raycast to control Chrome — accept.

## Commands

| Command | Use |
|---|---|
| Resize to Preset | Searchable device list; ⏎ resizes, `⌘C` copies dims, quicklink action creates a per-preset hotkey |
| Cycle Breakpoints | Bind to a hotkey (e.g. `⌥⌘R`), hit repeatedly to step through pinned widths |
| Apply Preset | No-view command with an argument — the target for Quicklink hotkeys |
| Add Custom Preset | Saves to `~/.config/resize/presets.json` |
| Measure Viewport | Diagnostic: viewport vs window bounds, chrome delta, zoom state |

## Custom presets

`~/.config/resize/presets.json` — hand-editable, dotfiles-friendly, merges over built-ins by `id`.

## Cycle configuration

The rotation is three dropdown slots in extension settings (⌘⇧, on any Resize command). A `cycle` array in `~/.config/resize/presets.json` overrides the slots — use it for more than 3 steps or to include custom presets. The hotkey itself is bound in Raycast: Configure Command → Hotkey.
