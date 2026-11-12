import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface EditUserDialogProps {
  userEmail: string;
  userUid: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: () => void;
}

/**
 * La pagina Utenti è di sola lettura. Si mantiene la firma del vecchio dialog
 * per compatibilità, ma nessuna modifica a profili altrui parte dalla UI.
 * Gli interventi amministrativi seguono una procedura separata e autorizzata.
 */
export function EditUserDialog({ open, onOpenChange }: EditUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle>Modifica profilo utente</DialogTitle>
          <DialogDescription>
            La modifica dei profili di altri utenti non è disponibile nell'app.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
