export interface MobilePreviewPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

/** Viewport logici più diffusi (coprono ~95% dei telefoni). */
export const MOBILE_PREVIEW_PRESETS: MobilePreviewPreset[] = [
  { id: "android-360", label: "Android 360", width: 360, height: 800 },
  { id: "iphone-375", label: "iPhone 375", width: 375, height: 812 },
  { id: "iphone-390", label: "iPhone 390", width: 390, height: 844 },
  { id: "iphone-15-pro-max", label: "iPhone 15 Pro Max", width: 430, height: 932 },
  { id: "pixel-393", label: "Pixel 393", width: 393, height: 852 },
  { id: "samsung-412", label: "Samsung 412", width: 412, height: 915 },
];

export const DEFAULT_PREVIEW_PRESET_ID = "iphone-390";

export function getPreviewPreset(id: string): MobilePreviewPreset {
  return (
    MOBILE_PREVIEW_PRESETS.find((p) => p.id === id) ??
    MOBILE_PREVIEW_PRESETS.find((p) => p.id === DEFAULT_PREVIEW_PRESET_ID)!
  );
}
