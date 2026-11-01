"use client";

import { useSyncExternalStore } from "react";

/** How the app is framed: a floating web window, or full screen as it would sit in Power Apps or Teams. */
export type Frame = "web" | "powerapps";

const KEY = "agfs-frame";
const listeners = new Set<() => void>();

function read(): Frame {
  try {
    return localStorage.getItem(KEY) === "powerapps" ? "powerapps" : "web";
  } catch {
    return "web";
  }
}

export function setFrame(frame: Frame) {
  try {
    localStorage.setItem(KEY, frame);
  } catch {
    // Private mode: the choice just won't persist.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => e.key === KEY && l();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useFrame(): Frame {
  return useSyncExternalStore(subscribe, read, () => "web");
}
