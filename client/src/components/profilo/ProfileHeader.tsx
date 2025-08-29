import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ProfileHeaderProps } from "./types";
import { getBackButtonText } from "./profileUtils";

export function ProfileHeader({ fromGestisciUtenti, userId, onBack }: ProfileHeaderProps) {
  return (
    <Button 
      variant="ghost" 
      className="mb-4 flex items-center"
      onClick={onBack}
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      {getBackButtonText(fromGestisciUtenti, userId)}
    </Button>
  );
}
