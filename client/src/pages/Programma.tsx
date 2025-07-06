import React, { useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface ProgrammaData {
  proposta1: string;
  proposta2: string;
  proposta3: string;
  proposta4: string;
  proposta5: string;
}

const defaultValues: ProgrammaData = {
  proposta1: "",
  proposta2: "",
  proposta3: "",
  proposta4: "",
  proposta5: "",
};

export default function Programma() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: userData } = useQuery({
    queryKey: ["/api/users", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const response = await fetch(`/api/users/${encodeURIComponent(user.uid)}`);
      if (!response.ok) throw new Error('Failed to fetch user data');
      return response.json();
    },
    enabled: !!user?.email,
  });

  const canEdit = userData && ["Admin", "Candidato", "Candidato Politico"].includes(userData.ruolo);

  const form = useForm<ProgrammaData>({
    defaultValues,
  });

  // Carica le proposte dal database
  useEffect(() => {
    if (!user?.uid) return;
    const fetchProgramma = async () => {
      const ref = doc(db, "programmi", user.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as ProgrammaData;
        form.reset({
          proposta1: data.proposta1 || "",
          proposta2: data.proposta2 || "",
          proposta3: data.proposta3 || "",
          proposta4: data.proposta4 || "",
          proposta5: data.proposta5 || "",
        });
      }
    };
    fetchProgramma();
    // eslint-disable-next-line
  }, [user?.uid]);

  // Salva le proposte su Firestore
  const onSubmit = async (values: ProgrammaData) => {
    if (!user?.uid) return;
    try {
      await setDoc(doc(db, "programmi", user.uid), {
        userId: user.uid,
        ...values,
      });
      toast({ title: "Salvato!", description: "Il tuo programma è stato aggiornato." });
    } catch (e) {
      toast({ title: "Errore", description: "Impossibile salvare il programma.", variant: "destructive" });
    }
  };

  if (userData && !canEdit) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4 flex items-center justify-center">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Accesso negato</CardTitle>
            <CardDescription>
              Non hai i permessi per visualizzare questa pagina.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              Programma personale
            </CardTitle>
            <CardDescription>
              Inserisci le tue 5 proposte elettorali personali.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              {[1,2,3,4,5].map((n) => (
                <div key={n}>
                  <label className="block font-medium mb-1">Proposta {n}</label>
                  <Input
                    {...form.register(`proposta${n}` as keyof ProgrammaData)}
                    placeholder={`Scrivi la proposta ${n}...`}
                    disabled={!canEdit}
                  />
                </div>
              ))}
              <Button type="submit" className="mt-4" disabled={!canEdit}>
                Salva
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 