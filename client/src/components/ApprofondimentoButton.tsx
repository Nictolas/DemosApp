import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';
import { ApprofondimentoDialog } from '@/pages/GestisciOpinioni/components/ApprofondimentoDialog';

interface ApprofondimentoButtonProps {
  opinionId: string;
  opinionText: string;
  className?: string;
}

export function ApprofondimentoButton({ opinionId, opinionText, className = "" }: ApprofondimentoButtonProps) {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={`h-8 w-8 rounded-full p-0 hover:bg-blue-50 hover:border-blue-300 ${className}`}
        onClick={() => setShowDialog(true)}
        title={`Approfondimento: ${opinionText}`}
      >
        <Info className="h-4 w-4 text-blue-600" />
      </Button>

      <ApprofondimentoDialog
        opinionId={opinionId}
        opinionText={opinionText}
        open={showDialog}
        onOpenChange={setShowDialog}
        readOnly={true}
      />
    </>
  );
}
