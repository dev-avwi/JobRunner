import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface KPIBoxProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  onClick?: () => void;
}

export default function KPIBox({ title, value, icon: Icon, trend, onClick }: KPIBoxProps) {
  return (
    <Card 
      className={`hover-elevate active-elevate-2 ${onClick ? 'cursor-pointer' : ''}`}
      style={{ borderRadius: '14px' }}
      onClick={onClick}
      data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ 
                backgroundColor: 'hsl(var(--trade) / 0.1)',
              }}
            >
              <Icon 
                className="h-5 w-5" 
                style={{ color: 'hsl(var(--trade))' }}
              />
            </div>
            {trend && (
              <div className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                trend.value > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {trend.value > 0 ? '↗' : '↘'} {Math.abs(trend.value)}%
              </div>
            )}
          </div>
          
          <div className="space-y-0.5">
            <div className="text-xl font-bold tracking-tight tabular-nums">
              {value}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
