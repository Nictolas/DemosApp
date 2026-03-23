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
      <div className="hidden xl:grid xl:grid-cols-4 gap-3">
        {groupedSections.map(({ category, sections }) => (
          <div key={category} className="rounded-2xl border border-white/60 bg-white/65 backdrop-blur-sm p-2.5 space-y-2 shadow-sm">
            <div className="pb-1 border-b border-slate-200/70">
              <h2 className="text-[11px] font-semibold tracking-wide text-slate-800 uppercase leading-tight">
                {gestisciCategoryMeta[category].title}
              </h2>
              <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-bold text-slate-900">
                {gestisciCategoryMeta[category].title}
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {sections.length} voci
              </span>
            </div>
            <p className="text-sm text-slate-600">{gestisciCategoryMeta[category].description}</p>
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
