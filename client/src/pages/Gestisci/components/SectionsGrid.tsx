import React from "react";
import { SectionCard } from "./SectionCard";
import { gestisciSections } from "../constants/sections";

export const SectionsGrid: React.FC = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {gestisciSections.map((section) => (
        <SectionCard key={section.id} section={section} />
      ))}
    </div>
  );
};
