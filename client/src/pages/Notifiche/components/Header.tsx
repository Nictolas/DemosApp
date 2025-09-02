import React from "react";
import { Link } from "wouter";
import { ArrowLeft, Bell } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Bell className="h-8 w-8 text-blue-600" />
          Notifiche
        </h1>
      </div>
      <p className="text-gray-600 text-lg">
        Gestisci le tue notifiche e preferenze
      </p>
    </div>
  );
};
