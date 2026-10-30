import React from 'react';
import { Loader2 } from 'lucide-react';
import { Opinione } from '../types';

interface ListaOpinioniProps { opinioni: Opinione[]; isLoading: boolean; isError: boolean; }

// Admin can review the official catalog, never mutate it in-app. A PR and a
// backend release are required to publish any official question change.
export const ListaOpinioni: React.FC<ListaOpinioniProps> = ({opinioni,isLoading,isError}) => {
  if(isLoading) return <div className="py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if(isError) return <p className="py-6 text-red-600">Impossibile caricare le Opinioni ufficiali.</p>;
  if(!opinioni.length) return <p className="py-6 text-muted-foreground">Nessuna Opinione ufficiale.</p>;
  const ordered=[...opinioni].sort((a,b)=>a.text.localeCompare(b.text,'it'));
  return <div className="space-y-2" aria-label="Catalogo ufficiale delle Opinioni in sola lettura">
    <p className="text-sm text-muted-foreground">{ordered.length} opinioni ufficiali. Per aggiungere, correggere o rimuovere una domanda serve una modifica al codice con verifica e release.</p>
    {ordered.map(op=><div key={op.id} className="border rounded-lg px-4 py-3 bg-white shadow-sm">
      <div className="font-medium">{op.text}</div>
      <div className="text-xs text-muted-foreground break-all">ID: {op.id}</div>
      <div className="text-xs text-muted-foreground">Livelli: {(op.gradi_opinione||[]).join(', ')}</div>
    </div>)}
  </div>;
};
