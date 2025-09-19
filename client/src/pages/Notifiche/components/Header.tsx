import React from "react";
import { Bell } from "lucide-react";
import { PreferenzeModal } from "./PreferenzeModal";

interface HeaderProps {
  fcmToken: string | null;
  fcmError: Error | null;
  permission: NotificationPermission | null;
  onSwitch: (type: 'inApp' | 'push') => void;
}

export const Header: React.FC<HeaderProps> = ({
  fcmToken,
  fcmError,
  permission,
  onSwitch
}) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Bell className="h-8 w-8 text-blue-600" />
          Notifiche
        </h1>
        <PreferenzeModal
          fcmToken={fcmToken}
          fcmError={fcmError}
          permission={permission}
          onSwitch={onSwitch}
        />
      </div>
    </div>
  );
};
