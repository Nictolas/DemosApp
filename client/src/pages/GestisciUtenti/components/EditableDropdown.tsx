import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EditableDropdownProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

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
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="empty">{placeholder}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
