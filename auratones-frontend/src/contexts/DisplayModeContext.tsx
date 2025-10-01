// src/contexts/DisplayModeContext.tsx

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

export type DisplayMode = "symbol" | "text";

type Ctx = {
  mode: DisplayMode;
  setMode: (m: DisplayMode) => void;
  toggle: () => void;
};

const DisplayModeContext = createContext<Ctx | undefined>(undefined);

const STORAGE_KEY = "auratones.displayMode";

export const DisplayModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<DisplayMode>(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    return (saved === "text" || saved === "symbol") ? saved : "symbol";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
  }, [mode]);

  const setModeSafe = useCallback((m: DisplayMode) => setMode(m), []);
  const toggle = useCallback(() => setMode(m => (m === "symbol" ? "text" : "symbol")), []);

  const value = useMemo(() => ({ mode, setMode: setModeSafe, toggle }), [mode, setModeSafe, toggle]);

  return <DisplayModeContext.Provider value={value}>{children}</DisplayModeContext.Provider>;
};

export const useDisplayMode = (): Ctx => {
  const ctx = useContext(DisplayModeContext);
  if (!ctx) throw new Error("useDisplayMode must be used within DisplayModeProvider");
  return ctx;
};
