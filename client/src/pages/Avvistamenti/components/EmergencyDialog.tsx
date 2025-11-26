import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";

interface EmergencyNumber {
  number: string;
  label: string;
  description?: string;
}

interface EmergencyCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  numbers: EmergencyNumber[];
}

interface EmergencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: EmergencyCategory;
}

export const EmergencyDialog: React.FC<EmergencyDialogProps> = ({
  open,
  onOpenChange,
  category,
}) => {
  const handleCall = (number: string) => {
    window.location.href = `tel:${number}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <span className="text-3xl">{category.icon}</span>
            <span>{category.title}</span>
          </DialogTitle>
          <DialogDescription className="text-base pt-2">
            {category.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          {category.numbers.map((emergencyNumber, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Button
                onClick={() => handleCall(emergencyNumber.number)}
                className="w-full h-14 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-3"
              >
                <Phone className="h-5 w-5" />
                <span>{emergencyNumber.label}</span>
              </Button>
              {emergencyNumber.description && (
                <p className="text-sm text-gray-600 text-center">
                  {emergencyNumber.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

