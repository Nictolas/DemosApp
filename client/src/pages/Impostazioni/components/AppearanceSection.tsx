import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  readColorSchemePreference,
  saveColorSchemePreference,
  type ColorSchemePreference,
} from "@/lib/colorScheme";

const OPTIONS: Array<{
  value: ColorSchemePreference;
  label: string;
  icon: typeof Monitor;
}> = [
  { value: "system", label: "Automatica", icon: Monitor },
  { value: "light", label: "Chiara", icon: Sun },
  { value: "dark", label: "Scura", icon: Moon },
];

export function AppearanceSection() {
  const [preference, setPreference] = React.useState<ColorSchemePreference>(readColorSchemePreference);

  function handleSelect(value: ColorSchemePreference) {
    saveColorSchemePreference(value);
    setPreference(value);
  }

  return (
    <Card className="border border-slate-200 bg-white/90 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Aspetto</CardTitle>
        <CardDescription>
          Automatica segue le impostazioni del dispositivo. La scelta rimane su questo dispositivo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div role="group" aria-label="Modalità di visualizzazione" className="grid grid-cols-3 gap-2">
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const selected = preference === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => handleSelect(value)}
                className={
                  "flex min-h-12 items-center justify-center gap-2 rounded-xl border px-2 py-3 text-sm font-semibold " +
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 " +
                  (selected
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
                }
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
