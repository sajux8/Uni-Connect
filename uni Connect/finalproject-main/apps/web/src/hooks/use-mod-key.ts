"use client";

import { useSyncExternalStore } from "react";

/** "⌘" on Apple devices, "Ctrl" elsewhere, for keyboard-shortcut hints. */
export function useModKey(): string {
  return useSyncExternalStore(
    () => () => {},
    () => (/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}
