import { Monitor, Smartphone } from "lucide-react";
import { useViewMode } from "@/hooks/useViewMode";
import { useMobileLayout } from "@/hooks/useMobileLayout";

export function MobilePreviewToggle() {
  const { viewMode, canTogglePreview, toggleMobilePreview } = useViewMode();
  const isMobileLayout = useMobileLayout();

  if (!canTogglePreview) return null;

  const isMobilePreview = viewMode === "mobile";

  return (
    <button
      type="button"
      onClick={toggleMobilePreview}
      className={`fixed z-[10000] flex items-center gap-1.5 rounded-full border border-slate-300 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-md backdrop-blur hover:bg-white hover:text-slate-900 ${
        isMobileLayout ? "bottom-4 right-4" : "top-4 right-4"
      }`}
      title={isMobilePreview ? "Torna alla vista desktop" : "Anteprima come su cellulare"}
      aria-label={isMobilePreview ? "Torna alla vista desktop" : "Anteprima come su cellulare"}
    >
      {isMobilePreview ? (
        <>
          <Monitor className="h-3.5 w-3.5" />
          Desktop
        </>
      ) : (
        <>
          <Smartphone className="h-3.5 w-3.5" />
          Mobile
        </>
      )}
    </button>
  );
}
