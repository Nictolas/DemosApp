import React from "react";
import { SectionCard } from "./SectionCard";
import { gestisciSections, gestisciCategoryMeta, gestisciCategoryOrder } from "../constants/sections";

export const SectionsGrid: React.FC = () => {
  const groupedSections = gestisciCategoryOrder
    .map((category) => ({
      category,
      sections: gestisciSections.filter((s) => s.category === category),
    }))
    .filter((group) => group.sections.length > 0);

  return (
    <div className="w-full space-y-8">
      {groupedSections.map(({ category, sections }) => (
        <div key={category} className="space-y-3">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-gray-900">
              {gestisciCategoryMeta[category].title}
            </h2>
            <p className="text-sm text-gray-600">
              {gestisciCategoryMeta[category].description}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 w-full">
            {sections.map((section) => (
              <div key={section.id} className="w-full">
                <SectionCard section={section} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
