Hi @pernielsentikaer, thanks for the careful review!

**DevTools handoff now acts on verified state.** Before sending ⌥⌘I, `openDeviceMode` reads the checkmark on **View → Developer → Developer Tools** through System Events. The stored flag is no longer used to decide:

- DevTools closed: open it plus the device toolbar, confirm it actually opened, and only then save the handoff flag.
- DevTools already open: send no keys. The device toolbar has no readable menu state, so we don't risk toggling it off, and the HUD says to press ⌘⇧M if it's off.
- State unreadable (e.g. no Accessibility permission): show an error toast and send no keystrokes.
- `closeDeviceModeIfNeeded` clears the flag first and only toggles when DevTools is verifiably open, so a stale flag can't reopen it.

**Window Sizer:** the3ash confirmed in #31219 that Chrome-specific behavior and DevTools integration are outside Window Sizer's scope, so they'd prefer to keep them separate.

**Also new:** a **Browser** preference (Google Chrome or Dia). Both are Chromium and share Chrome's AppleScript suite.

Ready for another look 🙏
