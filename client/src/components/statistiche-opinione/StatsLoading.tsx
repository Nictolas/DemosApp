import React from "react";
import { Loader2 } from "lucide-react";
import { StatsLoadingProps } from "./types";

export function StatsLoading({ isLoading }: StatsLoadingProps) {
  if (!isLoading) {
    return null;
  }

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
