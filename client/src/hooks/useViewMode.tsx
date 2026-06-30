import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  DEFAULT_PREVIEW_PRESET_ID,
  getPreviewPreset,
  MOBILE_PREVIEW_PRESETS,
  type MobilePreviewPreset,
} from "@/lib/mobile-preview-presets";

export type ViewMode = "auto" | "mobile";

const STORAGE_KEY = "demos_view_mode";
const STORAGE_KEY_PRESET = "demos_preview_preset";

interface ViewModeContextValue {
  viewMode: ViewMode;
  isMobilePreview: boolean;
  isRealDesktop: boolean;
  canTogglePreview: boolean;
  toggleMobilePreview: () => void;
  previewPreset: MobilePreviewPreset;
  previewPresets: MobilePreviewPreset[];
  setPreviewPreset: (id: string) => void;
  previewWidth: number;
  previewHeight: number;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

function readStoredMode(): ViewMode {
  if (typeof window === "undefined") return "auto";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "mobile" ? "mobile" : "auto";
}

function readStoredPresetId(): string {
  if (typeof window === "undefined") return DEFAULT_PREVIEW_PRESET_ID;
  const stored = localStorage.getItem(STORAGE_KEY_PRESET);
  return stored && getPreviewPreset(stored) ? stored : DEFAULT_PREVIEW_PRESET_ID;
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
  const [presetId, setPresetId] = useState<string>(readStoredPresetId);
  const [isRealDesktop, setIsRealDesktop] = useState(detectRealDesktop);

  const previewPreset = useMemo(() => getPreviewPreset(presetId), [presetId]);

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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PRESET, presetId);
    document.documentElement.style.setProperty("--demos-preview-width", `${previewPreset.width}px`);
    document.documentElement.style.setProperty("--demos-preview-height", `${previewPreset.height}px`);
  }, [presetId, previewPreset.width, previewPreset.height]);

  const toggleMobilePreview = useCallback(() => {
    setViewMode((current) => (current === "mobile" ? "auto" : "mobile"));
  }, []);

  const setPreviewPreset = useCallback((id: string) => {
    setPresetId(id);
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
      previewPreset,
      previewPresets: MOBILE_PREVIEW_PRESETS,
      setPreviewPreset,
      previewWidth: previewPreset.width,
      previewHeight: previewPreset.height,
    }),
    [
      viewMode,
      isMobilePreview,
      isRealDesktop,
      canTogglePreview,
      toggleMobilePreview,
      previewPreset,
      setPreviewPreset,
    ],
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
