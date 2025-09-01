import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface NavigationButtonsProps {
  onPrevious: () => void;
  onNext: () => void;
  isSubmitting?: boolean;
  canProceed?: boolean;
  previousText?: string;
  nextText?: string;
}

export const NavigationButtons: React.FC<NavigationButtonsProps> = ({
  onPrevious,
  onNext,
  isSubmitting = false,
  canProceed = true,
  previousText = "Indietro",
  nextText = "Avanti"
}) => {
  return (
    <div className="flex justify-between items-center pt-6">
      <Button
        type="button"
        variant="outline"
        onClick={onPrevious}
        disabled={isSubmitting}
        className="flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        {previousText}
      </Button>

      <Button
        type="button"
        onClick={onNext}
        disabled={!canProceed || isSubmitting}
        className="flex items-center gap-2"
      >
        {nextText}
        {!isSubmitting && <ArrowRight className="w-4 h-4" />}
        {isSubmitting && (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
      </Button>
    </div>
  );
};
