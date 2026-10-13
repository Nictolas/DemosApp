import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield, Database, Mail, Bell, Lock } from "lucide-react";
import { useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

interface PrivacySetting {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  category: string;
}

const privacySettings: PrivacySetting[] = [
  {
    id: "email_notifications",
    title: "Notifiche Email",
    description: "Ricevi notifiche via email per aggiornamenti importanti",
    icon: <Mail className="h-5 w-5" />,
    enabled: true,
    category: "Comunicazioni"
  },
  {
    id: "push_notifications",
    title: "Notifiche Push",
    description: "Ricevi notifiche push sul dispositivo",
    icon: <Bell className="h-5 w-5" />,
    enabled: true,
    category: "Comunicazioni"
  },
  {
    id: "data_analytics",
    title: "Analisi Dati",
    description: "Consenti l'analisi dei tuoi dati per migliorare il servizio",
    icon: <Database className="h-5 w-5" />,
    enabled: true,
    category: "Analisi"
  }
];

const categories = ["Comunicazioni", "Analisi"];

export default function GestionePrivacy() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState<PrivacySetting[]>(privacySettings);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    const loadUserPrivacySettings = async () => {
      try {
        const response = await apiRequest("GET", "/api/user/privacy-settings");
        const userSettings = response.data?.data || {};
        if (!cancelled) {
          setSettings((prev) => prev.map((setting) => ({
            ...setting,
            enabled: userSettings[setting.id] ?? setting.enabled,
          })));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Errore nel caricamento delle impostazioni privacy");
        }
      }
    };

    void loadUserPrivacySettings();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleSettingChange = async (settingId: string, enabled: boolean) => {
    setSettings((prev) => prev.map((setting) =>
      setting.id === settingId ? { ...setting, enabled } : setting
    ));

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiRequest("PUT", "/api/user/privacy-settings", {
        [settingId]: enabled,
      });
      setSuccess("Impostazioni aggiornate con successo");
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il salvataggio");
      setSettings((prev) => prev.map((setting) =>
        setting.id === settingId ? { ...setting, enabled: !enabled } : setting
      ));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const settingsToSave = settings.reduce((acc, setting) => {
        acc[setting.id] = setting.enabled;
        return acc;
      }, {} as Record<string, boolean>);

      await apiRequest("PUT", "/api/user/privacy-settings", settingsToSave);
      setSuccess("Tutte le impostazioni sono state salvate con successo");
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il salvataggio");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Accesso Richiesto</CardTitle>
            <CardDescription>Devi effettuare il login per accedere alle impostazioni privacy.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation("/auth")}>Vai al Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white page-with-navbar">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button variant="ghost" onClick={() => setLocation("/impostazioni")} className="mb-4">
            ← Torna alle Impostazioni
          </Button>

          <Card className="border-0 shadow-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white">
            <CardHeader className="text-center py-6">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold mb-2">Gestione Privacy</CardTitle>
              <CardDescription className="text-purple-100 text-lg">
                Controlla come vengono utilizzati i tuoi dati personali
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {success && (
          <Alert className="mb-6 border-green-200 bg-white">
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6 bg-white">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Alert className="mb-6 bg-white">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            La visibilità è determinata dal ruolo: i profili e le opinioni dei cittadini restano privati; i profili e le posizioni di politici e candidati sono pubblici per consentire il confronto. Qui puoi gestire le altre preferenze privacy e di comunicazione.
          </AlertDescription>
        </Alert>

        {categories.map((category) => {
          const categorySettings = settings.filter((setting) => setting.category === category);
          return (
            <Card key={category} className="mb-6 bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  {category}
                </CardTitle>
                <CardDescription>Impostazioni relative alla categoria {category.toLowerCase()}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {categorySettings.map((setting) => (
                  <div key={setting.id} className="flex items-center justify-between p-4 border rounded-lg bg-white">
                    <div className="flex items-center gap-3 flex-1">
                      {setting.icon}
                      <div>
                        <Label htmlFor={setting.id} className="text-base font-medium">{setting.title}</Label>
                        <p className="text-sm text-muted-foreground">{setting.description}</p>
                      </div>
                    </div>
                    <Switch
                      id={setting.id}
                      checked={setting.enabled}
                      onCheckedChange={(checked) => handleSettingChange(setting.id, checked)}
                      disabled={isSaving}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}

        <Card className="mb-6 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Riepilogo Utilizzo Dati
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{settings.filter((s) => s.enabled).length}</div>
                <div className="text-sm text-muted-foreground">Impostazioni Attive</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{settings.filter((s) => s.category === "Analisi" && s.enabled).length}</div>
                <div className="text-sm text-muted-foreground">Preferenze Analisi Attive</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{settings.filter((s) => s.category === "Comunicazioni" && s.enabled).length}</div>
                <div className="text-sm text-muted-foreground">Notifiche Attive</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={() => setLocation("/impostazioni")} disabled={isSaving}>Annulla</Button>
          <Button onClick={handleSaveAll} disabled={isSaving}>
            {isSaving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvataggio...</>
            ) : (
              "Salva Tutte le Impostazioni"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
