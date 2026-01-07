import React from "react";
import { SectionCard } from "./SectionCard";
import { gestisciSections } from "../constants/sections";

export const SectionsGrid: React.FC = () => {
  return (
    <div className="flex flex-row gap-3 flex-1 min-h-0 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
      {gestisciSections.map((section) => (
        <div key={section.id} className="flex-shrink-0 w-64 h-full">
          <SectionCard section={section} />
        </div>
      ))}
    </div>
  );
};
