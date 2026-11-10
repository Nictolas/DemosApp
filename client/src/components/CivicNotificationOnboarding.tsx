import { useEffect, useRef, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { isNativePushEnabled } from "@/lib/native-push";
import apiRequest from "@/lib/api-request";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type CivicKey = "iniziative_popolari" | "referendum_abrogativi" | "eci";
type CivicChoices = Record<CivicKey, boolean>;
type SavedPreferences = Record<string, boolean> & CivicChoices;

const CIVIC_KEYS: CivicKey[] = ["iniziative_popolari", "referendum_abrogativi", "eci"];
const PREFERENCE_KEYS = [
  "eurodeputato", "senatore", "deputato", "consigliere_regionale",
  "consigliere_comunale", "attivisti", "demos", "scuola", "animali",
  "organizzazioni", ...CIVIC_KEYS,
];
const DEFAULT_CHOICES: CivicChoices = {
  iniziative_popolari: true,
  referendum_abrogativi: true,
  eci: true,
};
const OPTIONS: { key: CivicKey; label: string }[] = [
  { key: "iniziative_popolari", label: "Iniziative popolari italiane" },
  { key: "referendum_abrogativi", label: "Referendum abrogativi" },
  { key: "eci", label: "Iniziative dei cittadini europei (ICE/ECI)" },
];

function isCompletePreferences(value: unknown): value is SavedPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return PREFERENCE_KEYS.every((key) =>
    typeof (value as Record<string, unknown>)[key] === "boolean"
  );
}

function onboardingKey(userId: string): string {
  return "demos_civic_onboarding_v1_" + userId;
}

/**
 * Android-only, per-account, per-installation first-login prompt.
 * A selection is only persisted after an explicit tap on "Attiva".
 * "Non ora" never writes a preference or requests OS permission.
 */
export function CivicNotificationOnboarding() {
  const { user, isLoading: authLoading } = useAuth();
  const activeAccountId = useRef(user?.id);
  activeAccountId.current = user?.id;
  const push = usePushNotifications();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<SavedPreferences | null>(null);
  const [choices, setChoices] = useState<CivicChoices>(DEFAULT_CHOICES);

  useEffect(() => {
    const userId = user?.id;
    if (authLoading || !userId || !isNativePushEnabled()) {
      setOpen(false);
      return;
    }
    try {
      if (localStorage.getItem(onboardingKey(userId)) === "done") return;
    } catch {
      // If storage is unavailable the dialog can still be dismissed safely.
    }

    let cancelled = false;
    setPreferences(null);
    setChoices(DEFAULT_CHOICES);
    setError(null);
    setLoading(true);

    void apiRequest.get<{ preferenze: SavedPreferences }>("/notifiche/preferenze")
      .then((result) => {
        if (cancelled) return;
        if (!result.success || !isCompletePreferences(result.data?.preferenze)) {
          setError("Impossibile caricare le preferenze. Riprova o scegli Non ora.");
        } else {
          const loaded = result.data.preferenze;
          setPreferences(loaded);
          if (CIVIC_KEYS.some((key) => loaded[key])) {
            // Already configured explicitly: don't ask again or overwrite it.
            try { localStorage.setItem(onboardingKey(userId), "done"); } catch { /* no-op */ }
            return;
          }
        }
        setOpen(true);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Impossibile caricare le preferenze. Riprova più tardi.");
          setOpen(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [user?.id, authLoading]);

  const finish = () => {
    if (user?.id) {
      try { localStorage.setItem(onboardingKey(user.id), "done"); } catch { /* no-op */ }
    }
    setOpen(false);
  };

  const confirm = async () => {
    if (!user?.id || !preferences || saving || !CIVIC_KEYS.some((key) => choices[key])) return;
    const initiatingUser = user.id;
    setSaving(true);
    setError(null);
    try {
      // Re-read before writing, to avoid replacing a recently changed preference
      // with a stale onboarding snapshot. Never post fallback values.
      const current = await apiRequest.get<{ preferenze: SavedPreferences }>("/notifiche/preferenze");
      if (!current.success || !isCompletePreferences(current.data?.preferenze)) {
        throw new Error("PREFERENCES_READ_FAILED");
      }
      if (activeAccountId.current !== initiatingUser) return;
      const result = await apiRequest.post("/notifiche/preferenze", {
        preferenze: { ...current.data.preferenze, ...choices },
      });
      if (!result.success) throw new Error("PREFERENCES_SAVE_FAILED");

      if (activeAccountId.current !== initiatingUser) return;
      finish();

      // Android system permission is requested only after explicit consent
      // and successful server persistence. Denial leaves category preferences
      // available for later edits, without repeated popups.
      if (push.permission === "default") {
        await push.requestPermission();
      } else if (push.permission === "granted") {
        await push.getToken();
      } else if (push.permission === "denied") {
        toast({
          title: "Notifiche bloccate sul dispositivo",
          description: "Puoi consentirle nelle impostazioni Android.",
        });
      }
    } catch {
      setError("Salvataggio non riuscito. Nessuna nuova preferenza è stata confermata.");
    } finally {
      setSaving(false);
    }
  };

  if (!isNativePushEnabled()) return null;
  const allSelected = CIVIC_KEYS.every((key) => choices[key]);
  const hasSelection = CIVIC_KEYS.some((key) => choices[key]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) finish(); }}>
      <DialogContent
        className="max-h-[85dvh] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl sm:max-w-md"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            <Bell className="h-5 w-5" /> Resta aggiornato con DEMOS
          </DialogTitle>
          <DialogDescription className="text-left">
            Scegli quali nuove raccolte firme ufficiali vuoi conoscere.
            Puoi modificare le scelte in qualsiasi momento da Preferenze notifiche.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-semibold">
            <Checkbox
              aria-label="Attiva tutte le notifiche civiche"
              checked={allSelected}
              onCheckedChange={(checked) => {
                const enabled = checked === true;
                setChoices({
                  iniziative_popolari: enabled,
                  referendum_abrogativi: enabled,
                  eci: enabled,
                });
              }}
              disabled={saving || loading}
            />
            Attiva tutte le notifiche civiche
          </label>
          <div className="space-y-2 pl-2">
            {OPTIONS.map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-center gap-3 py-2 text-sm">
                <Checkbox
                  checked={choices[key]}
                  onCheckedChange={(checked) =>
                    setChoices((previous) => ({ ...previous, [key]: checked === true }))
                  }
                  disabled={saving || loading}
                  aria-label={label}
                />
                {label}
              </label>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">{error}</p>
          )}
          <p className="text-xs text-gray-600">
            Se confermi, Android ti chiederà anche il permesso per mostrare le notifiche.
            Nessuna categoria viene attivata senza la tua conferma.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => void confirm()} disabled={saving || loading || !preferences || !hasSelection}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvataggio...</> : "Continua e attiva"}
            </Button>
            <Button variant="outline" onClick={finish} disabled={saving}>Non ora</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
