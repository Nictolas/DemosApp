import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Eye } from 'lucide-react';

/**
 * Presentation-only preview of two future AdSense layouts:
 * - installed mobile PWA: a closeable full-screen vignette-style DEMO
 * - desktop browser: an unobtrusive banner DEMO
 * - mobile browser: a compact banner DEMO
 *
 * NEVER loads a network ad, tracks an impression, writes browser storage,
 * auto-opens on app launch or replaces actual AdSense vignette triggers.
 * This is not Android's native AdMob App Open implementation.
 */
function isInstalledWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneDisplayMode = window.matchMedia?.('(display-mode: standalone)').matches === true;
  // iOS Safari Home Screen web apps expose navigator.standalone.
  const standaloneIos = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standaloneDisplayMode || standaloneIos;
}

function isDesktopBrowser(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(min-width: 900px)').matches === true;
}

export function WebAdvertisingPreview() {
  const [open, setOpen] = useState(false);

  // Never confuse the native Android AdMob flow with a web-only preview.
  if (Capacitor.isNativePlatform()) return null;

  const mode = isInstalledWebApp() ? 'standalone' :
    isDesktopBrowser() ? 'desktop' : 'mobile-browser';
  const installed = mode === 'standalone';
  const desktop = mode === 'desktop';

  return (
    <>
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-5 w-5" aria-hidden="true" />
            Anteprima pubblicità web
          </CardTitle>
          <CardDescription>
            {installed
              ? 'Simula un annuncio a schermo intero nella web app installata.'
              : desktop
                ? 'Simula un banner sulla versione per computer.'
                : 'Simula un banner discreto nel browser del telefono.'}
            {' '}Non è una pubblicità di Google e non genera guadagni.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="w-full min-h-11"
            onClick={() => setOpen(true)}
          >
            Visualizza annuncio dimostrativo
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={installed
          ? 'fixed inset-0 left-0 top-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col justify-center overflow-y-auto rounded-none p-6'
          : 'w-[calc(100vw-1.5rem)] max-w-2xl rounded-xl p-5'
        }>
          <DialogHeader>
            <DialogTitle>
              {installed ? 'Anteprima a schermo intero (PWA)' : 'Anteprima banner web'}
            </DialogTitle>
            <DialogDescription>
              Simulazione locale: non è un annuncio Google AdSense.
            </DialogDescription>
          </DialogHeader>

          <div
            role="img"
            aria-label={installed
              ? 'Simulazione di un annuncio a schermo intero nella PWA DEMOS'
              : 'Simulazione di un banner per il sito web DEMOS'}
            className={installed
              ? 'flex min-h-64 flex-col items-center justify-center rounded-xl border border-indigo-200 bg-gradient-to-b from-indigo-50 via-white to-blue-50 p-6 text-center'
              : 'rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-blue-50 p-5 text-center'
            }
          >
            <p className="mb-3 text-[11px] font-semibold tracking-widest text-indigo-700">
              PUBBLICITÀ DIMOSTRATIVA
            </p>
            <p className="text-lg font-bold text-slate-900">
              Il tuo spazio pubblicitario
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {installed
                ? 'Esempio visivo di vignette web nella PWA installata, non di App Open AdMob.'
                : desktop
                  ? 'Esempio visivo di banner AdSense su desktop.'
                  : 'Esempio visivo di banner web nel browser mobile.'}
            </p>
            <p className="mt-4 text-xs font-medium text-slate-600">
              Anteprima · Nessun inserzionista
            </p>
          </div>

          <p className="text-xs text-slate-600">
            Nessuna pubblicità viene scaricata da Internet; nessuna richiesta
            pubblicitaria, tracciamento o impression viene generata.
            Le vere vignette Google AdSense hanno regole proprie e non sono
            garantite esattamente all'apertura della web app.
          </p>
          <Button type="button" className="w-full min-h-11" onClick={() => setOpen(false)}>
            Chiudi anteprima
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
