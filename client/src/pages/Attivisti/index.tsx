import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { UserCheck, ArrowLeft, Users, Heart, MapPin } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { ProposeSubjectButton } from "@/components/ProposeSubjectButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useApprovedSubjectResumeRefresh } from "@/hooks/useApprovedSubjectResumeRefresh";

interface Attivista {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  status: string;
  regione_residenza?: string;
  tipologie_attivismo?: any[];
  supporters_count: number;
  avatar_config?: string;
  facebook_url?: string;
  twitter_url?: string;
  instagram_url?: string;
  linkedin_url?: string;
  telegram_url?: string;
  website_url?: string;
  twitch_url?: string;
  youtube_url?: string;
}

function AttivistiLoading() {
  return (
    <PageContainer className="attivisti-page bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </PageContainer>
  );
}

export default function Attivisti() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [attivisti, setAttivisti] = useState<Attivista[]>([]);
  const [approvedSubjects, setApprovedSubjects] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAttivisti = async () => {
      try {
        setLoading(true);
        const response = await apiRequest("GET", "/api/attivisti");

        if (!response.ok) {
          throw new Error("Errore nel caricamento degli attivisti");
        }

        const data = await response.json();

        if (data.success) {
          setAttivisti(data.data || []);
          setApprovedSubjects(data.approved_subjects || []);
        } else {
          throw new Error(data.error || "Errore nel caricamento");
        }
      } catch (err) {
        console.error("Errore:", err);
        setError(err instanceof Error ? err.message : "Errore sconosciuto");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchAttivisti();
    }
  }, [user]);

  // No extra read on first render. Revalidate only when a suspended page resumes.
  useApprovedSubjectResumeRefresh("attivisti", setApprovedSubjects, !!user && !loading && !error);

  if (isAuthLoading || loading) {
    return <AttivistiLoading />;
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  return (
    <PageContainer className="attivisti-page bg-gray-50">
      <div className="attivisti-page__inner flex h-full min-h-0 flex-col">
        <div className="attivisti-page__scroll flex-1 min-h-0 overflow-y-auto app-page-scroll px-4 py-2">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <Button
                variant="ghost"
                onClick={() => setLocation("/preferiti")}
                className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Torna ai Preferiti
              </Button>

              <div className="flex items-center gap-3 mb-4">
                <Users className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Attivisti</h1>
                  <p className="text-gray-600">Scopri e vota per gli attivisti della comunità</p>
                </div>
                <div className="ml-auto"><ProposeSubjectButton category="attivisti" /></div>
              </div>
            </div>

            {error ? (
              <Card className="w-full">
                <div className="p-8 text-center">
                  <h2 className="text-2xl font-bold text-red-600 mb-4">Errore</h2>
                  <p className="text-gray-600 mb-4">{error}</p>
                  <Button onClick={() => window.location.reload()}>Riprova</Button>
                </div>
              </Card>
            ) : attivisti.length === 0 ? (
              <Card className="w-full">
                <div className="p-8 text-center">
                  <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Nessun attivista trovato</h2>
                  <p className="text-gray-600">Al momento non ci sono attivisti registrati.</p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-2">
                {attivisti.map((attivista) => (
                  <Card key={attivista.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <UserCheck className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">
                              {attivista.nome} {attivista.cognome}
                            </CardTitle>
                            <CardDescription>
                              {attivista.ruolo === "A" ? "Attivista" : "Amministratore"}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="secondary">{attivista.supporters_count} sostenitori</Badge>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Heart className="h-4 w-4 text-red-500" />
                          <span>{attivista.supporters_count} supporter</span>
                        </div>

                        {attivista.regione_residenza && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="h-4 w-4 text-green-500" />
                            <span>{attivista.regione_residenza}</span>
                          </div>
                        )}

                        {attivista.tipologie_attivismo && attivista.tipologie_attivismo.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">Cause:</p>
                            <div className="flex flex-wrap gap-1">
                              {attivista.tipologie_attivismo.map((tipologia, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {tipologia.nome || tipologia}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 flex-wrap">
                          {attivista.facebook_url && (
                            <Button size="sm" variant="outline" className="text-blue-600">
                              Facebook
                            </Button>
                          )}
                          {attivista.twitter_url && (
                            <Button size="sm" variant="outline" className="text-blue-400">
                              Twitter
                            </Button>
                          )}
                          {attivista.instagram_url && (
                            <Button size="sm" variant="outline" className="text-pink-500">
                              Instagram
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {approvedSubjects.length > 0 && (
              <section className="mt-5 space-y-3" aria-label="Attivisti segnalati e approvati">
                <h2 className="text-lg font-semibold">Attivisti segnalati e approvati</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {approvedSubjects.map(subject => (
                    <Card key={subject.id}>
                      <CardHeader className="p-3">
                        <CardTitle className="break-words text-base">{subject.title}</CardTitle>
                        <CardDescription>Soggetto pubblico segnalato e approvato. Non è ancora un profilo DEMOS verificato.</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
