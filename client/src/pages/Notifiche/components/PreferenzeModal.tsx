import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { PreferenzeNotifiche } from "./PreferenzeNotifiche";

interface PreferenzeModalProps {
  fcmToken: string | null;
  fcmError: Error | null;
  permission: NotificationPermission | null;
  onSwitch: (type: 'inApp' | 'push') => void;
}

export const PreferenzeModal: React.FC<PreferenzeModalProps> = ({
  fcmToken,
  fcmError,
  permission,
  onSwitch
}) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          Preferenze Notifiche
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle>Preferenze Notifiche</DialogTitle>
        </DialogHeader>
        <PreferenzeNotifiche
          fcmToken={fcmToken}
          fcmError={fcmError}
          permission={permission}
          onSwitch={onSwitch}
        />
      </DialogContent>
    </Dialog>
  );
};
