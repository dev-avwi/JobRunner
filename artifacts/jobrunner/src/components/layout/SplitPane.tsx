import { ReactNode } from "react";

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  leftWidth?: "1/3" | "1/2" | "2/3";
  gap?: "sm" | "md" | "lg";
  className?: string;
}

const leftWidthClasses = {
  "1/3": "lg:w-1/3",
  "1/2": "lg:w-1/2",
  "2/3": "lg:w-2/3",
};

const rightWidthClasses = {
  "1/3": "lg:w-2/3",
  "1/2": "lg:w-1/2",
  "2/3": "lg:w-1/3",
};

const gapClasses = {
  sm: "gap-3",
  md: "gap-4 md:gap-6",
  lg: "gap-6 md:gap-8",
};

export function SplitPane({ 
  left, 
  right, 
  leftWidth = "1/2",
  gap = "md",
  className = ""
}: SplitPaneProps) {
  return (
    <div className={`flex flex-col lg:flex-row ${gapClasses[gap]} w-full ${className}`}>
      <div className={`w-full ${leftWidthClasses[leftWidth]}`}>
        {left}
      </div>
      <div className={`w-full ${rightWidthClasses[leftWidth]}`}>
        {right}
      </div>
    </div>
  );
}
