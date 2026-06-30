import React from "react";
import { useViewMode } from "@/hooks/useViewMode";

/** Larghezza/altezza fisse del frame anteprima (iPhone 14). Vedi index.css */
export const MOBILE_PREVIEW_WIDTH = 390;
export const MOBILE_PREVIEW_HEIGHT = 844;

interface MobilePreviewShellProps {
  children: React.ReactNode;
}

export function MobilePreviewShell({ children }: MobilePreviewShellProps) {
  const { isMobilePreview } = useViewMode();

  if (!isMobilePreview) {
    return <>{children}</>;
  }

  return (
    <div className="demos-mobile-preview-shell">
      <div
        className="demos-mobile-preview-device"
        style={{ width: MOBILE_PREVIEW_WIDTH, height: MOBILE_PREVIEW_HEIGHT }}
      >
        <div className="demos-mobile-preview-notch" aria-hidden="true" />
        <div className="demos-mobile-preview-content">{children}</div>
      </div>
    </div>
  );
}
