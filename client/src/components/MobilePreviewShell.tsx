import React from "react";
import { useViewMode } from "@/hooks/useViewMode";

interface MobilePreviewShellProps {
  children: React.ReactNode;
}

/** Wrapper sempre presente: evita unmount/remount (e splash) al toggle Mobile/Desktop. */
export function MobilePreviewShell({ children }: MobilePreviewShellProps) {
  const { isMobilePreview, previewWidth, previewHeight, previewPreset } = useViewMode();

  return (
    <div className={isMobilePreview ? "demos-mobile-preview-shell" : "demos-app-shell"}>
      <div
        className={isMobilePreview ? "demos-mobile-preview-device" : "demos-app-shell__frame"}
        style={isMobilePreview ? { width: previewWidth, height: previewHeight } : undefined}
        data-preview-preset={isMobilePreview ? previewPreset.id : undefined}
      >
        {isMobilePreview && <div className="demos-mobile-preview-notch" aria-hidden="true" />}
        <div
          className={isMobilePreview ? "demos-mobile-preview-content" : "demos-app-shell__content"}
          style={isMobilePreview ? { width: previewWidth, height: previewHeight } : undefined}
        >
          {children}
        </div>
      </div>
      {isMobilePreview && (
        <p className="demos-mobile-preview-label" aria-hidden="true">
          {previewPreset.label} · {previewWidth}×{previewHeight}
        </p>
      )}
    </div>
  );
}
