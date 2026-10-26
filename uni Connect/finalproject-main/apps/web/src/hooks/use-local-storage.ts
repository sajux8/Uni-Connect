"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "uniconnect:local-storage";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}

/**
 * Boolean preference persisted in localStorage, SSR-safe (no hydration mismatch,
 * no setState-in-effect). Storage can be blocked, so every access is guarded.
 */
export function useLocalStorageBoolean(key: string, defaultValue: boolean) {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? defaultValue : raw === "1";
      } catch {
        return defaultValue;
      }
    },
    () => defaultValue,
  );

  const setValue = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* storage unavailable: preference just won't persist */
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  return [value, setValue] as const;
}
