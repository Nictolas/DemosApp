import { Monitor, Smartphone } from "lucide-react";
import { useViewMode } from "@/hooks/useViewMode";
import { useMobileLayout } from "@/hooks/useMobileLayout";

export function MobilePreviewToggle() {
  const {
    canTogglePreview,
    toggleMobilePreview,
    previewPreset,
    previewPresets,
    setPreviewPreset,
    isMobilePreview,
  } = useViewMode();
  const isMobileLayout = useMobileLayout();

  if (!canTogglePreview) return null;

  if (!isMobilePreview) {
    return (
      <button
        type="button"
        onClick={toggleMobilePreview}
        className="fixed top-4 right-4 z-10000 flex items-center gap-1.5 rounded-full border border-slate-300 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-md backdrop-blur-sm hover:bg-white hover:text-slate-900"
        title="Anteprima come su cellulare"
        aria-label="Anteprima come su cellulare"
      >
        <Smartphone className="h-3.5 w-3.5" />
        Mobile
      </button>
    );
  }

  return (
    <div
      className={`fixed z-10000 flex flex-col items-end gap-2 ${
        isMobileLayout ? "bottom-4 right-4" : "top-4 right-4"
      }`}
    >
      <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white/95 px-2 py-1.5 shadow-md backdrop-blur-sm">
        <label htmlFor="demos-preview-preset" className="sr-only">
          Formato schermo anteprima
        </label>
        <select
          id="demos-preview-preset"
          value={previewPreset.id}
          onChange={(e) => setPreviewPreset(e.target.value)}
          className="max-w-34 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          title="Scegli dimensione schermo"
        >
          {previewPresets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={toggleMobilePreview}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          title="Torna alla vista desktop"
          aria-label="Torna alla vista desktop"
        >
          <Monitor className="h-3.5 w-3.5" />
          Desktop
        </button>
      </div>
    </div>
  );
}
