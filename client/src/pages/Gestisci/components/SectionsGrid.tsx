import React from "react";
import { SectionCard } from "./SectionCard";
import { gestisciSections } from "../constants/sections";

export const SectionsGrid: React.FC = () => {
  return (
    <div className="flex flex-col gap-4 w-full">
      {gestisciSections.map((section) => (
        <div key={section.id} className="w-full">
          <SectionCard section={section} />
        </div>
      ))}
    </div>
  );
};
