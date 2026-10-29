import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface OpinionActionsBarProps {
  onSave: () => void;
  onBack: () => void;
  isSaving: boolean;
  saveDisabled: boolean;
}

/**
 * Footer anchored in the app-main layout, above the shell's own bottom navbar.
 * The opinions list owns scrolling, so actions never cover the last question.
 */
export function OpinionActionsBar({ onSave, onBack, isSaving, saveDisabled }: OpinionActionsBarProps) {
  return (
    <footer aria-label="Azioni delle opinioni" className="z-10 w-full shrink-0 border-t border-slate-200 bg-white px-3 py-3 shadow-[0_-2px_8px_rgba(15,23,42,0.06)] sm:px-4">
      <div className="mx-auto flex w-full max-w-4xl items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isSaving}
          className="h-11 min-w-0 flex-1 text-base sm:flex-none sm:min-w-32"
        >
          Indietro
        </Button>
        <Button
          type="button"
          onClick={onSave}
          disabled={isSaving || saveDisabled}
          className="h-11 min-w-0 flex-[2] text-base sm:flex-none sm:min-w-64"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salva le mie opinioni"
          )}
        </Button>
      </div>
    </footer>
  );
}
