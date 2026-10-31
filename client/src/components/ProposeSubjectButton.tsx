import { Plus } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { getProposalCategory, type ProposalCategory } from "@/config/subjectProposalCategories";

/**
 * Shared + in the five source pages. No fetch on render or on click:
 * navigates to a single form with the correct category preselected.
 */
export function ProposeSubjectButton({ category }: { category: ProposalCategory }) {
  const [, navigate] = useLocation();
  const label = getProposalCategory(category).label;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => navigate("/proponi-soggetto?categoria=" + category)}
      aria-label={"Proponi: " + label}
      title={"Proponi: " + label}
      className="h-10 w-10 shrink-0 rounded-full border-primary/30 bg-white text-primary shadow-sm"
    >
      <Plus className="h-5 w-5" aria-hidden="true" />
    </Button>
  );
}
