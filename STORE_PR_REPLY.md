Hi @pernielsentikaer — going the **standalone** route (Chrome-specific AppleScript + DevTools handoff doesn’t fit Window Sizer’s general window-resize model).

Addressed your checklist:

- Renamed to **Chrome Viewport** (`chrome-viewport`) with a one-sentence description and `Chrome` command subtitles
- Removed `SPEC.md` (+ README link)
- Store-ready README (setup only; no clone-from-source section)
- Custom presets now use `environment.supportPath` (legacy `~/.config/resize` migrated on first read)
- `List.EmptyView` on Resize to Preset; presets load via `usePromise` (no unsafe render-time load)
- DevTools handoff: measurement failure after shortcuts no longer shows a success HUD; prior bounds restored when possible

Ready for another look when you have a moment 🙏
