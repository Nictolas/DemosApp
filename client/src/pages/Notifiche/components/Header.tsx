import React from "react";
import { Bell } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
        <Bell className="h-8 w-8 text-blue-600" />
        Notifiche
      </h1>
    </div>
  );
};
