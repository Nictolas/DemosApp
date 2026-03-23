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
    <div className="w-full">
      {/* Desktop 16:9: layout compatto a colonne, tutte le voci visibili */}
      <div className="hidden xl:grid xl:grid-cols-4 gap-4">
        {groupedSections.map(({ category, sections }) => (
          <div key={category} className="rounded-xl border bg-white/70 p-2.5 space-y-2">
            <div className="border-b pb-1.5">
              <h2 className="text-xs font-bold text-gray-900 leading-tight">
                {gestisciCategoryMeta[category].title}
              </h2>
              <p className="text-[10px] text-gray-600 leading-snug">
                {gestisciCategoryMeta[category].description}
              </p>
            </div>
            <div className="space-y-1.5">
              {sections.map((section) => (
                <div key={section.id} className="w-full">
                  <SectionCard section={section} compact />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Tablet/Mobile: layout standard */}
      <div className="xl:hidden space-y-8">
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
    </div>
  );
};
