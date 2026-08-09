import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface FilterChip {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

interface FilterChipsProps {
  chips: FilterChip[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export function FilterChips({ 
  chips, 
  activeId, 
  onSelect,
  className 
}: FilterChipsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {chips.map((chip) => {
        const isActive = chip.id === activeId;
        return (
          <button
            key={chip.id}
            onClick={() => onSelect(chip.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              "border hover-elevate active-elevate-2",
              isActive 
                ? "bg-primary text-primary-foreground border-primary" 
                : "bg-background border-border"
            )}
            data-testid={`filter-chip-${chip.id}`}
          >
            {chip.icon}
            <span>{chip.label}</span>
            {chip.count !== undefined && (
              <Badge 
                variant={isActive ? "secondary" : "outline"} 
                className="ml-0.5 h-4 min-w-4 px-1 text-[10px]"
              >
                {chip.count}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ 
  value, 
  onChange, 
  placeholder = "Search...",
  className 
}: SearchBarProps) {
  return (
    <div className={cn("relative", className)}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full px-3 py-2 text-sm rounded-lg border bg-background",
          "focus:outline-none focus:ring-2 focus:ring-primary/20",
          "placeholder:text-muted-foreground"
        )}
        data-testid="search-input"
      />
    </div>
  );
}
