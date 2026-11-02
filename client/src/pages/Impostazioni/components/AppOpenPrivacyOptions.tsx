import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  areAppOpenPrivacyOptionsRequired,
  showAppOpenPrivacyOptions,
} from '@/lib/native-app-open-privacy';

/**
 * UMP privacy entry point — visible only if UMP explicitly requires it.
 * On Android release the native gate always reports false, so the UI
 * remains unchanged until the separate, reviewed advertising release.
 */
export function AppOpenPrivacyOptions({ compact = false }: { compact?: boolean }) {
  const [required, setRequired] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void areAppOpenPrivacyOptionsRequired().then(value => {
      if (active) setRequired(value);
    });
    return () => { active = false; };
  }, []);

  if (!required) return null;

  const openOptions = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await showAppOpenPrivacyOptions();
      setRequired(await areAppOpenPrivacyOptionsRequired());
    } catch {
      toast({
        title: 'Opzioni privacy non disponibili',
        description: 'Non è stato possibile aprire le preferenze pubblicitarie. Riprova più tardi.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        className="text-sm underline underline-offset-2 text-indigo-700 disabled:opacity-50"
        aria-label="Gestisci le scelte sulla privacy pubblicitaria"
        disabled={busy}
        onClick={() => void openOptions()}
      >
        Privacy pubblicitaria
      </button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          Privacy pubblicitaria
        </CardTitle>
        <CardDescription>
          Puoi rivedere o modificare le scelte relative ai servizi pubblicitari.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          className="w-full min-h-11"
          disabled={busy}
          aria-label="Modifica le preferenze privacy pubblicitarie"
          onClick={() => void openOptions()}
        >
          {busy ? 'Apertura in corso…' : 'Gestisci le scelte pubblicitarie'}
        </Button>
      </CardContent>
    </Card>
  );
}
