import React from "react";
import { SectionCard } from "./SectionCard";
import { gestisciSections } from "../constants/sections";

export const SectionsGrid: React.FC = () => {
  return (
    <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
      {gestisciSections.map((section) => (
        <SectionCard key={section.id} section={section} />
      ))}
    </div>
  );
};
