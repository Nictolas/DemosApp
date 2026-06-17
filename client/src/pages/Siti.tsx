import React, { useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { Redirect } from "wouter";

interface SitiData {
  facebook_url: string;
  twitter_url: string;
  instagram_url: string;
  linkedin_url: string;
  telegram_url: string;
  website_url: string;
  twitch_url: string;
  youtube_url: string;
}

const defaultValues: SitiData = {
  facebook_url: "",
  twitter_url: "",
  instagram_url: "",
  linkedin_url: "",
  telegram_url: "",
  website_url: "",
  twitch_url: "",
  youtube_url: "",
};

export default function Siti() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<SitiData>({ defaultValues });

  // 1. Caricamento dati utente e siti con React Query
  const { data, isLoading } = useQuery({
    queryKey: ['sitiData', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      // Carica i siti specifici dell'utente
      const response = await apiRequest("GET", "/api/users/me");
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }
      const result = await response.json();
      return { 
        siti: {
          facebook_url: result.data.facebook_url || "",
          twitter_url: result.data.twitter_url || "",
          instagram_url: result.data.instagram_url || "",
          linkedin_url: result.data.linkedin_url || "",
          telegram_url: result.data.telegram_url || "",
          website_url: result.data.website_url || "",
          twitch_url: result.data.twitch_url || "",
          youtube_url: result.data.youtube_url || "",
        }
      };
    },
    enabled: !!user,
  });

  // Popola il form quando i dati vengono caricati
  useEffect(() => {
    if (data?.siti) {
      form.reset(data.siti);
    }
  }, [data, form]);

  // 2. Mutazione per salvare i siti
  const saveMutation = useMutation({
    mutationFn: async (values: SitiData) => {
      const response = await apiRequest("PUT", "/api/users/me", {
        facebook_url: values.facebook_url,
        twitter_url: values.twitter_url,
        instagram_url: values.instagram_url,
        linkedin_url: values.linkedin_url,
        telegram_url: values.telegram_url,
        website_url: values.website_url,
        twitch_url: values.twitch_url,
        youtube_url: values.youtube_url,
      });
      if (!response.ok) throw new Error("Impossibile salvare i siti.");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Salvato!", description: "I tuoi siti sono stati aggiornati." });
      queryClient.invalidateQueries({ queryKey: ['sitiData', user?.id] });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  });

  if (isAuthLoading || (user && isLoading)) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  const canEdit = user && ["AD", "A"].includes(user.ruolo || '');

  if (!canEdit) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4 flex items-center justify-center page-with-navbar">
        <Card><CardHeader><CardTitle>Accesso negato</CardTitle><CardDescription>Non hai i permessi per visualizzare questa pagina.</CardDescription></CardHeader></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4 page-with-navbar">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">I Tuoi Siti</CardTitle>
            <CardDescription>Inserisci i link ai tuoi social media e siti web.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
              <div className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div>
                  <label className="block font-medium mb-1">Facebook</label>
                  <Input
                    {...form.register("facebook_url")}
                    placeholder="https://facebook.com/tuousername"
                    disabled={!canEdit || saveMutation.isPending}
                    className="bg-white"
                    type="url"
                  />
                </div>
              </div>

              <div className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div>
                  <label className="block font-medium mb-1">Twitter</label>
                  <Input
                    {...form.register("twitter_url")}
                    placeholder="https://twitter.com/tuousername"
                    disabled={!canEdit || saveMutation.isPending}
                    className="bg-white"
                    type="url"
                  />
                </div>
              </div>

              <div className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div>
                  <label className="block font-medium mb-1">Instagram</label>
                  <Input
                    {...form.register("instagram_url")}
                    placeholder="https://instagram.com/tuousername"
                    disabled={!canEdit || saveMutation.isPending}
                    className="bg-white"
                    type="url"
                  />
                </div>
              </div>

              <div className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div>
                  <label className="block font-medium mb-1">LinkedIn</label>
                  <Input
                    {...form.register("linkedin_url")}
                    placeholder="https://linkedin.com/in/tuousername"
                    disabled={!canEdit || saveMutation.isPending}
                    className="bg-white"
                    type="url"
                  />
                </div>
              </div>

              <div className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div>
                  <label className="block font-medium mb-1">Telegram</label>
                  <Input
                    {...form.register("telegram_url")}
                    placeholder="https://t.me/tuousername"
                    disabled={!canEdit || saveMutation.isPending}
                    className="bg-white"
                    type="url"
                  />
                </div>
              </div>

              <div className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div>
                  <label className="block font-medium mb-1">Sito Web</label>
                  <Input
                    {...form.register("website_url")}
                    placeholder="https://tuosito.com"
                    disabled={!canEdit || saveMutation.isPending}
                    className="bg-white"
                    type="url"
                  />
                </div>
              </div>

              <div className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div>
                  <label className="block font-medium mb-1">Twitch</label>
                  <Input
                    {...form.register("twitch_url")}
                    placeholder="https://twitch.tv/tuousername"
                    disabled={!canEdit || saveMutation.isPending}
                    className="bg-white"
                    type="url"
                  />
                </div>
              </div>

              <div className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div>
                  <label className="block font-medium mb-1">YouTube</label>
                  <Input
                    {...form.register("youtube_url")}
                    placeholder="https://youtube.com/@tuousername"
                    disabled={!canEdit || saveMutation.isPending}
                    className="bg-white"
                    type="url"
                  />
                </div>
              </div>

              <Button type="submit" className="mt-4" disabled={!canEdit || saveMutation.isPending}>
                {saveMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvataggio...</> : "Salva Siti"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
