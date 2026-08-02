"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function usePersistedState<T extends string>(key: string, initial: T) {
  const getSnapshot = (): T =>
    (window.localStorage.getItem(key) as T | null) ?? initial;
  const getServerSnapshot = (): T => initial;

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = (next: T) => {
    window.localStorage.setItem(key, next);
    window.dispatchEvent(new Event("storage"));
  };

  return [value, setValue] as const;
}
