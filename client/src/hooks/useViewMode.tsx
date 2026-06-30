import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";

export type ViewMode = "auto" | "mobile";

const STORAGE_KEY = "demos_view_mode";

interface ViewModeContextValue {
  viewMode: ViewMode;
  isMobilePreview: boolean;
  isRealDesktop: boolean;
  canTogglePreview: boolean;
  toggleMobilePreview: () => void;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

function readStoredMode(): ViewMode {
  if (typeof window === "undefined") return "auto";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "mobile" ? "mobile" : "auto";
}

function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function detectRealDesktop(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth >= 768 && !isNativeApp();
}

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredMode);
  const [isRealDesktop, setIsRealDesktop] = useState(detectRealDesktop);

  useEffect(() => {
    const onResize = () => setIsRealDesktop(detectRealDesktop());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, viewMode);
    document.documentElement.dataset.demosViewMode = viewMode;
    document.documentElement.classList.toggle(
      "demos-mobile-preview-active",
      viewMode === "mobile" && isRealDesktop,
    );
  }, [viewMode, isRealDesktop]);

  const toggleMobilePreview = useCallback(() => {
    setViewMode((current) => (current === "mobile" ? "auto" : "mobile"));
  }, []);

  const isMobilePreview = viewMode === "mobile" && isRealDesktop;
  const canTogglePreview = isRealDesktop;

  const value = useMemo(
    () => ({
      viewMode,
      isMobilePreview,
      isRealDesktop,
      canTogglePreview,
      toggleMobilePreview,
    }),
    [viewMode, isMobilePreview, isRealDesktop, canTogglePreview, toggleMobilePreview],
  );

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode(): ViewModeContextValue {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error("useViewMode deve essere usato dentro ViewModeProvider");
  }
  return context;
}

export function useViewModeOptional(): ViewModeContextValue | null {
  return useContext(ViewModeContext);
}
