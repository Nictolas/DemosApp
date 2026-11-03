import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Bell } from "lucide-react";
import { NotificheData } from "../types";
import { NotificaItem } from "./NotificaItem";

interface ListaNotificheProps {
  data: NotificheData | undefined;
  isLoading: boolean;
  error: any;
  deleteSegnalazioneMutation: any;
  reazioniMap?: Record<string, { likes: number; dislikes: number }>;
  userReazioniMap?: Record<string, string | null>;
}

export const ListaNotifiche: React.FC<ListaNotificheProps> = ({
  data,
  isLoading,
  error,
  deleteSegnalazioneMutation,
  reazioniMap,
  userReazioniMap,
}) => {
  // Keep each verified MP's current last vote prominent above generic
  // announcements. Never render a synthetic ballot just to fill an empty slot.
  const finalParliament = (data?.notifiche || []).filter(n =>
    n.tipo_notifica === 'voto_parlamento' && !!n.openpolis_id
  );
  const otherNotices = (data?.notifiche || []).filter(n =>
    n.tipo_notifica !== 'voto_parlamento' || !n.openpolis_id
  );
  const renderItem = (notifica: NonNullable<NotificheData['notifiche']>[number]) => (
    <NotificaItem
      key={notifica.id}
      notifica={notifica}
      deleteSegnalazioneMutation={deleteSegnalazioneMutation}
      initialReazioni={reazioniMap?.[notifica.id]}
      initialUserReaction={userReazioniMap?.[notifica.id] ?? undefined}
    />
  );

  return (
    <section className="mx-auto w-full max-w-3xl" aria-label="Notifiche ricevute">
      {isLoading ? (
        <div className="flex items-center justify-center py-12" role="status">
          <Loader2 className="h-7 w-7 animate-spin text-blue-600" aria-hidden="true" />
          <span className="sr-only">Caricamento notifiche</span>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Errore nel caricamento delle notifiche: {error.message}
          </AlertDescription>
        </Alert>
      ) : !data?.notifiche || data.notifiche.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-slate-500">
          <Bell className="mx-auto mb-3 h-9 w-9 text-slate-300" aria-hidden="true" />
          <p className="font-semibold text-slate-700">Nessuna notifica disponibile</p>
          <p className="mt-1 text-sm">Le tue notifiche appariranno qui</p>
        </div>
      ) : (
        <div className="space-y-5">
          {finalParliament.length > 0 && (
            <section aria-label="Ultime votazioni dei tuoi rappresentanti" className="space-y-3">
              <h2 className="px-1 text-sm font-semibold text-slate-700">
                Le votazioni dei tuoi rappresentanti
              </h2>
              {finalParliament.map(renderItem)}
            </section>
          )}
          {otherNotices.length > 0 && (
            <section aria-label="Altre notifiche" className="space-y-3">
              {finalParliament.length > 0 && (
                <h2 className="px-1 text-sm font-semibold text-slate-700">Altre notifiche</h2>
              )}
              {otherNotices.map(renderItem)}
            </section>
          )}
        </div>
      )}
    </section>
  );
};
