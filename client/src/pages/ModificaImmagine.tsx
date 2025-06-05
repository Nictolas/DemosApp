import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Save } from "lucide-react";
import { AvatarEditor } from "@/components/AvatarEditor";
import { useToast } from "@/hooks/use-toast";
import { UserInfo } from "@/types";

interface AvatarConfig {
  skinColor: string;
  hairColor: string;
  hairStyle: string;
  mustacheStyle: string;
  mustacheColor: string;
  beardStyle: string;
  beardColor: string;
  noseStyle: string;
  suitColor: string;
  tieColor: string;
}

export default function ModificaImmagine() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig | null>(null);

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!user) return;
      
      try {
        const response = await fetch(`/api/users/${encodeURIComponent(user.email)}`);
        
        if (response.ok) {
          const userData = await response.json();
          setUserInfo(userData as UserInfo);
          
          // Carica la configurazione avatar esistente se presente
          if (userData.avatar_config) {
            try {
              const config = JSON.parse(userData.avatar_config);
              // Converti le configurazioni legacy
              const updatedConfig: AvatarConfig = {
                skinColor: config.skinColor || "#FDBCB4",
                hairColor: config.hairColor || "#8B4513",
                hairStyle: config.hairStyle || "short",
                mustacheStyle: config.mustacheStyle || (config.mustache ? "classic" : "none"),
                mustacheColor: config.mustacheColor || "#2C1810",
                beardStyle: config.beardStyle || "none",
                beardColor: config.beardColor || "#2C1810",
                noseStyle: config.noseStyle || "normal",
                suitColor: config.suitColor || "#2C3E50",
                tieColor: config.tieColor || "#E74C3C"
              };
              setAvatarConfig(updatedConfig);
            } catch (error) {
              console.error("Errore nel parsing della configurazione avatar:", error);
            }
          }
        } else {
          throw new Error("Errore nel caricamento dei dati del profilo");
        }
      } catch (error) {
        console.error("Errore:", error);
        toast({
          title: "Errore",
          description: "Errore nel caricamento dei dati del profilo",
          variant: "destructive",
        });
      } finally {
        setIsLoadingInfo(false);
      }
    };

    if (user) {
      fetchUserInfo();
    }
  }, [user, toast]);

  const handleSaveAvatar = async (config: AvatarConfig) => {
    if (!user) return;
    
    setIsSaving(true);
    
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(user.email)}/avatar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ avatar_config: JSON.stringify(config) }),
      });

      if (response.ok) {
        toast({
          title: "Avatar salvato",
          description: "Il tuo avatar è stato salvato con successo",
          variant: "default",
        });
        
        // Aggiorna la configurazione locale
        setAvatarConfig(config);
        
        // Reindirizza al profilo dopo un breve delay
        setTimeout(() => {
          window.location.href = "/profilo";
        }, 1000);
      } else {
        throw new Error("Errore nel salvataggio dell'avatar");
      }
    } catch (error) {
      console.error("Errore:", error);
      toast({
        title: "Errore",
        description: "Errore nel salvataggio dell'avatar",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  // Redirect to profile if user doesn't have permission
  if (userInfo && !isLoading && !isLoadingInfo) {
    const hasPermission = userInfo.ruolo === 'Politico' || 
                         userInfo.ruolo === 'Candidato' || 
                         userInfo.ruolo === 'Candidato Politico';
    
    if (!hasPermission) {
      return <Redirect to="/profilo" />;
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      {isLoading || isLoadingInfo ? (
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="container mx-auto max-w-7xl">
          <Button 
            variant="ghost" 
            className="mb-4 flex items-center"
            onClick={() => window.location.href = "/profilo"}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Profilo
          </Button>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Modifica la Tua Immagine Avatar
              </CardTitle>
              <CardDescription>
                Personalizza il tuo avatar per rappresentarti al meglio nella piattaforma
              </CardDescription>
            </CardHeader>
          </Card>

          {userInfo && (
            <AvatarEditor 
              onSave={handleSaveAvatar}
              initialConfig={avatarConfig || undefined}
            />
          )}

          {isSaving && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <Card className="p-6">
                <div className="flex items-center space-x-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span>Salvataggio avatar in corso...</span>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}