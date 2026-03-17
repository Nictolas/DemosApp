import React from "react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center items-center gap-3 mt-8">
      <Button 
        size="sm" 
        variant="outline" 
        onClick={() => onPageChange(Math.max(1, currentPage - 1))} 
        disabled={currentPage === 1}
        className="px-4 py-2"
      >
        ← Precedente
      </Button>
      
      <div className="flex items-center space-x-2">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
          <Button
            key={page}
            size="sm"
            variant={currentPage === page ? "default" : "outline"}
            onClick={() => onPageChange(page)}
            className="w-10 h-10"
          >
            {page}
          </Button>
        ))}
      </div>
      
      <Button 
        size="sm" 
        variant="outline" 
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} 
        disabled={currentPage === totalPages}
        className="px-4 py-2"
      >
        Successiva →
      </Button>
    </div>
  );
};
