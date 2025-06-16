import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Redirect } from 'wouter';
import { Loader2 } from 'lucide-react';

// Questo componente riceve il nome dell'opinione come prop
export default function DettaglioOpinione({ opinionField }: { opinionField: string }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && opinionField) {
      const fetchDetails = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/opinioni-dettaglio/${opinionField}`);
          if (!response.ok) {
            throw new Error(`Errore API: ${response.statusText}`);
          }
          const data = await response.json();
          setStats(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Errore sconosciuto");
        } finally {
          setIsLoading(false);
        }
      };
      fetchDetails();
    }
  }, [user, opinionField]);

  if (isAuthLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <div>
      <h1>Dettaglio per: {opinionField.replace(/_/g, ' ')}</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {stats && (
        <pre>{JSON.stringify(stats, null, 2)}</pre>
      )}
    </div>
  );
}