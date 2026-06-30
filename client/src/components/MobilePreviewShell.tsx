import React from "react";
import { useViewMode } from "@/hooks/useViewMode";

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
      <div className="demos-mobile-preview-device">
        <div className="demos-mobile-preview-notch" aria-hidden="true" />
        <div className="demos-mobile-preview-content">{children}</div>
      </div>
    </div>
  );
}
