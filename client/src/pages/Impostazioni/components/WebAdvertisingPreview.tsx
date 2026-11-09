import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Eye } from 'lucide-react';

/**
 * On-demand, first-party visual mock for the web/PWA (including iPhone
 * "Aggiungi a schermata Home"). NOT a Google AdSense/AdMob integration.
 * It never loads an ad network, writes to storage, sets cookies or generates
 * advertising impressions. Keep it out of native Android, whose App Open
 * ads have separate UMP, age and frequency protections.
 */
export function WebAdvertisingPreview() {
  const [open, setOpen] = useState(false);

  // Never offer a web mock in a native build as though it were an AdMob test.
  if (Capacitor.isNativePlatform()) return null;

  return (
    <>
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-5 w-5" aria-hidden="true" />
            Anteprima pubblicità web
          </CardTitle>
          <CardDescription>
            Visualizza un esempio grafico sull'iPhone o sul sito web.
            Non è una pubblicità di Google e non genera guadagni.
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
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm rounded-xl p-5">
          <DialogHeader>
            <DialogTitle>Anteprima pubblicitaria</DialogTitle>
            <DialogDescription>
              Simulazione locale: non è un annuncio Google AdSense.
            </DialogDescription>
          </DialogHeader>
          <div
            role="img"
            aria-label="Simulazione di uno spazio pubblicitario per la web app DEMOS"
            className="rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-blue-50 p-5 text-center"
          >
            <p className="mb-3 text-[11px] font-semibold tracking-widest text-indigo-700">
              PUBBLICITÀ DIMOSTRATIVA
            </p>
            <p className="text-lg font-bold text-slate-900">
              Il tuo spazio pubblicitario
            </p>
            <p className="mt-2 text-sm text-slate-700">
              Qui potrebbe comparire un banner nella versione web di DEMOS.
            </p>
            <p className="mt-4 text-xs font-medium text-slate-600">
              Anteprima · Nessun inserzionista
            </p>
          </div>
          <p className="text-xs text-slate-600">
            Nessuna pubblicità viene scaricata da Internet; nessuna richiesta
            pubblicitaria, tracciamento o impression viene generata.
            I veri annunci web richiederanno una separata integrazione e
            approvazione AdSense, oltre alle verifiche privacy.
          </p>
          <Button type="button" className="w-full min-h-11" onClick={() => setOpen(false)}>
            Chiudi anteprima
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
