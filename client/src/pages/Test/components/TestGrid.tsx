import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart2, Megaphone, FileText, Vote, Users } from "lucide-react";
import { useTestSelezioni } from "../hooks/useTestSelezioni";

interface TestGridProps {
  hasAdvancedAccess: boolean;
  onNavigate: (path: string) => void;
}

const testCategories = [
  {
    id: "europeo",
    icon: BarChart2,
    label: "Europeo",
    color: {
      bg: "#fef3c7",
      icon: "#d97706"
    }
  },
  {
    id: "camera",
    icon: Users,
    label: "Camera",
    color: {
      bg: "#fef3c7",
      icon: "#d97706"
    }
  },
  {
    id: "senato",
    icon: Users,
    label: "Senato",
    color: {
      bg: "#fef3c7",
      icon: "#d97706"
    }
  },
  {
    id: "regione",
    icon: Users,
    label: "Regionale",
    color: {
      bg: "#fef3c7",
      icon: "#d97706"
    }
  },
  {
    id: "comune",
    icon: Users,
    label: "Comunale",
    color: {
      bg: "#fef3c7",
      icon: "#d97706"
    }
  }
];

export const TestGrid: React.FC<TestGridProps> = ({ hasAdvancedAccess, onNavigate }) => {
  const { selezioni, isLoading } = useTestSelezioni();

  const handleCategoryClick = (categoryId: string) => {
    onNavigate(`/candidati/${categoryId}`);
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {testCategories.map((category) => {
        const Icon = category.icon;
        const selezionato = selezioni[category.id];
        
        return (
          <Card
            key={category.id}
            className="p-4 cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105"
            onClick={() => handleCategoryClick(category.id)}
          >
            <div className="flex flex-col items-center text-center space-y-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: category.color.bg }}
              >
                <Icon
                  className="w-6 h-6"
                  style={{ color: category.color.icon }}
                />
              </div>
              
              <div>
                <h3 className="font-semibold text-lg">Candidato {category.label}</h3>
                {selezionato ? (
                  <div className="mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {selezionato.nome} {selezionato.cognome}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Nessun candidato selezionato</p>
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCategoryClick(category.id);
                }}
              >
                {selezionato ? 'Cambia' : 'Scegli'}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
