import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tradeTypes, getTradeInfo, TradeType } from "@/data/tradeTypes";
import { Check, Briefcase, Wrench, Zap, Hammer, Wind, Paintbrush, Flower2, Home, Grid3X3, Square, SprayCan, HelpCircle } from "lucide-react";

const tradeIcons: Record<TradeType | string, typeof Wrench> = {
  plumbing: Wrench,
  electrical: Zap,
  carpentry: Hammer,
  hvac: Wind,
  painting: Paintbrush,
  landscaping: Flower2,
  roofing: Home,
  tiling: Grid3X3,
  concreting: Square,
  cleaning: SprayCan,
  other: HelpCircle
};

const getTradeIcon = (tradeType: string) => {
  return tradeIcons[tradeType] || HelpCircle;
};

interface TradePersonalizationProps {
  onTradeSelect?: (tradeType: string) => void;
  selectedTrade?: string;
  showSettings?: boolean;
}

export default function TradePersonalization({
  onTradeSelect,
  selectedTrade,
  showSettings = true
}: TradePersonalizationProps) {
  const [currentTrade, setCurrentTrade] = useState<string | null>(
    () => selectedTrade || localStorage.getItem('jobrunner-trade-type') || null
  );

  const handleTradeSelect = (tradeType: string) => {
    setCurrentTrade(tradeType);
    if (onTradeSelect) {
      onTradeSelect(tradeType);
    }
  };

  const currentTradeInfo = currentTrade ? getTradeInfo(currentTrade) : null;

  if (currentTrade && !showSettings) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-sm">
          {currentTradeInfo?.name}
        </Badge>
      </div>
    );
  }

  return (
    <Card data-testid="trade-personalization">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          What's Your Trade?
          {currentTrade && (
            <Badge variant="secondary">
              {currentTradeInfo?.name}
            </Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Select your trade to customize job templates and features. Your brand colors are set separately in the next step.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(tradeTypes).map(([key, trade]) => {
            const IconComponent = getTradeIcon(key);
            const isSelected = currentTrade === key;
            
            return (
              <div
                key={key}
                className={`
                  relative p-4 rounded-lg border cursor-pointer transition-all hover-elevate
                  ${isSelected 
                    ? 'border-2 border-primary shadow-md bg-accent/30' 
                    : 'border hover:border-muted-foreground'
                  }
                `}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleTradeSelect(key);
                }}
                data-testid={`trade-option-${key}`}
              >
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center bg-primary text-primary-foreground text-sm">
                    <Check className="h-4 w-4" />
                  </div>
                )}
                
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? 'bg-primary/10' : 'bg-muted'}`}>
                    <IconComponent className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{trade.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {trade.description}
                    </p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs">
                        {trade.typicalJobs[0]} & more
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {currentTrade && (
          <div className="mt-4 p-4 rounded-lg border bg-accent/20">
            <p className="text-sm text-center flex items-center justify-center gap-2 text-muted-foreground">
              <Check className="h-4 w-4 text-primary" />
              {currentTradeInfo?.name} selected - customize your brand colors in the next step
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
