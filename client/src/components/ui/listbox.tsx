import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface ListboxOption {
  value: string;
  label: string;
}

interface ListboxProps {
  options: ListboxOption[] | string[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Altezza massima dell'area scrollabile (es. "max-h-64") */
  maxHeight?: string;
}

export function Listbox({
  options,
  value,
  onValueChange,
  placeholder = "Seleziona...",
  className,
  maxHeight = "max-h-64",
}: ListboxProps) {
  const normalized = React.useMemo(
    () =>
      options.map((opt): ListboxOption =>
        typeof opt === "string" ? { value: opt, label: opt } : opt
      ),
    [options]
  );

  return (
    <div
      className={cn(
        "w-full rounded-md border border-input bg-background overflow-hidden",
        className
      )}
      role="listbox"
      aria-multiselectable={false}
    >
      <ScrollArea className={cn("w-full", maxHeight)}>
        <div className="p-1">
          {normalized.length === 0 ? (
            <div className="py-3 px-3 text-sm text-muted-foreground">
              {placeholder}
            </div>
          ) : (
            normalized.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "w-full text-left rounded-md px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                  onClick={() => onValueChange(opt.value)}
                >
                  {opt.label}
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
