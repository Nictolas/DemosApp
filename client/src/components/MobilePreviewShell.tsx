import React from "react";
import { useViewMode } from "@/hooks/useViewMode";

interface MobilePreviewShellProps {
  children: React.ReactNode;
}

export function MobilePreviewShell({ children }: MobilePreviewShellProps) {
  const { isMobilePreview, previewWidth, previewHeight, previewPreset } = useViewMode();

  if (!isMobilePreview) {
    return <>{children}</>;
  }

  return (
    <div className="demos-mobile-preview-shell">
      <div
        className="demos-mobile-preview-device"
        style={{ width: previewWidth, height: previewHeight }}
        data-preview-preset={previewPreset.id}
      >
        <div className="demos-mobile-preview-notch" aria-hidden="true" />
        <div
          className="demos-mobile-preview-content"
          style={{ width: previewWidth, height: previewHeight }}
        >
          {children}
        </div>
      </div>
      <p className="demos-mobile-preview-label" aria-hidden="true">
        {previewPreset.label} · {previewWidth}×{previewHeight}
      </p>
    </div>
  );
}
