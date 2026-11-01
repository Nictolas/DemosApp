import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Database, ShieldAlert } from 'lucide-react';

/**
 * The old application-level JSON backup is intentionally retired: it never
 * represented a complete database recovery point. Do not fetch the obsolete
 * Admin backup endpoints or offer actions that would imply recovery readiness.
 */
const BackupDashboard: React.FC = () => (
  <div className="container mx-auto max-w-4xl min-h-screen bg-white px-4 py-8 pt-20">
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        Backup e ripristino
      </h1>
      <p className="text-gray-600">
        Stato delle operazioni di continuità e recupero dei dati.
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-700" aria-hidden="true" />
          Backup applicativo legacy ritirato
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-700">
          Il precedente backup JSON non rappresenta l’intero database e non può
          essere utilizzato per un ripristino affidabile. Le sue operazioni di
          creazione, lettura, verifica e ripristino sono disabilitate.
        </p>
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4" role="status">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <p className="text-sm text-amber-950">
            Ripristino non ancora certificato: sono necessarie prove isolate del
            database, del registro GDPR e della conservazione B2, compresi
            isolamento, integrità, completezza e rollback.
          </p>
        </div>
        <p className="flex items-start gap-2 text-sm text-gray-600">
          <Database className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          Questa pagina non avvia backup e non legge file, credenziali o dati
          degli utenti.
        </p>
      </CardContent>
    </Card>
  </div>
);

export default BackupDashboard;
