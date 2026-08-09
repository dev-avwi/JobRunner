import { ReactNode } from "react";

interface SectionGridProps {
  children: ReactNode;
  columns?: "1" | "2" | "3" | "4";
  gap?: "sm" | "md" | "lg";
  className?: string;
}

const columnClasses = {
  "1": "grid-cols-1",
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  "4": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

const gapClasses = {
  sm: "gap-3",
  md: "gap-4 md:gap-6",
  lg: "gap-6 md:gap-8",
};

export function SectionGrid({ 
  children, 
  columns = "4", 
  gap = "md",
  className = ""
}: SectionGridProps) {
  return (
    <div className={`grid ${columnClasses[columns]} ${gapClasses[gap]} w-full ${className}`}>
      {children}
    </div>
  );
}
