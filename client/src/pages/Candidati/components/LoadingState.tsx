import React from "react";
import { Loader2 } from "lucide-react";

export const LoadingState: React.FC = () => {
  return (
    <div className="flex items-center justify-center pt-16">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
};
