import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AvatarEditor } from "@/components/AvatarEditor";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { GraziaAvatarConfig } from "../types";

// Stesso editor parametrico già utilizzato dai profili e dal governo.
// Gli avatar di Grazia non sono collegati ad account utente.
const defaultConfig: GraziaAvatarConfig = {
  skinColor: "#FDBCB4", hairColor: "#8B4513", hairStyle: "short",
  mustacheStyle: "none", mustacheColor: "#2C1810",
  beardStyle: "none", beardColor: "#2C1810", noseStyle: "normal",
  suitColor: "#2C3E50", tieColor: "#E74C3C",
  glassesStyle: "none", glassesColor: "#333333"
};

interface Props {
  nome: string;
  avatarConfig?: GraziaAvatarConfig | null;
  onClose: () => void;
}

export function GraziaAvatarDialog({ nome, avatarConfig, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (config: GraziaAvatarConfig) => {
      const response = await apiRequest("PUT", "/api/grazia/avatar", {
        nome, avatar_config: config
      });
      if (!response?.ok || response?.data?.success === false) {
        throw new Error(response?.data?.error || "Salvataggio non riuscito");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["graziaData"] });
      toast({ title: "Avatar aggiornato" });
      onClose();
    },
    onError: () => {
      toast({ title: "Impossibile salvare l'avatar", variant: "destructive" });
    }
  });

  return (
    <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Modifica avatar - {nome}</DialogTitle>
          <DialogDescription>Personalizza l'avatar di {nome}.</DialogDescription>
        </DialogHeader>
        <AvatarEditor
          initialConfig={avatarConfig || defaultConfig}
          isSaving={mutation.isPending}
          onSave={config => mutation.mutate(config)}
        />
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>Annulla</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
