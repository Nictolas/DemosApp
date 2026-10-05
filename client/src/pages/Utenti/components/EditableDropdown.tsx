import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EditableDropdownProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

// Mappa dei colori per ogni opzione
const getOptionColors = (option: string) => {
  switch (option) {
    case 'empty':
      return 'bg-white text-black border-gray-300';
    case 'E':
      return 'bg-blue-600 text-yellow-300 border-blue-700';
    case 'N':
      return 'bg-amber-800 text-white border-amber-900';
    case 'C':
      return 'bg-red-600 text-white border-red-700';
    case 'S':
      return 'bg-green-600 text-white border-green-700';
    case 'R':
      return 'bg-orange-500 text-black border-orange-600';
    case 'CO':
      return 'bg-yellow-400 text-black border-yellow-500';
    default:
      return 'bg-white text-black border-gray-300';
  }
};

export const EditableDropdown: React.FC<EditableDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = "Seleziona...",
  className = ""
}) => {
  return (
    <Select value={value || "empty"} onValueChange={(newValue) => onChange(newValue === "empty" ? null : newValue)}>
      <SelectTrigger className={`w-full ${className}`}>
        <SelectValue placeholder={placeholder}>
          {value && (
            <span className={`px-2 py-1 rounded-sm text-xs font-medium border ${getOptionColors(value)}`}>
              {value}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="empty">
          <span className={`px-2 py-1 rounded-sm text-xs font-medium border ${getOptionColors('empty')}`}>
            {placeholder}
          </span>
        </SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            <span className={`px-2 py-1 rounded-sm text-xs font-medium border ${getOptionColors(option)}`}>
              {option}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
